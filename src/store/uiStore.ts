import { create } from 'zustand'
import { countPendingSync } from '@/lib/offline/db'
import { syncOfflineQueue } from '@/lib/offline/sync'

interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  autoDismiss?: boolean
}

interface UiState {
  isOnline: boolean
  pendingSyncCount: number
  isSyncing: boolean
  notifications: Notification[]
  sidebarOpen: boolean
  activeModal: string | null
  activeChantierTab: string

  // Actions
  setOnline: (online: boolean) => void
  refreshSyncCount: () => Promise<void>
  triggerSync: () => Promise<void>
  addNotification: (notification: Omit<Notification, 'id'>) => void
  removeNotification: (id: string) => void
  toggleSidebar: () => void
  openModal: (modalId: string) => void
  closeModal: () => void
  setActiveTab: (tab: string) => void
}

export const useUiStore = create<UiState>((set, get) => ({
  isOnline: navigator.onLine,
  pendingSyncCount: 0,
  isSyncing: false,
  notifications: [],
  sidebarOpen: false,
  activeModal: null,
  activeChantierTab: 'production',

  setOnline: async (online: boolean) => {
    set({ isOnline: online })
    if (online) {
      // Déclencher sync automatique au retour du réseau
      get().triggerSync()
    }
  },

  refreshSyncCount: async () => {
    const count = await countPendingSync()
    set({ pendingSyncCount: count })
  },

  triggerSync: async () => {
    if (get().isSyncing) return
    set({ isSyncing: true })
    try {
      const { synced, errors } = await syncOfflineQueue()
      if (synced > 0) {
        get().addNotification({
          type: 'success',
          message: `${synced} action${synced > 1 ? 's' : ''} synchronisée${synced > 1 ? 's' : ''}`,
          autoDismiss: true
        })
      }
      if (errors > 0) {
        get().addNotification({
          type: 'warning',
          message: `${errors} action${errors > 1 ? 's' : ''} en erreur — retry automatique`,
          autoDismiss: true
        })
      }
    } finally {
      set({ isSyncing: false })
      get().refreshSyncCount()
    }
  },

  addNotification: (notification) => {
    const id = crypto.randomUUID()
    set(state => ({
      notifications: [...state.notifications, { ...notification, id }]
    }))
    if (notification.autoDismiss) {
      setTimeout(() => get().removeNotification(id), 3500)
    }
  },

  removeNotification: (id: string) => {
    set(state => ({
      notifications: state.notifications.filter(n => n.id !== id)
    }))
  },

  toggleSidebar: () => set(state => ({ sidebarOpen: !state.sidebarOpen })),

  openModal: (modalId: string) => set({ activeModal: modalId }),
  closeModal: () => set({ activeModal: null }),

  setActiveTab: (tab: string) => set({ activeChantierTab: tab })
}))
