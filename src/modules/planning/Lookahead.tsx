import { useEffect, useState } from 'react'
import { usePlanningStore } from '@/store/planningStore'
import { useAuthStore } from '@/store/authStore'
import { leverContrainte, upsertContrainte } from '@/lib/supabase'
import {
  currentMondayISO, joursRestants, urgenceFromJours,
  getSemaineLabel, addWeeks, formatDateISO
} from '@/utils/dates'
import { AlertTriangle, CheckCircle, Clock, Check } from 'lucide-react'
import type { Contrainte } from '@/types/models'

const TYPE_EMOJI: Record<string, string> = {
  materiau: '📦', acces: '🚧', autre_corps: '🔧',
  gros_oeuvre: '🏗️', equipement: '⚙️', autre: '❓',
}

const URGENCE_COLORS = {
  ok:        'bg-green-50 border-green-200 text-green-700',
  attention: 'bg-amber-50 border-amber-200 text-amber-700',
  urgent:    'bg-red-50 border-red-200 text-red-700',
  retard:    'bg-gray-900 text-white border-gray-700',
}

const STATUT_COLOR: Record<string, string> = {
  ouverte:  'bg-red-100 border-red-200 text-red-700',
  en_cours: 'bg-amber-100 border-amber-200 text-amber-700',
  levee:    'bg-green-100 border-green-200 text-green-700',
}

export default function Lookahead() {
  const { chantier } = useAuthStore()
  const { contraintes, isLoading, loadLookahead } = usePlanningStore()
  const monday = currentMondayISO()

  const [selected, setSelected] = useState<Contrainte | null>(null)
  const [levering, setLevering] = useState(false)

  useEffect(() => {
    if (!chantier?.id) return
    loadLookahead(chantier.id, monday)
  }, [chantier?.id, monday, loadLookahead])

  const refresh = () => { if (chantier?.id) loadLookahead(chantier.id, monday) }

  const handleLever = async () => {
    if (!selected) return
    setLevering(true)
    await leverContrainte(selected.id)
    setLevering(false)
    setSelected(null)
    refresh()
  }

  const handleEnCours = async () => {
    if (!selected) return
    await upsertContrainte({ id: selected.id, statut: 'en_cours' })
    setSelected(null)
    refresh()
  }

  const semaines = [0, 1, 2].map(n => formatDateISO(addWeeks(new Date(monday), n)))

  const contraintesParSemaine = semaines.map(sem => {
    const semContraintes = (contraintes as (Contrainte & { zone_name?: string; task_label?: string })[])
      .filter(c => {
        if (!c.date_besoin) return false
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

  const totalUrgent = contraintes.filter(
    c => c.date_besoin && joursRestants(c.date_besoin) <= 3 && c.statut !== 'levee'
  ).length

  return (
    <div className="p-4 pb-24">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-nc-blue">Lookahead 3 semaines</h2>
        <p className="text-gray-500 text-sm">
          {contraintes.length} contrainte{contraintes.length > 1 ? 's' : ''} à lever
          {totalUrgent > 0 && (
            <span className="text-red-600 font-medium"> · {totalUrgent} urgente{totalUrgent > 1 ? 's' : ''}</span>
          )}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">Appuie sur une contrainte pour la lever</p>
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
                <span className="text-xs text-gray-400">
                  {semContraintes.length} contrainte{semContraintes.length > 1 ? 's' : ''}
                </span>
              </div>

              {semContraintes.length === 0 ? (
                <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-sm text-green-600 flex items-center gap-2">
                  <CheckCircle size={16} />
                  Aucune contrainte — zone dégagée
                </div>
              ) : (
                <div className="space-y-2">
                  {semContraintes.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setSelected(c)}
                      className={`w-full rounded-xl border p-3 text-left hover:brightness-95 transition-all active:scale-98 ${URGENCE_COLORS[c.urgence]}`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-lg flex-shrink-0">{TYPE_EMOJI[c.type] ?? '❓'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{c.description}</p>
                          {(c as Contrainte & { task_label?: string }).task_label && (
                            <p className="text-xs opacity-70 mt-0.5">
                              Tâche : {(c as Contrainte & { task_label?: string }).task_label}
                            </p>
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
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── SHEET : Lever une contrainte ─────────────────────── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative w-full bg-white rounded-t-2xl p-5 shadow-2xl z-10 max-w-lg mx-auto">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

            <div className="flex items-start gap-3 mb-4">
              <span className="text-2xl">{TYPE_EMOJI[selected.type] ?? '❓'}</span>
              <div className="flex-1">
                <p className="font-bold text-nc-blue text-base">{selected.description}</p>
                {selected.responsable && (
                  <p className="text-sm text-gray-500 mt-0.5">→ {selected.responsable}</p>
                )}
                {selected.date_besoin && (
                  <p className="text-xs text-gray-400 mt-1">
                    Besoin le {new Date(selected.date_besoin).toLocaleDateString('fr-FR', {
                      weekday: 'long', day: 'numeric', month: 'long'
                    })}
                  </p>
                )}
                <span className={`inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full border ${STATUT_COLOR[selected.statut] ?? ''}`}>
                  {selected.statut === 'ouverte' ? 'Ouverte' : selected.statut === 'en_cours' ? 'En cours' : 'Levée'}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              {selected.statut === 'ouverte' && (
                <button
                  onClick={handleEnCours}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-amber-400 text-amber-700 font-semibold text-sm hover:bg-amber-50 transition-colors"
                >
                  <Clock size={16} />
                  En cours
                </button>
              )}
              <button
                onClick={handleLever}
                disabled={levering}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {levering ? (
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                Lever la contrainte
              </button>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="w-full mt-2 py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
