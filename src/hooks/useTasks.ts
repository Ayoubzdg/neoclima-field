import { useProductionStore } from '@/store/productionStore'
import { useAuthStore } from '@/store/authStore'
import { todayISO } from '@/utils/dates'

export function useTasks() {
  const { utilisateur, equipe, chantier, role } = useAuthStore()
  const {
    tasksDuJour, allTasks, isLoading, lastSyncAt,
    loadTasksDuJour, loadAllTasks, updateStatus
  } = useProductionStore()
  const today = todayISO()

  const refresh = () => {
    if (equipe?.id) loadTasksDuJour(equipe.id, today)
    if (chantier?.id) loadAllTasks(chantier.id, today)
  }

  return {
    tasksDuJour,
    allTasks,
    isLoading,
    lastSyncAt,
    refresh,
    updateStatus: (taskId: string, status: Parameters<typeof updateStatus>[1]) =>
      updateStatus(taskId, status, undefined, role ?? 'monteur'),
    tasksBloquees: tasksDuJour.filter(t => t.status === 'blocked'),
    tasksDone: tasksDuJour.filter(t => t.status === 'done'),
    tasksEnCours: tasksDuJour.filter(t => t.status === 'en_cours')
  }
}
