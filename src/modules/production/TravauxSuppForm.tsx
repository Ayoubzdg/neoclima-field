import { useEffect, useRef, useState } from 'react'
import { X, Camera, Send, Zap, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import {
  getZonesByChantier, createTravauxSupp, preparePhoto, uploadPhotoBlob
} from '@/lib/supabase'
import type { ZoneTakt } from '@/types/models'

interface Props {
  onClose: () => void
  onCreated: () => void
}

/**
 * Signalement d'un travail non prévu par le monteur.
 * Photo OBLIGATOIRE + description courte → statut "signalé"
 * → analyse chef → validation CA → réalisation. Rien ne se
 * réalise sans validation CA tracée.
 */
export default function TravauxSuppForm({ onClose, onCreated }: Props) {
  const { chantier, role, utilisateur, entrepriseId } = useAuthStore()
  const [zones, setZones] = useState<ZoneTakt[]>([])
  const [zoneId, setZoneId] = useState('')
  const [emplacement, setEmplacement] = useState('')
  const [demandeur, setDemandeur] = useState('')
  const [description, setDescription] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (chantier?.id) getZonesByChantier(chantier.id).then(setZones).catch(() => {})
  }, [chantier?.id])

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoFile(f)
    setPhotoPreview(URL.createObjectURL(f))
  }

  const handleSubmit = async () => {
    if (!chantier?.id || !description.trim() || !emplacement.trim() || !photoFile) return
    setIsSaving(true)
    setError(null)
    try {
      // Photo obligatoire — uploadée d'abord (compression auto)
      const rawPath = `travaux-supp/${chantier.id}/${Date.now()}-${photoFile.name.replace(/\s+/g, '_')}`
      const prepared = await preparePhoto(photoFile, rawPath)
      const photoUrl = await uploadPhotoBlob(prepared.body, prepared.path, prepared.contentType)

      const nom = utilisateur ? `${utilisateur.prenom ?? ''} ${utilisateur.nom ?? ''}`.trim() : null
      await createTravauxSupp({
        chantier_id: chantier.id,
        zone_takt_id: zoneId || null,
        entreprise_id: entrepriseId ?? null,
        emplacement: emplacement.trim(),
        demandeur: demandeur.trim() || null,
        description: description.trim(),
        photo_url: photoUrl,
        statut: 'signale',
        cree_par: nom,
        cree_par_role: role ?? null,
      })
      onCreated()
      onClose()
    } catch {
      setError('Envoi impossible — le signalement nécessite du réseau (photo obligatoire). Réessaie dès que tu captes.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end animate-fade-in">
      <div className="w-full bg-white rounded-t-3xl animate-slide-up max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Zap size={20} className="text-amber-500" />
            <h3 className="font-bold text-nc-blue">Travail non prévu</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
            Tu as repéré une modification ou un travail hors contrat ?
            Photographie-le MAINTENANT — le chef analysera, le chargé
            d'affaires validera. Rien ne se fait sans validation.
          </p>

          {/* Photo obligatoire */}
          <input ref={cameraRef} type="file" accept="image/*" capture="environment"
            className="hidden" onChange={handlePhoto} />
          {photoPreview ? (
            <div className="relative">
              <img src={photoPreview} alt="Constat" className="w-full h-40 object-cover rounded-xl border border-gray-200" />
              <button
                onClick={() => cameraRef.current?.click()}
                className="absolute bottom-2 right-2 px-2.5 py-1.5 bg-black/60 text-white text-xs rounded-lg"
              >
                Reprendre
              </button>
            </div>
          ) : (
            <button
              onClick={() => cameraRef.current?.click()}
              className="w-full h-28 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50
                         flex flex-col items-center justify-center gap-1.5 text-amber-600
                         active:scale-95 transition-all touch-manipulation"
            >
              <Camera size={26} />
              <span className="text-sm font-semibold">Photo obligatoire *</span>
            </button>
          )}

          {/* Zone */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1.5">Zone</p>
            <select value={zoneId} onChange={e => setZoneId(e.target.value)} className="input-field">
              <option value="">— Choisir la zone —</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>

          {/* Emplacement exact — repris tel quel sur le rapport de régie */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1.5">Emplacement exact *</p>
            <input
              value={emplacement}
              onChange={e => setEmplacement(e.target.value)}
              placeholder="Ex : N3, local 3.081, axe 12 — au-dessus du faux plafond"
              className="input-field"
            />
          </div>

          {/* Demandeur — qui a demandé ces travaux (repris sur le bon de régie) */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1.5">Qui a demandé ces travaux ?</p>
            <input
              value={demandeur}
              onChange={e => setDemandeur(e.target.value)}
              placeholder="Ex : M. Dupont (Implenia), architecte, direction de travaux…"
              className="input-field"
            />
          </div>

          {/* Description */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1.5">Description *</p>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ex : gaine à dévier, réservation absente, modification demandée par l'architecte…"
              rows={3}
              className="input-field resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={isSaving || !description.trim() || !emplacement.trim() || !photoFile}
            className="w-full h-12 rounded-xl bg-amber-500 text-white font-semibold
                       flex items-center justify-center gap-2 active:scale-95 transition-all
                       hover:bg-amber-600 disabled:opacity-40"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            Signaler au chef de chantier
          </button>
        </div>
      </div>
    </div>
  )
}
