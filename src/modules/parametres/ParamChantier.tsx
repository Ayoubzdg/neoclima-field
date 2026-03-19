import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings, Save, ShieldCheck, ChevronRight } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { upsertChantier } from '@/lib/supabase'
import type { Chantier } from '@/types/models'

export default function ParamChantier() {
  const { chantier, role, utilisateur, setChantier } = useAuthStore()
  const navigate = useNavigate()
  const [form, setForm] = useState<Partial<Chantier>>(chantier ?? {})
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    if (!form.id) return
    setIsSaving(true)
    try {
      const updated = await upsertChantier(form)
      setChantier(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setIsSaving(false)
    }
  }

  if (!chantier) return null

  return (
    <div className="p-4 max-w-lg">
      <div className="flex items-center gap-2 mb-5">
        <Settings size={20} className="text-nc-red" />
        <h2 className="text-lg font-bold text-nc-blue">Paramètres chantier</h2>
      </div>

      {/* Bandeau rôle + accès admin */}
      <div className="mb-5 bg-gray-50 border border-gray-100 rounded-2xl p-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-nc-blue text-white flex items-center justify-center text-xs font-bold">
            {(utilisateur?.prenom?.[0] ?? '').toUpperCase()}{(utilisateur?.nom?.[0] ?? '').toUpperCase()}
          </div>
          <div>
            <p className="text-xs font-semibold text-nc-blue">{utilisateur?.prenom} {utilisateur?.nom}</p>
            <p className="text-[10px] text-gray-400">
              Rôle : <span className={`font-bold capitalize ${role === 'admin' ? 'text-red-600' : role === 'ca' ? 'text-purple-600' : 'text-gray-600'}`}>{role}</span>
            </p>
          </div>
        </div>
        {role === 'admin' && (
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 rounded-xl text-xs font-semibold hover:bg-red-100 transition-colors"
          >
            <ShieldCheck size={14} />
            Gestion accès
            <ChevronRight size={12} />
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase mb-1.5 block">Nom du chantier</label>
          <input className="input-field" value={form.name ?? ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase mb-1.5 block">Adresse</label>
          <input className="input-field" value={form.adresse ?? ''} onChange={e => setForm(p => ({ ...p, adresse: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase mb-1.5 block">Client / Maître d'ouvrage</label>
          <input className="input-field" value={form.client ?? ''} onChange={e => setForm(p => ({ ...p, client: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase mb-1.5 block">Date début</label>
            <input type="date" className="input-field" value={form.date_debut ?? ''} onChange={e => setForm(p => ({ ...p, date_debut: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase mb-1.5 block">Date fin prévue</label>
            <input type="date" className="input-field" value={form.date_fin_prev ?? ''} onChange={e => setForm(p => ({ ...p, date_fin_prev: e.target.value }))} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase mb-1.5 block">Budget heures</label>
            <input type="number" className="input-field" value={form.budget_heures ?? 0} onChange={e => setForm(p => ({ ...p, budget_heures: parseFloat(e.target.value) }))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase mb-1.5 block">Durée takt (jours)</label>
            <input type="number" className="input-field" min={1} max={10} value={form.takt_duree ?? 5} onChange={e => setForm(p => ({ ...p, takt_duree: parseInt(e.target.value) }))} />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase mb-1.5 block">Statut</label>
          <select className="input-field" value={form.statut ?? 'actif'} onChange={e => setForm(p => ({ ...p, statut: e.target.value as Chantier['statut'] }))}>
            <option value="actif">Actif</option>
            <option value="termine">Terminé</option>
            <option value="archive">Archivé</option>
          </select>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`w-full flex items-center justify-center gap-2 h-12 rounded-xl font-semibold transition-all
            ${saved ? 'bg-green-500 text-white' : 'btn-primary'}`}
        >
          <Save size={18} />
          {isSaving ? 'Sauvegarde…' : saved ? 'Sauvegardé ✓' : 'Sauvegarder'}
        </button>
      </div>
    </div>
  )
}
