import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle, AlertTriangle, Camera,
  ChevronRight, Loader2, Clock, ImageIcon
} from 'lucide-react'
import { useProductionStore } from '@/store/productionStore'
import { useAuthStore } from '@/store/authStore'
import { getTaskById, preparePhoto, uploadPhotoBlob, savePhoto, getPhotosByTask, getTaskHistory } from '@/lib/supabase'
import { addPhotoOffline } from '@/lib/offline/db'
import { useUiStore } from '@/store/uiStore'
import { History } from 'lucide-react'
import type { TaskHistory } from '@/types/models'
import StatusBadge from '@/components/ui/StatusBadge'
import SecureImage from '@/components/ui/SecureImage'
import ProgressBar from '@/components/ui/ProgressBar'
import BlocageForm from './BlocageForm'
import { nextStatus, actionLabel, canValidate } from '@/utils/statusMachine'
import type { Task, TaskStatus, Photo } from '@/types/models'

export default function TacheDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { role } = useAuthStore()
  const { updateStatus, signalerBlocage } = useProductionStore()

  const [task, setTask] = useState<Task | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [history, setHistory] = useState<TaskHistory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [showBlocage, setShowBlocage] = useState(false)
  const [qteRealisee, setQteRealisee] = useState<string>('')

  const photoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!id) return
    setIsLoading(true)
    Promise.all([getTaskById(id), getPhotosByTask(id), getTaskHistory(id)])
      .then(([t, p, h]) => {
        setTask(t)
        setPhotos(p)
        setHistory(h)
        if (t) setQteRealisee(String(t.qte_realisee))
      })
      .finally(() => setIsLoading(false))
  }, [id])

  const handleStatusUpdate = async (newStatus: TaskStatus, extra?: Partial<Task>) => {
    if (!task || isUpdating) return
    setIsUpdating(true)
    const updates: Partial<Task> = {
      qte_realisee: parseFloat(qteRealisee) || task.qte_realisee,
      ...extra,
    }
    if (newStatus === 'en_cours' && !task.date_debut_reel) {
      updates.date_debut_reel = new Date().toISOString()
    }
    if (newStatus === 'a_controler' && task.status !== 'done') {
      // Fin des travaux déclarée — on garde la quantité réellement
      // saisie (avant : écrasée par qte_prevue, on perdait l'info)
      updates.date_fin_reel = new Date().toISOString()
    }
    await updateStatus(task.id, newStatus, updates, role ?? 'monteur')
    setTask(prev => prev ? { ...prev, status: newStatus, ...updates } : prev)
    setIsUpdating(false)
  }

  // Refus de contrôle par le chef : motif obligatoire → retour en cours
  const handleRefus = async () => {
    const motif = window.prompt('Motif du refus (obligatoire) :')
    if (!motif?.trim()) return
    await handleStatusUpdate('en_cours', { comment: `⚠ Contrôle refusé : ${motif.trim()}` })
  }

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !task) return
    setIsUploadingPhoto(true)
    const rawPath = `tasks/${task.id}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`
    // Compression d'abord (le blob compressé part en ligne OU en file offline)
    const prepared = await preparePhoto(file, rawPath)
    try {
      const url = await uploadPhotoBlob(prepared.body, prepared.path, prepared.contentType)
      const photo = await savePhoto({
        task_id: task.id,
        zone_takt_id: task.zone_takt_id ?? task.zone_takt?.id ?? '',
        url,
        type: 'avant',
        auteur_role: role ?? null,
        legende: null,
      })
      setPhotos(prev => [photo, ...prev])
    } catch {
      // Hors ligne / échec réseau → file Dexie, JAMAIS de photo perdue
      await addPhotoOffline({
        task_id: task.id,
        zone_takt_id: task.zone_takt_id ?? task.zone_takt?.id ?? '',
        nc_id: null,
        path: prepared.path,
        contentType: prepared.contentType,
        type: 'avant',
        auteur_role: role ?? null,
        blob: prepared.body,
        created_at: new Date().toISOString(),
      })
      useUiStore.getState().addNotification({
        type: 'info',
        message: 'Photo enregistrée — elle partira au retour du réseau',
        autoDismiss: true,
      })
      useUiStore.getState().refreshSyncCount()
    } finally {
      setIsUploadingPhoto(false)
      if (photoInputRef.current) photoInputRef.current.value = ''
    }
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={28} className="animate-spin text-nc-red" />
    </div>
  )

  if (!task) return (
    <div className="p-4 text-center text-gray-400">Tâche introuvable</div>
  )

  const next = nextStatus(task.status, role)
  const pct = task.qte_prevue > 0 ? Math.round((parseFloat(qteRealisee) / task.qte_prevue) * 100) : 0
  const isValide = task.status === 'done'
  const isAControler = task.status === 'a_controler'
  const isChef = canValidate(role)

  return (
    <>
      {/* Hidden file input for camera/gallery */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoSelected}
      />

      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="bg-nc-blue text-white px-4 py-3">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-white/70 mb-2 text-sm">
            <ArrowLeft size={16} />
            Retour
          </button>
          <h2 className="font-bold text-lg leading-tight">{task.label}</h2>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={task.status} />
            <span className="text-white/60 text-sm">{task.zone_takt?.name}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Quantité réalisée */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 mb-2">Quantité réalisée</p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={qteRealisee}
                onChange={e => setQteRealisee(e.target.value)}
                disabled={isValide}
                className="input-field text-2xl font-bold text-nc-blue w-28 text-center"
                min={0}
                max={task.qte_prevue * 2}
              />
              <div className="text-gray-500">
                <span className="text-lg">/ {task.qte_prevue}</span>
                <span className="text-sm ml-1">{task.unite}</span>
              </div>
            </div>
            <ProgressBar value={pct} color="auto" className="mt-3" showLabel />
          </div>

          {/* Contraintes */}
          {task.contraintes && task.contraintes.filter(c => c.statut !== 'levee').length > 0 && (
            <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
              <p className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1.5">
                <AlertTriangle size={14} />
                Contraintes actives
              </p>
              <div className="space-y-2">
                {task.contraintes.filter(c => c.statut !== 'levee').map(c => (
                  <div key={c.id} className="text-sm text-red-600">
                    • {c.description}
                    {c.responsable && <span className="text-red-400 text-xs"> — {c.responsable}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Commentaire */}
          {task.comment && (
            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
              <p className="text-xs font-semibold text-amber-700 uppercase mb-1">Note</p>
              <p className="text-sm text-amber-900">{task.comment}</p>
            </div>
          )}

          {/* Photos */}
          {photos.length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <ImageIcon size={14} />
                Photos ({photos.length})
              </p>
              <div className="grid grid-cols-3 gap-2">
                {photos.map(p => (
                  <SecureImage
                    key={p.id}
                    src={p.url}
                    alt={p.legende ?? 'Photo'}
                    className="w-full aspect-square object-cover rounded-lg border border-gray-100"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Historique — qui a fait quoi, quand */}
          {history.length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <History size={14} />
                Historique
              </p>
              <div className="space-y-2.5">
                {history.map(h => {
                  const d = new Date(h.created_at)
                  const when = d.toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit' })
                    + ' ' + d.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })
                  const actionLabel =
                    h.action === 'blocage'   ? '🚫 Blocage' :
                    h.action === 'deblocage' ? '🔓 Déblocage' :
                    h.action === 'status_change' ? 'Statut' : h.action
                  return (
                    <div key={h.id} className="flex items-start gap-2 text-xs">
                      <span className="text-gray-400 font-mono flex-shrink-0 w-20">{when}</span>
                      <div className="min-w-0">
                        <span className="text-gray-700 font-medium">{actionLabel}</span>
                        {h.detail && <span className="text-gray-500"> {h.detail}</span>}
                        <span className="text-gray-400">
                          {' — '}{h.personne_nom || h.role || '?'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Tâche isolation en attente du montage ── */}
        {task.bloquee_par_predecesseur && !isValide && !isAControler && (
          <div className="p-4 bg-gray-50 border-t border-gray-100 safe-bottom">
            <div className="flex items-center justify-center gap-2 py-2 text-gray-500 font-semibold">
              <span className="text-lg">🔒</span>
              En attente de la validation du montage
            </div>
            <p className="text-xs text-gray-400 text-center">
              Cette tâche se débloquera automatiquement.
            </p>
          </div>
        )}

        {/* Actions bas de page — selon l'état du workflow */}
        {!task.bloquee_par_predecesseur && !isValide && !isAControler && (
          /* ── Tâche active (à faire / en cours / bloquée) ── */
          <div className="p-4 bg-white border-t border-gray-100 space-y-2 safe-bottom">
            {next && (
              <button
                onClick={() => handleStatusUpdate(next)}
                disabled={isUpdating}
                className="w-full btn-primary flex items-center justify-center gap-2 h-14 text-lg"
              >
                {isUpdating ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : task.status === 'todo' ? (
                  <><Clock size={20} />{actionLabel(task.status, role)}</>
                ) : (
                  <><CheckCircle size={20} />{actionLabel(task.status, role)}</>
                )}
              </button>
            )}

            <button
              onClick={() => setShowBlocage(true)}
              disabled={isUpdating}
              className="w-full py-3 px-6 rounded-xl border-2 border-red-200 text-red-600
                         font-semibold flex items-center justify-center gap-2
                         active:scale-95 transition-all hover:bg-red-50"
            >
              <AlertTriangle size={18} />
              Signaler un blocage
              <ChevronRight size={16} className="ml-auto" />
            </button>

            <button
              onClick={() => photoInputRef.current?.click()}
              disabled={isUploadingPhoto}
              className="w-full py-3 px-6 rounded-xl border border-gray-200 text-gray-600
                         font-medium flex items-center justify-center gap-2
                         active:scale-95 transition-all hover:bg-gray-50 disabled:opacity-50"
            >
              {isUploadingPhoto ? (
                <><Loader2 size={18} className="animate-spin" />Envoi en cours…</>
              ) : (
                <><Camera size={18} />Ajouter une photo</>
              )}
            </button>
          </div>
        )}

        {isAControler && (
          /* ── En attente de contrôle ── */
          <div className="p-4 bg-white border-t border-gray-100 space-y-2 safe-bottom">
            {isChef ? (
              <>
                <button
                  onClick={() => handleStatusUpdate('done')}
                  disabled={isUpdating}
                  className="w-full h-14 rounded-xl bg-green-600 text-white font-semibold text-lg
                             flex items-center justify-center gap-2 active:scale-95 transition-all
                             hover:bg-green-700 disabled:opacity-50"
                >
                  {isUpdating ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle size={20} />}
                  Valider les travaux
                </button>
                <button
                  onClick={handleRefus}
                  disabled={isUpdating}
                  className="w-full py-3 px-6 rounded-xl border-2 border-red-200 text-red-600
                             font-semibold flex items-center justify-center gap-2
                             active:scale-95 transition-all hover:bg-red-50"
                >
                  <AlertTriangle size={18} />
                  Refuser — renvoyer en cours
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center gap-2 py-2 text-amber-600 font-semibold">
                  <Clock size={18} />
                  En attente de contrôle du chef
                </div>
                <button
                  onClick={() => handleStatusUpdate('en_cours')}
                  disabled={isUpdating}
                  className="w-full py-3 px-6 rounded-xl border border-gray-200 text-gray-500
                             font-medium flex items-center justify-center gap-2
                             active:scale-95 transition-all hover:bg-gray-50"
                >
                  Annuler — remettre en cours
                </button>
              </>
            )}
            <button
              onClick={() => photoInputRef.current?.click()}
              disabled={isUploadingPhoto}
              className="w-full py-2.5 px-6 rounded-xl border border-gray-200 text-gray-500 text-sm
                         font-medium flex items-center justify-center gap-2
                         active:scale-95 transition-all hover:bg-gray-50 disabled:opacity-50"
            >
              {isUploadingPhoto ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
              Ajouter une photo
            </button>
          </div>
        )}

        {isValide && (
          /* ── Validée ── */
          <div className="p-4 bg-white border-t border-gray-100 safe-bottom">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-600 font-semibold">
                <CheckCircle size={20} />
                Travaux validés
              </div>
              <div className="flex items-center gap-3">
                {isChef && (
                  <button
                    onClick={() => handleStatusUpdate('a_controler')}
                    disabled={isUpdating}
                    className="text-sm text-gray-400 hover:text-nc-blue underline"
                  >
                    Dévalider
                  </button>
                )}
                <button
                  onClick={() => photoInputRef.current?.click()}
                  disabled={isUploadingPhoto}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-nc-blue"
                >
                  {isUploadingPhoto ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                  Photo
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showBlocage && (
        <BlocageForm
          task={task}
          onClose={() => setShowBlocage(false)}
          onSubmit={async (type, comment) => {
            // Point d'entrée unifié : statut + contrainte + historique
            // (avant : ce chemin ne créait PAS la contrainte, contrairement
            //  à MesTaches — incohérence relevée par l'audit)
            await signalerBlocage(task, type, comment, role ?? 'monteur')
            setTask(prev => prev ? { ...prev, status: 'blocked', type_blocage: type, comment } : prev)
            setShowBlocage(false)
          }}
        />
      )}
    </>
  )
}
