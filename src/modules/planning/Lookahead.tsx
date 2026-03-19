import { useEffect } from 'react'
import { usePlanningStore } from '@/store/planningStore'
import { useAuthStore } from '@/store/authStore'
import { currentMondayISO, joursRestants, urgenceFromJours, getSemaineLabel, addWeeks, formatDateISO } from '@/utils/dates'
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import type { Contrainte } from '@/types/models'

const URGENCE_COLORS = {
  ok: 'bg-green-50 border-green-200 text-green-700',
  attention: 'bg-amber-50 border-amber-200 text-amber-700',
  urgent: 'bg-red-50 border-red-200 text-red-700',
  retard: 'bg-gray-900 text-white border-gray-700'
}

const URGENCE_ICONS = {
  ok: <CheckCircle size={14} className="text-green-500" />,
  attention: <Clock size={14} className="text-amber-500" />,
  urgent: <AlertTriangle size={14} className="text-red-500" />,
  retard: <AlertTriangle size={14} className="text-white" />
}

export default function Lookahead() {
  const { chantier } = useAuthStore()
  const { contraintes, isLoading, loadLookahead } = usePlanningStore()
  const monday = currentMondayISO()

  useEffect(() => {
    if (!chantier?.id) return
    loadLookahead(chantier.id, monday)
  }, [chantier?.id, monday, loadLookahead])

  const semaines = [0, 1, 2].map(n => formatDateISO(addWeeks(new Date(monday), n)))

  const contraintesParSemaine = semaines.map(sem => {
    const semContraintes = (contraintes as (Contrainte & { zone_name?: string; task_label?: string })[])
      .filter(c => {
        if (!c.date_besoin) return false
        const jours = joursRestants(c.date_besoin)
        const weekEnd = new Date(sem)
        weekEnd.setDate(weekEnd.getDate() + 6)
        const cDate = new Date(c.date_besoin)
        return cDate >= new Date(sem) && cDate <= weekEnd
      })
      .map(c => ({
        ...c,
        jours: joursRestants(c.date_besoin!),
        urgence: urgenceFromJours(joursRestants(c.date_besoin!))
      }))
    return { semaine: sem, contraintes: semContraintes }
  })

  const totalUrgent = contraintes.filter(c => c.date_besoin && joursRestants(c.date_besoin) <= 3 && c.statut !== 'levee').length

  return (
    <div className="p-4">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-nc-blue">Lookahead 3 semaines</h2>
        <p className="text-gray-500 text-sm">{contraintes.length} contrainte{contraintes.length > 1 ? 's' : ''} à lever
          {totalUrgent > 0 && <span className="text-red-600 font-medium"> · {totalUrgent} urgente{totalUrgent > 1 ? 's' : ''}</span>}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[0, 1, 2].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-5">
          {contraintesParSemaine.map(({ semaine, contraintes: semContraintes }) => (
            <div key={semaine}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-nc-blue text-sm">{getSemaineLabel(semaine)}</h3>
                <span className="text-xs text-gray-400">{semContraintes.length} contrainte{semContraintes.length > 1 ? 's' : ''}</span>
              </div>

              {semContraintes.length === 0 ? (
                <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-sm text-green-600 flex items-center gap-2">
                  <CheckCircle size={16} />
                  Aucune contrainte — zone dégagée
                </div>
              ) : (
                <div className="space-y-2">
                  {semContraintes.map(c => (
                    <div key={c.id} className={`rounded-xl border p-3 ${URGENCE_COLORS[c.urgence]}`}>
                      <div className="flex items-start gap-2">
                        {URGENCE_ICONS[c.urgence]}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{c.description}</p>
                          {c.task_label && (
                            <p className="text-xs opacity-70 mt-0.5">Tâche : {c.task_label}</p>
                          )}
                          {c.responsable && (
                            <p className="text-xs opacity-70">→ {c.responsable}</p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-bold">
                            {c.jours < 0 ? `${Math.abs(c.jours)}j retard` : `J-${c.jours}`}
                          </p>
                          <p className="text-[10px] opacity-60 capitalize">{c.statut}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
