import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ChevronLeft, ChevronRight, CheckCircle,
  AlertTriangle, Clock, Plus, X, Check
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { upsertContrainte, leverContrainte, getTasksByChantier } from '@/lib/supabase'
import type { Contrainte, ContrainteType, Task } from '@/types/models'

// ── Utilitaires semaine ───────────────────────────────────────

function getWeekDays(startMonday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startMonday)
    d.setDate(d.getDate() + i)
    return d
  })
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function toISO(d: Date): string {
  return d.toISOString().split('T')[0]
}

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const TYPE_OPTIONS: { value: ContrainteType; label: string; emoji: string }[] = [
  { value: 'materiau',     label: 'Matériau',       emoji: '📦' },
  { value: 'acces',        label: 'Accès',           emoji: '🚧' },
  { value: 'autre_corps',  label: 'Autre corps',     emoji: '🔧' },
  { value: 'gros_oeuvre',  label: 'Gros œuvre',      emoji: '🏗️' },
  { value: 'equipement',   label: 'Équipement',      emoji: '⚙️' },
  { value: 'autre',        label: 'Autre',           emoji: '❓' },
]

const TYPE_EMOJI: Record<string, string> = Object.fromEntries(
  TYPE_OPTIONS.map(t => [t.value, t.emoji])
)

const STATUT_COLOR: Record<string, string> = {
  ouverte:  'bg-red-100 border-red-200 text-red-700',
  en_cours: 'bg-amber-100 border-amber-200 text-amber-700',
  levee:    'bg-green-100 border-green-200 text-green-700',
}

// ── Composant principal ────────────────────────────────────────

export default function ContraintesAgenda() {
  const navigate = useNavigate()
  const { chantier } = useAuthStore()

  const [monday, setMonday] = useState(() => getMondayOfWeek(new Date()))
  const [contraintes, setContraintes] = useState<Contrainte[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Création
  const [showCreate, setShowCreate] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [form, setForm] = useState({
    task_id: '',
    type: 'materiau' as ContrainteType,
    description: '',
    responsable: '',
    date_besoin: toISO(new Date()),
    bloquant: false,
  })
  const [saving, setSaving] = useState(false)

  // Lever
  const [selected, setSelected] = useState<Contrainte | null>(null)
  const [levering, setLevering] = useState(false)

  // ── Chargement contraintes ──────────────────────────────
  const load = useCallback(async () => {
    if (!chantier?.id) return
    setIsLoading(true)

    const { data: secteurs } = await supabase
      .from('secteurs').select('id').eq('chantier_id', chantier.id)
    if (!secteurs?.length) { setContraintes([]); setIsLoading(false); return }

    const { data: zones } = await supabase
      .from('zones_takt').select('id').in('secteur_id', secteurs.map(s => s.id))
    if (!zones?.length) { setContraintes([]); setIsLoading(false); return }

    const { data: taskRows } = await supabase
      .from('tasks').select('id').in('zone_takt_id', zones.map(z => z.id))
    if (!taskRows?.length) { setContraintes([]); setIsLoading(false); return }

    const { data, error } = await supabase
      .from('contraintes')
      .select('*')
      .in('task_id', taskRows.map(t => t.id))
      .neq('statut', 'levee')
      .order('date_besoin', { ascending: true })

    if (!error && data) setContraintes(data as Contrainte[])
    setIsLoading(false)
  }, [chantier?.id])

  useEffect(() => { load() }, [load, monday])

  // ── Chargement tâches pour le formulaire ──────────────────
  useEffect(() => {
    if (!chantier?.id || !showCreate) return
    getTasksByChantier(chantier.id).then(setTasks)
  }, [chantier?.id, showCreate])

  // ── Lever une contrainte ──────────────────────────────────
  const handleLever = async () => {
    if (!selected) return
    setLevering(true)
    await leverContrainte(selected.id)
    setLevering(false)
    setSelected(null)
    load()
  }

  // ── Passer en "en cours" ──────────────────────────────────
  const handleEnCours = async () => {
    if (!selected) return
    await upsertContrainte({ id: selected.id, statut: 'en_cours' })
    setSelected(null)
    load()
  }

  // ── Créer une contrainte ──────────────────────────────────
  const handleCreate = async () => {
    if (!form.task_id || !form.description.trim()) return
    setSaving(true)
    await upsertContrainte({
      task_id: form.task_id,
      type: form.type,
      description: form.description.trim(),
      responsable: form.responsable.trim() || null,
      date_besoin: form.date_besoin || null,
      bloquant: form.bloquant,
      statut: 'ouverte',
    })
    setSaving(false)
    setShowCreate(false)
    setForm({ task_id: '', type: 'materiau', description: '', responsable: '', date_besoin: toISO(new Date()), bloquant: false })
    load()
  }

  // ── Calcul affichage ──────────────────────────────────────
  const days = getWeekDays(monday)
  const weekEnd = new Date(monday)
  weekEnd.setDate(weekEnd.getDate() + 6)

  const contraintesByDay = days.map(day => {
    const isoDay = toISO(day)
    return contraintes.filter(c => c.date_besoin === isoDay)
  })

  const sansDates = contraintes.filter(c =>
    !c.date_besoin ||
    c.date_besoin < toISO(monday) ||
    c.date_besoin > toISO(weekEnd)
  )

  const prevWeek = () => { const d = new Date(monday); d.setDate(d.getDate() - 7); setMonday(d) }
  const nextWeek = () => { const d = new Date(monday); d.setDate(d.getDate() + 7); setMonday(d) }
  const today = toISO(new Date())

  return (
    <div className="p-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-nc-blue">Agenda Contraintes</h2>
          <p className="text-xs text-gray-500">
            {monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} —{' '}
            {weekEnd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-1">
          <button onClick={prevWeek} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50">
            <ChevronLeft size={18} className="text-gray-600" />
          </button>
          <button onClick={nextWeek} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50">
            <ChevronRight size={18} className="text-gray-600" />
          </button>
        </div>
        {/* Bouton Nouvelle contrainte */}
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-nc-red text-white px-3 py-2 rounded-xl text-sm font-semibold shadow-sm hover:bg-red-700 transition-colors"
        >
          <Plus size={16} />
          Nouvelle
        </button>
      </div>

      {/* Grille semaine */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {days.map((day, i) => {
              const isoDay = toISO(day)
              const isToday = isoDay === today
              const items = contraintesByDay[i]
              const isWeekend = i >= 5

              return (
                <div
                  key={isoDay}
                  className={`rounded-xl overflow-hidden border
                    ${isToday ? 'border-nc-blue' : 'border-gray-100'}
                    ${isWeekend && items.length === 0 ? 'opacity-40' : ''}`}
                >
                  <div className={`flex items-center gap-2 px-3 py-2
                    ${isToday ? 'bg-nc-blue text-white' : 'bg-gray-50 text-gray-600'}`}>
                    <span className="font-semibold text-sm">{DAY_LABELS[i]}</span>
                    <span className="text-xs opacity-70">
                      {day.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                    {items.length > 0 && (
                      <span className={`ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full
                        ${isToday ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600'}`}>
                        {items.length}
                      </span>
                    )}
                  </div>

                  {items.length > 0 ? (
                    <div className="divide-y divide-gray-50 bg-white">
                      {items.map(c => (
                        <button
                          key={c.id}
                          onClick={() => setSelected(c)}
                          className={`w-full flex items-start gap-2 px-3 py-2.5 border-l-4 text-left hover:brightness-95 transition-all ${STATUT_COLOR[c.statut] ?? ''}`}
                        >
                          <span className="text-base flex-shrink-0">{TYPE_EMOJI[c.type] ?? '❓'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{c.description}</p>
                            {c.responsable && (
                              <p className="text-xs opacity-60">→ {c.responsable}</p>
                            )}
                          </div>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 border ${STATUT_COLOR[c.statut] ?? ''}`}>
                            {c.statut === 'ouverte' ? 'Ouverte' : c.statut === 'en_cours' ? 'En cours' : 'Levée'}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-1.5 bg-white">
                      <p className="text-xs text-gray-300 italic">Aucune contrainte</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Sans date */}
          {sansDates.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                <Clock size={12} /> Sans date / hors semaine ({sansDates.length})
              </p>
              <div className="space-y-1.5">
                {sansDates.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelected(c)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-left hover:brightness-95 transition-all ${STATUT_COLOR[c.statut] ?? 'border-gray-100'}`}
                  >
                    <span>{TYPE_EMOJI[c.type] ?? '❓'}</span>
                    <p className="text-xs font-medium flex-1 truncate">{c.description}</p>
                    {c.bloquant && <AlertTriangle size={12} className="text-red-500 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {contraintes.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <CheckCircle size={36} className="mx-auto mb-2 text-green-400" />
              <p className="font-medium text-green-600">Aucune contrainte ouverte</p>
              <p className="text-sm mt-1">Toutes les contraintes sont levées</p>
            </div>
          )}
        </>
      )}

      {/* ── SHEET : Lever une contrainte ─────────────────────── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative w-full bg-white rounded-t-2xl p-5 shadow-2xl z-10 max-w-lg mx-auto">
            {/* Drag indicator */}
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
                    Besoin le {new Date(selected.date_besoin).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
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

      {/* ── PANEL : Créer une contrainte ─────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCreate(false)} />
          <div className="relative w-full bg-white rounded-t-2xl shadow-2xl z-10 max-w-lg mx-auto max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 z-10">
              <h3 className="font-bold text-nc-blue text-base">Nouvelle contrainte</h3>
              <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Sélection tâche */}
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">
                  Tâche concernée *
                </label>
                <select
                  value={form.task_id}
                  onChange={e => setForm(f => ({ ...f, task_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue"
                >
                  <option value="">— Sélectionner une tâche —</option>
                  {tasks.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.label} {t.zone_takt ? `(${(t.zone_takt as { name: string }).name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type */}
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">
                  Type de contrainte
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {TYPE_OPTIONS.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setForm(f => ({ ...f, type: t.value }))}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 text-xs font-medium transition-colors
                        ${form.type === t.value
                          ? 'border-nc-red bg-red-50 text-nc-red'
                          : 'border-gray-100 text-gray-600 hover:border-gray-300'}`}
                    >
                      <span className="text-lg">{t.emoji}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">
                  Description *
                </label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Ex: Dalle béton à 30% non prête avant intervention..."
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue resize-none"
                />
              </div>

              {/* Responsable */}
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">
                  Responsable (qui doit lever ?)
                </label>
                <input
                  type="text"
                  value={form.responsable}
                  onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))}
                  placeholder="Ex: Gros œuvre — M. Dupont"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue"
                />
              </div>

              {/* Date besoin */}
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">
                  Date besoin (besoin levée avant le)
                </label>
                <input
                  type="date"
                  value={form.date_besoin}
                  onChange={e => setForm(f => ({ ...f, date_besoin: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue"
                />
              </div>

              {/* Bloquant */}
              <button
                onClick={() => setForm(f => ({ ...f, bloquant: !f.bloquant }))}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-colors
                  ${form.bloquant
                    ? 'border-red-400 bg-red-50 text-red-700'
                    : 'border-gray-100 text-gray-500 hover:border-gray-300'}`}
              >
                <AlertTriangle size={16} />
                <span className="text-sm font-medium">
                  {form.bloquant ? '⚠️ Bloquant activé — tâche ne peut pas démarrer' : 'Marquer comme bloquant'}
                </span>
              </button>

              {/* CTA */}
              <button
                onClick={handleCreate}
                disabled={!form.task_id || !form.description.trim() || saving}
                className="w-full bg-nc-red text-white py-3.5 rounded-xl font-bold text-sm
                           disabled:opacity-40 hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Plus size={16} />
                )}
                Enregistrer la contrainte
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
