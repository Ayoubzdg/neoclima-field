import { create } from 'zustand'
import type { Task, Equipe, Effectif, TaskStatus } from '@/types/models'
import {
  getTasksDuJour, getTasksByChantier, getEquipes, getEffectifs,
  updateTaskStatusSafe, incrementQteRealisee, addTaskHistory
} from '@/lib/supabase'
import { addToSyncQueue, updateTaskOffline, getTasksOffline, cacheDonneesTerrain } from '@/lib/offline/db'
import { useUiStore } from '@/store/uiStore'

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
  /** Quantité en delta atomique — deux saisies simultanées s'additionnent */
  updateQty: (taskId: string, delta: number, userRole?: string) => Promise<void>
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
        // Alimenter le cache offline : l'app s'ouvrira avec les
        // données du dernier passage réseau, même sans connexion
        cacheDonneesTerrain({
          tasks, zones: [], phases: [], contraintes: [],
          equipes: get().equipes, taskTypes: [],
        }).catch(() => { /* cache best-effort */ })
      } else {
        const tasks = await getTasksOffline(equipeId, date)
        set({ tasksDuJour: tasks, isLoading: false })
      }
    } catch {
      // Erreur réseau → fallback sur le cache, en le SIGNALANT
      // (avant : erreur avalée → "Aucune tâche" mensonger)
      const tasks = await getTasksOffline(equipeId, date)
      set({
        tasksDuJour: tasks,
        isLoading: false,
        error: tasks.length === 0 ? 'Impossible de charger les tâches — vérifie ta connexion' : null,
      })
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

    // Version connue localement → base du verrou optimiste
    const known = tasksDuJour.find(t => t.id === taskId) ?? allTasks.find(t => t.id === taskId)
    const expectedUpdatedAt = known?.updated_at ?? null

    // Optimistic update local
    const updateInList = (tasks: Task[]) =>
      tasks.map(t => t.id === taskId ? { ...t, status, ...updates, updated_at: new Date().toISOString() } : t)

    set({
      tasksDuJour: updateInList(tasksDuJour),
      allTasks: updateInList(allTasks)
    })

    if (isOnline) {
      try {
        const { task, conflict } = await updateTaskStatusSafe(taskId, status, updates ?? {}, expectedUpdatedAt)
        if (conflict && task) {
          // Quelqu'un a modifié la tâche entre-temps → on reprend
          // l'état serveur et on PRÉVIENT, on n'écrase jamais en douce
          get().updateTaskLocal(taskId, task)
          useUiStore.getState().addNotification({
            type: 'warning',
            message: `"${task.label ?? 'Tâche'}" modifiée par quelqu'un d'autre — état rechargé`,
            autoDismiss: true,
          })
          return
        }
        if (task) get().updateTaskLocal(taskId, task)
        await addTaskHistory(taskId, userRole, 'status_change', `→ ${status}`)
      } catch {
        // Erreur réseau → sync queue
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

  updateQty: async (taskId: string, delta: number, _userRole = 'monteur') => {
    if (delta === 0) return
    const { isOnline, tasksDuJour, allTasks } = get()

    // Optimistic local (clampé ≥ 0)
    const bump = (tasks: Task[]) =>
      tasks.map(t => t.id === taskId
        ? { ...t, qte_realisee: Math.max(0, t.qte_realisee + delta), updated_at: new Date().toISOString() }
        : t)
    set({ tasksDuJour: bump(tasksDuJour), allTasks: bump(allTasks) })

    const queueDelta = async () => {
      const t = get().tasksDuJour.find(x => x.id === taskId) ?? get().allTasks.find(x => x.id === taskId)
      if (t) await updateTaskOffline(taskId, { qte_realisee: t.qte_realisee })
      await addToSyncQueue({
        id: crypto.randomUUID(),
        table_name: 'tasks',
        operation: 'increment',
        record_id: taskId,
        payload: { delta },
        synced: false,
        created_at: new Date().toISOString()
      })
    }

    if (isOnline) {
      try {
        // Delta ATOMIQUE côté serveur : deux saisies simultanées
        // s'additionnent au lieu de s'écraser (RPC increment_qte_realisee)
        const task = await incrementQteRealisee(taskId, delta)
        if (task) get().updateTaskLocal(taskId, task)
      } catch {
        await queueDelta()
      }
    } else {
      await queueDelta()
    }
  },

  setOnline: (online: boolean) => set({ isOnline: online }),

  updateTaskLocal: (taskId: string, updates: Partial<Task>) => {
    // UPDATE : met à jour si la tâche existe déjà dans la liste
    // INSERT : ajoute la tâche si elle n'est pas encore présente
    const upsertInList = (tasks: Task[]) => {
      const exists = tasks.some(t => t.id === taskId)
      if (exists) {
        return tasks.map(t => t.id === taskId ? { ...t, ...updates } : t)
      }
      // Nouvelle tâche (INSERT realtime) → ajouter à allTasks seulement
      return tasks
    }
    const addIfNew = (tasks: Task[]) => {
      const exists = tasks.some(t => t.id === taskId)
      if (!exists && (updates as Task).id) {
        return [...tasks, updates as Task]
      }
      return upsertInList(tasks)
    }
    set({
      tasksDuJour: upsertInList(get().tasksDuJour),
      allTasks: addIfNew(get().allTasks)
    })
  }
}))
