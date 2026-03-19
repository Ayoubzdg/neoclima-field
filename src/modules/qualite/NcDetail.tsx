import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { supabase, uploadPhoto, savePhoto } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useQualiteStore } from '@/store/qualiteStore'
import { formatDateFR } from '@/utils/dates'
import type { NonConformite, Photo } from '@/types/models'

export default function NcDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { role } = useAuthStore()
  const { updateNC } = useQualiteStore()
  const [nc, setNc] = useState<NonConformite | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)

  const photoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!id) return
    Promise.resolve(
      supabase.from('non_conformites').select('*, photos(*), equipe:equipes(*)').eq('id', id).single()
    )
      .then(({ data }) => setNc(data as NonConformite | null))
      .finally(() => setIsLoading(false))
  }, [id])

  const handleLever = async () => {
    if (!nc) return
    const updated = await updateNC({ id: nc.id, statut: 'levee', date_levee: new Date().toISOString().split('T')[0] })
    setNc(updated)
  }

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !nc) return
    setIsUploadingPhoto(true)
    try {
      const path = `nc/${nc.id}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`
      const url = await uploadPhoto(file, path)
      const photo = await savePhoto({
        nc_id: nc.id,
        task_id: null,
        zone_takt_id: nc.zone_takt_id,
        url,
        type: 'apres',
        auteur_role: role ?? null,
        legende: 'Après correction',
      })
      setNc(prev => prev ? { ...prev, photos: [photo, ...(prev.photos ?? [])] } : prev)
    } catch (err) {
      console.error('Erreur upload photo NC:', err)
    } finally {
      setIsUploadingPhoto(false)
      if (photoInputRef.current) photoInputRef.current.value = ''
    }
  }

  if (isLoading) return <div className="flex justify-center items-center h-64"><Loader2 size={28} className="animate-spin text-nc-red" /></div>
  if (!nc) return <div className="p-4 text-gray-400 text-center">NC introuvable</div>

  return (
    <div className="flex flex-col">
      {/* Hidden file input */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoSelected}
      />

      <div className="bg-nc-blue text-white px-4 py-3">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-white/70 mb-2 text-sm">
          <ArrowLeft size={16} />Retour
        </button>
        <div className="flex items-start gap-2">
          <AlertTriangle size={18} className={nc.gravite === 'bloquante' ? 'text-red-300' : 'text-amber-300'} />
          <div>
            <h2 className="font-bold text-base leading-tight">{nc.titre}</h2>
            <p className="text-white/60 text-xs mt-0.5">NC #{nc.numero} · <span className="capitalize">{nc.gravite}</span></p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Description */}
        {nc.description && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Description</p>
            <p className="text-sm text-gray-700">{nc.description}</p>
          </div>
        )}

        {/* Statut et dates */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400">Statut</p>
              <p className="font-semibold text-sm capitalize mt-0.5">{nc.statut.replace('_', ' ')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Gravité</p>
              <p className="font-semibold text-sm capitalize mt-0.5">{nc.gravite}</p>
            </div>
            {nc.date_echeance && (
              <div>
                <p className="text-xs text-gray-400">Échéance</p>
                <p className="font-semibold text-sm mt-0.5">{formatDateFR(nc.date_echeance)}</p>
              </div>
            )}
            {nc.date_levee && (
              <div>
                <p className="text-xs text-gray-400">Levée le</p>
                <p className="font-semibold text-sm mt-0.5">{formatDateFR(nc.date_levee)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Photos */}
        {nc.photos && nc.photos.length > 0 && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">
              Photos ({nc.photos.length})
            </p>
            <div className="grid grid-cols-3 gap-2">
              {nc.photos.map((p: Photo) => (
                <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={p.url}
                    alt={p.legende ?? ''}
                    className="w-full aspect-square object-cover rounded-xl border border-gray-100"
                    loading="lazy"
                  />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {nc.statut !== 'levee' && nc.statut !== 'validee' && (
        <div className="p-4 bg-white border-t border-gray-100 space-y-2 safe-bottom">
          <button onClick={handleLever} className="w-full btn-primary flex items-center justify-center gap-2">
            <CheckCircle size={18} />
            Lever la NC
          </button>
          <button
            onClick={() => photoInputRef.current?.click()}
            disabled={isUploadingPhoto}
            className="w-full btn-ghost flex items-center justify-center gap-2 text-gray-600 disabled:opacity-50"
          >
            {isUploadingPhoto ? (
              <><Loader2 size={18} className="animate-spin" />Envoi en cours…</>
            ) : (
              <><Camera size={18} />Ajouter photo "après"</>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
