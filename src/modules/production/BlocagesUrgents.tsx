import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ChevronRight, CheckCircle } from 'lucide-react'
import { useProductionStore } from '@/store/productionStore'
import { useAuthStore } from '@/store/authStore'
import { todayISO, formatDateFR } from '@/utils/dates'
import { BLOCAGE_LABELS } from './BlocageForm'
import type { Task } from '@/types/models'

/** Durée depuis le blocage, en heures (basée sur updated_at) */
function heuresDepuisBlocage(task: Task): number | null {
  if (!task.updated_at) return null
  return Math.round((Date.now() - new Date(task.updated_at).getTime()) / 3_600_000)
}

export default function BlocagesUrgents() {
  const navigate = useNavigate()
  const { chantier, role, entrepriseId } = useAuthStore()
  const { allTasks, isLoading, loadAllTasks, leverBlocage } = useProductionStore()
  const today = todayISO()

  useEffect(() => {
    if (chantier?.id) {
      // Pas de filtre date : les blocages peuvent venir de n'importe quel jour
      loadAllTasks(chantier.id)
    }
  }, [chantier?.id, loadAllTasks])

  // Cloisonnement : un chef d'équipe ST ne voit que les blocages
  // de SON entreprise
  const isST = role === 'chef_equipe' && !!entrepriseId
  const blockedTasks = allTasks
    .filter(t => t.status === 'blocked')
    .filter(t => !isST || t.entreprise_id === entrepriseId)

  const handleLever = async (task: Task) => {
    // Levée unifiée : statut + contrainte liée + historique avec durée
    await leverBlocage(task, role ?? 'chef')
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50"
        >
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-nc-blue flex items-center gap-2">
            <AlertTriangle size={20} className="text-red-500" />
            Blocages urgents
          </h2>
          <p className="text-gray-500 text-sm">{formatDateFR(today)} · {chantier?.name}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : blockedTasks.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CheckCircle size={40} className="mx-auto mb-3 text-green-400" />
          <p className="font-semibold text-green-600">Aucun blocage actif</p>
          <p className="text-sm mt-1">Tous les flux sont libres</p>
        </div>
      ) : (
        <div className="space-y-3">
          {blockedTasks.map(task => (
            <div
              key={task.id}
              className="bg-white rounded-2xl border-2 border-red-100 shadow-sm overflow-hidden"
            >
              {/* Info principale */}
              <button
                onClick={() => navigate(`/production/tache/${task.id}`)}
                className="w-full flex items-start gap-3 p-4 text-left hover:bg-red-50/30 transition-colors"
              >
                <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-nc-blue text-sm truncate">{task.label}</p>
                  {task.zone_takt && (
                    <p className="text-xs text-gray-400 mt-0.5">{task.zone_takt.name}</p>
                  )}
                  {task.equipe && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: task.equipe.couleur }}
                      />
                      <span className="text-xs text-gray-500">{task.equipe.name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {task.type_blocage && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        {BLOCAGE_LABELS[task.type_blocage] ?? task.type_blocage}
                      </span>
                    )}
                    {(() => {
                      const h = heuresDepuisBlocage(task)
                      if (h == null) return null
                      const urgent = h >= 48
                      return (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                          ${urgent ? 'bg-red-600 text-white' : h >= 24 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                          {h < 1 ? "< 1 h" : h < 24 ? `depuis ${h} h` : `depuis ${Math.floor(h / 24)} j ${h % 24} h`}
                          {urgent && ' ⚠'}
                        </span>
                      )
                    })()}
                  </div>
                  {task.comment && (
                    <p className="text-xs text-gray-500 mt-1 truncate">{task.comment}</p>
                  )}
                </div>
                <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
              </button>

              {/* Action lever le blocage */}
              <div className="border-t border-gray-50 px-4 py-2 flex justify-end">
                <button
                  onClick={() => handleLever(task)}
                  className="text-xs font-semibold text-green-600 hover:text-green-700
                             flex items-center gap-1 active:scale-95 transition-all touch-manipulation"
                >
                  <CheckCircle size={14} />
                  Lever le blocage
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
