import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Map, QrCode, ChevronRight, Plus, Upload } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { getSecteurs, getZonesTakt, getAvancementChantier } from '@/lib/supabase'
import type { Secteur, ZoneTakt, VueAvancementZone } from '@/types/models'
import ProgressBar from '@/components/ui/ProgressBar'

export default function ZonesList() {
  const navigate = useNavigate()
  const { chantier } = useAuthStore()
  const [secteurs, setSecteurs] = useState<Secteur[]>([])
  const [zones, setZones] = useState<ZoneTakt[]>([])
  const [avancements, setAvancements] = useState<VueAvancementZone[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedSecteur, setExpandedSecteur] = useState<string | null>(null)

  useEffect(() => {
    if (!chantier?.id) return
    setIsLoading(true)

    const load = async () => {
      const [sects, avancements] = await Promise.all([
        getSecteurs(chantier.id!),
        getAvancementChantier(chantier.id!),
      ])
      setSecteurs(sects)
      setAvancements(avancements)
      if (sects[0]) setExpandedSecteur(sects[0].id)

      // Charger les zones de tous les secteurs en parallèle
      const allZonesArrays = await Promise.all(sects.map(s => getZonesTakt(s.id)))
      setZones(allZonesArrays.flat())
    }

    load().finally(() => setIsLoading(false))
  }, [chantier?.id])

  const getAvancement = (zoneId: string) =>
    avancements.find(a => a.zone_takt_id === zoneId)

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-nc-blue">Plans & Zones</h2>
          <p className="text-gray-500 text-sm">{zones.length} zones · {secteurs.length} secteurs</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/plans/qr')}
            className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50"
            title="Imprimer QR codes"
          >
            <QrCode size={18} className="text-gray-600" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {secteurs.map(secteur => {
            const secteurZones = zones.filter(z => z.secteur_id === secteur.id)
            const isExpanded = expandedSecteur === secteur.id
            return (
              <div key={secteur.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Header secteur */}
                <button
                  onClick={() => setExpandedSecteur(isExpanded ? null : secteur.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Map size={16} className="text-nc-red" />
                    <div className="text-left">
                      <p className="font-semibold text-nc-blue text-sm">{secteur.name}</p>
                      <p className="text-xs text-gray-400">{secteurZones.length} zones</p>
                    </div>
                  </div>
                  <ChevronRight
                    size={16}
                    className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  />
                </button>

                {/* Zones du secteur */}
                {isExpanded && (
                  <div className="divide-y divide-gray-50 border-t border-gray-100">
                    {secteurZones.map(zone => {
                      const av = getAvancement(zone.id)
                      return (
                        <button
                          key={zone.id}
                          onClick={() => navigate(`/plans/zone/${zone.id}`)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50/30 transition-colors text-left"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-nc-blue truncate">{zone.name}</p>
                            <div className="flex items-center gap-3 mt-1">
                              {av && (
                                <ProgressBar
                                  value={av.avancement_pct}
                                  height="h-1.5"
                                  color="auto"
                                  className="flex-1"
                                />
                              )}
                              <span className="text-xs text-gray-400 flex-shrink-0">
                                {av ? `${av.avancement_pct}%` : '—'}
                              </span>
                            </div>
                            {zone.qr_code && (
                              <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{zone.qr_code}</p>
                            )}
                          </div>
                          {av && av.tasks_blocked > 0 && (
                            <span className="text-[10px] bg-red-100 text-red-600 font-medium px-1.5 py-0.5 rounded-full flex-shrink-0">
                              {av.tasks_blocked} bloquée{av.tasks_blocked > 1 ? 's' : ''}
                            </span>
                          )}
                          {zone.plan_url ? (
                            <Map size={14} className="text-gray-300 flex-shrink-0" />
                          ) : (
                            <Upload size={14} className="text-gray-200 flex-shrink-0" />
                          )}
                          <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
                        </button>
                      )
                    })}
                    {secteurZones.length === 0 && (
                      <div className="px-4 py-3 text-xs text-gray-400">Aucune zone dans ce secteur</div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
