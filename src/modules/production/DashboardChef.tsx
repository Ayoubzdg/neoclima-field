import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, Users, TrendingUp, Calendar,
  RefreshCw, CheckCircle, Clock, Play, ChevronDown, ChevronUp, AlertCircle,
  Bell, BellRing
} from 'lucide-react'
import { pushDisponible, pushActif, activerNotifications } from '@/lib/push'
import { useProductionStore } from '@/store/productionStore'
import { useAuthStore } from '@/store/authStore'
import { todayISO, formatDateFR } from '@/utils/dates'
import { calculerAvancementMixte } from '@/utils/ppc'
import { STATUS_LABELS } from '@/utils/statusMachine'
import ProgressBar from '@/components/ui/ProgressBar'
import AlertesBanner from '@/components/ui/AlertesBanner'
import type { Task, Equipe } from '@/types/models'

// ── Icône statut tâche ───────────────────────────────────────
function StatusIcon({ status }: { status: string }) {
  if (status === 'done')        return <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
  if (status === 'a_controler') return <CheckCircle size={14} className="text-amber-500 flex-shrink-0" />
  if (status === 'blocked')     return <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
  if (status === 'en_cours')    return <Play size={14} className="text-blue-500 flex-shrink-0" />
  return                               <Clock size={14} className="text-gray-300 flex-shrink-0" />
}

// ── Dashboard principal ──────────────────────────────────────
export default function DashboardChef() {
  const navigate  = useNavigate()
  const { chantier, role, entrepriseId, entrepriseName } = useAuthStore()
  const { allTasks: allTasksRaw, equipes: equipesRaw, effectifs, isLoading, loadAllTasks, loadEquipes, loadEffectifs } = useProductionStore()
  const today = todayISO()
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [notifOk, setNotifOk] = useState(pushActif())

  // ── Cloisonnement sous-traitant ─────────────────────────────
  // Un chef d'équipe ST ne voit que les équipes et tâches de
  // SON entreprise (filtrage app ; l'étanchéité serveur = RLS)
  const isST = role === 'chef_equipe' && !!entrepriseId
  const equipes  = isST ? equipesRaw.filter(e => e.entreprise_id === entrepriseId) : equipesRaw
  const allTasks = isST ? allTasksRaw.filter(t => t.entreprise_id === entrepriseId) : allTasksRaw

  const refresh = useCallback(() => {
    if (!chantier?.id) return
    loadAllTasks(chantier.id)
    loadEquipes(chantier.id)
    loadEffectifs(chantier.id, today)
    setLastRefresh(new Date())
  }, [chantier?.id, today, loadAllTasks, loadEquipes, loadEffectifs])

  useEffect(() => { refresh() }, [refresh])

  // Construire les données par équipe — on filtre les équipes sans tâches
  const tasksByEquipe = equipes
    .map(equipe => {
      const tasks       = allTasks.filter(t => t.equipe_id === equipe.id)
      const effectif    = effectifs.find(e => e.equipe_id === equipe.id)
      const avancement  = calculerAvancementMixte(tasks)
      const blocked     = tasks.filter(t => t.status === 'blocked').length
      const done        = tasks.filter(t => t.status === 'done').length
      const aControler  = tasks.filter(t => t.status === 'a_controler').length
      const enCours     = tasks.filter(t => t.status === 'en_cours').length
      return { equipe, tasks, effectif, avancement, blocked, done, aControler, enCours }
    })
    .filter(e => e.tasks.length > 0)          // ← masquer les équipes sans tâches

  const totalBlocages   = allTasks.filter(t => t.status === 'blocked').length
  const totalAControler = allTasks.filter(t => t.status === 'a_controler').length
  const effectifsVisibles = isST
    ? effectifs.filter(e => equipes.some(eq => eq.id === e.equipe_id))
    : effectifs
  const totalPresents  = effectifsVisibles.reduce((s, e) => s + e.monteurs_presents, 0)
  const totalPrevus    = effectifsVisibles.reduce((s, e) => s + e.monteurs_prevus, 0)
  const avanTotal      = tasksByEquipe.length
    ? Math.round(tasksByEquipe.reduce((s, e) => s + e.avancement, 0) / tasksByEquipe.length)
    : 0

  const refreshLabel = lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <div className="p-4 max-w-2xl mx-auto">

      {/* ── En-tête ── */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-nc-blue">{chantier?.name}</h2>
          <p className="text-gray-500 text-sm">
            {formatDateFR(today)}
            {isST && entrepriseName && <span className="ml-1 text-nc-blue font-medium">· {entrepriseName}</span>}
          </p>
          <div className="flex items-center gap-3 mt-1 text-sm">
            <span className={totalPresents < totalPrevus ? 'text-amber-600 font-medium' : 'text-green-600 font-medium'}>
              {totalPresents}/{totalPrevus} présents
            </span>
            {totalBlocages > 0 && (
              <span className="text-red-500 font-semibold flex items-center gap-1">
                <AlertTriangle size={13} /> {totalBlocages} bloquée{totalBlocages > 1 ? 's' : ''}
              </span>
            )}
            <span className="text-nc-blue font-bold">{avanTotal}% global</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          {/* Notifications push : blocage signalé → alerte immédiate */}
          {pushDisponible() && (
            <button
              onClick={async () => { if (!notifOk) setNotifOk(await activerNotifications()) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs transition-all touch-manipulation
                ${notifOk
                  ? 'border-green-200 bg-green-50 text-green-600'
                  : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 active:scale-95'}`}
              title={notifOk ? 'Notifications actives sur cet appareil' : 'Être alerté immédiatement des blocages'}
            >
              {notifOk ? <BellRing size={13} /> : <Bell size={13} />}
              {notifOk ? 'Alertes actives' : 'Activer les alertes'}
            </button>
          )}
          {/* Bouton rafraîchir */}
          <button
            onClick={refresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200
                       text-gray-500 text-xs hover:bg-gray-50 active:scale-95 transition-all touch-manipulation"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            Actualiser
          </button>
          <span className="text-gray-300 text-[10px]">màj {refreshLabel}</span>
        </div>
      </div>

      {/* Barre d'avancement globale */}
      <ProgressBar value={avanTotal} color="auto" height="h-2" className="mb-4" showLabel />

      {/* Alertes */}
      <AlertesBanner allTasks={allTasks} equipes={equipes} />

      {/* ── Liste équipes ── */}
      {isLoading ? (
        <div className="space-y-3 mt-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 h-28 animate-pulse border border-gray-100" />
          ))}
        </div>
      ) : tasksByEquipe.length === 0 ? (
        <div className="mt-8 text-center text-gray-400">
          <Users size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Aucune tâche planifiée cette semaine</p>
        </div>
      ) : (
        <div className="space-y-3 mt-4">
          {tasksByEquipe.map(({ equipe, tasks, effectif, avancement, blocked, done, aControler, enCours }) => (
            <EquipeCard
              key={equipe.id}
              equipe={equipe}
              tasks={tasks}
              avancement={avancement}
              done={done}
              aControler={aControler}
              enCours={enCours}
              blocked={blocked}
              presents={effectif?.monteurs_presents ?? 0}
              prevus={effectif?.monteurs_prevus ?? 0}
              onTaskClick={id => navigate(`/production/tache/${id}`)}
            />
          ))}
        </div>
      )}

      {/* ── Actions rapides ── */}
      <div className="flex gap-2 mt-5 flex-wrap">
        {/* Le contrôle est réservé à l'interne (jamais d'auto-validation ST) */}
        {!isST && (
          <button
            onClick={() => navigate('/production/controle')}
            className={`flex-1 min-w-[110px] text-sm flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-semibold transition-colors
              ${totalAControler > 0 ? 'bg-amber-500 text-white' : 'btn-secondary'}`}
          >
            <CheckCircle size={15} />
            Contrôle{totalAControler > 0 ? ` (${totalAControler})` : ''}
          </button>
        )}
        <button
          onClick={() => navigate('/production/blocages')}
          className={`flex-1 min-w-[110px] text-sm flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-semibold transition-colors
            ${totalBlocages > 0 ? 'bg-red-500 text-white' : 'btn-secondary'}`}
        >
          <AlertTriangle size={15} />
          Blocages{totalBlocages > 0 ? ` (${totalBlocages})` : ''}
        </button>
        {!isST && (
          <>
            <button onClick={() => navigate('/planning/ppc')} className="flex-1 min-w-[90px] btn-secondary text-sm flex items-center justify-center gap-1.5">
              <TrendingUp size={15} /> PPC
            </button>
            <button onClick={() => navigate('/reporting/bon-travail')} className="flex-1 min-w-[90px] btn-secondary text-sm flex items-center justify-center gap-1.5">
              <Calendar size={15} /> Bon travail
            </button>
          </>
        )}
        <button onClick={() => navigate('/plans')} className="flex-1 min-w-[90px] btn-secondary text-sm flex items-center justify-center gap-1.5">
          <Users size={15} /> Plans
        </button>
      </div>
    </div>
  )
}

// ── Carte équipe avec liste de tâches dépliable ──────────────
function EquipeCard({
  equipe, tasks, avancement, done, aControler, enCours, blocked, presents, prevus, onTaskClick
}: {
  equipe: Equipe
  tasks: Task[]
  avancement: number
  done: number
  aControler: number
  enCours: number
  blocked: number
  presents: number
  prevus: number
  onTaskClick: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(blocked > 0) // ouvert par défaut si blocage
  const manquants = prevus - presents
  const hasAlert  = blocked > 0 || manquants > 0

  return (
    <div className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden transition-all
      ${blocked > 0 ? 'border-red-200' : hasAlert ? 'border-amber-200' : 'border-gray-100'}`}
    >
      {/* ── Header équipe ── */}
      <button
        className="w-full text-left px-4 pt-3 pb-2 active:bg-gray-50 touch-manipulation"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: equipe.couleur }} />
            <p className="font-bold text-nc-blue text-sm">{equipe.name}</p>
            {blocked > 0 && (
              <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                {blocked} bloquée{blocked > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full
              ${manquants > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
              {presents}/{prevus} pers.
            </span>
            <span className="font-bold text-sm text-nc-blue">{avancement}%</span>
            {expanded ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
          </div>
        </div>

        {/* Barre progression + compteurs */}
        <ProgressBar value={avancement} color="auto" height="h-1.5" />
        <div className="flex gap-3 mt-1.5 text-xs text-gray-500">
          <span>{tasks.length} tâche{tasks.length > 1 ? 's' : ''}</span>
          {enCours > 0    && <span className="text-blue-500">{enCours} en cours</span>}
          {aControler > 0 && <span className="text-amber-600 font-medium">{aControler} à contrôler</span>}
          {done > 0       && <span className="text-green-600">{done} ✓</span>}
          {blocked > 0    && <span className="text-red-500 font-medium">{blocked} ✗</span>}
        </div>
      </button>

      {/* ── Liste des tâches (dépliable) ── */}
      {expanded && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {tasks.map(task => {
            const pct = task.qte_prevue > 0
              ? Math.round((task.qte_realisee / task.qte_prevue) * 100)
              : task.status === 'done' ? 100 : 0

            return (
              <button
                key={task.id}
                onClick={() => onTaskClick(task.id)}
                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 active:bg-gray-100
                           transition-colors touch-manipulation"
              >
                <div className="flex items-start gap-2">
                  <StatusIcon status={task.status} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate leading-snug
                      ${task.status === 'done' ? 'line-through text-gray-400' :
                        task.status === 'blocked' ? 'text-red-600' : 'text-gray-700'}`}>
                      {task.label}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] ${task.status === 'a_controler' ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
                        {STATUS_LABELS[task.status] ?? task.status}
                      </span>
                      {task.zone_takt?.name && (
                        <span className="text-[10px] bg-gray-100 text-gray-400 px-1 rounded">
                          {task.zone_takt.name}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Quantité + % */}
                  {task.qte_prevue > 0 && (
                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs font-bold text-nc-blue">
                        {task.qte_realisee}/{task.qte_prevue}
                        <span className="text-gray-400 font-normal ml-0.5 text-[10px]">{task.unite}</span>
                      </p>
                      <div className="w-14 h-1 bg-gray-100 rounded-full mt-0.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${pct >= 100 ? 'bg-green-400' : 'bg-nc-red/60'}`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">{pct}%</p>
                    </div>
                  )}
                </div>
                {/* Commentaire blocage */}
                {task.status === 'blocked' && task.comment && (
                  <p className="text-[10px] text-red-500 mt-1 ml-5 truncate">⚠ {task.comment}</p>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
