import { useEffect, useState } from 'react'
import { usePlanningStore } from '@/store/planningStore'
import { useProductionStore } from '@/store/productionStore'
import { useAuthStore } from '@/store/authStore'
import { getSemaineLabel } from '@/utils/dates'
import { calculerPPC } from '@/utils/ppc'
import { updateTask } from '@/lib/supabase'
import { CheckSquare, Square, Lock, LockOpen, ChevronLeft, ChevronRight, Users } from 'lucide-react'
import ProgressBar from '@/components/ui/ProgressBar'
import StatusBadge from '@/components/ui/StatusBadge'

export default function WeeklyPlan() {
  const { chantier } = useAuthStore()
  const { weeklyPlan, semaineCourante, setSemaine, cloturerSemaine, decloturerSemaine, loadPlanning } = usePlanningStore()
  const { allTasks, loadAllTasks, updateTaskLocal } = useProductionStore()
  const [isClosing, setIsClosing] = useState(false)
  const [isOpening, setIsOpening] = useState(false)

  useEffect(() => {
    if (!chantier?.id) return
    loadPlanning(chantier.id, semaineCourante)
    loadAllTasks(chantier.id, semaineCourante)
  }, [chantier?.id, semaineCourante, loadPlanning, loadAllTasks])

  const tasksEngagees = allTasks.filter(t => t.engage)
  const tasksNonEngagees = allTasks.filter(t => !t.engage)
  const ppc = calculerPPC(tasksEngagees)

  const handleToggleEngage = async (taskId: string, currentEngage: boolean) => {
    updateTaskLocal(taskId, { engage: !currentEngage })
    try {
      await updateTask(taskId, { engage: !currentEngage })
    } catch {
      updateTaskLocal(taskId, { engage: currentEngage })
    }
  }

  const handleCloturer = async () => {
    if (!chantier?.id) return
    setIsClosing(true)
    await cloturerSemaine(chantier.id, semaineCourante)
    setIsClosing(false)
  }

  const handleDecloture = async () => {
    if (!chantier?.id) return
    setIsOpening(true)
    await decloturerSemaine(chantier.id, semaineCourante)
    setIsOpening(false)
  }

  const isCloture = weeklyPlan?.statut === 'cloture'

  // Badge équipe : couleur + nom
  const EquipeBadge = ({ equipeNom, couleur }: { equipeNom?: string; couleur?: string }) => {
    if (!equipeNom) return null
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
        style={{ backgroundColor: `${couleur ?? '#6366f1'}22`, color: couleur ?? '#6366f1' }}>
        <Users size={10} />
        {equipeNom}
      </span>
    )
  }

  return (
    <div className="p-4">
      {/* Header + navigation semaine */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => {
          const d = new Date(semaineCourante)
          d.setDate(d.getDate() - 7)
          setSemaine(d.toISOString().split('T')[0])
        }} className="p-2 rounded-xl hover:bg-gray-100">
          <ChevronLeft size={20} className="text-gray-500" />
        </button>
        <div className="text-center">
          <h2 className="font-bold text-nc-blue text-sm">{getSemaineLabel(semaineCourante)}</h2>
          <p className="text-xs mt-0.5 flex items-center justify-center gap-1"
            style={{ color: isCloture ? '#22C55E' : '#9CA3AF' }}>
            {isCloture && <Lock size={10} />}
            {weeklyPlan ? `Plan ${weeklyPlan.statut}` : 'Pas de plan'}
          </p>
        </div>
        <button onClick={() => {
          const d = new Date(semaineCourante)
          d.setDate(d.getDate() + 7)
          setSemaine(d.toISOString().split('T')[0])
        }} className="p-2 rounded-xl hover:bg-gray-100">
          <ChevronRight size={20} className="text-gray-500" />
        </button>
      </div>

      {/* PPC en cours */}
      {tasksEngagees.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-nc-blue">PPC courant</p>
            <p className="text-lg font-bold" style={{ color: ppc !== null && ppc >= 80 ? '#22C55E' : ppc !== null && ppc >= 60 ? '#F59E0B' : '#EF4444' }}>
              {ppc !== null ? `${ppc}%` : '—'}
            </p>
          </div>
          <ProgressBar value={ppc ?? 0} color="auto" />
          <p className="text-xs text-gray-400 mt-1.5">
            {tasksEngagees.filter(t => t.status === 'done').length}/{tasksEngagees.length} tâches engagées complétées
          </p>
        </div>
      )}

      {/* Tâches engagées */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-gray-700">Tâches engagées ({tasksEngagees.length})</p>
          {isCloture && <span className="text-xs text-green-600 flex items-center gap-1"><Lock size={12} />Clôturé</span>}
        </div>
        {tasksEngagees.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Aucune tâche engagée pour cette semaine</p>
        ) : (
          <div className="space-y-2">
            {tasksEngagees.map(task => (
              <div key={task.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-start gap-3">
                <button
                  onClick={() => !isCloture && handleToggleEngage(task.id, true)}
                  disabled={isCloture}
                  className="mt-0.5 flex-shrink-0"
                >
                  <CheckSquare size={20} className={isCloture ? 'text-gray-300' : 'text-nc-blue'} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-nc-blue truncate">{task.label}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <StatusBadge status={task.status} />
                    <span className="text-xs text-gray-400">{task.qte_prevue} {task.unite}</span>
                    <EquipeBadge equipeNom={task.equipe?.name} couleur={task.equipe?.couleur} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tâches disponibles à engager */}
      {!isCloture && tasksNonEngagees.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-semibold text-gray-700 mb-2">
            Disponibles à engager ({tasksNonEngagees.length})
          </p>
          <div className="space-y-2">
            {tasksNonEngagees.slice(0, 10).map(task => (
              <div key={task.id} className="bg-gray-50 rounded-xl border border-gray-100 p-3 flex items-start gap-3">
                <button
                  onClick={() => handleToggleEngage(task.id, false)}
                  className="mt-0.5 flex-shrink-0"
                >
                  <Square size={20} className="text-gray-400 hover:text-nc-blue transition-colors" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{task.label}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-gray-400">{task.qte_prevue} {task.unite}</span>
                    <EquipeBadge equipeNom={task.equipe?.name} couleur={task.equipe?.couleur} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bouton clôture */}
      {!isCloture && tasksEngagees.length > 0 && (
        <div className="mt-4">
          <button
            onClick={handleCloturer}
            disabled={isClosing}
            className="w-full btn-primary flex items-center justify-center gap-2"
          >
            <Lock size={18} />
            {isClosing ? 'Clôture en cours…' : 'Clôturer la semaine'}
          </button>
          <p className="text-xs text-gray-400 text-center mt-2">
            Le PPC sera calculé automatiquement à la clôture
          </p>
        </div>
      )}

      {/* Bouton déclôturer */}
      {isCloture && (
        <div className="mt-4">
          <button
            onClick={handleDecloture}
            disabled={isOpening}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border-2 border-orange-300 text-orange-600 font-semibold text-sm hover:bg-orange-50 transition-colors"
          >
            <LockOpen size={18} />
            {isOpening ? 'Réouverture…' : 'Déclôturer la semaine'}
          </button>
          <p className="text-xs text-gray-400 text-center mt-2">
            Permet de modifier les tâches engagées avant recalcul du PPC
          </p>
        </div>
      )}
    </div>
  )
}
