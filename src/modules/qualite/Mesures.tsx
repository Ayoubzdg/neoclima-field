import { useEffect, useState } from 'react'
import { BarChart2, Plus, CheckCircle, XCircle, X, Check, Loader2 } from 'lucide-react'
import { useQualiteStore } from '@/store/qualiteStore'
import { useAuthStore } from '@/store/authStore'
import { getZonesByChantier } from '@/lib/supabase'
import { formatDateShort, todayISO } from '@/utils/dates'
import type { MesureType, ZoneTakt } from '@/types/models'

const TYPE_LABELS: Record<MesureType, string> = {
  debit: 'Débit',
  pression: 'Pression',
  etancheite: 'Étanchéité',
  bruit: 'Bruit',
  temperature: 'Température',
  autre: 'Autre'
}

const UNITES_BY_TYPE: Record<MesureType, string[]> = {
  debit: ['m³/h', 'l/s', 'l/min'],
  pression: ['Pa', 'kPa', 'bar', 'mbar'],
  etancheite: ['Pa', 'l/s.m²', '%'],
  bruit: ['dB', 'dB(A)'],
  temperature: ['°C', '°F', 'K'],
  autre: ['u', '%', 'mm', 'cm', 'm'],
}

interface MesureForm {
  type: MesureType
  designation: string
  valeur_prevue: string
  valeur_mesuree: string
  unite: string
  date_mesure: string
  zone_takt_id: string
  note: string
}

function NouvellesMesurePanel({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { chantier } = useAuthStore()
  const { createMesure } = useQualiteStore()
  const [zones, setZones] = useState<ZoneTakt[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState<MesureForm>({
    type: 'debit',
    designation: '',
    valeur_prevue: '',
    valeur_mesuree: '',
    unite: 'm³/h',
    date_mesure: todayISO(),
    zone_takt_id: '',
    note: '',
  })

  useEffect(() => {
    if (!chantier?.id) return
    getZonesByChantier(chantier.id).then(setZones)
  }, [chantier?.id])

  const handleTypeChange = (type: MesureType) => {
    setForm(f => ({ ...f, type, unite: UNITES_BY_TYPE[type][0] }))
  }

  const conforme = form.valeur_mesuree && form.valeur_prevue
    ? Math.abs(parseFloat(form.valeur_mesuree) - parseFloat(form.valeur_prevue)) / parseFloat(form.valeur_prevue) <= 0.1
    : null

  const handleSubmit = async () => {
    if (!form.designation.trim() || !form.valeur_mesuree || !form.zone_takt_id) return
    setIsSaving(true)
    try {
      const valM = parseFloat(form.valeur_mesuree)
      const valP = form.valeur_prevue ? parseFloat(form.valeur_prevue) : null
      const ecart = valP ? Math.round(((valM - valP) / valP) * 1000) / 10 : null
      await createMesure({
        chantier_id: chantier?.id,
        zone_takt_id: form.zone_takt_id,
        type: form.type,
        designation: form.designation.trim(),
        valeur_prevue: valP,
        valeur_mesuree: valM,
        unite: form.unite,
        conforme: conforme,
        ecart_pct: ecart,
        date_mesure: form.date_mesure || null,
        note: form.note.trim() || null,
      })
      onCreated()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="font-bold text-nc-blue">Nouvelle mesure</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Type */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Type *</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(Object.keys(TYPE_LABELS) as MesureType[]).map(t => (
                <button
                  key={t}
                  onClick={() => handleTypeChange(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                    ${form.type === t ? 'bg-nc-blue text-white border-nc-blue' : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-nc-blue/30'}`}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Désignation */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Désignation *</label>
            <input
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue/20"
              value={form.designation}
              onChange={e => setForm(f => ({ ...f, designation: e.target.value }))}
              placeholder="Ex: Débitmètre CTA-01 alimentation bureau"
              autoFocus
            />
          </div>

          {/* Valeurs + Unité */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Prévue</label>
              <input
                type="number"
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue/20"
                value={form.valeur_prevue}
                onChange={e => setForm(f => ({ ...f, valeur_prevue: e.target.value }))}
                placeholder="—"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Mesurée *</label>
              <input
                type="number"
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue/20"
                value={form.valeur_mesuree}
                onChange={e => setForm(f => ({ ...f, valeur_mesuree: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Unité</label>
              <select
                className="mt-1 w-full border border-gray-200 rounded-xl px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue/20 bg-white"
                value={form.unite}
                onChange={e => setForm(f => ({ ...f, unite: e.target.value }))}
              >
                {UNITES_BY_TYPE[form.type].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {/* Conformité preview */}
          {conforme !== null && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${conforme ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {conforme ? <CheckCircle size={16} /> : <XCircle size={16} />}
              <span className="text-sm font-medium">
                {conforme ? 'Conforme' : 'Non conforme'}
                {form.valeur_prevue && form.valeur_mesuree && ` — écart : ${Math.round(((parseFloat(form.valeur_mesuree) - parseFloat(form.valeur_prevue)) / parseFloat(form.valeur_prevue)) * 1000) / 10}%`}
              </span>
            </div>
          )}

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

          {/* Date */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Date de mesure</label>
            <input
              type="date"
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue/20"
              value={form.date_mesure}
              onChange={e => setForm(f => ({ ...f, date_mesure: e.target.value }))}
            />
          </div>

          {/* Note */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Note</label>
            <textarea
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue/20 resize-none"
              rows={2}
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              placeholder="Observations…"
            />
          </div>
        </div>

        <div className="px-4 py-3 border-t border-gray-100">
          <button
            onClick={handleSubmit}
            disabled={!form.designation.trim() || !form.valeur_mesuree || !form.zone_takt_id || isSaving}
            className="w-full btn-primary h-12 flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {isSaving ? (
              <><Loader2 size={18} className="animate-spin" />Enregistrement…</>
            ) : (
              <><Check size={18} />Enregistrer la mesure</>
            )}
          </button>
        </div>
      </div>
    </>
  )
}

export default function Mesures() {
  const { chantier } = useAuthStore()
  const { mesures, isLoading, loadMesures } = useQualiteStore()
  const [showPanel, setShowPanel] = useState(false)

  useEffect(() => {
    if (!chantier?.id) return
    loadMesures(chantier.id)
  }, [chantier?.id, loadMesures])

  const conformes = mesures.filter(m => m.conforme === true).length
  const nonConformes = mesures.filter(m => m.conforme === false).length

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-nc-blue">Mesures & Essais</h2>
          <p className="text-gray-500 text-sm">{mesures.length} mesures · {conformes} conformes</p>
        </div>
        <button
          onClick={() => setShowPanel(true)}
          className="btn-primary text-sm flex items-center gap-1.5 py-2 px-3"
        >
          <Plus size={16} />
          Nouvelle mesure
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-black text-blue-600">{mesures.length}</p>
          <p className="text-xs text-blue-400 mt-0.5">Total</p>
        </div>
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-black text-green-600">{conformes}</p>
          <p className="text-xs text-green-400 mt-0.5">Conformes</p>
        </div>
        <div className="bg-red-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-black text-red-600">{nonConformes}</p>
          <p className="text-xs text-red-400 mt-0.5">Non conformes</p>
        </div>
      </div>

      {/* Liste */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : mesures.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <BarChart2 size={40} className="mx-auto mb-3 opacity-30" />
          <p>Aucune mesure enregistrée</p>
          <button
            onClick={() => setShowPanel(true)}
            className="mt-3 text-xs text-nc-blue hover:underline"
          >
            Enregistrer la première mesure
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {mesures.map(m => (
            <div key={m.id} className="bg-white rounded-xl border border-gray-100 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                      {TYPE_LABELS[m.type]}
                    </span>
                    {m.date_mesure && <span className="text-xs text-gray-400">{formatDateShort(m.date_mesure)}</span>}
                  </div>
                  {m.designation && (
                    <p className="font-medium text-sm text-nc-blue mt-1">{m.designation}</p>
                  )}
                  <div className="flex items-center gap-2 mt-0.5">
                    {m.valeur_mesuree !== null && (
                      <span className="text-sm font-semibold text-gray-800">
                        {m.valeur_mesuree} {m.unite}
                      </span>
                    )}
                    {m.valeur_prevue !== null && (
                      <span className="text-xs text-gray-400">
                        / prévue : {m.valeur_prevue} {m.unite}
                      </span>
                    )}
                    {m.ecart_pct !== null && (
                      <span className={`text-xs font-medium ${Math.abs(m.ecart_pct) > 10 ? 'text-red-500' : 'text-green-600'}`}>
                        {m.ecart_pct > 0 ? '+' : ''}{m.ecart_pct}%
                      </span>
                    )}
                  </div>
                </div>
                {m.conforme !== null && (
                  m.conforme
                    ? <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
                    : <XCircle size={20} className="text-red-500 flex-shrink-0" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showPanel && (
        <NouvellesMesurePanel
          onClose={() => setShowPanel(false)}
          onCreated={() => { setShowPanel(false); if (chantier?.id) loadMesures(chantier.id) }}
        />
      )}
    </div>
  )
}
