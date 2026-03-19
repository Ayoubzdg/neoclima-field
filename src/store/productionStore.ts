import { create } from 'zustand'
import type { Task, Equipe, Effectif, TaskStatus } from '@/types/models'
import {
  getTasksDuJour, getTasksByChantier, getEquipes, getEffectifs,
  updateTaskStatus, upsertTask, addTaskHistory
} from '@/lib/supabase'
import { addToSyncQueue, updateTaskOffline, getTasksOffline } from '@/lib/offline/db'

interface ProductionState {
  // Data
  tasksDuJour: Task[]
  allTasks: Task[]
  equipes: Equipe[]
  effectifs: Effectif[]

  // État
  isLoading: boolean
  isOnline: boolean
  lastSyncAt: string | null
  error: string | null

  // Actions
  loadTasksDuJour: (equipeId: string, date: string) => Promise<void>
  loadAllTasks: (chantierId: string, date?: string) => Promise<void>
  loadEquipes: (chantierId: string) => Promise<void>
  loadEffectifs: (chantierId: string, date: string) => Promise<void>
  updateStatus: (taskId: string, status: TaskStatus, updates?: Partial<Task>, userRole?: string) => Promise<void>
  setOnline: (online: boolean) => void
  updateTaskLocal: (taskId: string, updates: Partial<Task>) => void
}

export const useProductionStore = create<ProductionState>((set, get) => ({
  tasksDuJour: [],
  allTasks: [],
  equipes: [],
  effectifs: [],
  isLoading: false,
  isOnline: navigator.onLine,
  lastSyncAt: null,
  error: null,

  loadTasksDuJour: async (equipeId: string, date: string) => {
    set({ isLoading: true, error: null })
    try {
      if (get().isOnline) {
        const tasks = await getTasksDuJour(equipeId, date)
        set({ tasksDuJour: tasks, isLoading: false, lastSyncAt: new Date().toISOString() })
      } else {
        // Mode offline : lire depuis Dexie
        const tasks = await getTasksOffline(equipeId, date)
        set({ tasksDuJour: tasks, isLoading: false })
      }
    } catch (err) {
      // Fallback offline
      const tasks = await getTasksOffline(equipeId, date)
      set({ tasksDuJour: tasks, isLoading: false, error: null })
    }
  },

  loadAllTasks: async (chantierId: string, date?: string) => {
    set({ isLoading: true, error: null })
    try {
      const tasks = await getTasksByChantier(chantierId, date ? { semaine: date } : undefined)
      set({ allTasks: tasks, isLoading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur chargement tâches'
      set({ isLoading: false, error: message })
    }
  },

  loadEquipes: async (chantierId: string) => {
    try {
      const equipes = await getEquipes(chantierId)
      set({ equipes })
    } catch {
      // Silencieux — les équipes peuvent déjà être en cache
    }
  },

  loadEffectifs: async (chantierId: string, date: string) => {
    try {
      const effectifs = await getEffectifs(chantierId, date)
      set({ effectifs })
    } catch {
      // Silencieux
    }
  },

  updateStatus: async (taskId: string, status: TaskStatus, updates?: Partial<Task>, userRole = 'monteur') => {
    const { isOnline, tasksDuJour, allTasks } = get()

    // Optimistic update
    const updateInList = (tasks: Task[]) =>
      tasks.map(t => t.id === taskId ? { ...t, status, ...updates, updated_at: new Date().toISOString() } : t)

    set({
      tasksDuJour: updateInList(tasksDuJour),
      allTasks: updateInList(allTasks)
    })

    if (isOnline) {
      try {
        await updateTaskStatus(taskId, status, updates)
        await addTaskHistory(taskId, userRole, 'status_change', `→ ${status}`)
      } catch {
        // En cas d'erreur, écrire dans la sync queue
        await addToSyncQueue({
          id: crypto.randomUUID(),
          table_name: 'tasks',
          operation: 'update',
          record_id: taskId,
          payload: { status, ...updates, updated_at: new Date().toISOString() },
          synced: false,
          created_at: new Date().toISOString()
        })
      }
    } else {
      // Offline : écrire en local + sync queue
      await updateTaskOffline(taskId, { status, ...updates })
      await addToSyncQueue({
        id: crypto.randomUUID(),
        table_name: 'tasks',
        operation: 'update',
        record_id: taskId,
        payload: { status, ...updates, updated_at: new Date().toISOString() },
        synced: false,
        created_at: new Date().toISOString()
      })
    }
  },

  setOnline: (online: boolean) => set({ isOnline: online }),

  updateTaskLocal: (taskId: string, updates: Partial<Task>) => {
    const updateInList = (tasks: Task[]) =>
      tasks.map(t => t.id === taskId ? { ...t, ...updates } : t)
    set({
      tasksDuJour: updateInList(get().tasksDuJour),
      allTasks: updateInList(get().allTasks)
    })
  }
}))
