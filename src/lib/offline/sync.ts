import {
  db, getPendingSyncItems, markSyncItemDone, clearSyncedItems,
  getPendingPhotos, deletePhotoOffline
} from './db'
import { supabase, uploadPhotoBlob, savePhoto } from '@/lib/supabase'

// ── Sync orchestrator ───────────────────────────────────────

let isSyncing = false

/** Au-delà, l'action est abandonnée (et signalée) au lieu de bloquer la file à vie */
const MAX_RETRIES = 8

export interface SyncResult {
  synced: number
  errors: number
  /** Actions définitivement abandonnées après MAX_RETRIES échecs */
  abandoned: number
}

export async function syncOfflineQueue(): Promise<SyncResult> {
  if (isSyncing) return { synced: 0, errors: 0, abandoned: 0 }
  isSyncing = true

  let synced = 0
  let errors = 0
  let abandoned = 0

  try {
    const pending = await getPendingSyncItems()

    for (const item of pending) {
      // Plafond de retries : un item invalide (ex: tâche supprimée
      // côté serveur) ne doit pas bloquer le compteur pour toujours
      if (item.retry_count >= MAX_RETRIES) {
        if (item.localId !== undefined) await markSyncItemDone(item.localId)
        abandoned++
        continue
      }

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
        } else if (item.operation === 'increment' && item.record_id) {
          // Delta de quantité → RPC atomique (s'additionne côté serveur)
          const { error } = await supabase.rpc('increment_qte_realisee', {
            p_task_id: item.record_id,
            p_delta: (item.payload as { delta: number }).delta,
          })
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

    // ── Photos en attente ───────────────────────────────────
    const pendingPhotos = await getPendingPhotos()
    for (const p of pendingPhotos) {
      if (p.retry_count >= MAX_RETRIES) {
        if (p.localId !== undefined) await deletePhotoOffline(p.localId)
        abandoned++
        continue
      }
      try {
        const url = await uploadPhotoBlob(p.blob, p.path, p.contentType)
        await savePhoto({
          task_id: p.task_id ?? undefined,
          nc_id: p.nc_id ?? undefined,
          zone_takt_id: p.zone_takt_id,
          url,
          type: p.type as never,
          auteur_role: (p.auteur_role ?? null) as never,
          legende: null,
        })
        if (p.localId !== undefined) await deletePhotoOffline(p.localId)
        synced++
      } catch {
        errors++
        if (p.localId !== undefined) {
          await db.photos_offline.update(p.localId, { retry_count: p.retry_count + 1 })
        }
      }
    }

    await clearSyncedItems()
  } finally {
    isSyncing = false
  }

  return { synced, errors, abandoned }
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
