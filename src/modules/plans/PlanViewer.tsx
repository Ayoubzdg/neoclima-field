import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, ZoomIn, ZoomOut, List, AlertTriangle, Loader2 } from 'lucide-react'
import { getZoneByQrCode, getTasksByZone, uploadPlan, supabase } from '@/lib/supabase'
import type { ZoneTakt, Task } from '@/types/models'
import StatusBadge from '@/components/ui/StatusBadge'

export default function PlanViewer() {
  const { id, qrCode } = useParams<{ id?: string; qrCode?: string }>()
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Cache du document PDF — rechargé uniquement si l'URL change
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null)
  const renderingRef = useRef(false)

  const [zone, setZone] = useState<ZoneTakt | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPdfLoading, setIsPdfLoading] = useState(false)
  const [showTasks, setShowTasks] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pdfPage, setPdfPage] = useState(1)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [pdfRenderError, setPdfRenderError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setIsLoading(true)
    const load = async () => {
      let z: ZoneTakt | null = null
      if (qrCode) {
        z = await getZoneByQrCode(decodeURIComponent(qrCode))
      } else if (id) {
        const { data } = await supabase
          .from('zones_takt')
          .select('*, secteur:secteurs(*)')
          .eq('id', id)
          .single()
        z = data as ZoneTakt | null
      }

      if (z) {
        setZone(z)
        const t = await getTasksByZone(z.id)
        setTasks(t)
      }
    }
    load().finally(() => setIsLoading(false))
  }, [id, qrCode])

  // Chargement initial du document PDF (fetch + parse) — uniquement quand l'URL change
  useEffect(() => {
    if (isLoading || !zone?.plan_url) return
    pdfDocRef.current = null
    setPdfRenderError(null)
    setIsPdfLoading(true)
    ;(async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
        const response = await fetch(zone.plan_url!)
        if (!response.ok) throw new Error(`HTTP ${response.status} — impossible de charger le plan`)
        const arrayBuffer = await response.arrayBuffer()
        pdfDocRef.current = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        renderPage()
      } catch (err) {
        console.error('[PlanViewer] Erreur chargement PDF:', err)
        setPdfRenderError(err instanceof Error ? err.message : 'Impossible de charger le PDF')
      } finally {
        setIsPdfLoading(false)
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone?.plan_url, isLoading])

  // Re-rendu rapide quand zoom ou page change (pas de re-fetch)
  useEffect(() => {
    if (pdfDocRef.current) renderPage()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, pdfPage])

  const renderPage = async () => {
    const pdf = pdfDocRef.current
    if (!pdf || renderingRef.current) return
    renderingRef.current = true
    try {
      const page = await pdf.getPage(pdfPage)
      const viewport = page.getViewport({ scale: zoom })
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvasContext: ctx, viewport }).promise
    } catch (err) {
      console.error('[PlanViewer] Erreur rendu page:', err)
      setPdfRenderError(err instanceof Error ? err.message : 'Impossible d\'afficher le PDF')
    } finally {
      renderingRef.current = false
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !zone) return
    if (file.type !== 'application/pdf') {
      setUploadError('Seuls les fichiers PDF sont acceptés')
      return
    }
    setIsUploading(true)
    setUploadError(null)
    try {
      const url = await uploadPlan(file, zone.id)
      // Mettre à jour la zone avec l'URL du plan
      const { data: updated } = await supabase
        .from('zones_takt')
        .update({ plan_url: url, plan_version: (zone.plan_version ?? 1) + 1 })
        .eq('id', zone.id)
        .select()
        .single()
      if (updated) {
        setZone(updated as ZoneTakt)
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Erreur upload')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-2 border-nc-red border-t-transparent rounded-full" />
    </div>
  )

  if (!zone) return (
    <div className="p-8 text-center">
      <AlertTriangle size={32} className="mx-auto text-amber-400 mb-3" />
      <p className="font-semibold text-nc-blue">Zone introuvable</p>
      <p className="text-sm text-gray-400 mt-1">Code QR : {qrCode}</p>
      <button onClick={() => navigate('/plans')} className="btn-secondary mt-4 text-sm">
        ← Retour aux plans
      </button>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-nc-blue text-white px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-xl hover:bg-white/10">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{zone.name}</p>
          <p className="text-white/60 text-xs">{zone.qr_code} · Version {zone.plan_version}</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} disabled={isPdfLoading} className="p-1.5 rounded-xl hover:bg-white/10 disabled:opacity-40">
            <ZoomOut size={18} />
          </button>
          <span className="text-xs text-white/60 w-10 text-center">
            {isPdfLoading ? <Loader2 size={13} className="animate-spin mx-auto" /> : `${Math.round(zoom * 100)}%`}
          </span>
          <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} disabled={isPdfLoading} className="p-1.5 rounded-xl hover:bg-white/10 disabled:opacity-40">
            <ZoomIn size={18} />
          </button>
          <button
            onClick={() => setShowTasks(p => !p)}
            className={`p-1.5 rounded-xl transition-colors ${showTasks ? 'bg-white/20' : 'hover:bg-white/10'}`}
          >
            <List size={18} />
          </button>
          {/* Bouton upload plan */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="p-1.5 rounded-xl hover:bg-white/10 disabled:opacity-50"
            title="Importer un plan PDF"
          >
            {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleUpload}
            className="hidden"
          />
        </div>
      </div>
      {/* Erreur upload */}
      {uploadError && (
        <div className="bg-red-50 text-red-600 text-xs px-4 py-2 flex items-center gap-2">
          <AlertTriangle size={14} />
          {uploadError}
          <button onClick={() => setUploadError(null)} className="ml-auto font-bold">×</button>
        </div>
      )}
      {/* Erreur rendu PDF */}
      {pdfRenderError && (
        <div className="bg-amber-50 text-amber-700 text-xs px-4 py-2 flex items-center gap-2">
          <AlertTriangle size={14} />
          {pdfRenderError}
          <button onClick={() => setPdfRenderError(null)} className="ml-auto font-bold">×</button>
        </div>
      )}

      {/* Corps */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas plan */}
        <div className="flex-1 overflow-auto bg-gray-100">
          {zone.plan_url ? (
            <div className="relative inline-block">
              <canvas
                ref={canvasRef}
                className="shadow-lg block"
              />
              {/* Overlay tâches */}
              {tasks.filter(t => t.rect).map(task => (
                <div
                  key={task.id}
                  className={`absolute border-2 rounded cursor-pointer transition-all hover:opacity-90
                    ${task.status === 'done' ? 'border-green-500 bg-green-200/40'
                      : task.status === 'blocked' ? 'border-red-500 bg-red-200/40'
                      : task.status === 'en_cours' ? 'border-blue-500 bg-blue-200/40'
                      : 'border-gray-400 bg-gray-200/30'}`}
                  style={{
                    left: `${task.rect!.x}%`,
                    top: `${task.rect!.y}%`,
                    width: `${task.rect!.w}%`,
                    height: `${task.rect!.h}%`
                  }}
                  onClick={() => navigate(`/production/tache/${task.id}`)}
                  title={task.label}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
              <Upload size={48} className="mb-3 opacity-30" />
              <p className="font-medium">Aucun plan disponible</p>
              <p className="text-sm mt-1 mb-4">Importer un plan PDF pour cette zone</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-4 py-2 bg-nc-blue text-white text-sm rounded-xl hover:bg-nc-blue/90 disabled:opacity-50 flex items-center gap-2"
              >
                {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {isUploading ? 'Import en cours...' : 'Importer un plan PDF'}
              </button>
            </div>
          )}
        </div>

        {/* Panel tâches */}
        {showTasks && (
          <div className="w-80 bg-white border-l border-gray-100 overflow-y-auto flex-shrink-0">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="font-semibold text-nc-blue text-sm">{tasks.length} tâche{tasks.length > 1 ? 's' : ''}</p>
            </div>
            <div className="divide-y divide-gray-50">
              {tasks.map(task => (
                <button
                  key={task.id}
                  onClick={() => navigate(`/production/tache/${task.id}`)}
                  className="w-full text-left px-4 py-3 hover:bg-blue-50/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-nc-blue truncate flex-1">{task.label}</p>
                    <StatusBadge status={task.status} />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {task.qte_realisee}/{task.qte_prevue} {task.unite}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
