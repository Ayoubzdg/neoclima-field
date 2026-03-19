import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Map, AlertTriangle, CheckCircle, Clock,
  Play, AlertCircle, Loader2, Users, Filter
} from 'lucide-react'
import { getZoneByQrCode, getTasksByZone, supabase } from '@/lib/supabase'
import { useProductionStore } from '@/store/productionStore'
import { useAuthStore } from '@/store/authStore'
import { currentMondayISO } from '@/utils/dates'
import type { ZoneTakt, Task, TaskStatus } from '@/types/models'
import StatusBadge from '@/components/ui/StatusBadge'
import ProgressBar from '@/components/ui/ProgressBar'

export default function ZoneTasksView() {
  const { qrCode, id } = useParams<{ qrCode?: string; id?: string }>()
  const navigate = useNavigate()
  const { role, equipe } = useAuthStore()
  const { updateStatus } = useProductionStore()

  const [zone, setZone] = useState<ZoneTakt | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  // Filtre équipe : par défaut ON pour un monteur, chef peut voir tout
  const [filtreEquipe, setFiltreEquipe] = useState(role === 'monteur' || role === 'chef' ? true : false)

  const semaineCourante = currentMondayISO()

  useEffect(() => {
    setIsLoading(true)
    const load = async () => {
      let z: ZoneTakt | null = null
      if (qrCode) {
        z = await getZoneByQrCode(decodeURIComponent(qrCode))
      } else if (id) {
        const { data } = await supabase
          .from('zones_takt')
          .select('*, secteur:secteurs(*)')
          .eq('id', id)
          .single()
        z = data as ZoneTakt | null
      }
      if (z) {
        setZone(z)
        const t = await getTasksByZone(z.id, {
          equipeId: filtreEquipe && equipe?.id ? equipe.id : undefined,
          semaine: semaineCourante,
        })
        setTasks(t)
      }
    }
    load().finally(() => setIsLoading(false))
  }, [qrCode, id, filtreEquipe, equipe?.id, semaineCourante])

  const handleStatusCycle = async (task: Task) => {
    const next: Record<TaskStatus, TaskStatus> = {
      todo: 'en_cours',
      en_cours: 'done',
      done: 'todo',
      blocked: 'en_cours',
      nappe_h: 'nappe_b',
      nappe_b: 'terminaux',
      terminaux: 'raccordement',
      raccordement: 'done',
    }
    const newStatus = next[task.status] ?? 'en_cours'
    await updateStatus(task.id, newStatus, {}, role ?? 'monteur')
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
  }

  const done = tasks.filter(t => t.status === 'done').length
  const blocked = tasks.filter(t => t.status === 'blocked').length
  const enCours = tasks.filter(t => t.status === 'en_cours').length
  const pct = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={28} className="animate-spin text-nc-red" />
    </div>
  )

  if (!zone) return (
    <div className="p-8 text-center">
      <AlertTriangle size={32} className="mx-auto text-amber-400 mb-3" />
      <p className="font-semibold text-nc-blue">Zone introuvable</p>
      <p className="text-sm text-gray-400 mt-1">Code QR : {qrCode}</p>
      <button onClick={() => navigate(-1)} className="btn-secondary mt-4 text-sm">
        ← Retour
      </button>
    </div>
  )

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="bg-nc-blue text-white px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-xl hover:bg-white/10">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{zone.name}</p>
          <p className="text-white/60 text-xs">
            {zone.qr_code} · {tasks.length} tâche{tasks.length > 1 ? 's' : ''} cette semaine
            {equipe && filtreEquipe && <span> · {equipe.name}</span>}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {/* Toggle filtre équipe (chef peut le désactiver pour voir tout) */}
          {(role === 'chef' || role === 'ca' || role === 'admin') && equipe && (
            <button
              onClick={() => setFiltreEquipe(f => !f)}
              className={`p-1.5 rounded-xl transition-colors ${filtreEquipe ? 'bg-white/20' : 'hover:bg-white/10'}`}
              title={filtreEquipe ? 'Vue : mon équipe seulement' : 'Vue : toutes les équipes'}
            >
              <Filter size={17} className={filtreEquipe ? 'text-white' : 'text-white/50'} />
            </button>
          )}
          {/* Lien vers le plan PDF */}
          {zone.plan_url && (
            <button
              onClick={() => navigate(`/plans/zone/${zone.id}`)}
              className="p-1.5 rounded-xl hover:bg-white/10"
              title="Voir le plan PDF"
            >
              <Map size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Résumé avancement */}
      {tasks.length > 0 && (
        <div className="px-4 py-3 bg-white border-b border-gray-100">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-3 text-xs">
              <span className="text-green-600 font-medium">✓ {done} terminée{done > 1 ? 's' : ''}</span>
              {enCours > 0 && <span className="text-blue-500">▶ {enCours} en cours</span>}
              {blocked > 0 && <span className="text-red-500">⚠ {blocked} bloquée{blocked > 1 ? 's' : ''}</span>}
            </div>
            <span className="text-xs font-bold text-nc-blue">{pct}%</span>
          </div>
          <ProgressBar value={pct} color="auto" height="h-2" />
        </div>
      )}

      {/* Liste tâches */}
      <div className="flex-1 p-4 space-y-2">
        {tasks.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <CheckCircle size={36} className="mx-auto mb-2 opacity-40" />
            <p className="font-medium">
              {filtreEquipe && equipe
                ? `Aucune tâche pour ${equipe.name} cette semaine`
                : 'Aucune tâche dans cette zone cette semaine'}
            </p>
            {filtreEquipe && (role === 'chef' || role === 'admin') && (
              <button
                onClick={() => setFiltreEquipe(false)}
                className="mt-3 text-sm text-nc-blue underline"
              >
                Voir toutes les équipes
              </button>
            )}
          </div>
        ) : (
          tasks.map(task => (
            <div
              key={task.id}
              className={`bg-white rounded-xl border-2 overflow-hidden
                ${task.status === 'done' ? 'border-green-100 opacity-75' : ''}
                ${task.status === 'blocked' ? 'border-red-200' : ''}
                ${task.status === 'en_cours' ? 'border-blue-200' : ''}
                ${['nappe_h','nappe_b','terminaux','raccordement'].includes(task.status) ? 'border-orange-200' : ''}
                ${task.status === 'todo' ? 'border-gray-100' : ''}`}
            >
              <div className="flex items-center gap-3 p-3">
                {/* Tap pour cycler le statut */}
                <button
                  onClick={() => handleStatusCycle(task)}
                  className="flex-shrink-0 active:scale-90 touch-manipulation"
                >
                  {task.status === 'done' && <CheckCircle size={22} className="text-green-500" />}
                  {task.status === 'blocked' && <AlertCircle size={22} className="text-red-500" />}
                  {task.status === 'en_cours' && <Play size={22} className="text-blue-500" />}
                  {['nappe_h','nappe_b','terminaux','raccordement'].includes(task.status) && (
                    <Play size={22} className="text-orange-400" />
                  )}
                  {task.status === 'todo' && <Clock size={22} className="text-gray-400" />}
                </button>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium leading-tight ${task.status === 'done' ? 'line-through text-gray-400' : 'text-nc-blue'}`}>
                    {task.label}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <StatusBadge status={task.status} />
                    <span className="text-xs text-gray-400">
                      {task.qte_realisee}/{task.qte_prevue} {task.unite}
                    </span>
                    {/* Badge équipe (utile si chef voit toutes les équipes) */}
                    {!filtreEquipe && task.equipe && (
                      <span
                        className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: `${task.equipe.couleur ?? '#6366f1'}22`, color: task.equipe.couleur ?? '#6366f1' }}
                      >
                        <Users size={10} />
                        {task.equipe.name}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => navigate(`/production/tache/${task.id}`)}
                  className="flex-shrink-0 text-xs text-nc-blue/40 hover:text-nc-blue transition-colors px-1"
                >
                  Détails →
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
