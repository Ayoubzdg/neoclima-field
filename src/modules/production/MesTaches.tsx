import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, AlertCircle, Clock, Play, Plus, Minus, AlertTriangle, ChevronRight, Moon, QrCode, Users, RotateCcw } from 'lucide-react'
import { useProductionStore } from '@/store/productionStore'
import { useAuthStore } from '@/store/authStore'
import { currentMondayISO, formatDateFR, todayISO, addDays, formatDateISO, getSemaineLabel } from '@/utils/dates'
import { calculerAvancement } from '@/utils/ppc'
import ProgressBar from '@/components/ui/ProgressBar'
import BlocageForm from './BlocageForm'
import FinJourneeWizard from './FinJourneeWizard'
import type { Task, TaskStatus, ContrainteType } from '@/types/models'
import { upsertContrainte } from '@/lib/supabase'

// ── Utilitaires deadline ────────────────────────────────────

function getDeadlineInfo(dateplanifiee: string | null): {
  label: string
  color: string
  urgent: boolean
} | null {
  if (!dateplanifiee) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const monday = new Date(currentMondayISO())
  monday.setHours(0, 0, 0, 0)
  const taskWeek = new Date(dateplanifiee)
  taskWeek.setHours(0, 0, 0, 0)

  // Tâche d'une semaine passée non terminée → en retard
  if (taskWeek < monday) {
    return { label: '⚠ En retard', color: 'bg-red-100 text-red-700', urgent: true }
  }

  // Tâche de la semaine courante → jours restants jusqu'au vendredi
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)
  friday.setHours(23, 59, 59, 999)
  const diffMs = friday.getTime() - today.getTime()
  const joursRestants = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (joursRestants <= 0) {
    return { label: 'Vendredi', color: 'bg-red-100 text-red-700', urgent: true }
  }
  if (joursRestants === 1) {
    return { label: '1 j restant', color: 'bg-orange-100 text-orange-700', urgent: true }
  }
  if (joursRestants === 2) {
    return { label: '2 j restants', color: 'bg-amber-100 text-amber-700', urgent: false }
  }
  return { label: `${joursRestants} j`, color: 'bg-gray-100 text-gray-500', urgent: false }
}

// ── Tri par priorité ────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = {
  blocked: 0,
  en_cours: 1,
  nappe_h: 2,
  nappe_b: 3,
  terminaux: 4,
  raccordement: 5,
  todo: 6,
  done: 7,
}

function sortByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.status] ?? 6
    const pb = PRIORITY_ORDER[b.status] ?? 6
    if (pa !== pb) return pa - pb
    // À priorité égale, les retards d'abord
    const monday = currentMondayISO()
    const ma = new Date(monday)
    const ta = a.date_planifiee ? new Date(a.date_planifiee) : ma
    const tb = b.date_planifiee ? new Date(b.date_planifiee) : ma
    if (ta < ma && tb >= ma) return -1
    if (tb < ma && ta >= ma) return 1
    return 0
  })
}

// ── Composant principal ─────────────────────────────────────

export default function MesTaches() {
  const navigate = useNavigate()
  const { equipe, role, utilisateur } = useAuthStore()
  const { tasksDuJour, isLoading, loadTasksDuJour, updateStatus } = useProductionStore()
  const today = todayISO()
  const monday = currentMondayISO()

  const [blocageTask, setBlocageTask] = useState<Task | null>(null)
  const [showWizard, setShowWizard] = useState(false)

  useEffect(() => {
    if (equipe?.id) {
      loadTasksDuJour(equipe.id, monday)
    }
  }, [equipe?.id, monday, loadTasksDuJour])

  // Rediriger chef/CA vers le dashboard approprié
  useEffect(() => {
    if (role === 'chef') navigate('/production/chef', { replace: true })
    if (role === 'ca') navigate('/production/takt', { replace: true })
  }, [role, navigate])

  const sorted = sortByPriority(tasksDuJour)
  const tasksDone = tasksDuJour.filter(t => t.status === 'done').length
  const tasksBlocked = tasksDuJour.filter(t => t.status === 'blocked').length
  const tasksEnCours = tasksDuJour.filter(t => t.status === 'en_cours' || ['nappe_h','nappe_b','terminaux','raccordement'].includes(t.status)).length
  const avancement = calculerAvancement(tasksDuJour)

  const handleStatusCycle = async (task: Task) => {
    const next: Record<TaskStatus, TaskStatus> = {
      todo:         'en_cours',
      en_cours:     'done',
      nappe_h:      'nappe_b',
      nappe_b:      'terminaux',
      terminaux:    'raccordement',
      raccordement: 'done',
      done:         'en_cours',  // annuler → remet en cours (conserve la progression)
      blocked:      'en_cours',
    }
    await updateStatus(task.id, next[task.status] ?? 'en_cours', {}, role ?? 'monteur')
  }

  const handleQtyChange = async (task: Task, delta: number) => {
    const cap = Math.max(task.qte_prevue * 2, task.qte_prevue + 20)
    const newQte = Math.min(cap, Math.max(0, task.qte_realisee + delta))
    await updateStatus(task.id, task.status, { qte_realisee: newQte }, role ?? 'monteur')
  }

  const handleBlocageSubmit = async (type: ContrainteType, comment: string) => {
    if (!blocageTask) return
    await updateStatus(blocageTask.id, 'blocked', { type_blocage: type, comment }, role ?? 'monteur')
    await upsertContrainte({
      task_id: blocageTask.id,
      cycle_id: blocageTask.cycle_id ?? undefined,
      type,
      description: comment || type,
      bloquant: true,
      statut: 'ouverte',
    })
    setBlocageTask(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-3 border-nc-red border-t-transparent rounded-full" />
      </div>
    )
  }

  // Aucune équipe assignée → message clair au lieu de liste vide silencieuse
  if (!equipe) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="mb-5">
          <h2 className="text-base font-bold text-nc-blue">{getSemaineLabel(monday)}</h2>
          <p className="text-gray-400 text-xs mt-0.5">{formatDateFR(today)}</p>
        </div>
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5 text-center">
          <AlertTriangle size={32} className="mx-auto mb-3 text-amber-400" />
          <p className="font-bold text-nc-blue text-sm mb-1">Aucune équipe assignée</p>
          <p className="text-sm text-gray-500">
            Ton compte n'est pas encore rattaché à une équipe sur ce chantier.
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Contacte ton chef de chantier pour qu'il t'assigne à une équipe.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-lg mx-auto pb-28">

      {/* Header semaine */}
      <div className="mb-5">
        <h2 className="text-base font-bold text-nc-blue">{getSemaineLabel(monday)}</h2>
        <p className="text-gray-400 text-xs mt-0.5">{formatDateFR(today)}</p>

        {/* Résumé statuts */}
        <div className="flex items-center gap-3 mt-2 text-sm">
          <span className="text-gray-600 font-medium">{tasksDuJour.length} tâche{tasksDuJour.length > 1 ? 's' : ''}</span>
          {tasksEnCours > 0 && (
            <span className="flex items-center gap-1 text-blue-600 font-medium">
              <Play size={12} /> {tasksEnCours} en cours
            </span>
          )}
          {tasksBlocked > 0 && (
            <span className="flex items-center gap-1 text-red-500 font-semibold">
              <AlertCircle size={12} /> {tasksBlocked} bloquée{tasksBlocked > 1 ? 's' : ''}
            </span>
          )}
          {tasksDone > 0 && (
            <span className="flex items-center gap-1 text-green-600 font-medium">
              <CheckCircle size={12} /> {tasksDone} terminée{tasksDone > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {tasksDuJour.length > 0 && (
          <ProgressBar value={avancement} color="auto" className="mt-2" showLabel />
        )}
      </div>

      {/* Bannière alerte : tâches en retard ou bloquées */}
      {(() => {
        const hasRetard = tasksDuJour.some(t => t.date_planifiee && new Date(t.date_planifiee) < new Date(monday) && t.status !== 'done')
        if (!tasksBlocked && !hasRetard) return null
        return (
          <div className="mb-4 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2">
            <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">
              {tasksBlocked > 0 && (
                <p className="font-semibold">{tasksBlocked} tâche{tasksBlocked > 1 ? 's' : ''} bloquée{tasksBlocked > 1 ? 's' : ''} — signale à ton chef</p>
              )}
              {hasRetard && (
                <p className={tasksBlocked > 0 ? 'mt-0.5' : 'font-semibold'}>Tâches en retard de la semaine précédente</p>
              )}
            </div>
          </div>
        )
      })()}

      {/* Liste des tâches */}
      {sorted.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CheckCircle size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium text-gray-500">Aucune tâche planifiée cette semaine</p>
          <p className="text-sm mt-1 text-gray-400">Contacte ton chef de chantier</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(task => (
            <InlineTaskCard
              key={task.id}
              task={task}
              onStatusCycle={() => handleStatusCycle(task)}
              onQtyChange={(delta) => handleQtyChange(task, delta)}
              onBlocage={() => setBlocageTask(task)}
              onDetail={() => navigate(`/production/tache/${task.id}`)}
            />
          ))}
        </div>
      )}

      {/* Bouton clôture journée (principal) */}
      {tasksDuJour.length > 0 && (
        <button
          onClick={() => setShowWizard(true)}
          className="mt-5 w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl
                     bg-nc-blue text-white font-semibold text-sm hover:bg-nc-blue/90 transition-colors shadow-sm"
        >
          <Moon size={18} />
          Clôture de journée
        </button>
      )}

      {/* Bouton scan QR — secondaire, discret */}
      <button
        onClick={() => navigate('/production/scan')}
        className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                   border border-gray-200 text-gray-400 text-xs hover:bg-gray-50 transition-colors"
      >
        <QrCode size={14} />
        Scanner une zone
      </button>

      {/* Blocage form */}
      {blocageTask && (
        <BlocageForm
          task={blocageTask}
          onClose={() => setBlocageTask(null)}
          onSubmit={handleBlocageSubmit}
        />
      )}

      {/* Wizard fin de journée */}
      {showWizard && (
        <FinJourneeWizard
          tasks={tasksDuJour}
          equipe={equipe}
          utilisateur={utilisateur}
          onClose={() => setShowWizard(false)}
          onQtyUpdate={(taskId, qte) => updateStatus(taskId, 'done', { qte_realisee: qte }, role ?? 'monteur')}
        />
      )}
    </div>
  )
}

// ── Carte tâche avec actions inline ─────────────────────────

function InlineTaskCard({
  task, onStatusCycle, onQtyChange, onBlocage, onDetail
}: {
  task: Task
  onStatusCycle: () => void
  onQtyChange: (delta: number) => void
  onBlocage: () => void
  onDetail: () => void
}) {
  const pct = task.qte_prevue > 0
    ? Math.round((task.qte_realisee / task.qte_prevue) * 100)
    : task.status === 'done' ? 100 : 0

  const cvcPhases = ['nappe_h', 'nappe_b', 'terminaux', 'raccordement']
  const isCvcPhase = cvcPhases.includes(task.status)

  const statusColors: Record<string, string> = {
    done:         'border-green-200 bg-green-50/50',
    blocked:      'border-red-300 bg-red-50/40',
    en_cours:     'border-blue-200 bg-blue-50/20',
    todo:         'border-gray-100 bg-white',
    nappe_h:      'border-orange-200 bg-orange-50/20',
    nappe_b:      'border-orange-200 bg-orange-50/20',
    terminaux:    'border-orange-200 bg-orange-50/20',
    raccordement: 'border-orange-200 bg-orange-50/20',
  }

  const StatusIcon = () => {
    if (task.status === 'done') return <CheckCircle size={22} className="text-green-500" />
    if (task.status === 'blocked') return <AlertCircle size={22} className="text-red-500" />
    if (task.status === 'en_cours') return <Play size={22} className="text-blue-500" />
    if (isCvcPhase) return <Play size={22} className="text-orange-400" />
    return <Clock size={22} className="text-gray-400" />
  }

  const statusLabel: Record<string, string> = {
    todo:         'À faire',
    en_cours:     'En cours',
    done:         'Terminé',
    blocked:      'Bloqué',
    nappe_h:      'Nappe H',
    nappe_b:      'Nappe B',
    terminaux:    'Terminaux',
    raccordement: 'Raccordement',
  }

  const deadline = task.status !== 'done' ? getDeadlineInfo(task.date_planifiee) : null

  return (
    <div className={`rounded-2xl border-2 shadow-sm overflow-hidden ${statusColors[task.status] ?? 'border-gray-100 bg-white'}`}>
      {/* Ligne principale */}
      <div className="flex items-center gap-3 px-3 pt-3 pb-2">
        {/* Bouton statut */}
        <button
          onClick={onStatusCycle}
          className="flex-shrink-0 active:scale-90 transition-transform touch-manipulation"
          title={`Statut: ${statusLabel[task.status]} → tap pour changer`}
        >
          <StatusIcon />
        </button>

        {/* Info tâche */}
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm leading-tight ${task.status === 'done' ? 'line-through text-gray-400' : 'text-nc-blue'}`}>
            {task.label}
          </p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="text-xs text-gray-400">{statusLabel[task.status]}</span>
            {/* Zone de travail */}
            {task.zone_takt?.name && (
              <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md font-medium">
                📍 {task.zone_takt.name}
              </span>
            )}
            {/* Badge deadline — visible si non terminée */}
            {deadline && (
              <span className={`text-xs px-1.5 py-0.5 rounded-md font-semibold ${deadline.color}`}>
                {deadline.label}
              </span>
            )}
          </div>
        </div>

        {/* Lien détail */}
        <button
          onClick={onDetail}
          className="flex-shrink-0 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ChevronRight size={16} className="text-gray-300" />
        </button>
      </div>

      {/* Barre progression */}
      {task.qte_prevue > 0 && task.status !== 'todo' && (
        <div className="px-3 pb-1">
          <ProgressBar value={pct} height="h-1.5" />
        </div>
      )}

      {/* Commentaire blocage */}
      {task.status === 'blocked' && task.comment && (
        <div className="mx-3 mb-2 px-2 py-1.5 bg-red-100 rounded-lg">
          <p className="text-xs text-red-600 truncate">⚠ {task.comment}</p>
        </div>
      )}

      {/* Actions rapides — toujours présentes pour permettre l'annulation */}
      <div className="flex items-center border-t border-gray-100/80 px-1 py-1 min-h-[40px]">
        {task.status === 'done' ? (
          /* ── Tâche terminée : seul bouton = annuler ── */
          <button
            onClick={onStatusCycle}
            className="flex-1 flex items-center justify-center gap-2 py-1 text-xs font-medium
                       text-gray-400 hover:text-nc-blue hover:bg-gray-50 active:scale-95
                       transition-all rounded-xl touch-manipulation"
          >
            <RotateCcw size={13} />
            Annuler — remettre en cours
          </button>
        ) : (
          <>
            {/* ── Contrôle quantité : boutons +/- + tap pour saisir ── */}
            <div className="flex items-center gap-1 flex-1 px-1">
              <button
                onClick={() => onQtyChange(-1)}
                disabled={task.qte_realisee <= 0}
                className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30
                           flex items-center justify-center active:scale-90 transition-all touch-manipulation flex-shrink-0"
              >
                <Minus size={14} />
              </button>

              <TapQtyControl
                value={task.qte_realisee}
                max={task.qte_prevue}
                unite={task.unite}
                onDelta={onQtyChange}
              />

              <button
                onClick={() => onQtyChange(+1)}
                className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200
                           flex items-center justify-center active:scale-90 transition-all touch-manipulation flex-shrink-0"
              >
                <Plus size={14} />
              </button>
            </div>

            {/* ── Bouton blocage ── */}
            {task.status !== 'blocked' ? (
              <button
                onClick={onBlocage}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium
                           text-red-500 hover:bg-red-50 active:scale-95 transition-all touch-manipulation"
              >
                <AlertTriangle size={13} />
                Bloquer
              </button>
            ) : (
              <button
                onClick={onBlocage}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium
                           text-amber-600 hover:bg-amber-50 active:scale-95 transition-all touch-manipulation"
              >
                <AlertTriangle size={13} />
                Modifier
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Saisie quantité par tap → clavier natif ─────────────────
// Le monteur tape directement le nombre réalisé (ex: "480").
// Les boutons +/- à côté servent pour corriger de ±1.
// En tapant le chiffre, le clavier numérique du téléphone s'ouvre.

function TapQtyControl({
  value, max, unite, onDelta
}: {
  value: number
  max: number
  unite: string
  onDelta: (delta: number) => void
}) {
  const [editing, setEditing]   = useState(false)
  const [raw, setRaw]           = useState('')
  const inputRef                = useRef<HTMLInputElement>(null)

  const openEdit = () => {
    setRaw(String(value))
    setEditing(true)
    // Focus après le prochain render pour que le clavier s'ouvre
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
  }

  const confirm = () => {
    const n = parseInt(raw, 10)
    if (!isNaN(n) && n >= 0) {
      const delta = n - value
      if (delta !== 0) onDelta(delta)
    }
    setEditing(false)
  }

  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0

  if (editing) {
    return (
      <div className="flex-1 flex items-center justify-center gap-1.5 px-1">
        <input
          ref={inputRef}
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          value={raw}
          onChange={e => setRaw(e.target.value)}
          onBlur={confirm}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirm() } }}
          className="w-20 text-center font-bold text-lg text-nc-blue border-b-2 border-blue-400
                     bg-transparent outline-none"
        />
        <span className="text-gray-400 text-xs whitespace-nowrap">/ {max} {unite}</span>
        {/* Bouton OK — onMouseDown pour éviter le blur avant le click */}
        <button
          onMouseDown={e => { e.preventDefault(); confirm() }}
          onTouchStart={e => { e.preventDefault(); confirm() }}
          className="px-2 py-1 bg-blue-500 text-white text-xs font-semibold rounded-lg
                     active:scale-95 transition-transform touch-manipulation"
        >
          OK
        </button>
      </div>
    )
  }

  // Mode affichage : tap pour ouvrir le clavier
  return (
    <button
      onClick={openEdit}
      className="flex-1 flex flex-col items-center justify-center px-1 py-0.5
                 rounded-lg active:bg-blue-50 transition-colors touch-manipulation"
    >
      <div className="flex items-baseline gap-0.5">
        <span className="text-base font-bold text-nc-blue leading-none">{value}</span>
        <span className="text-gray-300 text-xs font-normal">/{max}</span>
        <span className="text-gray-400 text-xs ml-1">{unite}</span>
      </div>
      {/* Barre de progression */}
      <div className="w-full h-1 bg-gray-100 rounded-full mt-1 overflow-hidden">
        <div
          className={`h-full rounded-full ${value > max ? 'bg-orange-400' : 'bg-nc-red/50'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </button>
  )
}
