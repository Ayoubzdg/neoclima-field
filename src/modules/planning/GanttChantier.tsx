import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { getAllCyclesByChantier, getZonesByChantier, getTasksByChantier } from '@/lib/supabase'
import { buildTaktFlux, getTaktCellBg } from '@/utils/takt'
import { getSemaineLabel, formatDateISO, getMonday } from '@/utils/dates'
import { STATUS_LABELS, isValide } from '@/utils/statusMachine'
import { BarChart3, ChevronLeft, ChevronRight, CalendarClock, X, AlertTriangle, Link2 } from 'lucide-react'
import type { CycleTakt, ZoneTakt, Task, TaskStatus } from '@/types/models'

// ── Helpers pilotage cellule ────────────────────────────────

const STATUS_BADGE_CLS: Record<TaskStatus, string> = {
  todo:        'bg-slate-100 text-slate-600',
  en_cours:    'bg-blue-100 text-blue-700',
  a_controler: 'bg-amber-100 text-amber-700',
  done:        'bg-green-100 text-green-700',
  blocked:     'bg-red-100 text-red-700',
}

const FALLBACK_EQUIPE_COLOR = '#94A3B8'

/** Avancement 0-100 d'un lot de tâches : quantités si dispo, sinon statuts (done). */
function getCellProgress(tasks: Task[]): number {
  if (tasks.length === 0) return 0
  const totalPrevu = tasks.reduce((s, t) => s + (t.qte_prevue ?? 0), 0)
  if (totalPrevu > 0) {
    const totalRealise = tasks.reduce((s, t) => s + (t.qte_realisee ?? 0), 0)
    return Math.min(100, Math.round((totalRealise / totalPrevu) * 100))
  }
  const done = tasks.filter(t => isValide(t.status)).length
  return Math.round((done / tasks.length) * 100)
}

/** Équipes distinctes présentes sur un lot de tâches (couleur + nom). */
function getCellEquipes(tasks: Task[]): { id: string; name: string; couleur: string }[] {
  const map = new Map<string, { id: string; name: string; couleur: string }>()
  for (const t of tasks) {
    const id = t.equipe_id ?? t.equipe?.id
    if (!id || map.has(id)) continue
    map.set(id, {
      id,
      name: t.equipe?.name ?? 'Équipe',
      couleur: t.equipe?.couleur ?? FALLBACK_EQUIPE_COLOR,
    })
  }
  return Array.from(map.values())
}

/** Fond seul d'une cellule (sans la bordure) — pour combiner avec le liseré ambre "attente isolation". */
function getCellBgOnly(cycle: CycleTakt | null): string {
  const bg = getTaktCellBg(cycle).split(' ').find(c => c.startsWith('bg-'))
  return bg && bg !== 'bg-transparent' ? bg : 'bg-amber-50'
}

interface SelectedCell {
  zone: ZoneTakt
  semaine: string
}

export default function GanttChantier() {
  const { chantier } = useAuthStore()
  const [cycles, setCycles] = useState<CycleTakt[]>([])
  const [zones, setZones] = useState<ZoneTakt[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null)
  // Navigation timeline
  const [offsetWeeks, setOffsetWeeks] = useState(-4)
  const SEMAINES_VISIBLES = 16

  const currentWeekISO = formatDateISO(getMonday(new Date()))

  useEffect(() => {
    if (!chantier?.id) return
    setIsLoading(true)
    Promise.all([
      getAllCyclesByChantier(chantier.id),
      getZonesByChantier(chantier.id),
      getTasksByChantier(chantier.id),
    ])
      .then(([c, z, t]) => {
        setCycles(c)
        setZones(z)
        setTasks(t)
      })
      .finally(() => setIsLoading(false))
  }, [chantier?.id])

  const flux = buildTaktFlux(zones, cycles, [], SEMAINES_VISIBLES, offsetWeeks)

  // Tâches indexées par cellule `${zoneId}-${lundiISO}` (date_planifiee normalisée au lundi)
  const tasksByCell = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of tasks) {
      if (!t.zone_takt_id || !t.date_planifiee) continue
      const weekISO = formatDateISO(getMonday(new Date(t.date_planifiee)))
      const key = `${t.zone_takt_id}-${weekISO}`
      const list = map.get(key)
      if (list) list.push(t)
      else map.set(key, [t])
    }
    return map
  }, [tasks])

  // ── Chemin critique montage → isolation ───────────────────
  // Index id → tâche pour retrouver le montage prédécesseur.
  const tasksById = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks])

  // Tâches d'isolation "en dérive" : verrouillées par un prédécesseur
  // dont le montage est en retard. Définition "en retard" :
  //  · le prédécesseur n'est pas validé (status ≠ 'done') ET sa semaine
  //    planifiée (lundi ISO) est antérieure au lundi de la semaine courante,
  //  · OU l'isolation dépendante est planifiée cette semaine / une semaine
  //    passée alors que son prédécesseur n'est toujours pas validé.
  const { attenteTaskIds, zonesEnDerive } = useMemo(() => {
    const ids = new Set<string>()
    const zoneIds = new Set<string>()
    for (const t of tasks) {
      if (!t.bloquee_par_predecesseur || !t.tache_precedente_id) continue
      const pred = tasksById.get(t.tache_precedente_id)
      if (!pred || pred.status === 'done') continue
      const predSemaine = pred.date_planifiee
        ? formatDateISO(getMonday(new Date(pred.date_planifiee)))
        : null
      const isoSemaine = t.date_planifiee
        ? formatDateISO(getMonday(new Date(t.date_planifiee)))
        : null
      const predEnRetard = predSemaine !== null && predSemaine < currentWeekISO
      const isoEchue = isoSemaine !== null && isoSemaine <= currentWeekISO
      if (!predEnRetard && !isoEchue) continue
      ids.add(t.id)
      if (t.zone_takt_id) zoneIds.add(t.zone_takt_id)
    }
    return { attenteTaskIds: ids, zonesEnDerive: zoneIds }
  }, [tasks, tasksById, currentWeekISO])

  const selectedTasks = selectedCell
    ? tasksByCell.get(`${selectedCell.zone.id}-${selectedCell.semaine}`) ?? []
    : []

  // Période affichée
  const periodeLabel = flux.semaines.length > 0
    ? `${getSemaineLabel(flux.semaines[0]).split(' · ')[1]?.split(' – ')[0]} → ${getSemaineLabel(flux.semaines[flux.semaines.length - 1]).split(' · ')[1]?.split(' – ')[1]}`
    : ''

  return (
    <div className="p-4">
      {/* En-tête + navigation */}
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <BarChart3 size={20} className="text-nc-red flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-lg font-bold text-nc-blue">Gantt Chantier</h2>
            <p className="text-gray-500 text-sm">{zones.length} zones · {SEMAINES_VISIBLES} semaines</p>
          </div>
        </div>

        {/* Contrôles navigation */}
        <div className="flex items-center gap-1.5 flex-shrink-0 mt-1">
          <button
            onClick={() => setOffsetWeeks(o => o - 8)}
            className="flex items-center gap-0.5 px-2 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-nc-blue transition-colors"
            title="8 semaines en arrière"
          >
            <ChevronLeft size={13} />
            <ChevronLeft size={13} className="-ml-1.5" />
          </button>
          <button
            onClick={() => setOffsetWeeks(o => o - 1)}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-nc-blue transition-colors"
            title="Semaine précédente"
          >
            <ChevronLeft size={15} />
          </button>

          <button
            onClick={() => setOffsetWeeks(-4)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              offsetWeeks === -4
                ? 'bg-nc-blue text-white'
                : 'border border-gray-200 text-nc-blue hover:bg-blue-50'
            }`}
            title="Revenir à aujourd'hui"
          >
            <CalendarClock size={12} />
            Auj.
          </button>

          <button
            onClick={() => setOffsetWeeks(o => o + 1)}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-nc-blue transition-colors"
            title="Semaine suivante"
          >
            <ChevronRight size={15} />
          </button>
          <button
            onClick={() => setOffsetWeeks(o => o + 8)}
            className="flex items-center gap-0.5 px-2 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-nc-blue transition-colors"
            title="8 semaines en avant"
          >
            <ChevronRight size={13} />
            <ChevronRight size={13} className="-ml-1.5" />
          </button>
        </div>
      </div>

      {periodeLabel && (
        <p className="text-[11px] text-gray-400 mb-4 ml-7">{periodeLabel}</p>
      )}

      {/* Bandeau dérive chemin critique montage → isolation */}
      {!isLoading && zonesEnDerive.size > 0 && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
          <Link2 size={13} className="text-amber-600 flex-shrink-0" />
          <span>
            {zonesEnDerive.size} zone{zonesEnDerive.size > 1 ? 's' : ''} où l'isolation attend un montage en retard
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : zones.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <BarChart3 size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Aucune zone configurée</p>
          <p className="text-sm mt-1">Créer des zones dans Paramètres → Zones</p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="min-w-max border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-white text-left text-xs text-gray-500 font-semibold px-3 py-2 border-b border-r border-gray-100 w-44">
                  Zone / Secteur
                </th>
                {flux.semaines.map(sem => {
                  const isCurrent = sem === currentWeekISO
                  return (
                    <th
                      key={sem}
                      className={`text-center text-xs px-1 py-2 border-b border-gray-100 min-w-[72px] relative ${
                        isCurrent ? 'bg-nc-blue/8 text-nc-blue font-bold' : 'bg-white text-gray-400 font-medium'
                      }`}
                    >
                      {isCurrent && (
                        <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-px h-0.5 w-6 bg-nc-red rounded-b" />
                      )}
                      {getSemaineLabel(sem).split(' · ')[0]}
                      {isCurrent && (
                        <div className="text-[8px] font-bold text-nc-red uppercase mt-0.5">◆</div>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {flux.zones.map((zone, i) => (
                <tr key={zone.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                  <td className="sticky left-0 bg-inherit z-10 px-3 py-2 border-r border-b border-gray-100">
                    <p className="text-xs font-semibold text-nc-blue truncate max-w-[140px]">{zone.name}</p>
                    {zone.secteur?.name && (
                      <p className="text-[10px] text-gray-400 truncate max-w-[140px]">{zone.secteur.name}</p>
                    )}
                    {zonesEnDerive.has(zone.id) && (
                      <span
                        className="inline-block mt-0.5 px-1.5 py-px rounded bg-amber-100 text-amber-700 text-[8px] font-bold uppercase tracking-wide"
                        title="Au moins une tâche d'isolation attend un montage en retard"
                      >
                        ⛓ isolation en attente
                      </span>
                    )}
                  </td>
                  {flux.semaines.map(sem => {
                    const cell = flux.cells.get(`${zone.id}-${sem}`)
                    const cycle = cell?.cycle ?? null
                    const isCurrent = sem === currentWeekISO
                    const cellTasks = tasksByCell.get(`${zone.id}-${sem}`) ?? []
                    const hasTasks = cellTasks.length > 0
                    const hasBlocked = cellTasks.some(t => t.status === 'blocked')
                    const hasAttente = cellTasks.some(t => attenteTaskIds.has(t.id))
                    const cellEquipes = hasTasks ? getCellEquipes(cellTasks) : []
                    const progress = hasTasks ? getCellProgress(cellTasks) : 0
                    return (
                      <td key={sem} className={`px-1 py-1 border-b border-gray-100 ${isCurrent ? 'bg-nc-blue/5' : ''}`}>
                        {cycle || hasTasks ? (
                          <button
                            type="button"
                            disabled={!hasTasks}
                            onClick={() => hasTasks && setSelectedCell({ zone, semaine: sem })}
                            title={hasTasks ? `${cellTasks.length} tâche${cellTasks.length > 1 ? 's' : ''} — voir le détail` : undefined}
                            className={`w-full min-h-[28px] rounded border px-1 py-0.5 flex flex-col items-stretch justify-center gap-[3px] text-[10px] font-medium transition-all ${
                              hasBlocked
                                ? 'bg-red-50 border-nc-red ring-1 ring-nc-red/40'
                                : hasAttente
                                  ? `${getCellBgOnly(cycle)} border-dashed border-amber-500 ring-1 ring-amber-400/50`
                                  : cycle
                                    ? getTaktCellBg(cycle)
                                    : 'bg-slate-50 border-slate-200'
                            } ${hasTasks ? 'cursor-pointer hover:shadow-md active:scale-95' : 'cursor-default'}`}
                          >
                            {/* Ligne haute : % PPC du cycle + pastilles équipes */}
                            <span className="flex items-center justify-center gap-1 leading-none">
                              {hasBlocked && <AlertTriangle size={9} className="text-nc-red flex-shrink-0" />}
                              {hasAttente && <Link2 size={9} className="text-amber-600 flex-shrink-0" />}
                              {cycle && (
                                <span className={hasBlocked ? 'text-nc-red font-bold' : ''}>
                                  {cycle.ppc !== null && cycle.ppc !== undefined ? `${cycle.ppc}%` : '–'}
                                </span>
                              )}
                              {cellEquipes.length > 0 && (
                                <span className="flex items-center -space-x-0.5">
                                  {cellEquipes.slice(0, 3).map(eq => (
                                    <span
                                      key={eq.id}
                                      title={eq.name}
                                      className="w-2 h-2 rounded-full ring-1 ring-white flex-shrink-0"
                                      style={{ backgroundColor: eq.couleur }}
                                    />
                                  ))}
                                  {cellEquipes.length > 3 && (
                                    <span className="pl-1 text-[8px] text-gray-500 font-semibold">+{cellEquipes.length - 3}</span>
                                  )}
                                </span>
                              )}
                            </span>
                            {/* Mini-jauge d'avancement de la zone cette semaine */}
                            {hasTasks && (
                              <span className="block h-1 w-full rounded-full bg-black/10 overflow-hidden">
                                <span
                                  className={`block h-full rounded-full transition-all ${hasBlocked ? 'bg-nc-red' : 'bg-nc-blue'}`}
                                  style={{ width: `${progress}%` }}
                                />
                              </span>
                            )}
                          </button>
                        ) : (
                          <div className={`h-7 rounded border border-dashed ${isCurrent ? 'border-nc-blue/25' : 'border-gray-200'}`} />
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Légende */}
          <div className="flex items-center gap-4 mt-4 px-1 flex-wrap">
            {[
              { label: 'Planifié', cls: 'bg-slate-100 border-slate-300' },
              { label: 'En cours', cls: 'bg-blue-100 border-blue-400' },
              { label: 'Partiel', cls: 'bg-yellow-100 border-yellow-400' },
              { label: 'Complet', cls: 'bg-green-100 border-green-400' },
              { label: 'Tâche bloquée', cls: 'bg-red-50 border-nc-red' },
              { label: '⛓ Isolation en attente du montage', cls: 'bg-amber-50 border-dashed border-amber-500' },
            ].map(({ label, cls }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`w-4 h-4 rounded border ${cls}`} />
                <span className="text-[11px] text-gray-500">{label}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <span className="flex items-center -space-x-0.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-1 ring-white" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-1 ring-white" />
              </span>
              <span className="text-[11px] text-gray-500">Équipes présentes</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="block h-1 w-6 rounded-full bg-black/10 overflow-hidden">
                <span className="block h-full w-2/3 rounded-full bg-nc-blue" />
              </span>
              <span className="text-[11px] text-gray-500">Avancement semaine</span>
            </div>
            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-nc-red text-xs font-bold">◆</span>
              <span className="text-[11px] text-gray-500">Semaine en cours</span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom-sheet détail cellule */}
      {selectedCell && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSelectedCell(null)}
          />
          {/* Sheet */}
          <div className="relative bg-white rounded-t-2xl shadow-xl max-h-[75vh] flex flex-col w-full md:max-w-lg md:mx-auto">
            <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 border-b border-gray-100">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-nc-blue truncate">{selectedCell.zone.name}</h3>
                <p className="text-xs text-gray-500">
                  {getSemaineLabel(selectedCell.semaine)}
                  {' · '}
                  {selectedTasks.length} tâche{selectedTasks.length > 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => setSelectedCell(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-nc-blue transition-colors flex-shrink-0"
                title="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 pb-6">
              {selectedTasks.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Aucune tâche planifiée</p>
              ) : (
                selectedTasks.map(task => {
                  // Montage prédécesseur d'une tâche verrouillée (chaîne montage → isolation)
                  const pred = task.bloquee_par_predecesseur && task.tache_precedente_id
                    ? tasksById.get(task.tache_precedente_id)
                    : undefined
                  const predSemaine = pred?.date_planifiee
                    ? formatDateISO(getMonday(new Date(pred.date_planifiee)))
                    : null
                  return (
                  <div key={task.id} className="px-4 py-3 flex items-start gap-3 border-b border-gray-50 last:border-b-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                      title={task.equipe?.name}
                      style={{ backgroundColor: task.equipe?.couleur ?? FALLBACK_EQUIPE_COLOR }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-nc-blue leading-snug">{task.label}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{task.equipe?.name ?? 'Sans équipe'}</p>
                      {task.bloquee_par_predecesseur && (
                        <p className="text-[11px] text-amber-700 mt-1 leading-snug">
                          🔒 attend : {pred?.label ?? 'montage précédent'}
                          {predSemaine ? ` — planifié ${getSemaineLabel(predSemaine)}` : ' — non planifié'}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_BADGE_CLS[task.status]}`}>
                        {STATUS_LABELS[task.status]}
                      </span>
                      <p className="text-[11px] text-gray-500 mt-1 tabular-nums">
                        {task.qte_realisee ?? 0}/{task.qte_prevue ?? 0} {task.unite}
                      </p>
                    </div>
                  </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
