import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { getAllCyclesByChantier, getZonesByChantier } from '@/lib/supabase'
import { buildTaktFlux, getTaktCellBg } from '@/utils/takt'
import { getSemaineLabel, formatDateISO, getMonday } from '@/utils/dates'
import { BarChart3, ChevronLeft, ChevronRight, CalendarClock } from 'lucide-react'
import type { CycleTakt, ZoneTakt } from '@/types/models'

export default function GanttChantier() {
  const { chantier } = useAuthStore()
  const [cycles, setCycles] = useState<CycleTakt[]>([])
  const [zones, setZones] = useState<ZoneTakt[]>([])
  const [isLoading, setIsLoading] = useState(true)
  // Navigation timeline
  const [offsetWeeks, setOffsetWeeks] = useState(-4)
  const SEMAINES_VISIBLES = 16

  const currentWeekISO = formatDateISO(getMonday(new Date()))

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

  const flux = buildTaktFlux(zones, cycles, [], SEMAINES_VISIBLES, offsetWeeks)

  // Période affichée
  const periodeLabel = flux.semaines.length > 0
    ? `${getSemaineLabel(flux.semaines[0]).split(' · ')[1]?.split(' – ')[0]} → ${getSemaineLabel(flux.semaines[flux.semaines.length - 1]).split(' · ')[1]?.split(' – ')[1]}`
    : ''

  return (
    <div className="p-4">
      {/* En-tête + navigation */}
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <BarChart3 size={20} className="text-nc-red flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-lg font-bold text-nc-blue">Gantt Chantier</h2>
            <p className="text-gray-500 text-sm">{zones.length} zones · {SEMAINES_VISIBLES} semaines</p>
          </div>
        </div>

        {/* Contrôles navigation */}
        <div className="flex items-center gap-1.5 flex-shrink-0 mt-1">
          <button
            onClick={() => setOffsetWeeks(o => o - 8)}
            className="flex items-center gap-0.5 px-2 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-nc-blue transition-colors"
            title="8 semaines en arrière"
          >
            <ChevronLeft size={13} />
            <ChevronLeft size={13} className="-ml-1.5" />
          </button>
          <button
            onClick={() => setOffsetWeeks(o => o - 1)}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-nc-blue transition-colors"
            title="Semaine précédente"
          >
            <ChevronLeft size={15} />
          </button>

          <button
            onClick={() => setOffsetWeeks(-4)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              offsetWeeks === -4
                ? 'bg-nc-blue text-white'
                : 'border border-gray-200 text-nc-blue hover:bg-blue-50'
            }`}
            title="Revenir à aujourd'hui"
          >
            <CalendarClock size={12} />
            Auj.
          </button>

          <button
            onClick={() => setOffsetWeeks(o => o + 1)}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-nc-blue transition-colors"
            title="Semaine suivante"
          >
            <ChevronRight size={15} />
          </button>
          <button
            onClick={() => setOffsetWeeks(o => o + 8)}
            className="flex items-center gap-0.5 px-2 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-nc-blue transition-colors"
            title="8 semaines en avant"
          >
            <ChevronRight size={13} />
            <ChevronRight size={13} className="-ml-1.5" />
          </button>
        </div>
      </div>

      {periodeLabel && (
        <p className="text-[11px] text-gray-400 mb-4 ml-7">{periodeLabel}</p>
      )}

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
                {flux.semaines.map(sem => {
                  const isCurrent = sem === currentWeekISO
                  return (
                    <th
                      key={sem}
                      className={`text-center text-xs px-1 py-2 border-b border-gray-100 min-w-[72px] relative ${
                        isCurrent ? 'bg-nc-blue/8 text-nc-blue font-bold' : 'bg-white text-gray-400 font-medium'
                      }`}
                    >
                      {isCurrent && (
                        <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-px h-0.5 w-6 bg-nc-red rounded-b" />
                      )}
                      {getSemaineLabel(sem).split(' · ')[0]}
                      {isCurrent && (
                        <div className="text-[8px] font-bold text-nc-red uppercase mt-0.5">◆</div>
                      )}
                    </th>
                  )
                })}
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
                    const isCurrent = sem === currentWeekISO
                    return (
                      <td key={sem} className={`px-1 py-1 border-b border-gray-100 ${isCurrent ? 'bg-nc-blue/5' : ''}`}>
                        {cycle ? (
                          <div className={`h-7 rounded border text-[10px] flex items-center justify-center font-medium ${getTaktCellBg(cycle)}`}>
                            {cycle.ppc !== null && cycle.ppc !== undefined ? `${cycle.ppc}%` : '–'}
                          </div>
                        ) : (
                          <div className={`h-7 rounded border border-dashed ${isCurrent ? 'border-nc-blue/25' : 'border-gray-200'}`} />
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
            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-nc-red text-xs font-bold">◆</span>
              <span className="text-[11px] text-gray-500">Semaine en cours</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
