import { useEffect, useState } from 'react'
import { ClipboardList, Plus, Edit2, Trash2, Check, X } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { getTaskTypes, upsertTaskType, deleteTaskType } from '@/lib/supabase'
import type { TaskType } from '@/types/models'

const UNITES = ['m²', 'm³', 'ml', 'u', 'kg', 'h', 'forfait']

interface TaskTypeForm {
  name: string
  unite: string
  phases: string         // comma-separated in the form
  rendement: string
  cout_unitaire: string
}

const emptyForm = (): TaskTypeForm => ({
  name: '', unite: 'm²', phases: '', rendement: '', cout_unitaire: '0',
})

function fromTaskType(tt: TaskType): TaskTypeForm {
  return {
    name: tt.name,
    unite: tt.unite,
    phases: tt.phases.join(', '),
    rendement: tt.rendement !== null ? String(tt.rendement) : '',
    cout_unitaire: String(tt.cout_unitaire),
  }
}

// ── Inline edit / create form ────────────────────────────────
function TaskTypeForm({ initial, onSave, onCancel }: {
  initial: TaskTypeForm
  onSave: (f: TaskTypeForm) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<TaskTypeForm>(initial)

  return (
    <div className="bg-blue-50/40 rounded-xl border border-nc-blue/20 p-4 space-y-3">
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Nom</label>
          <input
            className="mt-0.5 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue/20"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Ex: Pose de dalles"
            autoFocus
          />
        </div>
        <div className="w-28">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Unité</label>
          <select
            className="mt-0.5 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue/20"
            value={form.unite}
            onChange={e => setForm(f => ({ ...f, unite: e.target.value }))}
          >
            {UNITES.map(u => <option key={u} value={u}>{u}</option>)}
            <option value="_custom">Autre…</option>
          </select>
        </div>
      </div>

      {form.unite === '_custom' && (
        <input
          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue/20"
          value={form.unite === '_custom' ? '' : form.unite}
          onChange={e => setForm(f => ({ ...f, unite: e.target.value }))}
          placeholder="Unité personnalisée"
        />
      )}

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            Rendement ({form.unite}/h/monteur)
          </label>
          <input
            type="number"
            min="0"
            step="0.1"
            className="mt-0.5 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue/20"
            value={form.rendement}
            onChange={e => setForm(f => ({ ...f, rendement: e.target.value }))}
            placeholder="Optionnel"
          />
        </div>
        <div className="flex-1">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            Coût unitaire (CHF/{form.unite})
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="mt-0.5 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue/20"
            value={form.cout_unitaire}
            onChange={e => setForm(f => ({ ...f, cout_unitaire: e.target.value }))}
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          Phases (séparées par virgule)
        </label>
        <input
          className="mt-0.5 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue/20"
          value={form.phases}
          onChange={e => setForm(f => ({ ...f, phases: e.target.value }))}
          placeholder="Ex: Préparation, Pose, Finitions"
        />
        {form.phases && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {form.phases.split(',').map(p => p.trim()).filter(Boolean).map((phase, i) => (
              <span key={i} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                {i + 1}. {phase}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">
          Annuler
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={!form.name.trim()}
          className="px-4 py-1.5 text-sm bg-nc-blue text-white rounded-lg hover:bg-nc-blue-dark disabled:opacity-40 flex items-center gap-1.5"
        >
          <Check size={14} />
          Enregistrer
        </button>
      </div>
    </div>
  )
}

export default function ParamTaskTypes() {
  const { chantier } = useAuthStore()
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const reload = () => {
    if (!chantier?.id) return
    getTaskTypes(chantier.id).then(setTaskTypes)
  }

  useEffect(() => {
    if (!chantier?.id) return
    setIsLoading(true)
    getTaskTypes(chantier.id)
      .then(setTaskTypes)
      .finally(() => setIsLoading(false))
  }, [chantier?.id])

  const handleSave = async (form: TaskTypeForm, existingId?: string) => {
    if (!chantier?.id) return
    const phases = form.phases.split(',').map(p => p.trim()).filter(Boolean)
    const payload: Partial<TaskType> = {
      ...(existingId ? { id: existingId } : {}),
      chantier_id: chantier.id,
      name: form.name.trim(),
      unite: form.unite === '_custom' ? '' : form.unite,
      phases,
      rendement: form.rendement ? parseFloat(form.rendement) : null,
      cout_unitaire: parseFloat(form.cout_unitaire) || 0,
    }
    await upsertTaskType(payload)
    setEditingId(null)
    setIsAdding(false)
    reload()
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    await deleteTaskType(id)
    setDeletingId(null)
    reload()
  }

  return (
    <div className="p-4 max-w-2xl">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <ClipboardList size={20} className="text-nc-red" />
          <h2 className="text-lg font-bold text-nc-blue">Types de tâches</h2>
        </div>
        {!isAdding && (
          <button
            onClick={() => { setIsAdding(true); setEditingId(null) }}
            className="btn-primary text-sm flex items-center gap-1.5 py-2 px-3"
          >
            <Plus size={16} />
            Nouveau type
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500 mb-4">
        Les types de tâches définissent les phases, l'unité et le rendement par défaut pour les nouvelles tâches.
      </p>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Add form */}
          {isAdding && (
            <TaskTypeForm
              initial={emptyForm()}
              onSave={f => handleSave(f)}
              onCancel={() => setIsAdding(false)}
            />
          )}

          {taskTypes.map(tt => (
            <div key={tt.id}>
              {editingId === tt.id ? (
                <TaskTypeForm
                  initial={fromTaskType(tt)}
                  onSave={f => handleSave(f, tt.id)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-nc-blue text-sm">{tt.name}</p>
                      <div className="flex items-center flex-wrap gap-2 mt-1">
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{tt.unite}</span>
                        {tt.rendement && (
                          <span className="text-xs text-gray-400">{tt.rendement} {tt.unite}/h/monteur</span>
                        )}
                        {tt.cout_unitaire > 0 && (
                          <span className="text-xs text-gray-400">{tt.cout_unitaire} CHF/{tt.unite}</span>
                        )}
                      </div>
                      {tt.phases.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {tt.phases.map((phase, i) => (
                            <span key={i} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                              {i + 1}. {phase}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => { setEditingId(tt.id); setIsAdding(false) }}
                        className="p-1.5 rounded-lg hover:bg-gray-100"
                      >
                        <Edit2 size={14} className="text-gray-400" />
                      </button>
                      <button
                        onClick={() => handleDelete(tt.id)}
                        disabled={deletingId === tt.id}
                        className="p-1.5 rounded-lg hover:bg-red-50 disabled:opacity-40"
                      >
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {taskTypes.length === 0 && !isAdding && (
            <div className="text-center py-10 text-gray-400">
              <ClipboardList size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucun type de tâche défini</p>
              <button
                onClick={() => setIsAdding(true)}
                className="mt-3 text-xs text-nc-blue hover:underline"
              >
                Créer le premier type
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
