import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Plus, AlertTriangle, ChevronRight, X, Check, Loader2 } from 'lucide-react'
import { useQualiteStore } from '@/store/qualiteStore'
import { useAuthStore } from '@/store/authStore'
import { getZonesByChantier } from '@/lib/supabase'
import { formatDateShort, todayISO } from '@/utils/dates'
import type { NcGravite, NcStatut, ZoneTakt } from '@/types/models'

const GRAVITE_COLORS: Record<NcGravite, string> = {
  mineure: 'bg-amber-100 text-amber-700 border-amber-200',
  majeure: 'bg-red-100 text-red-700 border-red-200',
  bloquante: 'bg-gray-900 text-white border-gray-700'
}

const STATUT_COLORS: Record<NcStatut, string> = {
  ouverte: 'text-red-600',
  en_cours: 'text-amber-600',
  levee: 'text-green-600',
  validee: 'text-blue-600'
}

interface NcForm {
  titre: string
  description: string
  gravite: NcGravite
  zone_takt_id: string
  date_echeance: string
}

// ── Slide-in panel pour créer une NC ────────────────────────
function NouvelleNcPanel({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { chantier } = useAuthStore()
  const { createNC } = useQualiteStore()
  const [zones, setZones] = useState<ZoneTakt[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [form, setForm] = useState<NcForm>({
    titre: '',
    description: '',
    gravite: 'mineure',
    zone_takt_id: '',
    date_echeance: '',
  })

  useEffect(() => {
    if (!chantier?.id) return
    getZonesByChantier(chantier.id).then(setZones)
  }, [chantier?.id])

  const handleSubmit = async () => {
    if (!form.titre.trim() || !form.zone_takt_id) return
    setIsSaving(true)
    setSaveError(null)
    try {
      await createNC({
        titre: form.titre.trim(),
        description: form.description.trim() || null,
        gravite: form.gravite,
        statut: 'ouverte',
        zone_takt_id: form.zone_takt_id,
        date_echeance: form.date_echeance || null,
        // numero généré automatiquement par la DB (séquence ou trigger)
      })
      onCreated()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      {/* Panel */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="font-bold text-nc-blue">Nouvelle non-conformité</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Titre */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Titre *</label>
            <input
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue/20"
              value={form.titre}
              onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
              placeholder="Ex: Défaut d'étanchéité sur joint de toiture"
              autoFocus
            />
          </div>

          {/* Gravité */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Gravité *</label>
            <div className="mt-1 flex gap-2">
              {(['mineure', 'majeure', 'bloquante'] as NcGravite[]).map(g => (
                <button
                  key={g}
                  onClick={() => setForm(f => ({ ...f, gravite: g }))}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all
                    ${form.gravite === g ? GRAVITE_COLORS[g] + ' ring-2 ring-offset-1 ring-nc-blue' : 'bg-gray-50 text-gray-400 border-gray-100'}`}
                >
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Zone */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Zone *</label>
            <select
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue/20 bg-white"
              value={form.zone_takt_id}
              onChange={e => setForm(f => ({ ...f, zone_takt_id: e.target.value }))}
            >
              <option value="">Sélectionner une zone…</option>
              {zones.map(z => (
                <option key={z.id} value={z.id}>
                  {z.secteur?.name ? `${z.secteur.name} — ` : ''}{z.name}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</label>
            <textarea
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue/20 resize-none"
              rows={3}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Décrire la non-conformité…"
            />
          </div>

          {/* Échéance */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Date d'échéance</label>
            <input
              type="date"
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue/20"
              value={form.date_echeance}
              min={todayISO()}
              onChange={e => setForm(f => ({ ...f, date_echeance: e.target.value }))}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 space-y-2">
          {saveError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 flex-1">{saveError}</p>
              <button onClick={() => setSaveError(null)} className="text-red-400 font-bold text-sm leading-none">×</button>
            </div>
          )}
          <button
            onClick={handleSubmit}
            disabled={!form.titre.trim() || !form.zone_takt_id || isSaving}
            className="w-full btn-primary h-12 flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {isSaving ? (
              <><Loader2 size={18} className="animate-spin" />Enregistrement…</>
            ) : (
              <><Check size={18} />Créer la non-conformité</>
            )}
          </button>
        </div>
      </div>
    </>
  )
}

export default function NonConformites() {
  const navigate = useNavigate()
  const { chantier } = useAuthStore()
  const { nonConformites, isLoading, filtreStatut, filtreGravite, loadNonConformites, setFiltreStatut } = useQualiteStore()
  const [showNcPanel, setShowNcPanel] = useState(false)

  const reload = () => {
    if (!chantier?.id) return
    loadNonConformites(chantier.id)
  }

  useEffect(() => {
    if (!chantier?.id) return
    loadNonConformites(chantier.id)
  }, [chantier?.id, loadNonConformites, filtreStatut, filtreGravite])

  const stats = {
    ouvertes: nonConformites.filter(n => n.statut === 'ouverte').length,
    bloquantes: nonConformites.filter(n => n.gravite === 'bloquante').length,
    levees: nonConformites.filter(n => n.statut === 'levee' || n.statut === 'validee').length
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-nc-blue">Non-Conformités</h2>
          <p className="text-gray-500 text-sm">{nonConformites.length} NC · {stats.ouvertes} ouvertes</p>
        </div>
        <button
          onClick={() => setShowNcPanel(true)}
          className="btn-primary text-sm flex items-center gap-1.5 py-2 px-3"
        >
          <Plus size={16} />
          Nouvelle NC
        </button>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: 'Ouvertes', value: stats.ouvertes, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Bloquantes', value: stats.bloquantes, color: 'text-gray-900', bg: 'bg-gray-900' },
          { label: 'Levées', value: stats.levees, color: 'text-green-600', bg: 'bg-green-50' }
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg === 'bg-gray-900' ? 'bg-gray-900 text-white' : `${bg} ${color}`} rounded-xl p-3 text-center`}>
            <p className="text-2xl font-black">{value}</p>
            <p className={`text-xs mt-0.5 ${bg === 'bg-gray-900' ? 'text-white/70' : 'opacity-70'}`}>{label}</p>
          </div>
        ))}
      </div>

      {/* Filtres statut */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-4 -mx-1 px-1">
        {(['all', 'ouverte', 'en_cours', 'levee', 'validee'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFiltreStatut(s)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all
              ${filtreStatut === s ? 'bg-nc-blue text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {s === 'all' ? 'Toutes' : s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Liste NC */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : nonConformites.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Shield size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Aucune non-conformité</p>
          <button
            onClick={() => setShowNcPanel(true)}
            className="mt-3 text-xs text-nc-blue hover:underline"
          >
            Créer la première NC
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {nonConformites.map(nc => (
            <button
              key={nc.id}
              onClick={() => navigate(`/qualite/nc/${nc.id}`)}
              className="w-full text-left bg-white rounded-xl border border-gray-100 p-3 shadow-sm
                         hover:shadow-md transition-shadow active:scale-98"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle size={16} className={`mt-0.5 flex-shrink-0 ${nc.gravite === 'bloquante' ? 'text-gray-900' : nc.gravite === 'majeure' ? 'text-red-500' : 'text-amber-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-nc-blue text-sm truncate flex-1">{nc.titre}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${GRAVITE_COLORS[nc.gravite]}`}>
                      {nc.gravite}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`text-xs font-medium capitalize ${STATUT_COLORS[nc.statut]}`}>
                      {nc.statut.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-gray-400">NC #{nc.numero}</span>
                    {nc.date_echeance && (
                      <span className="text-xs text-gray-400">
                        Échéance : {formatDateShort(nc.date_echeance)}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={14} className="text-gray-300 mt-1 flex-shrink-0" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Nouvelle NC Panel */}
      {showNcPanel && (
        <NouvelleNcPanel
          onClose={() => setShowNcPanel(false)}
          onCreated={() => { setShowNcPanel(false); reload() }}
        />
      )}
    </div>
  )
}
