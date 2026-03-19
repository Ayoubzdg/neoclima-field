import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { useAuthStore } from '@/store/authStore'
import { getTasksByChantier } from '@/lib/supabase'
import { calculerPPC, getPpcColor, buildPpcData } from '@/utils/ppc'
import { getMonday, addWeeks, formatDateISO, getSemaineLabel } from '@/utils/dates'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function PpcDashboard() {
  const { chantier } = useAuthStore()
  const [ppcData, setPpcData] = useState<ReturnType<typeof buildPpcData>>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!chantier?.id) return
    setIsLoading(true)

    // Charger les 8 dernières semaines
    const monday = getMonday(new Date())
    const semaines = Array.from({ length: 8 }, (_, i) =>
      formatDateISO(addWeeks(monday, i - 7))
    )

    Promise.all(
      semaines.map(s => getTasksByChantier(chantier.id, { semaine: s }))
    ).then(results => {
      const map = new Map(semaines.map((s, i) => [s, results[i]]))
      setPpcData(buildPpcData(map))
    }).finally(() => setIsLoading(false))
  }, [chantier?.id])

  const dernierPPC = ppcData[ppcData.length - 1]?.ppc ?? null
  const avantDernierPPC = ppcData[ppcData.length - 2]?.ppc ?? null
  const trend = dernierPPC !== null && avantDernierPPC !== null
    ? dernierPPC - avantDernierPPC
    : null

  return (
    <div className="p-4">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-nc-blue">PPC — Fiabilité planning</h2>
        <p className="text-gray-500 text-sm">8 dernières semaines</p>
      </div>

      {/* KPI principal */}
      {dernierPPC !== null && (
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm mb-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">PPC semaine courante</p>
            <p className="text-4xl font-black mt-1" style={{ color: getPpcColor(dernierPPC) }}>
              {dernierPPC}%
            </p>
          </div>
          {trend !== null && (
            <div className={`flex items-center gap-1 text-sm font-semibold
              ${trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-500' : 'text-gray-400'}`}>
              {trend > 0 ? <TrendingUp size={20} /> : trend < 0 ? <TrendingDown size={20} /> : <Minus size={20} />}
              {trend > 0 ? '+' : ''}{Math.round(trend)}pts
            </div>
          )}
        </div>
      )}

      {/* Graphe */}
      {isLoading ? (
        <div className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
      ) : (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-5">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ppcData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="semaine"
                tickFormatter={s => getSemaineLabel(s).split(' · ')[0]}
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
              />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9CA3AF' }} />
              <Tooltip
                formatter={(val: number) => [`${val}%`, 'PPC']}
                labelFormatter={s => getSemaineLabel(s)}
                contentStyle={{ fontSize: 12, borderRadius: '12px', border: '1px solid #E5E7EB' }}
              />
              <ReferenceLine y={80} stroke="#22C55E" strokeDasharray="4 4" label={{ value: '80%', fontSize: 10 }} />
              <Bar dataKey="ppc" radius={[4, 4, 0, 0]}
                fill="#3B82F6"
                // Couleur dynamique par valeur
                label={false}
              />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex justify-between text-xs text-gray-400 mt-1 px-1">
            <span>Objectif : 80%+</span>
            <span>Tâches engagées complétées / total engagées</span>
          </div>
        </div>
      )}

      {/* Tableau détail */}
      {ppcData.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-nc-blue">Détail par semaine</p>
          </div>
          <div className="divide-y divide-gray-50">
            {[...ppcData].reverse().map(d => (
              <div key={d.semaine} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-xs font-medium text-nc-blue">{getSemaineLabel(d.semaine)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{d.completees}/{d.engagees} tâches</p>
                </div>
                <span className="text-sm font-bold" style={{ color: getPpcColor(d.ppc) }}>
                  {d.ppc}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
