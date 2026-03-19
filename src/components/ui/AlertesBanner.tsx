/**
 * AlertesBanner — Bandeau d'alertes prioritaires
 * Utilisé par DashboardChef et TableauFluxTakt (CA)
 *
 * Affiche en ordre de priorité :
 *  1. Blocages actifs (status = 'blocked')
 *  2. Tâches en retard (semaine précédente non terminées)
 *  3. Retard d'avancement global (mi-semaine + % trop bas)
 */

import { AlertTriangle, AlertCircle, Clock, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { currentMondayISO } from '@/utils/dates'
import type { Task, Equipe } from '@/types/models'
import { calculerAvancement } from '@/utils/ppc'

// ── Types ────────────────────────────────────────────────────

export interface Alerte {
  id: string
  niveau: 'critique' | 'urgent' | 'attention'
  titre: string
  detail?: string
  taskId?: string    // lien direct vers une tâche
}

// ── Calcul des alertes depuis les données brutes ─────────────

export function computeAlertes(allTasks: Task[], equipes: Equipe[]): Alerte[] {
  const alertes: Alerte[] = []
  const monday = currentMondayISO()
  const mondayDate = new Date(monday)

  // 1. Blocages actifs — CRITIQUE
  const blocked = allTasks.filter(t => t.status === 'blocked')
  blocked.forEach(task => {
    const equipeName = equipes.find(e => e.id === task.equipe_id)?.name ?? 'Équipe inconnue'
    alertes.push({
      id: `blocked-${task.id}`,
      niveau: 'critique',
      titre: `Blocage — ${equipeName}`,
      detail: task.label + (task.comment ? ` : ${task.comment}` : ''),
      taskId: task.id,
    })
  })

  // 2. Tâches en retard (semaine précédente, non terminées) — URGENT
  const retard = allTasks.filter(t => {
    if (!t.date_planifiee) return false
    const taskDate = new Date(t.date_planifiee)
    return taskDate < mondayDate && t.status !== 'done'
  })
  if (retard.length > 0) {
    const equipesRetard = [...new Set(
      retard.map(t => equipes.find(e => e.id === t.equipe_id)?.name).filter(Boolean)
    )]
    alertes.push({
      id: 'retard-semaine',
      niveau: 'urgent',
      titre: `${retard.length} tâche${retard.length > 1 ? 's' : ''} en retard`,
      detail: equipesRetard.length > 0
        ? `Équipe${equipesRetard.length > 1 ? 's' : ''} : ${equipesRetard.join(', ')}`
        : `Semaine précédente non clôturée`,
    })
  }

  // 3. Retard d'avancement global (jeudi/vendredi + < 60%) — ATTENTION
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dayOfWeek = today.getDay() // 0=dim, 1=lun, ..., 5=ven
  const isLateWeek = dayOfWeek >= 4 // jeudi ou vendredi
  const isMidWeek = dayOfWeek === 3  // mercredi

  if (isLateWeek || isMidWeek) {
    const tasksSemaine = allTasks.filter(t => t.date_planifiee != null && t.date_planifiee >= monday)
    const avancement = calculerAvancement(tasksSemaine)
    const seuilAttention = isLateWeek ? 70 : 40 // jeudi: 70%, mercredi: 40%

    if (tasksSemaine.length > 0 && avancement < seuilAttention) {
      alertes.push({
        id: 'retard-avancement',
        niveau: 'attention',
        titre: `Avancement insuffisant — ${avancement}%`,
        detail: isLateWeek
          ? `Seulement ${avancement}% de réalisation. Vendredi approche.`
          : `${avancement}% en milieu de semaine. Risque de non-respect du Takt.`,
      })
    }
  }

  return alertes
}

// ── Composant visuel ─────────────────────────────────────────

const NIVEAU_STYLES = {
  critique: {
    container: 'bg-red-50 border-red-200',
    icon: 'text-red-500',
    title: 'text-red-800',
    detail: 'text-red-600',
    badge: 'bg-red-500 text-white',
    Icon: AlertCircle,
  },
  urgent: {
    container: 'bg-orange-50 border-orange-200',
    icon: 'text-orange-500',
    title: 'text-orange-800',
    detail: 'text-orange-600',
    badge: 'bg-orange-500 text-white',
    Icon: AlertTriangle,
  },
  attention: {
    container: 'bg-amber-50 border-amber-200',
    icon: 'text-amber-500',
    title: 'text-amber-800',
    detail: 'text-amber-600',
    badge: 'bg-amber-400 text-white',
    Icon: Clock,
  },
}

export default function AlertesBanner({
  allTasks,
  equipes,
  collapsed = false,
}: {
  allTasks: Task[]
  equipes: Equipe[]
  collapsed?: boolean
}) {
  const navigate = useNavigate()
  const alertes = computeAlertes(allTasks, equipes)

  if (alertes.length === 0) return null

  const critiques = alertes.filter(a => a.niveau === 'critique').length
  const urgents = alertes.filter(a => a.niveau === 'urgent').length

  // Vue compacte (pour header / badge)
  if (collapsed) {
    return (
      <div className="flex items-center gap-1.5">
        {critiques > 0 && (
          <span className="flex items-center gap-1 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            <AlertCircle size={11} />
            {critiques}
          </span>
        )}
        {urgents > 0 && (
          <span className="flex items-center gap-1 bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            <AlertTriangle size={11} />
            {urgents}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2 mb-4">
      {alertes.map(alerte => {
        const styles = NIVEAU_STYLES[alerte.niveau]
        const Icon = styles.Icon

        return (
          <div
            key={alerte.id}
            className={`rounded-xl border px-3 py-2.5 flex items-start gap-2.5 ${styles.container}`}
          >
            <Icon size={16} className={`${styles.icon} flex-shrink-0 mt-0.5`} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${styles.title}`}>{alerte.titre}</p>
              {alerte.detail && (
                <p className={`text-xs mt-0.5 truncate ${styles.detail}`}>{alerte.detail}</p>
              )}
            </div>
            {/* Lien direct vers la tâche si disponible */}
            {alerte.taskId && (
              <button
                onClick={() => navigate(`/production/tache/${alerte.taskId}`)}
                className={`flex-shrink-0 flex items-center gap-0.5 text-xs font-semibold ${styles.detail} hover:underline`}
              >
                Voir
                <ChevronRight size={13} />
              </button>
            )}
            {/* Lien vers blocages si critique sans taskId direct */}
            {!alerte.taskId && alerte.niveau === 'critique' && (
              <button
                onClick={() => navigate('/production/blocages')}
                className={`flex-shrink-0 flex items-center gap-0.5 text-xs font-semibold ${styles.detail} hover:underline`}
              >
                Blocages
                <ChevronRight size={13} />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
