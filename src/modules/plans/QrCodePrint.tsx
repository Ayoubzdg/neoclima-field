import { useEffect, useState } from 'react'
import { Printer, Download } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { getSecteurs, getZonesTakt } from '@/lib/supabase'
import { generateQRCodeDataURL } from '@/utils/qr'
import type { ZoneTakt } from '@/types/models'

interface ZoneWithQR extends ZoneTakt {
  qrDataURL: string | null
}

export default function QrCodePrint() {
  const { chantier } = useAuthStore()
  const [zones, setZones] = useState<ZoneWithQR[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!chantier?.id) return
    setIsLoading(true)

    getSecteurs(chantier.id).then(async secteurs => {
      const allZones = (await Promise.all(secteurs.map(s => getZonesTakt(s.id)))).flat()
      const withQR = await Promise.all(
        allZones.map(async z => ({
          ...z,
          qrDataURL: z.qr_code ? await generateQRCodeDataURL(z.qr_code) : null
        }))
      )
      setZones(withQR)
    }).finally(() => setIsLoading(false))
  }, [chantier?.id])

  const handlePrint = () => window.print()

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-5 print:hidden">
        <div>
          <h2 className="text-lg font-bold text-nc-blue">Impression QR Codes</h2>
          <p className="text-gray-500 text-sm">{zones.length} zones · Format étiquette A6</p>
        </div>
        <button
          onClick={handlePrint}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Printer size={16} />
          Imprimer
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 print:grid-cols-3 print:gap-2">
          {zones.map(zone => (
            <div
              key={zone.id}
              className="bg-white rounded-2xl border-2 border-gray-100 p-4 flex flex-col items-center
                         text-center print:border print:rounded-none print:break-inside-avoid"
            >
              {/* Logo Neoclima */}
              <div className="w-8 h-8 bg-nc-red rounded-lg flex items-center justify-center mb-2">
                <span className="text-white text-xs font-black">NC</span>
              </div>

              {/* QR Code */}
              {zone.qrDataURL ? (
                <img src={zone.qrDataURL} alt={`QR ${zone.qr_code}`} className="w-32 h-32" />
              ) : (
                <div className="w-32 h-32 bg-gray-100 rounded-xl flex items-center justify-center">
                  <span className="text-gray-400 text-xs">Pas de QR</span>
                </div>
              )}

              {/* Infos zone */}
              <div className="mt-2">
                <p className="font-bold text-nc-blue text-sm">{zone.name}</p>
                <p className="font-mono text-xs text-gray-500 mt-0.5">{zone.qr_code}</p>
                {chantier && (
                  <p className="text-[10px] text-gray-400 mt-1 truncate max-w-[120px]">{chantier.name}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Instructions impression */}
      <div className="mt-6 bg-gray-50 rounded-2xl p-4 text-sm text-gray-600 print:hidden">
        <p className="font-semibold mb-1">Instructions :</p>
        <ol className="list-decimal list-inside space-y-1 text-xs">
          <li>Cliquer sur <strong>Imprimer</strong> et sélectionner le format A4</li>
          <li>Activer <em>Imprimer les arrière-plans</em> pour les couleurs</li>
          <li>Découper les étiquettes et les plastifier</li>
          <li>Coller sur les zones correspondantes sur le chantier</li>
        </ol>
      </div>
    </div>
  )
}
