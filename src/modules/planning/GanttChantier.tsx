import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { getAllCyclesByChantier, getZonesByChantier } from '@/lib/supabase'
import { buildTaktFlux, getTaktCellBg } from '@/utils/takt'
import { getSemaineLabel } from '@/utils/dates'
import { BarChart3 } from 'lucide-react'
import type { CycleTakt, ZoneTakt } from '@/types/models'

export default function GanttChantier() {
  const { chantier } = useAuthStore()
  const [cycles, setCycles] = useState<CycleTakt[]>([])
  const [zones, setZones] = useState<ZoneTakt[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!chantier?.id) return
    setIsLoading(true)
    Promise.all([
      getAllCyclesByChantier(chantier.id),
      getZonesByChantier(chantier.id),
    ])
      .then(([c, z]) => {
        setCycles(c)
        setZones(z)
      })
      .finally(() => setIsLoading(false))
  }, [chantier?.id])

  // 12 semaines : 2 passées + semaine courante + 9 à venir
  const flux = buildTaktFlux(zones, cycles, [], 12)

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-5">
        <BarChart3 size={20} className="text-nc-red" />
        <div>
          <h2 className="text-lg font-bold text-nc-blue">Gantt Chantier</h2>
          <p className="text-gray-500 text-sm">Vue 12 semaines · {zones.length} zones</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : zones.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <BarChart3 size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Aucune zone configurée</p>
          <p className="text-sm mt-1">Créer des zones dans Paramètres → Zones</p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="min-w-max border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-white text-left text-xs text-gray-500 font-semibold px-3 py-2 border-b border-r border-gray-100 w-44">
                  Zone / Secteur
                </th>
                {flux.semaines.map(sem => (
                  <th key={sem} className="text-center text-xs text-gray-400 px-1 py-2 border-b border-gray-100 min-w-[72px]">
                    {getSemaineLabel(sem).split(' · ')[0]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flux.zones.map((zone, i) => (
                <tr key={zone.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                  <td className="sticky left-0 bg-inherit z-10 px-3 py-2 border-r border-b border-gray-100">
                    <p className="text-xs font-semibold text-nc-blue truncate max-w-[140px]">{zone.name}</p>
                    {zone.secteur?.name && (
                      <p className="text-[10px] text-gray-400 truncate max-w-[140px]">{zone.secteur.name}</p>
                    )}
                  </td>
                  {flux.semaines.map(sem => {
                    const cell = flux.cells.get(`${zone.id}-${sem}`)
                    const cycle = cell?.cycle ?? null
                    return (
                      <td key={sem} className="px-1 py-1 border-b border-gray-100">
                        {cycle ? (
                          <div className={`h-7 rounded border text-[10px] flex items-center justify-center font-medium ${getTaktCellBg(cycle)}`}>
                            {cycle.ppc !== null && cycle.ppc !== undefined ? `${cycle.ppc}%` : '–'}
                          </div>
                        ) : (
                          <div className="h-7 rounded border border-dashed border-gray-150" />
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Légende */}
          <div className="flex items-center gap-4 mt-4 px-1 flex-wrap">
            {[
              { label: 'Planifié', cls: 'bg-slate-100 border-slate-300' },
              { label: 'En cours', cls: 'bg-blue-100 border-blue-400' },
              { label: 'Partiel', cls: 'bg-yellow-100 border-yellow-400' },
              { label: 'Complet', cls: 'bg-green-100 border-green-400' },
            ].map(({ label, cls }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`w-4 h-4 rounded border ${cls}`} />
                <span className="text-[11px] text-gray-500">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
