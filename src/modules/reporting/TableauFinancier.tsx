import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { getTasksByChantier } from '@/lib/supabase'
import type { Task } from '@/types/models'
import ProgressBar from '@/components/ui/ProgressBar'

interface FinancialData {
  budgetHeures: number
  heuresPrevues: number
  heuresRealisees: number
  avancementPhysique: number
  avancementHeures: number
  derive: number
  projectionFin: number
  cout_unitaire_total: number
}

export default function TableauFinancier() {
  const { chantier } = useAuthStore()
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!chantier?.id) return
    setIsLoading(true)
    getTasksByChantier(chantier.id)
      .then(setTasks)
      .finally(() => setIsLoading(false))
  }, [chantier?.id])

  const financial: FinancialData = (() => {
    const budgetHeures = chantier?.budget_heures ?? 0
    const heuresPrevues = tasks.reduce((s, t) => s + t.heures_prevues, 0)
    const heuresRealisees = tasks.reduce((s, t) => s + t.heures_realisees, 0)
    const totalTaches = tasks.length
    const tachesDone = tasks.filter(t => t.status === 'done').length
    const avancementPhysique = totalTaches > 0 ? Math.round((tachesDone / totalTaches) * 100) : 0
    const avancementHeures = heuresPrevues > 0 ? Math.round((heuresRealisees / heuresPrevues) * 100) : 0
    const derive = avancementHeures - avancementPhysique
    const projectionFin = avancementPhysique > 0 ? Math.round(heuresRealisees / (avancementPhysique / 100)) : budgetHeures

    return {
      budgetHeures, heuresPrevues, heuresRealisees,
      avancementPhysique, avancementHeures, derive,
      projectionFin, cout_unitaire_total: 0
    }
  })()

  const taux_horaire = 130 // CHF/h — paramétrable

  return (
    <div className="p-4">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-nc-blue">Tableau financier</h2>
        <p className="text-gray-500 text-sm">{chantier?.name}</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Budget global */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-sm text-gray-500 mb-1">Budget global</p>
            <p className="text-3xl font-black text-nc-blue">
              {financial.budgetHeures.toLocaleString('fr-CH')} h
            </p>
            <p className="text-sm text-gray-500 mt-0.5">
              {(financial.budgetHeures * taux_horaire).toLocaleString('fr-CH')} CHF
            </p>
          </div>

          {/* Avancement physique vs heures */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-nc-blue">Avancement physique</p>
              <span className="text-xl font-black text-nc-blue">{financial.avancementPhysique}%</span>
            </div>
            <ProgressBar value={financial.avancementPhysique} color="#2C3E50" />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-nc-blue">Avancement heures</p>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-nc-blue">{financial.avancementHeures}%</span>
                {financial.derive !== 0 && (
                  <span className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full
                    ${financial.derive > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                    {financial.derive > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {financial.derive > 0 ? '+' : ''}{financial.derive}pts
                  </span>
                )}
              </div>
            </div>
            <ProgressBar value={financial.avancementHeures} color={financial.derive > 5 ? '#EF4444' : '#22C55E'} />
          </div>

          {/* Détail heures */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {[
              { label: 'Heures prévues à date', value: financial.heuresPrevues, unit: 'h' },
              { label: 'Heures réalisées', value: financial.heuresRealisees, unit: 'h' },
              { label: 'Dérive', value: financial.heuresRealisees - financial.heuresPrevues, unit: 'h', isDerive: true },
              { label: 'Projection fin de chantier', value: financial.projectionFin, unit: 'h', isBold: true }
            ].map(({ label, value, unit, isDerive, isBold }) => (
              <div key={label} className="flex items-center justify-between px-4 py-3">
                <p className={`text-sm ${isBold ? 'font-bold text-nc-blue' : 'text-gray-600'}`}>{label}</p>
                <p className={`text-sm font-bold ${
                  isDerive && value > 0 ? 'text-red-600' :
                  isDerive && value < 0 ? 'text-green-600' :
                  isBold ? 'text-nc-blue' : 'text-gray-800'
                }`}>
                  {isDerive && value > 0 ? '+' : ''}{value.toFixed(0)} {unit}
                  {isDerive && Math.abs(value) > 0 && (
                    <span className="text-xs ml-1 font-normal text-gray-400">
                      ({((Math.abs(value)) * taux_horaire).toLocaleString('fr-CH')} CHF)
                    </span>
                  )}
                </p>
              </div>
            ))}
          </div>

          {/* Alerte dérive */}
          {financial.derive > 10 && (
            <div className="bg-red-50 rounded-2xl p-4 border border-red-100 flex items-start gap-2">
              <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-700">Dérive heures importante</p>
                <p className="text-xs text-red-600 mt-0.5">
                  +{financial.derive}pts vs avancement physique — analyser les causes
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
