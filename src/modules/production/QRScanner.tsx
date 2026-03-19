import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, X } from 'lucide-react'
import { scanQRFromVideoFrame } from '@/utils/qr'

export default function QRScanner() {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [lastResult, setLastResult] = useState<string | null>(null)

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setScanning(true)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('NotAllowedError') || msg.includes('Permission denied')) {
        setError('Accès caméra refusé. Utiliser le code manuel.')
      } else {
        setError('Caméra indisponible sur cet appareil.')
      }
      setShowManual(true)
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setScanning(false)
  }, [])

  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, [startCamera, stopCamera])

  useEffect(() => {
    if (!scanning) return

    scanIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current) return
      const code = await scanQRFromVideoFrame(videoRef.current, canvasRef.current)
      if (code && code !== lastResult) {
        setLastResult(code)
        stopCamera()
        navigate(`/zone-tasks/${encodeURIComponent(code)}`)
      }
    }, 200)

    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current)
    }
  }, [scanning, lastResult, navigate, stopCamera])

  const handleManualSubmit = () => {
    const code = manualCode.trim().toUpperCase()
    if (!code) return
    navigate(`/zone-tasks/${encodeURIComponent(code)}`)
  }

  return (
    <div className="flex flex-col h-screen bg-black">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-3 px-4 py-4 safe-top">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 bg-black/40 rounded-xl flex items-center justify-center"
        >
          <ArrowLeft size={20} className="text-white" />
        </button>
        <h2 className="text-white font-bold text-lg">Scanner une zone</h2>
        <button
          onClick={() => setShowManual(prev => !prev)}
          className="ml-auto w-10 h-10 bg-black/40 rounded-xl flex items-center justify-center"
        >
          {showManual ? <X size={18} className="text-white" /> : <span className="text-white text-xs font-bold">ABC</span>}
        </button>
      </div>

      {/* Viewfinder */}
      <div className="relative flex-1">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Cadre scan */}
        {scanning && !showManual && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 relative">
              {/* Coins du cadre */}
              {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(pos => (
                <div
                  key={pos}
                  className={`absolute w-8 h-8 border-nc-red border-4
                    ${pos.includes('top') ? 'top-0' : 'bottom-0'}
                    ${pos.includes('left') ? 'left-0' : 'right-0'}
                    ${pos === 'top-left' ? 'border-r-0 border-b-0 rounded-tl-lg' : ''}
                    ${pos === 'top-right' ? 'border-l-0 border-b-0 rounded-tr-lg' : ''}
                    ${pos === 'bottom-left' ? 'border-r-0 border-t-0 rounded-bl-lg' : ''}
                    ${pos === 'bottom-right' ? 'border-l-0 border-t-0 rounded-br-lg' : ''}
                  `}
                />
              ))}
              {/* Ligne de scan animée */}
              <div className="absolute left-2 right-2 h-0.5 bg-nc-red/80 top-1/2 animate-bounce opacity-80" />
            </div>
            <p className="absolute bottom-1/4 text-white/80 text-sm text-center">
              Pointez le QR code de la zone
            </p>
          </div>
        )}

        {/* Erreur caméra */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center text-white px-6">
              <p className="text-lg font-semibold mb-2">Caméra indisponible</p>
              <p className="text-white/60 text-sm mb-4">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Saisie manuelle */}
      {showManual && (
        <div className="bg-white p-5 animate-slide-up">
          <p className="text-sm font-semibold text-nc-blue mb-3">Saisir le code manuellement</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={e => setManualCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
              placeholder="Ex: NC-Z001"
              className="input-field flex-1 uppercase tracking-widest font-mono"
              autoFocus
            />
            <button
              onClick={handleManualSubmit}
              disabled={!manualCode.trim()}
              className="btn-primary px-5"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
