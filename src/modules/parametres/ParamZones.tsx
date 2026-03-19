import { useEffect, useState } from 'react'
import { Building2, ChevronRight, Plus, Trash2, Pencil, Check, X, Map, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import {
  getSecteurs, upsertSecteur, deleteSecteur,
  getZonesTakt, upsertZoneTakt, deleteZoneTakt
} from '@/lib/supabase'
import type { Secteur, ZoneTakt } from '@/types/models'

// ── Formulaire zone ──────────────────────────────────────────
interface ZoneFormData {
  name: string
  description: string
  superficie: string
  qr_code: string
}

const emptyZoneForm = (): ZoneFormData => ({ name: '', description: '', superficie: '', qr_code: '' })

export default function ParamZones() {
  const { chantier } = useAuthStore()
  const [secteurs, setSecteurs] = useState<Secteur[]>([])
  const [zones, setZones] = useState<ZoneTakt[]>([])
  const [expandedSecteur, setExpandedSecteur] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // ── États édition secteur ────────────────────────────────────
  const [editingSecteurId, setEditingSecteurId] = useState<string | null>(null)
  const [editingSecteurName, setEditingSecteurName] = useState('')
  const [newSecteurName, setNewSecteurName] = useState('')
  const [showNewSecteur, setShowNewSecteur] = useState(false)
  const [savingSecteur, setSavingSecteur] = useState(false)

  // ── États édition zone ───────────────────────────────────────
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null)
  const [editingZoneForm, setEditingZoneForm] = useState<ZoneFormData>(emptyZoneForm())
  const [addingZoneInSecteur, setAddingZoneInSecteur] = useState<string | null>(null)
  const [newZoneForm, setNewZoneForm] = useState<ZoneFormData>(emptyZoneForm())
  const [savingZone, setSavingZone] = useState(false)

  useEffect(() => {
    if (!chantier?.id) return
    loadAll()
  }, [chantier?.id])

  const loadAll = async () => {
    if (!chantier?.id) return
    setIsLoading(true)
    try {
      const sects = await getSecteurs(chantier.id)
      setSecteurs(sects)
      if (sects.length > 0 && !expandedSecteur) setExpandedSecteur(sects[0].id)
      const allZones = await Promise.all(sects.map(s => getZonesTakt(s.id)))
      setZones(allZones.flat())
    } finally {
      setIsLoading(false)
    }
  }

  // ── Secteurs ─────────────────────────────────────────────────

  const handleSaveSecteur = async (secteur?: Secteur) => {
    if (!chantier?.id) return
    setSavingSecteur(true)
    try {
      if (secteur) {
        // Renommage
        const updated = await upsertSecteur({ ...secteur, name: editingSecteurName })
        setSecteurs(prev => prev.map(s => s.id === updated.id ? updated : s))
        setEditingSecteurId(null)
      } else {
        // Nouveau secteur
        if (!newSecteurName.trim()) return
        const created = await upsertSecteur({
          chantier_id: chantier.id,
          name: newSecteurName.trim(),
          ordre: secteurs.length + 1
        })
        setSecteurs(prev => [...prev, created])
        setNewSecteurName('')
        setShowNewSecteur(false)
        setExpandedSecteur(created.id)
      }
    } finally {
      setSavingSecteur(false)
    }
  }

  const handleDeleteSecteur = async (id: string) => {
    if (!confirm('Supprimer ce secteur et toutes ses zones ?')) return
    await deleteSecteur(id)
    setSecteurs(prev => prev.filter(s => s.id !== id))
    setZones(prev => prev.filter(z => z.secteur_id !== id))
    if (expandedSecteur === id) setExpandedSecteur(null)
  }

  // ── Zones ────────────────────────────────────────────────────

  const handleSaveZone = async (secteurId: string, existingZone?: ZoneTakt) => {
    setSavingZone(true)
    try {
      const form = existingZone ? editingZoneForm : newZoneForm
      const payload: Partial<ZoneTakt> = {
        ...(existingZone ?? {}),
        secteur_id: secteurId,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        superficie: form.superficie ? parseFloat(form.superficie) : undefined,
        qr_code: form.qr_code.trim() || undefined,
        ordre: existingZone?.ordre ?? zones.filter(z => z.secteur_id === secteurId).length + 1
      }
      if (!payload.name) return
      const saved = await upsertZoneTakt(payload)
      if (existingZone) {
        setZones(prev => prev.map(z => z.id === saved.id ? saved : z))
        setEditingZoneId(null)
      } else {
        setZones(prev => [...prev, saved])
        setNewZoneForm(emptyZoneForm())
        setAddingZoneInSecteur(null)
      }
    } finally {
      setSavingZone(false)
    }
  }

  const handleDeleteZone = async (id: string) => {
    if (!confirm('Supprimer cette zone ?')) return
    await deleteZoneTakt(id)
    setZones(prev => prev.filter(z => z.id !== id))
  }

  const startEditZone = (zone: ZoneTakt) => {
    setEditingZoneId(zone.id)
    setEditingZoneForm({
      name: zone.name,
      description: zone.description ?? '',
      superficie: zone.superficie?.toString() ?? '',
      qr_code: zone.qr_code ?? ''
    })
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={28} className="animate-spin text-nc-red" />
    </div>
  )

  return (
    <div className="p-4 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Building2 size={20} className="text-nc-red" />
          <h2 className="text-lg font-bold text-nc-blue">Zones & Secteurs</h2>
        </div>
        <button
          onClick={() => { setShowNewSecteur(true); setNewSecteurName('') }}
          className="flex items-center gap-1.5 text-sm font-semibold text-white bg-nc-blue px-3 py-2 rounded-xl hover:bg-nc-blue/90"
        >
          <Plus size={16} />
          Secteur
        </button>
      </div>

      {/* Formulaire nouveau secteur */}
      {showNewSecteur && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4 flex items-center gap-2">
          <input
            autoFocus
            className="input-field flex-1"
            placeholder="Nom du secteur (ex: Bâtiment A, Sous-sol…)"
            value={newSecteurName}
            onChange={e => setNewSecteurName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSaveSecteur(); if (e.key === 'Escape') setShowNewSecteur(false) }}
          />
          <button onClick={() => handleSaveSecteur()} disabled={savingSecteur || !newSecteurName.trim()}
            className="p-2 bg-nc-blue text-white rounded-xl disabled:opacity-40">
            {savingSecteur ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          </button>
          <button onClick={() => setShowNewSecteur(false)} className="p-2 bg-gray-100 rounded-xl">
            <X size={16} className="text-gray-500" />
          </button>
        </div>
      )}

      {secteurs.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Building2 size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Aucun secteur</p>
          <p className="text-sm mt-1">Crée un secteur pour organiser tes zones</p>
        </div>
      )}

      {/* Liste secteurs */}
      <div className="space-y-3">
        {secteurs.map(secteur => {
          const secteurZones = zones.filter(z => z.secteur_id === secteur.id)
          const isExpanded = expandedSecteur === secteur.id

          return (
            <div key={secteur.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

              {/* Header secteur */}
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
                {editingSecteurId === secteur.id ? (
                  <>
                    <input
                      autoFocus
                      className="input-field flex-1 text-sm"
                      value={editingSecteurName}
                      onChange={e => setEditingSecteurName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveSecteur(secteur); if (e.key === 'Escape') setEditingSecteurId(null) }}
                    />
                    <button onClick={() => handleSaveSecteur(secteur)} disabled={savingSecteur}
                      className="p-1.5 bg-nc-blue text-white rounded-lg">
                      {savingSecteur ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    </button>
                    <button onClick={() => setEditingSecteurId(null)} className="p-1.5 bg-gray-100 rounded-lg">
                      <X size={14} className="text-gray-500" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setExpandedSecteur(isExpanded ? null : secteur.id)}
                      className="flex-1 flex items-center gap-2 text-left"
                    >
                      <ChevronRight size={16} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      <span className="font-semibold text-nc-blue text-sm">{secteur.name}</span>
                      <span className="text-xs text-gray-400">{secteurZones.length} zone{secteurZones.length !== 1 ? 's' : ''}</span>
                    </button>
                    <button onClick={() => { setEditingSecteurId(secteur.id); setEditingSecteurName(secteur.name) }}
                      className="p-1.5 text-gray-400 hover:text-nc-blue rounded-lg hover:bg-blue-50">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDeleteSecteur(secteur.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50">
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>

              {/* Zones du secteur */}
              {isExpanded && (
                <div>
                  {secteurZones.map(zone => (
                    <div key={zone.id} className="border-b border-gray-50 last:border-0">
                      {editingZoneId === zone.id ? (
                        /* Formulaire édition zone */
                        <div className="p-4 bg-blue-50/40 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs font-semibold text-gray-500 mb-1 block">Nom *</label>
                              <input className="input-field text-sm" value={editingZoneForm.name}
                                onChange={e => setEditingZoneForm(p => ({ ...p, name: e.target.value }))} />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-500 mb-1 block">Code QR</label>
                              <input className="input-field text-sm font-mono" placeholder="NC-Z001"
                                value={editingZoneForm.qr_code}
                                onChange={e => setEditingZoneForm(p => ({ ...p, qr_code: e.target.value }))} />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs font-semibold text-gray-500 mb-1 block">Description</label>
                              <input className="input-field text-sm" value={editingZoneForm.description}
                                onChange={e => setEditingZoneForm(p => ({ ...p, description: e.target.value }))} />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-500 mb-1 block">Superficie (m²)</label>
                              <input type="number" className="input-field text-sm" value={editingZoneForm.superficie}
                                onChange={e => setEditingZoneForm(p => ({ ...p, superficie: e.target.value }))} />
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => setEditingZoneId(null)}
                              className="px-3 py-1.5 text-sm text-gray-500 bg-gray-100 rounded-lg">
                              Annuler
                            </button>
                            <button onClick={() => handleSaveZone(secteur.id, zone)} disabled={savingZone}
                              className="px-3 py-1.5 text-sm text-white bg-nc-blue rounded-lg disabled:opacity-50 flex items-center gap-1">
                              {savingZone ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                              Sauvegarder
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Ligne zone */
                        <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 group">
                          <Map size={15} className="text-gray-300 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-nc-blue truncate">{zone.name}</p>
                            <div className="flex items-center gap-3 mt-0.5">
                              {zone.description && (
                                <span className="text-xs text-gray-400 truncate">{zone.description}</span>
                              )}
                              {zone.qr_code && (
                                <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{zone.qr_code}</span>
                              )}
                              {zone.superficie && (
                                <span className="text-xs text-gray-400">{zone.superficie} m²</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEditZone(zone)}
                              className="p-1.5 text-gray-400 hover:text-nc-blue rounded-lg hover:bg-blue-50">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => handleDeleteZone(zone.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Formulaire nouvelle zone */}
                  {addingZoneInSecteur === secteur.id ? (
                    <div className="p-4 bg-green-50/40 border-t border-gray-100 space-y-3">
                      <p className="text-xs font-semibold text-green-700">Nouvelle zone</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 mb-1 block">Nom *</label>
                          <input autoFocus className="input-field text-sm" placeholder="ex: Niveau 3 Est"
                            value={newZoneForm.name}
                            onChange={e => setNewZoneForm(p => ({ ...p, name: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 mb-1 block">Code QR</label>
                          <input className="input-field text-sm font-mono" placeholder="NC-Z005"
                            value={newZoneForm.qr_code}
                            onChange={e => setNewZoneForm(p => ({ ...p, qr_code: e.target.value }))} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 mb-1 block">Description</label>
                          <input className="input-field text-sm" placeholder="Description optionnelle"
                            value={newZoneForm.description}
                            onChange={e => setNewZoneForm(p => ({ ...p, description: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 mb-1 block">Superficie (m²)</label>
                          <input type="number" className="input-field text-sm" placeholder="0"
                            value={newZoneForm.superficie}
                            onChange={e => setNewZoneForm(p => ({ ...p, superficie: e.target.value }))} />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => { setAddingZoneInSecteur(null); setNewZoneForm(emptyZoneForm()) }}
                          className="px-3 py-1.5 text-sm text-gray-500 bg-gray-100 rounded-lg">
                          Annuler
                        </button>
                        <button onClick={() => handleSaveZone(secteur.id)} disabled={savingZone || !newZoneForm.name.trim()}
                          className="px-3 py-1.5 text-sm text-white bg-green-600 rounded-lg disabled:opacity-50 flex items-center gap-1">
                          {savingZone ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                          Ajouter
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setAddingZoneInSecteur(secteur.id); setNewZoneForm(emptyZoneForm()) }}
                      className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-400
                                 hover:text-nc-blue hover:bg-blue-50/30 transition-colors border-t border-gray-50"
                    >
                      <Plus size={15} />
                      Ajouter une zone
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
