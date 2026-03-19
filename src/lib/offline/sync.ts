import { db, getPendingSyncItems, markSyncItemDone, clearSyncedItems } from './db'
import { supabase } from '@/lib/supabase'

// ── Sync orchestrator ───────────────────────────────────────

let isSyncing = false

export async function syncOfflineQueue(): Promise<{ synced: number; errors: number }> {
  if (isSyncing) return { synced: 0, errors: 0 }
  isSyncing = true

  let synced = 0
  let errors = 0

  try {
    const pending = await getPendingSyncItems()
    if (pending.length === 0) {
      isSyncing = false
      return { synced: 0, errors: 0 }
    }

    for (const item of pending) {
      try {
        let success = false

        if (item.operation === 'insert') {
          const { error } = await supabase.from(item.table_name).upsert(item.payload)
          success = !error
        } else if (item.operation === 'update' && item.record_id) {
          const { error } = await supabase
            .from(item.table_name)
            .update(item.payload)
            .eq('id', item.record_id)
          success = !error
        } else if (item.operation === 'delete' && item.record_id) {
          const { error } = await supabase
            .from(item.table_name)
            .delete()
            .eq('id', item.record_id)
          success = !error
        }

        if (success && item.localId !== undefined) {
          await markSyncItemDone(item.localId)
          synced++
        } else {
          errors++
          // Incrémenter le retry count
          if (item.localId !== undefined) {
            await db.sync_queue.update(item.localId, {
              retry_count: item.retry_count + 1
            })
          }
        }
      } catch {
        errors++
      }
    }

    await clearSyncedItems()
  } finally {
    isSyncing = false
  }

  return { synced, errors }
}

// ── Conflit resolution ──────────────────────────────────────
// Règle : Last-Write-Wins sur statuts simples
// Exception : status=done sur serveur + status=blocked en local → garder blocked

export async function resolveTaskConflict(
  serverId: string,
  serverStatus: string,
  localStatus: string
): Promise<string> {
  if (serverStatus === 'done' && localStatus === 'blocked') {
    // Priorité au blocage local — le monteur sait ce qui se passe
    return 'blocked'
  }
  // Dans tous les autres cas, le serveur gagne
  return serverStatus
}

// ── Background sync (Service Worker message) ───────────────

export function registerBackgroundSync(): void {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then(reg => {
      // @ts-expect-error SyncManager types may not be complete
      reg.sync.register('nc-offline-sync').catch(() => {
        // Fallback : sync immédiate si background sync pas dispo
        syncOfflineQueue()
      })
    })
  }
}

// ── Network listener ────────────────────────────────────────

export function setupNetworkListener(onOnline: () => void, onOffline: () => void): () => void {
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  return () => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
  }
}
