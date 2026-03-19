import { RouterProvider } from 'react-router-dom'
import { useEffect } from 'react'
import { router } from './router'
import { useUiStore } from '@/store/uiStore'
import { setupNetworkListener } from '@/lib/offline/sync'
import NotificationStack from '@/components/ui/NotificationStack'

export default function App() {
  const { setOnline, refreshSyncCount } = useUiStore()

  useEffect(() => {
    // Initialiser l'état réseau
    setOnline(navigator.onLine)
    refreshSyncCount()

    // Écouter les changements réseau
    const cleanup = setupNetworkListener(
      () => {
        setOnline(true)
      },
      () => {
        setOnline(false)
      }
    )

    return cleanup
  }, [setOnline, refreshSyncCount])

  return (
    <>
      <RouterProvider router={router} />
      <NotificationStack />
    </>
  )
}
