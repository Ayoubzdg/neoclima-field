import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle, ClipboardCheck, ChevronRight, Loader2,
  AlertTriangle, Users, RefreshCw
} from 'lucide-react'
import { useProductionStore } from '@/store/productionStore'
import { useAuthStore } from '@/store/authStore'
import { canValidate } from '@/utils/statusMachine'
import type { Task } from '@/types/models'

/**
 * FILE DE CONTRÔLE DU CHEF DE CHANTIER
 *
 * Toutes les tâches déclarées terminées par les monteurs
 * (statut a_controler), groupées par zone. Le chef valide
 * tâche par tâche, en lot par zone, ou refuse avec motif.
 * Seules les tâches validées comptent dans l'avancement.
 */
export default function ControleTaches() {
  const navigate = useNavigate()
  const { chantier, role } = useAuthStore()
  const { allTasks, isLoading, loadAllTasks, updateStatus } = useProductionStore()
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (chantier?.id) loadAllTasks(chantier.id)
  }, [chantier?.id, loadAllTasks])

  const aControler = useMemo(
    () => allTasks.filter(t => t.status === 'a_controler'),
    [allTasks]
  )

  // Groupement par zone
  const byZone = useMemo(() => {
    const map = new Map<string, { zoneName: string; tasks: Task[] }>()
    for (const t of aControler) {
      const key = t.zone_takt_id ?? 'sans-zone'
      const zoneName = t.zone_takt?.name ?? 'Sans zone'
      if (!map.has(key)) map.set(key, { zoneName, tasks: [] })
      map.get(key)!.tasks.push(t)
    }
    return [...map.entries()].sort((a, b) => a[1].zoneName.localeCompare(b[1].zoneName))
  }, [aControler])

  const setBusy = (id: string, busy: boolean) =>
    setBusyIds(prev => {
      const next = new Set(prev)
      if (busy) next.add(id); else next.delete(id)
      return next
    })

  const valider = async (task: Task) => {
    setBusy(task.id, true)
    await updateStatus(task.id, 'done', {}, role ?? 'chef')
    setBusy(task.id, false)
  }

  const refuser = async (task: Task) => {
    const motif = window.prompt(`Motif du refus — "${task.label}" :`)
    if (!motif?.trim()) return
    setBusy(task.id, true)
    await updateStatus(task.id, 'en_cours', {
      comment: `⚠ Contrôle refusé : ${motif.trim()}`
    }, role ?? 'chef')
    setBusy(task.id, false)
  }

  const validerZone = async (tasks: Task[]) => {
    if (!confirm(`Valider les ${tasks.length} tâches de cette zone ?`)) return
    for (const t of tasks) {
      setBusy(t.id, true)
    }
    // Séquentiel volontaire : évite de saturer la connexion chantier
    for (const t of tasks) {
      await updateStatus(t.id, 'done', {}, role ?? 'chef')
      setBusy(t.id, false)
    }
  }

  // Garde applicative : réservé aux valideurs
  if (!canValidate(role)) {
    return (
      <div className="p-8 text-center text-gray-400">
        <AlertTriangle size={32} className="mx-auto mb-3 text-amber-400" />
        <p className="font-semibold text-nc-blue">Accès réservé</p>
        <p className="text-sm mt-1">Le contrôle des travaux est réservé au chef de chantier.</p>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {/* En-tête */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-nc-blue flex items-center gap-2">
            <ClipboardCheck size={20} className="text-amber-500" />
            Contrôle des travaux
          </h2>
          <p className="text-gray-500 text-sm mt-0.5">
            {aControler.length === 0
              ? 'Aucune tâche en attente'
              : `${aControler.length} tâche${aControler.length > 1 ? 's' : ''} en attente de validation`}
          </p>
        </div>
        <button
          onClick={() => chantier?.id && loadAllTasks(chantier.id)}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200
                     text-gray-500 text-xs hover:bg-gray-50 active:scale-95 transition-all touch-manipulation"
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </div>

      {isLoading && aControler.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-nc-red" />
        </div>
      ) : aControler.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CheckCircle size={40} className="mx-auto mb-3 opacity-40 text-green-400" />
          <p className="font-medium text-gray-500">Tout est contrôlé</p>
          <p className="text-sm mt-1">Les tâches terminées par les monteurs apparaîtront ici.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {byZone.map(([zoneId, { zoneName, tasks }]) => (
            <div key={zoneId} className="bg-white rounded-2xl border-2 border-amber-100 shadow-sm overflow-hidden">
              {/* Header zone + validation en lot */}
              <div className="flex items-center justify-between px-4 py-3 bg-amber-50/60 border-b border-amber-100">
                <div>
                  <p className="font-bold text-nc-blue text-sm">{zoneName}</p>
                  <p className="text-xs text-gray-500">{tasks.length} tâche{tasks.length > 1 ? 's' : ''} à contrôler</p>
                </div>
                {tasks.length > 1 && (
                  <button
                    onClick={() => validerZone(tasks)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-600 text-white
                               text-xs font-semibold hover:bg-green-700 active:scale-95 transition-all touch-manipulation"
                  >
                    <CheckCircle size={13} />
                    Tout valider
                  </button>
                )}
              </div>

              {/* Tâches de la zone */}
              <div className="divide-y divide-gray-50">
                {tasks.map(task => {
                  const busy = busyIds.has(task.id)
                  const pct = task.qte_prevue > 0
                    ? Math.round((task.qte_realisee / task.qte_prevue) * 100)
                    : 100
                  return (
                    <div key={task.id} className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <button
                            onClick={() => navigate(`/production/tache/${task.id}`)}
                            className="text-left w-full group"
                          >
                            <p className="text-sm font-medium text-nc-blue leading-snug group-hover:underline">
                              {task.label}
                              <ChevronRight size={12} className="inline ml-0.5 text-gray-300" />
                            </p>
                          </button>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {task.equipe && (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                                style={{ backgroundColor: `${task.equipe.couleur ?? '#6366f1'}22`, color: task.equipe.couleur ?? '#6366f1' }}
                              >
                                <Users size={9} />
                                {task.equipe.name}
                              </span>
                            )}
                            {task.qte_prevue > 0 && (
                              <span className={`text-xs ${pct < 100 ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
                                {task.qte_realisee}/{task.qte_prevue} {task.unite}
                                {pct < 100 && ` (${pct}%)`}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => refuser(task)}
                            disabled={busy}
                            className="px-2.5 py-1.5 rounded-lg border border-red-200 text-red-500 text-xs
                                       font-medium hover:bg-red-50 active:scale-95 transition-all
                                       disabled:opacity-40 touch-manipulation"
                          >
                            Refuser
                          </button>
                          <button
                            onClick={() => valider(task)}
                            disabled={busy}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 text-white
                                       text-xs font-semibold hover:bg-green-700 active:scale-95 transition-all
                                       disabled:opacity-40 touch-manipulation"
                          >
                            {busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                            Valider
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
