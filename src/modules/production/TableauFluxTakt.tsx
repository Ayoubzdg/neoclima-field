import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import {
  getAllCyclesByChantier, getZonesByChantier, upsertCycle,
  getTasksByCycle, upsertTask, deleteTask, getEquipes, getTasksByChantier
} from '@/lib/supabase'
import { buildTaktFlux, getTaktCellBg } from '@/utils/takt'
import { getSemaineLabel } from '@/utils/dates'
import type { CycleTakt, ZoneTakt, Task, Equipe } from '@/types/models'
import StatusBadge from '@/components/ui/StatusBadge'
import AlertesBanner from '@/components/ui/AlertesBanner'
import { X, Plus, Trash2, CheckCircle, Clock, Loader2, Pencil } from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// Types locaux
// ─────────────────────────────────────────────────────────────

interface SelectedCell {
  zone: ZoneTakt
  semaine: string
  cycle: CycleTakt | null
}

// ─────────────────────────────────────────────────────────────
// Modal d'édition d'un cycle Takt
// ─────────────────────────────────────────────────────────────

function CycleEditModal({
  cell,
  equipes,
  onClose,
  onRefresh,
}: {
  cell: SelectedCell
  equipes: Equipe[]
  onClose: () => void
  onRefresh: () => void
}) {
  const { zone, semaine } = cell

  // État local du cycle (peut changer si on vient d'en créer un)
  const [cycle, setCycle] = useState<CycleTakt | null>(cell.cycle)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Champs du cycle
  const [statut, setStatut] = useState<CycleTakt['statut']>(cell.cycle?.statut ?? 'planifie')
  const [noteChef, setNoteChef] = useState(cell.cycle?.note_chef ?? '')
  const [saveOk, setSaveOk] = useState(false)

  // Formulaire ajout tâche
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [taskForm, setTaskForm] = useState({
    label: '', equipe_id: '', qte_prevue: '1', unite: 'u', heures_prevues: '4'
  })
  const [taskSaving, setTaskSaving] = useState(false)
  const [taskError, setTaskError] = useState<string | null>(null)

  const semaineLabel = getSemaineLabel(semaine)

  // Charger les tâches dès qu'on a un cycle
  useEffect(() => {
    if (!cycle) return
    setLoadingTasks(true)
    getTasksByCycle(cycle.id)
      .then(setTasks)
      .finally(() => setLoadingTasks(false))
  }, [cycle?.id])

  // ── Créer un cycle ──────────────────────────────────────────
  const handleCreateCycle = async () => {
    setIsSaving(true)
    try {
      const saved = await upsertCycle({
        zone_takt_id: zone.id,
        semaine,
        statut: 'planifie',
        note_chef: '',
      })
      setCycle(saved)
      setStatut(saved.statut)
      onRefresh()
    } finally {
      setIsSaving(false)
    }
  }

  // ── Enregistrer statut + note ───────────────────────────────
  const handleSaveCycle = async () => {
    if (!cycle) return
    setIsSaving(true)
    setSaveOk(false)
    try {
      await upsertCycle({ id: cycle.id, zone_takt_id: zone.id, semaine, statut, note_chef: noteChef })
      onRefresh()
      setSaveOk(true)
      setTimeout(() => setSaveOk(false), 2000)
    } finally {
      setIsSaving(false)
    }
  }

  // ── Ajouter une tâche ───────────────────────────────────────
  const handleAddTask = async () => {
    if (!cycle) return
    if (!taskForm.label.trim()) { setTaskError('Libellé requis'); return }
    setTaskError(null)
    setTaskSaving(true)
    try {
      const newTask = await upsertTask({
        cycle_id: cycle.id,
        zone_takt_id: zone.id,
        label: taskForm.label.trim(),
        equipe_id: taskForm.equipe_id || null,
        qte_prevue: parseFloat(taskForm.qte_prevue) || 1,
        qte_realisee: 0,
        unite: taskForm.unite || 'u',
        heures_prevues: parseFloat(taskForm.heures_prevues) || 4,
        heures_realisees: 0,
        status: 'todo',
        date_planifiee: semaine,
        engage: false,
        cout_unitaire: 0,
      })
      setTasks(prev => [...prev, newTask])
      setTaskForm({ label: '', equipe_id: '', qte_prevue: '1', unite: 'u', heures_prevues: '4' })
      setShowTaskForm(false)
    } finally {
      setTaskSaving(false)
    }
  }

  // ── Supprimer une tâche ─────────────────────────────────────
  const handleDeleteTask = async (task: Task) => {
    if (task.status !== 'todo') {
      alert('Seules les tâches "À faire" peuvent être supprimées.')
      return
    }
    if (!confirm(`Supprimer la tâche "${task.label}" ?`)) return
    await deleteTask(task.id)
    setTasks(prev => prev.filter(t => t.id !== task.id))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Fond semi-transparent */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel modal */}
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="bg-nc-blue text-white px-5 py-4 rounded-t-2xl flex items-start justify-between gap-3 flex-shrink-0">
          <div>
            <p className="font-bold text-sm">{zone.name}</p>
            <p className="text-white/70 text-xs mt-0.5">{semaineLabel}</p>
            {zone.superficie && (
              <p className="text-white/50 text-[10px] mt-0.5">{zone.superficie} m²</p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-xl flex-shrink-0 mt-0.5">
            <X size={18} />
          </button>
        </div>

        {/* Contenu scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {!cycle ? (
            /* ── Pas de cycle → création ── */
            <div className="flex flex-col items-center py-8 text-center gap-4">
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
                <Clock size={26} className="text-slate-400" />
              </div>
              <div>
                <p className="font-semibold text-nc-blue">Aucun cycle planifié</p>
                <p className="text-sm text-gray-400 mt-1">
                  Créer un cycle pour planifier le travail sur cette zone pendant cette semaine
                </p>
              </div>
              <button
                onClick={handleCreateCycle}
                disabled={isSaving}
                className="px-6 py-2.5 bg-nc-blue text-white rounded-xl text-sm font-semibold hover:bg-nc-blue/90 disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                Planifier ce cycle
              </button>
            </div>
          ) : (
            <>
              {/* ── Statut ── */}
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Statut du cycle</p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: 'planifie', label: 'Planifié', active: 'bg-slate-600 text-white', inactive: 'bg-slate-100 text-slate-600 hover:bg-slate-200' },
                    { value: 'en_cours', label: 'En cours', active: 'bg-blue-600 text-white', inactive: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
                    { value: 'partiel', label: 'Partiel', active: 'bg-amber-500 text-white', inactive: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
                    { value: 'complete', label: 'Complet', active: 'bg-green-600 text-white', inactive: 'bg-green-50 text-green-700 hover:bg-green-100' },
                  ] as const).map(s => (
                    <button
                      key={s.value}
                      onClick={() => setStatut(s.value)}
                      className={`py-2 rounded-xl text-xs font-semibold transition-colors ${statut === s.value ? s.active : s.inactive}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Note chef ── */}
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Note chef de chantier</p>
                <textarea
                  value={noteChef}
                  onChange={e => setNoteChef(e.target.value)}
                  rows={2}
                  placeholder="Ex : Attente réception matériel, démarrage confirmé lundi..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-nc-blue/30 focus:border-nc-blue/40"
                />
              </div>

              {/* ── Bouton save cycle ── */}
              <button
                onClick={handleSaveCycle}
                disabled={isSaving}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                  saveOk
                    ? 'bg-green-500 text-white'
                    : 'bg-nc-blue text-white hover:bg-nc-blue/90 disabled:opacity-50'
                }`}
              >
                {isSaving
                  ? <Loader2 size={15} className="animate-spin" />
                  : saveOk
                    ? <CheckCircle size={15} />
                    : <Pencil size={15} />
                }
                {saveOk ? 'Enregistré !' : 'Enregistrer le cycle'}
              </button>

              {/* ── Séparateur tâches ── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Tâches ({tasks.length})
                  </p>
                  <button
                    onClick={() => { setShowTaskForm(p => !p); setTaskError(null) }}
                    className="flex items-center gap-1 text-xs text-nc-blue font-semibold hover:underline"
                  >
                    <Plus size={13} />
                    Ajouter une tâche
                  </button>
                </div>

                {/* Formulaire ajout tâche */}
                {showTaskForm && (
                  <div className="border border-dashed border-nc-blue/30 rounded-xl p-3.5 mb-3 space-y-2.5 bg-blue-50/40">
                    <div>
                      <input
                        value={taskForm.label}
                        onChange={e => setTaskForm(f => ({ ...f, label: e.target.value }))}
                        placeholder="Libellé de la tâche *"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue/30"
                        onKeyDown={e => { if (e.key === 'Enter') handleAddTask() }}
                      />
                      {taskError && <p className="text-red-500 text-xs mt-1">{taskError}</p>}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Qté prévue</label>
                        <input
                          type="number" min="0" step="0.5"
                          value={taskForm.qte_prevue}
                          onChange={e => setTaskForm(f => ({ ...f, qte_prevue: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Unité</label>
                        <input
                          value={taskForm.unite}
                          onChange={e => setTaskForm(f => ({ ...f, unite: e.target.value }))}
                          placeholder="u"
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Heures</label>
                        <input
                          type="number" min="0" step="0.5"
                          value={taskForm.heures_prevues}
                          onChange={e => setTaskForm(f => ({ ...f, heures_prevues: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Équipe assignée</label>
                      <select
                        value={taskForm.equipe_id}
                        onChange={e => setTaskForm(f => ({ ...f, equipe_id: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none bg-white mt-0.5"
                      >
                        <option value="">— Sans équipe —</option>
                        {equipes.map(eq => (
                          <option key={eq.id} value={eq.id}>{eq.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={handleAddTask}
                        disabled={!taskForm.label.trim() || taskSaving}
                        className="flex-1 py-2 bg-nc-blue text-white rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        {taskSaving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                        Ajouter
                      </button>
                      <button
                        onClick={() => { setShowTaskForm(false); setTaskError(null) }}
                        className="px-4 py-2 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}

                {/* Liste des tâches */}
                {loadingTasks ? (
                  <div className="flex justify-center py-4">
                    <Loader2 size={16} className="animate-spin text-gray-300" />
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="text-center py-4 text-gray-400">
                    <p className="text-xs">Aucune tâche dans ce cycle</p>
                    <p className="text-[10px] mt-0.5">Ajoutez des tâches pour planifier les interventions</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {tasks.map(task => (
                      <div
                        key={task.id}
                        className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 rounded-xl border border-gray-100"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-nc-blue truncate">{task.label}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {task.qte_realisee}/{task.qte_prevue} {task.unite}
                            {task.heures_prevues > 0 && ` · ${task.heures_prevues}h`}
                            {task.equipe && ` · ${task.equipe.name}`}
                          </p>
                        </div>
                        <StatusBadge status={task.status} />
                        {task.status === 'todo' && (
                          <button
                            onClick={() => handleDeleteTask(task)}
                            className="p-1.5 hover:text-red-500 text-gray-300 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 font-medium"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TableauFluxTakt — composant principal
// ─────────────────────────────────────────────────────────────

export default function TableauFluxTakt() {
  const { chantier } = useAuthStore()
  const [cycles, setCycles] = useState<CycleTakt[]>([])
  const [zones, setZones] = useState<ZoneTakt[]>([])
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null)

  const load = async () => {
    if (!chantier?.id) return
    setIsLoading(true)
    try {
      const [c, z, eq, tasks] = await Promise.all([
        getAllCyclesByChantier(chantier.id),
        getZonesByChantier(chantier.id),
        getEquipes(chantier.id),
        getTasksByChantier(chantier.id),  // pour calcul alertes
      ])
      setCycles(c)
      setZones(z)
      setEquipes(eq)
      setAllTasks(tasks)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { load() }, [chantier?.id])

  const flux = buildTaktFlux(zones, cycles, [], 8)

  const handleCellClick = (zone: ZoneTakt, semaine: string, cycle: CycleTakt | null) => {
    setSelectedCell({ zone, semaine, cycle })
  }

  const handleClose = () => {
    setSelectedCell(null)
    load()
  }

  return (
    <div className="p-4">
      {/* En-tête */}
      <div className="mb-4">
        <h2 className="text-lg font-bold text-nc-blue">Tableau de flux Takt</h2>
        <p className="text-gray-500 text-sm">{chantier?.name} · {zones.length} zones</p>
        <p className="text-[11px] text-gray-400 mt-0.5">
          Appuyez sur une cellule pour planifier ou modifier un cycle
        </p>
      </div>

      {/* Alertes CA — blocages actifs + retards */}
      {!isLoading && <AlertesBanner allTasks={allTasks} equipes={equipes} />}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-8 h-8 border-2 border-nc-red border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
          <table className="min-w-max border-collapse">
            <thead>
              <tr>
                <th className="text-left text-xs font-semibold text-gray-500 bg-gray-50 sticky left-0 z-10 w-40 px-3 py-2 border-b border-r border-gray-100">
                  Zone Takt
                </th>
                {flux.semaines.map(semaine => (
                  <th key={semaine} className="text-center text-xs font-medium text-gray-500 bg-gray-50 px-3 py-2 border-b border-gray-100 min-w-[90px]">
                    {getSemaineLabel(semaine).split(' · ')[0]}
                    <div className="text-[10px] text-gray-400 font-normal">
                      {getSemaineLabel(semaine).split(' · ')[1]}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flux.zones.map((zone, zIdx) => (
                <tr key={zone.id} className={zIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="sticky left-0 bg-inherit z-10 px-3 py-2.5 border-r border-b border-gray-100 min-w-[140px]">
                    <p className="text-xs font-semibold text-nc-blue truncate">{zone.name}</p>
                    {zone.superficie && (
                      <p className="text-[10px] text-gray-400">{zone.superficie} m²</p>
                    )}
                  </td>
                  {flux.semaines.map(semaine => {
                    const cell = flux.cells.get(`${zone.id}-${semaine}`)
                    const cycle = cell?.cycle ?? null
                    const bg = getTaktCellBg(cycle)
                    return (
                      <td key={semaine} className="px-1.5 py-1.5 border-b border-gray-100 text-center">
                        <button
                          onClick={() => handleCellClick(zone, semaine, cycle)}
                          className="w-full"
                          title={cycle ? `${zone.name} · ${getSemaineLabel(semaine)} — ${cycle.statut}` : 'Cliquer pour planifier'}
                        >
                          {cycle ? (
                            <div className={`rounded-lg px-2 py-1.5 border text-xs font-medium ${bg} hover:opacity-75 transition-opacity cursor-pointer`}>
                              <span className="capitalize">
                                {cycle.statut === 'planifie' ? 'Planifié'
                                  : cycle.statut === 'en_cours' ? 'En cours'
                                  : cycle.statut === 'partiel' ? 'Partiel'
                                  : 'Complet'}
                              </span>
                              {cycle.ppc !== null && (
                                <div className="text-[10px] opacity-70">{cycle.ppc}%</div>
                              )}
                            </div>
                          ) : (
                            <div className="w-full h-8 rounded-lg bg-gray-50 border border-dashed border-gray-200 hover:border-nc-blue/40 hover:bg-blue-50/30 transition-colors" />
                          )}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Légende */}
      <div className="flex flex-wrap gap-3 mt-4">
        {[
          { label: 'Planifié', bg: 'bg-slate-100 border-slate-300' },
          { label: 'En cours', bg: 'bg-blue-100 border-blue-400' },
          { label: 'Partiel', bg: 'bg-yellow-100 border-yellow-400' },
          { label: 'Complet', bg: 'bg-green-100 border-green-400' },
        ].map(({ label, bg }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-4 h-4 rounded border ${bg}`} />
            <span className="text-xs text-gray-500">{label}</span>
          </div>
        ))}
        <div className="ml-auto text-[10px] text-gray-400">
          {cycles.length} cycle{cycles.length > 1 ? 's' : ''} planifié{cycles.length > 1 ? 's' : ''}
        </div>
      </div>

      {/* Modal */}
      {selectedCell && (
        <CycleEditModal
          cell={selectedCell}
          equipes={equipes}
          onClose={handleClose}
          onRefresh={load}
        />
      )}
    </div>
  )
}
