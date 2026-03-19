import { useEffect } from 'react'
import { useUiStore } from '@/store/uiStore'
import { setupNetworkListener } from '@/lib/offline/sync'

export function useOffline() {
  const { isOnline, pendingSyncCount, isSyncing, setOnline, refreshSyncCount, triggerSync } = useUiStore()

  useEffect(() => {
    refreshSyncCount()
    const cleanup = setupNetworkListener(
      () => { setOnline(true) },
      () => { setOnline(false) }
    )
    // Refresh sync count toutes les 30 secondes
    const interval = setInterval(refreshSyncCount, 30000)
    return () => {
      cleanup()
      clearInterval(interval)
    }
  }, [setOnline, refreshSyncCount])

  return { isOnline, pendingSyncCount, isSyncing, triggerSync }
}
