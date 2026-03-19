import { useEffect } from 'react'
import { subscribeToChantier } from '@/lib/supabase'
import { useProductionStore } from '@/store/productionStore'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

export function useRealtime(chantierId: string | null) {
  const { updateTaskLocal } = useProductionStore()

  useEffect(() => {
    if (!chantierId) return

    const channel = subscribeToChantier(chantierId, (payload: unknown) => {
      const p = payload as RealtimePostgresChangesPayload<Record<string, unknown>>
      if (p.table === 'tasks' && (p.eventType === 'UPDATE' || p.eventType === 'INSERT')) {
        const record = p.new as Record<string, unknown>
        if (record && record.id) {
          updateTaskLocal(record.id as string, record as Parameters<typeof updateTaskLocal>[1])
        }
      }
    })

    return () => {
      channel.unsubscribe()
    }
  }, [chantierId, updateTaskLocal])
}
