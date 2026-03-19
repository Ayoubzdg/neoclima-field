import { useEffect, useState } from 'react'
import { Printer, Loader2, ClipboardList } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { getEquipes, getTasksByChantier } from '@/lib/supabase'
import { todayISO, formatDateFR } from '@/utils/dates'
import type { Equipe, Task } from '@/types/models'

export default function BonTravail() {
  const { chantier } = useAuthStore()
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedEquipe, setSelectedEquipe] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(true)
  const today = todayISO()

  useEffect(() => {
    if (!chantier?.id) return
    setIsLoading(true)
    Promise.all([
      getEquipes(chantier.id),
      getTasksByChantier(chantier.id, { semaine: today })
    ]).then(([eq, tk]) => {
      setEquipes(eq)
      setTasks(tk)
    }).finally(() => setIsLoading(false))
  }, [chantier?.id, today])

  const filteredTasks = selectedEquipe === 'all'
    ? tasks
    : tasks.filter(t => t.equipe_id === selectedEquipe)

  const tasksByEquipe = equipes.map(e => ({
    equipe: e,
    tasks: filteredTasks.filter(t => t.equipe_id === e.id)
  })).filter(g => g.tasks.length > 0 || selectedEquipe === 'all')

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-5 print:hidden">
        <div>
          <h2 className="text-lg font-bold text-nc-blue">Bon de travail</h2>
          <p className="text-gray-500 text-sm">{formatDateFR(today)}</p>
        </div>
        <button
          onClick={() => window.print()}
          className="btn-primary text-sm flex items-center gap-2"
        >
          <Printer size={16} />
          Imprimer
        </button>
      </div>

      {/* Sélecteur équipe */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-4 print:hidden">
        <button
          onClick={() => setSelectedEquipe('all')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all
            ${selectedEquipe === 'all' ? 'bg-nc-blue text-white' : 'bg-gray-100 text-gray-600'}`}
        >
          Toutes les équipes
        </button>
        {equipes.map(e => (
          <button
            key={e.id}
            onClick={() => setSelectedEquipe(e.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all
              ${selectedEquipe === e.id ? 'bg-nc-blue text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            {e.name}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-nc-red" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Header pour impression */}
          <div className="hidden print:block mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold">Bon de travail</h1>
                <p className="text-sm text-gray-600">{chantier?.name} · {formatDateFR(today)}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-lg">NEOCLIMA</p>
              </div>
            </div>
            <hr className="my-3" />
          </div>

          {tasksByEquipe.map(({ equipe, tasks: eqTasks }) => (
            <div key={equipe.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden print:border print:rounded-none">
              {/* Header équipe */}
              <div className="px-4 py-3 border-b border-gray-100" style={{ borderLeftColor: equipe.couleur, borderLeftWidth: 4 }}>
                <p className="font-bold text-nc-blue">{equipe.name}</p>
                <p className="text-xs text-gray-500">{eqTasks.length} tâche{eqTasks.length > 1 ? 's' : ''} ce jour</p>
              </div>

              {/* Tâches */}
              <div className="divide-y divide-gray-50">
                {eqTasks.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-gray-400">Aucune tâche assignée aujourd'hui</p>
                ) : eqTasks.map((task, i) => (
                  <div key={task.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-nc-blue text-sm">{i + 1}. {task.label}</p>
                        {task.zone_takt && (
                          <p className="text-xs text-gray-400">Zone : {task.zone_takt.name}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-nc-blue">{task.qte_prevue} {task.unite}</p>
                        <p className="text-xs text-gray-400">{task.heures_prevues}h prévues</p>
                      </div>
                    </div>
                    {task.description && (
                      <p className="text-xs text-gray-500 mt-1">{task.description}</p>
                    )}
                    {/* Espace signature pour impression */}
                    <div className="hidden print:block mt-2 border-b border-dashed border-gray-300 pb-2">
                      <p className="text-[10px] text-gray-400">Réalisé : _____ {task.unite} · Visa : __________</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
