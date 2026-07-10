import { useEffect, useRef } from 'react'
import { subscribeToChantier } from '@/lib/supabase'
import { useProductionStore } from '@/store/productionStore'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

/**
 * Souscription Supabase Realtime + polling de secours.
 *
 * Le realtime propage les changements instantanément.
 * Le polling (30 s) garantit la fraîcheur si le realtime est
 * indisponible ou si la table n'est pas encore dans la publication.
 */
export function useRealtime(chantierId: string | null) {
  const { updateTaskLocal, loadAllTasks } = useProductionStore()
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!chantierId) return

    // ── Realtime ─────────────────────────────────────────────
    const channel = subscribeToChantier(chantierId, (payload: unknown) => {
      const p = payload as RealtimePostgresChangesPayload<Record<string, unknown>>

      if (p.table === 'tasks') {
        if (p.eventType === 'UPDATE' || p.eventType === 'INSERT') {
          const record = p.new as Record<string, unknown>
          if (record?.id) {
            updateTaskLocal(record.id as string, record as Parameters<typeof updateTaskLocal>[1])
          }
        }
        // DELETE → rechargement complet pour éviter des fantômes
        if (p.eventType === 'DELETE') {
          loadAllTasks(chantierId)
        }
      }
    })

    // ── Polling de secours toutes les 30 s ───────────────────
    // Garantit la fraîcheur si le realtime Supabase n'est pas activé
    // sur la table ou si la connexion websocket est coupée.
    pollRef.current = setInterval(() => {
      loadAllTasks(chantierId)
    }, 30_000)

    return () => {
      channel.unsubscribe()
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [chantierId, updateTaskLocal, loadAllTasks])
}
