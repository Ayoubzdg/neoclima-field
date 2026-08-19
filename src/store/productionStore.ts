import { create } from 'zustand'
import type { Task, Equipe, Effectif, TaskStatus, ContrainteType } from '@/types/models'
import {
  getTasksDuJour, getTasksByChantier, getEquipes, getEffectifs,
  updateTaskStatusSafe, incrementQteRealisee, addTaskHistory, upsertContrainte, supabase
} from '@/lib/supabase'
import { addToSyncQueue, updateTaskOffline, getTasksOffline, cacheDonneesTerrain } from '@/lib/offline/db'
import { useUiStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'

/** Identité de session pour la traçabilité (qui + quelle entreprise) */
function auteur() {
  const a = useAuthStore.getState()
  const nom = a.utilisateur ? `${a.utilisateur.prenom ?? ''} ${a.utilisateur.nom ?? ''}`.trim() : null
  return { nom: nom || null, entrepriseId: a.entrepriseId ?? null }
}

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
  /** Point d'entrée UNIQUE du signalement de blocage : statut + contrainte + historique */
  signalerBlocage: (task: Task, type: ContrainteType, comment: string, userRole?: string) => Promise<void>
  /** Levée de blocage : statut + contrainte liée + historique avec durée */
  leverBlocage: (task: Task, userRole?: string) => Promise<void>
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
        const { nom, entrepriseId } = auteur()
        await addTaskHistory(taskId, userRole, 'status_change', `→ ${status}`, nom, entrepriseId)
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

  signalerBlocage: async (task: Task, type: ContrainteType, comment: string, userRole = 'monteur') => {
    // 1. Statut + cause sur la tâche
    await get().updateStatus(task.id, 'blocked', { type_blocage: type, comment }, userRole)
    // 2. Contrainte liée (alimente Lookahead + agenda contraintes)
    try {
      await upsertContrainte({
        task_id: task.id,
        cycle_id: task.cycle_id ?? undefined,
        type,
        description: comment || type,
        bloquant: true,
        statut: 'ouverte',
      })
    } catch { /* la tâche reste bloquée même si la contrainte échoue */ }
    // 3. Historique : cause + commentaire (la donnée qui nourrit
    //    le KPI "durée moyenne de blocage" et l'analyse des causes)
    const { nom, entrepriseId } = auteur()
    try {
      await addTaskHistory(task.id, userRole, 'blocage', `${type}${comment ? ` — ${comment}` : ''}`, nom, entrepriseId)
    } catch { /* non bloquant */ }
  },

  leverBlocage: async (task: Task, userRole = 'chef') => {
    const cause = task.type_blocage
    const bloqueDepuis = task.updated_at
    // 1. Retour en cours (efface la cause sur la tâche)
    await get().updateStatus(task.id, 'en_cours', { type_blocage: null, comment: null }, userRole)
    // 2. Lever la contrainte liée (avant : elle restait "ouverte"
    //    pour toujours et polluait le Lookahead)
    try {
      await supabase
        .from('contraintes')
        .update({ statut: 'levee', date_levee_reel: new Date().toISOString().split('T')[0] })
        .eq('task_id', task.id)
        .neq('statut', 'levee')
    } catch { /* non bloquant */ }
    // 3. Historique avec la durée du blocage
    const heures = bloqueDepuis
      ? Math.round((Date.now() - new Date(bloqueDepuis).getTime()) / 3_600_000)
      : null
    const { nom, entrepriseId } = auteur()
    try {
      await addTaskHistory(
        task.id, userRole, 'deblocage',
        `${cause ?? 'blocage'} levé${heures != null ? ` après ~${heures} h` : ''}`,
        nom, entrepriseId
      )
    } catch { /* non bloquant */ }
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
