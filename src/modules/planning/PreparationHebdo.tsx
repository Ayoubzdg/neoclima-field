import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase, updateTask } from '@/lib/supabase'
import { currentMondayISO, addWeeks, formatDateISO, getSemaineLabel } from '@/utils/dates'
import {
  ChevronLeft, ChevronRight, Users, Ban, PlusCircle, MinusCircle,
  AlertTriangle, CheckCircle, ClipboardCheck, MapPin,
} from 'lucide-react'
import type { Task, Contrainte } from '@/types/models'

// ─────────────────────────────────────────────────────────────
// CAPACITÉ HEBDO PAR ÉQUIPE
// Une équipe type = 2 monteurs × 8 h/jour × 5 jours = 80 h.
// Sert de référence pour la jauge de charge : on compare la
// somme des heures_prevues engagées à cette capacité.
// ─────────────────────────────────────────────────────────────
const CAPACITE_EQUIPE_HEURES = 2 * 8 * 5 // = 80 h

/** Libellés FR des types de contraintes (cf. ContrainteType) */
const CONTRAINTE_TYPE_LABEL: Record<string, string> = {
  materiau: 'Matériau',
  acces: 'Accès',
  gros_oeuvre: 'Gros œuvre',
  autre_corps: 'Autre corps d’état',
  equipement: 'Équipement',
  plan_manquant: 'Plan manquant',
  erreur_plan: 'Erreur de plan',
  validation: 'Validation',
  reservation: 'Réservation',
  securite: 'Sécurité',
  technique: 'Technique',
  autre: 'Autre',
}

/** Contraintes non levées d'une tâche (bloquantes pour l'engagement) */
function contraintesNonLevees(task: Task): Contrainte[] {
  return (task.contraintes ?? []).filter(c => c.statut !== 'levee')
}

/** Couleurs de jauge selon le taux de charge */
function chargeColor(pct: number): string {
  if (pct > 100) return '#EF4444' // rouge : surengagement
  if (pct >= 80) return '#F59E0B' // ambre : proche de la capacité
  return '#22C55E'                // vert : marge disponible
}

export default function PreparationHebdo() {
  const { chantier } = useAuthStore()
  // Par défaut : S+1, la semaine que le chef prépare
  const [semaine, setSemaine] = useState(() => formatDateISO(addWeeks(new Date(currentMondayISO()), 1)))
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const loadTasks = useCallback(async () => {
    if (!chantier?.id) return
    setIsLoading(true)
    // Requête dédiée : getTasksByChantier ne joint pas les contraintes,
    // or on en a besoin pour interdire l'engagement (Last Planner).
    const { data, error } = await supabase
      .from('tasks')
      .select('*, equipe:equipes(*), zone_takt:zones_takt!inner(*, secteur:secteurs!inner(*)), contraintes(*)')
      .eq('zone_takt.secteur.chantier_id', chantier.id)
      .eq('date_planifiee', semaine)
    if (!error) setTasks((data ?? []) as Task[])
    setIsLoading(false)
  }, [chantier?.id, semaine])

  useEffect(() => { loadTasks() }, [loadTasks])

  const changeSemaine = (delta: number) =>
    setSemaine(prev => formatDateISO(addWeeks(new Date(prev), delta)))

  const isSemaineAPreparer = semaine === formatDateISO(addWeeks(new Date(currentMondayISO()), 1))

  const candidates = tasks.filter(t => !t.engage)
  const engagees = tasks.filter(t => t.engage)

  // ── Engagement groupé par équipe + charge ──────────────────
  const parEquipe = useMemo(() => {
    const groupes = new Map<string, { nom: string; couleur: string; tasks: Task[]; heures: number }>()
    for (const t of engagees) {
      const key = t.equipe_id ?? 'sans-equipe'
      if (!groupes.has(key)) {
        groupes.set(key, {
          nom: t.equipe?.name ?? 'Sans équipe',
          couleur: t.equipe?.couleur ?? '#9CA3AF',
          tasks: [],
          heures: 0,
        })
      }
      const g = groupes.get(key)!
      g.tasks.push(t)
      g.heures += t.heures_prevues ?? 0
    }
    return Array.from(groupes.entries()).map(([id, g]) => ({
      id, ...g, pct: Math.round((g.heures / CAPACITE_EQUIPE_HEURES) * 100),
    })).sort((a, b) => a.nom.localeCompare(b.nom))
  }, [engagees])

  const totalHeures = parEquipe.reduce((s, g) => s + g.heures, 0)
  const totalCapacite = parEquipe.length * CAPACITE_EQUIPE_HEURES
  const totalPct = totalCapacite > 0 ? Math.round((totalHeures / totalCapacite) * 100) : 0

  // ── Toggle engager / désengager ────────────────────────────
  const handleToggleEngage = async (task: Task) => {
    const nouveau = !task.engage
    setTogglingId(task.id)
    // Optimiste : maj locale immédiate, rollback si le serveur refuse
    setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, engage: nouveau } : t)))
    try {
      await updateTask(task.id, { engage: nouveau })
    } catch {
      setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, engage: !nouveau } : t)))
    }
    setTogglingId(null)
  }

  // ── Badge équipe (même convention que WeeklyPlan) ──────────
  const EquipeBadge = ({ nom, couleur }: { nom?: string; couleur?: string }) => {
    if (!nom) return null
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
        style={{ backgroundColor: `${couleur ?? '#6366f1'}22`, color: couleur ?? '#6366f1' }}>
        <Users size={10} />
        {nom}
      </span>
    )
  }

  return (
    <div className="p-4 pb-24">
      {/* ── Header + navigation semaine ── */}
      <div className="flex items-center justify-between mb-1">
        <button onClick={() => changeSemaine(-1)} className="p-2 rounded-xl hover:bg-gray-100">
          <ChevronLeft size={20} className="text-gray-500" />
        </button>
        <div className="text-center">
          <h2 className="font-bold text-nc-blue text-sm flex items-center justify-center gap-1.5">
            <ClipboardCheck size={16} className="text-nc-red" />
            Préparation hebdo
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">{getSemaineLabel(semaine)}</p>
          {isSemaineAPreparer && (
            <p className="text-[10px] text-nc-red font-medium mt-0.5">Semaine à préparer (S+1)</p>
          )}
        </div>
        <button onClick={() => changeSemaine(1)} className="p-2 rounded-xl hover:bg-gray-100">
          <ChevronRight size={20} className="text-gray-500" />
        </button>
      </div>
      <p className="text-xs text-gray-400 text-center mb-5">
        Engage uniquement ce qui est réellement faisable — contraintes levées d'abord
      </p>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* ── Charge globale ── */}
          {parEquipe.length > 0 && (
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-nc-blue">Charge globale engagée</p>
                <p className="text-lg font-bold" style={{ color: chargeColor(totalPct) }}>
                  {totalPct}%
                </p>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(totalPct, 100)}%`, backgroundColor: chargeColor(totalPct) }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                {totalHeures} h engagées / {totalCapacite} h de capacité
                ({parEquipe.length} équipe{parEquipe.length > 1 ? 's' : ''} × {CAPACITE_EQUIPE_HEURES} h)
              </p>
              {totalPct > 100 && (
                <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                  <AlertTriangle size={12} />
                  Surengagement global — allège le plan ou renforce les équipes
                </p>
              )}
            </div>
          )}

          {/* ── Engagement par équipe ── */}
          <div className="mb-6">
            <p className="text-sm font-semibold text-gray-700 mb-2">
              Engagement par équipe ({engagees.length} tâche{engagees.length > 1 ? 's' : ''})
            </p>
            {parEquipe.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center bg-white rounded-2xl border border-gray-100">
                Aucune tâche engagée pour cette semaine
              </p>
            ) : (
              <div className="space-y-3">
                {parEquipe.map(g => (
                  <div key={g.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    {/* Jauge de charge de l'équipe */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold"
                        style={{ color: g.couleur }}>
                        <Users size={14} />
                        {g.nom}
                      </span>
                      <span className="text-sm font-bold" style={{ color: chargeColor(g.pct) }}>
                        {g.heures} h / {CAPACITE_EQUIPE_HEURES} h · {g.pct}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-1">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(g.pct, 100)}%`, backgroundColor: chargeColor(g.pct) }}
                      />
                    </div>
                    {g.pct > 100 && (
                      <p className="text-xs text-red-600 font-medium mb-1 flex items-center gap-1">
                        <AlertTriangle size={12} />
                        Surengagement : {g.heures - CAPACITE_EQUIPE_HEURES} h au-dessus de la capacité
                      </p>
                    )}

                    {/* Tâches engagées de l'équipe */}
                    <div className="mt-2 space-y-1.5">
                      {g.tasks.map(task => (
                        <div key={task.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-nc-blue font-medium truncate">{task.label}</p>
                            <p className="text-xs text-gray-400 flex items-center gap-1">
                              {task.zone_takt?.name && (
                                <><MapPin size={10} />{task.zone_takt.name} · </>
                              )}
                              {task.heures_prevues ?? 0} h
                            </p>
                          </div>
                          <button
                            onClick={() => handleToggleEngage(task)}
                            disabled={togglingId === task.id}
                            title="Désengager la tâche"
                            className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                          >
                            <MinusCircle size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Tâches candidates ── */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">
              Tâches candidates ({candidates.length})
            </p>
            {candidates.length === 0 ? (
              <div className="bg-green-50 border border-green-100 rounded-2xl p-3 text-sm text-green-600 flex items-center gap-2">
                <CheckCircle size={16} />
                Toutes les tâches planifiées de la semaine sont engagées
              </div>
            ) : (
              <div className="space-y-2">
                {candidates.map(task => {
                  const bloquantes = contraintesNonLevees(task)
                  const bloquee = bloquantes.length > 0
                  return (
                    <div
                      key={task.id}
                      className={`bg-white rounded-2xl border p-3 shadow-sm ${bloquee ? 'border-red-200' : 'border-gray-100'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-nc-blue truncate">{task.label}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {task.zone_takt?.name && (
                              <span className="text-xs text-gray-400 inline-flex items-center gap-0.5">
                                <MapPin size={10} />{task.zone_takt.name}
                              </span>
                            )}
                            <EquipeBadge nom={task.equipe?.name} couleur={task.equipe?.couleur} />
                            <span className="text-xs text-gray-400">{task.heures_prevues ?? 0} h</span>
                          </div>
                          {/* Contraintes non levées → engagement interdit */}
                          {bloquee && (
                            <div className="mt-2 space-y-1">
                              {bloquantes.map(c => (
                                <p key={c.id} className="text-xs text-red-600 font-medium flex items-center gap-1">
                                  <Ban size={12} className="flex-shrink-0" />
                                  🚫 {CONTRAINTE_TYPE_LABEL[c.type] ?? c.type} — {c.description}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => !bloquee && handleToggleEngage(task)}
                          disabled={bloquee || togglingId === task.id}
                          title={bloquee ? 'Contrainte à lever d’abord' : 'Engager la tâche'}
                          className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors
                            ${bloquee
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-nc-blue text-white hover:brightness-110 active:scale-95 disabled:opacity-40'}`}
                        >
                          <PlusCircle size={14} />
                          Engager
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
