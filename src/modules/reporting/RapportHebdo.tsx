import { useState, useEffect } from 'react'
import { FileText, Download, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { getTasksByChantier, getEffectifs, getNonConformites } from '@/lib/supabase'
import { calculerPPC, calculerAvancement, getPpcColor } from '@/utils/ppc'
import { currentMondayISO, getSemaineLabel, addWeeks, formatDateISO } from '@/utils/dates'
import ProgressBar from '@/components/ui/ProgressBar'
import type { Task, Effectif, NonConformite } from '@/types/models'

interface WeekStats {
  tasks: Task[]
  effectifs: Effectif[]
  ncs: NonConformite[]
  ppc: number | null
  avancement: number
  tasksEngagees: number
  tasksRealisees: number
  blocages: Task[]
  totalHeures: number
  totalPresents: number
  totalPrevus: number
}

export default function RapportHebdo() {
  const { chantier } = useAuthStore()
  const [semaine, setSemaine] = useState(currentMondayISO())
  const [stats, setStats] = useState<WeekStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    if (!chantier?.id) return
    setIsLoading(true)
    Promise.all([
      getTasksByChantier(chantier.id, { semaine }),
      getEffectifs(chantier.id, semaine),
      getNonConformites(chantier.id)
    ]).then(([tasks, effectifs, ncs]) => {
      const ppc = calculerPPC(tasks)
      const avancement = calculerAvancement(tasks)
      const engagees = tasks.filter(t => t.engage)
      const realisees = engagees.filter(t => t.status === 'done')
      const blocages = tasks.filter(t => t.status === 'blocked')
      const totalPresents = effectifs.reduce((s, e) => s + e.monteurs_presents, 0)
      const totalPrevus = effectifs.reduce((s, e) => s + e.monteurs_prevus, 0)
      setStats({
        tasks, effectifs, ncs,
        ppc, avancement,
        tasksEngagees: engagees.length,
        tasksRealisees: realisees.length,
        blocages,
        totalHeures: totalPresents * 8,
        totalPresents,
        totalPrevus
      })
    }).finally(() => setIsLoading(false))
  }, [chantier?.id, semaine])

  const navigateSemaine = (dir: -1 | 1) => {
    setSemaine(s => formatDateISO(addWeeks(new Date(s), dir)))
  }

  const handleGeneratePDF = async () => {
    if (!stats || !chantier) return
    setIsGenerating(true)
    try {
      const { pdf } = await import('@react-pdf/renderer')
      const { RapportPDF } = await import('./RapportPDF')
      const blob = await pdf(
        // @ts-ignore JSX element passed to pdf()
        <RapportPDF chantier={chantier} semaine={semaine} stats={stats} />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rapport-${semaine}-${chantier.name.replace(/\s+/g, '-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Erreur génération PDF:', err)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FileText size={20} className="text-nc-red" />
          <h2 className="text-lg font-bold text-nc-blue">Rapport hebdomadaire</h2>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => navigateSemaine(-1)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500">
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs font-bold text-nc-blue px-1">
            {getSemaineLabel(semaine).split(' · ')[0]}
          </span>
          <button
            onClick={() => navigateSemaine(1)}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-500"
            disabled={semaine >= currentMondayISO()}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-5">{getSemaineLabel(semaine)}</p>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-nc-red" />
        </div>
      ) : stats ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm col-span-2 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">PPC semaine</p>
                <p className="text-4xl font-black" style={{ color: getPpcColor(stats.ppc) }}>
                  {stats.ppc !== null ? `${stats.ppc}%` : '—'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {stats.tasksRealisees} / {stats.tasksEngagees} tâches engagées
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 mb-0.5">Avancement</p>
                <p className="text-2xl font-bold text-nc-blue">{stats.avancement}%</p>
                <ProgressBar value={stats.avancement} color="auto" className="mt-1 w-24 ml-auto" />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <p className="text-xs text-gray-500">Effectif</p>
              <p className="text-2xl font-black text-nc-blue mt-0.5">
                {stats.totalPresents}
                <span className="text-sm font-normal text-gray-400"> / {stats.totalPrevus}</span>
              </p>
              <p className="text-xs text-gray-400">{stats.totalHeures}h prod.</p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <p className="text-xs text-gray-500">Tâches terminées</p>
              <p className="text-2xl font-black text-nc-blue mt-0.5">
                {stats.tasks.filter(t => t.status === 'done').length}
                <span className="text-sm font-normal text-gray-400"> / {stats.tasks.length}</span>
              </p>
              {stats.blocages.length > 0 && (
                <p className="text-xs text-red-500 font-medium">
                  {stats.blocages.length} bloquée{stats.blocages.length > 1 ? 's' : ''}
                </p>
              )}
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <p className="text-xs text-gray-500">NC ouvertes</p>
              <p className="text-2xl font-black text-red-500 mt-0.5">
                {stats.ncs.filter(n => n.statut === 'ouverte' || n.statut === 'en_cours').length}
              </p>
              <p className="text-xs text-gray-400">
                {stats.ncs.filter(n => n.gravite === 'bloquante').length} bloquante
              </p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <p className="text-xs text-gray-500">Taux présence</p>
              <p className="text-2xl font-black mt-0.5" style={{
                color: stats.totalPrevus > 0 && stats.totalPresents / stats.totalPrevus >= 0.9
                  ? '#22C55E' : '#F59E0B'
              }}>
                {stats.totalPrevus > 0
                  ? `${Math.round((stats.totalPresents / stats.totalPrevus) * 100)}%`
                  : '—'}
              </p>
            </div>
          </div>

          {/* Blocages */}
          {stats.blocages.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4">
              <p className="px-4 py-3 font-semibold text-nc-blue text-sm border-b border-gray-50">
                Blocages ({stats.blocages.length})
              </p>
              <div className="divide-y divide-gray-50">
                {stats.blocages.map(task => (
                  <div key={task.id} className="px-4 py-3">
                    <p className="text-sm font-medium text-red-700">{task.label}</p>
                    {task.type_blocage && (
                      <p className="text-xs text-gray-500 mt-0.5">Type : {task.type_blocage}</p>
                    )}
                    {task.comment && (
                      <p className="text-xs text-gray-400 italic mt-0.5">{task.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NC actives */}
          {stats.ncs.filter(n => n.statut !== 'validee').length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4">
              <p className="px-4 py-3 font-semibold text-nc-blue text-sm border-b border-gray-50">
                Non-conformités actives ({stats.ncs.filter(n => n.statut !== 'validee').length})
              </p>
              <div className="divide-y divide-gray-50">
                {stats.ncs.filter(n => n.statut !== 'validee').slice(0, 5).map(nc => (
                  <div key={nc.id} className="px-4 py-3 flex items-start gap-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border mt-0.5 flex-shrink-0 ${
                      nc.gravite === 'bloquante' ? 'bg-gray-900 text-white border-gray-700'
                      : nc.gravite === 'majeure' ? 'bg-red-100 text-red-700 border-red-200'
                      : 'bg-amber-100 text-amber-700 border-amber-200'
                    }`}>
                      {nc.gravite}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-nc-blue">{nc.titre}</p>
                      <p className="text-xs text-gray-400 capitalize">{nc.statut}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleGeneratePDF}
            disabled={isGenerating}
            className="w-full btn-primary flex items-center justify-center gap-2 h-12"
          >
            {isGenerating ? (
              <><Loader2 size={18} className="animate-spin" />Génération en cours…</>
            ) : (
              <><Download size={18} />Exporter en PDF</>
            )}
          </button>
          <p className="text-xs text-gray-400 text-center mt-2">Format A4 · Logo Neoclima</p>
        </>
      ) : (
        <div className="text-center py-12 text-gray-400">
          <FileText size={40} className="mx-auto mb-3 opacity-40" />
          <p>Aucune donnée pour cette semaine</p>
        </div>
      )}
    </div>
  )
}
