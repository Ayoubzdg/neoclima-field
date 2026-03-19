import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Users, TrendingUp, Calendar } from 'lucide-react'
import { useProductionStore } from '@/store/productionStore'
import { useAuthStore } from '@/store/authStore'
import { todayISO, formatDateFR } from '@/utils/dates'
import { calculerAvancement } from '@/utils/ppc'
import ProgressBar from '@/components/ui/ProgressBar'
import AlertesBanner from '@/components/ui/AlertesBanner'
import type { Task, Equipe } from '@/types/models'

export default function DashboardChef() {
  const navigate = useNavigate()
  const { chantier } = useAuthStore()
  const { allTasks, equipes, effectifs, isLoading, loadAllTasks, loadEquipes, loadEffectifs } = useProductionStore()
  const today = todayISO()

  useEffect(() => {
    if (!chantier?.id) return
    // Sans filtre date pour voir toutes les tâches (y compris blocages d'autres jours)
    loadAllTasks(chantier.id)
    loadEquipes(chantier.id)
    loadEffectifs(chantier.id, today)
  }, [chantier?.id, today, loadAllTasks, loadEquipes, loadEffectifs])

  const tasksByEquipe = equipes.map(equipe => {
    const tasks = allTasks.filter(t => t.equipe_id === equipe.id)
    const effectif = effectifs.find(e => e.equipe_id === equipe.id)
    const blockedTasks = tasks.filter(t => t.status === 'blocked')
    const doneTasks = tasks.filter(t => t.status === 'done')
    const avancement = calculerAvancement(tasks)
    const alertes: string[] = []
    if (blockedTasks.length > 0) alertes.push(`${blockedTasks.length} tâche${blockedTasks.length > 1 ? 's' : ''} bloquée${blockedTasks.length > 1 ? 's' : ''}`)
    if (effectif && effectif.monteurs_presents < effectif.monteurs_prevus) {
      alertes.push(`${effectif.monteurs_prevus - effectif.monteurs_presents} monteur(s) absent(s)`)
    }
    return { equipe, tasks, effectif, blockedTasks, doneTasks, avancement, alertes }
  })

  const totalAlerts = tasksByEquipe.reduce((sum, e) => sum + e.alertes.length, 0)
  // Compteur blocages = tâches réellement bloquées (pas les alertes d'absences)
  const totalBlocages = allTasks.filter(t => t.status === 'blocked').length
  const totalPresents = effectifs.reduce((sum, e) => sum + e.monteurs_presents, 0)
  const totalPrevus = effectifs.reduce((sum, e) => sum + e.monteurs_prevus, 0)

  return (
    <div className="p-4">
      {/* En-tête */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-nc-blue">{chantier?.name}</h2>
          <p className="text-gray-500 text-sm">{formatDateFR(today)}</p>
          <p className="text-sm mt-1">
            <span className={totalPresents < totalPrevus ? 'text-amber-600 font-medium' : 'text-green-600 font-medium'}>
              {totalPresents} présent{totalPresents > 1 ? 's' : ''}
            </span>
            <span className="text-gray-400"> / {totalPrevus} prévus</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/reporting/bon-travail')}
            className="btn-secondary text-sm py-2 px-3 flex items-center gap-1"
          >
            <Calendar size={16} />
            Bon de travail
          </button>
        </div>
      </div>

      {/* Alertes prioritaires — banneau unifié */}
      <AlertesBanner allTasks={allTasks} equipes={equipes} />

      {/* Grille équipes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 h-36 animate-pulse" />
          ))
        ) : tasksByEquipe.map(({ equipe, tasks, effectif, doneTasks, blockedTasks, avancement, alertes }) => (
          <EquipeCard
            key={equipe.id}
            equipe={equipe}
            tasks={tasks}
            avancement={avancement}
            doneTasks={doneTasks.length}
            blockedTasks={blockedTasks.length}
            presents={effectif?.monteurs_presents ?? 0}
            prevus={effectif?.monteurs_prevus ?? 0}
            hasAlerte={alertes.length > 0}
            onTaskClick={id => navigate(`/production/tache/${id}`)}
          />
        ))}
      </div>

      {/* Actions rapides */}
      <div className="flex gap-3 mt-6 flex-wrap">
        {/* Blocages urgents — en rouge si actifs */}
        <button
          onClick={() => navigate('/production/blocages')}
          className={`flex-1 min-w-[120px] text-sm flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-semibold transition-colors
            ${totalBlocages > 0
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'btn-secondary'}`}
        >
          <AlertTriangle size={16} />
          Blocages{totalBlocages > 0 ? ` (${totalBlocages})` : ''}
        </button>
        <button
          onClick={() => navigate('/planning/ppc')}
          className="flex-1 min-w-[100px] btn-secondary text-sm flex items-center justify-center gap-1.5"
        >
          <TrendingUp size={16} />
          PPC
        </button>
        <button
          onClick={() => navigate('/plans')}
          className="flex-1 min-w-[100px] btn-secondary text-sm flex items-center justify-center gap-1.5"
        >
          <Users size={16} />
          Plans
        </button>
      </div>
    </div>
  )
}

function EquipeCard({
  equipe, tasks, avancement, doneTasks, blockedTasks, presents, prevus, hasAlerte, onTaskClick
}: {
  equipe: Equipe
  tasks: Task[]
  avancement: number
  doneTasks: number
  blockedTasks: number
  presents: number
  prevus: number
  hasAlerte: boolean
  onTaskClick: (id: string) => void
}) {
  const manquants = prevus - presents

  return (
    <div className={`bg-white rounded-2xl p-4 border-2 shadow-sm transition-all
      ${hasAlerte ? 'border-amber-200' : 'border-gray-100'}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: equipe.couleur }} />
          <p className="font-bold text-nc-blue text-sm">{equipe.name}</p>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full
          ${manquants > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
          {presents}/{prevus} pers.
        </span>
      </div>

      <ProgressBar value={avancement} color="auto" height="h-2" className="mb-2" />

      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span>{tasks.length} tâches</span>
        <span className="text-green-600">{doneTasks} ✓</span>
        {blockedTasks > 0 && (
          <span className="text-red-600 font-medium flex items-center gap-0.5">
            <AlertTriangle size={12} />
            {blockedTasks} bloquée{blockedTasks > 1 ? 's' : ''}
          </span>
        )}
        <span className="ml-auto font-semibold text-nc-blue">{avancement}%</span>
      </div>

      {/* Tâches bloquées cliquables */}
      {blockedTasks > 0 && tasks.filter(t => t.status === 'blocked').slice(0, 2).map(task => (
        <button
          key={task.id}
          onClick={() => onTaskClick(task.id)}
          className="w-full mt-2 text-left text-xs p-2 bg-red-50 rounded-lg text-red-600 truncate"
        >
          ⚠ {task.label}
        </button>
      ))}
    </div>
  )
}
