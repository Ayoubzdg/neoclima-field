import { useEffect, useState, useCallback } from 'react'
import {
  FileText, Printer, Loader2, RefreshCw, Users, TrendingUp,
  AlertTriangle, Shield, Clock, Zap
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import {
  getTasksByChantier, getEquipes, getEffectifs, getNonConformites, getTravauxSupp
} from '@/lib/supabase'
import { todayISO, currentMondayISO, formatDateFR } from '@/utils/dates'
import type { Task, Equipe, Effectif, NonConformite, TravauxSupp } from '@/types/models'

/**
 * RAPPORT DU JOUR — la photo du chantier en 90 secondes.
 *
 * Personnel · Production · Blocages · Réserves · Retards ·
 * Décisions nécessaires. Calculé à la demande, imprimable.
 */
export default function RapportJour() {
  const { chantier } = useAuthStore()
  const today = todayISO()
  const monday = currentMondayISO()

  const [tasks, setTasks] = useState<Task[]>([])
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [effectifs, setEffectifs] = useState<Effectif[]>([])
  const [ncs, setNcs] = useState<NonConformite[]>([])
  const [travauxSupp, setTravauxSupp] = useState<TravauxSupp[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(() => {
    if (!chantier?.id) return
    setIsLoading(true)
    Promise.all([
      getTasksByChantier(chantier.id),
      getEquipes(chantier.id),
      getEffectifs(chantier.id, today),
      getNonConformites(chantier.id),
      getTravauxSupp(chantier.id).catch(() => [] as TravauxSupp[]),
    ]).then(([t, eq, eff, nc, ts]) => {
      setTasks(t); setEquipes(eq); setEffectifs(eff); setNcs(nc); setTravauxSupp(ts)
    }).finally(() => setIsLoading(false))
  }, [chantier?.id, today])

  useEffect(() => { load() }, [load])

  // ── Personnel ─────────────────────────────────────────────
  const presents = effectifs.reduce((s, e) => s + e.monteurs_presents, 0)
  const prevus = effectifs.reduce((s, e) => s + e.monteurs_prevus, 0)
  const equipesManquantes = effectifs
    .filter(e => e.monteurs_presents < e.monteurs_prevus)
    .map(e => ({
      nom: equipes.find(eq => eq.id === e.equipe_id)?.name ?? '?',
      manque: e.monteurs_prevus - e.monteurs_presents,
    }))

  // ── Production (aujourd'hui) ──────────────────────────────
  const isToday = (d: string | null) => !!d && d.slice(0, 10) === today
  const declareesAujourdhui = tasks.filter(t => isToday(t.date_fin_reel)).length
  const valideesAujourdhui = tasks.filter(t => t.status === 'done' && isToday(t.updated_at)).length
  const stockAControler = tasks.filter(t => t.status === 'a_controler').length

  // ── Blocages ──────────────────────────────────────────────
  const bloquees = tasks.filter(t => t.status === 'blocked')
  const bloqueesVieilles = bloquees.filter(t =>
    t.updated_at && (Date.now() - new Date(t.updated_at).getTime()) > 48 * 3_600_000)

  // ── Réserves (NC) ─────────────────────────────────────────
  const ncOuvertes = ncs.filter(n => n.statut === 'ouverte' || n.statut === 'en_cours')
  const ncFermeesAujourdhui = ncs.filter(n => isToday(n.date_levee)).length

  // ── Retards par zone ──────────────────────────────────────
  const retardsParZone = (() => {
    const map = new Map<string, number>()
    tasks
      .filter(t => t.date_planifiee && t.date_planifiee < monday
        && t.status !== 'done' && t.status !== 'a_controler')
      .forEach(t => {
        const z = t.zone_takt?.name ?? 'Sans zone'
        map.set(z, (map.get(z) ?? 0) + 1)
      })
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  })()

  // ── Décisions nécessaires ─────────────────────────────────
  const tsEnAttenteCA = travauxSupp.filter(t => t.statut === 'valide_cc')
  const tsASignaler = travauxSupp.filter(t => t.statut === 'signale')
  const decisions: string[] = [
    ...bloqueesVieilles.map(t =>
      `Blocage > 48 h : « ${t.label} » (${t.zone_takt?.name ?? '?'}) — ${t.type_blocage ?? 'cause inconnue'}`),
    ...tsEnAttenteCA.map(t =>
      `Travaux supp. en attente de validation CA : « ${t.description.slice(0, 60)}${t.description.length > 60 ? '…' : ''} »`),
    ...tsASignaler.map(t =>
      `Travaux supp. à analyser (chef) : « ${t.description.slice(0, 60)}${t.description.length > 60 ? '…' : ''} »`),
  ]

  if (isLoading) return (
    <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-nc-red" /></div>
  )

  const Bloc = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 print:border print:rounded-none print:shadow-none print:break-inside-avoid">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        {icon}{title}
      </p>
      {children}
    </div>
  )

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {/* En-tête */}
      <div className="flex items-start justify-between mb-4 print:hidden">
        <div>
          <h2 className="text-lg font-bold text-nc-blue flex items-center gap-2">
            <FileText size={20} className="text-nc-red" />
            Rapport du jour
          </h2>
          <p className="text-gray-500 text-sm">{chantier?.name} · {formatDateFR(today)}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load}
            className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50" title="Actualiser">
            <RefreshCw size={16} />
          </button>
          <button onClick={() => window.print()}
            className="btn-primary text-sm flex items-center gap-2">
            <Printer size={15} />Imprimer
          </button>
        </div>
      </div>

      {/* En-tête impression */}
      <div className="hidden print:block mb-4">
        <h1 className="text-xl font-bold">Rapport du jour — {chantier?.name}</h1>
        <p className="text-sm text-gray-600">{formatDateFR(today)}</p>
        <hr className="my-2" />
      </div>

      <div className="space-y-3">
        {/* Personnel */}
        <Bloc icon={<Users size={13} />} title="Personnel">
          <p className="text-2xl font-black text-nc-blue">
            {presents}<span className="text-base text-gray-400 font-medium">/{prevus} présents</span>
          </p>
          {equipesManquantes.length > 0 && (
            <p className="text-xs text-amber-600 mt-1">
              {equipesManquantes.map(e => `${e.nom} : ${e.manque} manquant${e.manque > 1 ? 's' : ''}`).join(' · ')}
            </p>
          )}
          {effectifs.length === 0 && (
            <p className="text-xs text-gray-400 mt-1">Effectifs du jour non déclarés</p>
          )}
        </Bloc>

        {/* Production */}
        <Bloc icon={<TrendingUp size={13} />} title="Production">
          <div className="flex gap-6">
            <div>
              <p className="text-2xl font-black text-green-600">{valideesAujourdhui}</p>
              <p className="text-xs text-gray-500">validées aujourd'hui</p>
            </div>
            <div>
              <p className="text-2xl font-black text-nc-blue">{declareesAujourdhui}</p>
              <p className="text-xs text-gray-500">terminées (déclarées)</p>
            </div>
            <div>
              <p className="text-2xl font-black text-amber-500">{stockAControler}</p>
              <p className="text-xs text-gray-500">stock à contrôler</p>
            </div>
          </div>
        </Bloc>

        {/* Blocages */}
        <Bloc icon={<AlertTriangle size={13} />} title="Blocages">
          <p className="text-2xl font-black" style={{ color: bloquees.length > 0 ? '#EF4444' : '#22C55E' }}>
            {bloquees.length}
            {bloqueesVieilles.length > 0 && (
              <span className="text-sm font-bold text-red-600 ml-2">dont {bloqueesVieilles.length} &gt; 48 h ⚠</span>
            )}
          </p>
          {bloquees.slice(0, 5).map(t => (
            <p key={t.id} className="text-xs text-gray-500 mt-0.5 truncate">
              · {t.label} ({t.zone_takt?.name ?? '?'}) — {t.type_blocage ?? '?'}
            </p>
          ))}
        </Bloc>

        {/* Réserves */}
        <Bloc icon={<Shield size={13} />} title="Réserves (NC)">
          <p className="text-lg font-bold text-nc-blue">
            {ncOuvertes.length} ouverte{ncOuvertes.length > 1 ? 's' : ''}
            <span className="text-gray-400 font-medium"> / {ncFermeesAujourdhui} fermée{ncFermeesAujourdhui > 1 ? 's' : ''} aujourd'hui</span>
          </p>
        </Bloc>

        {/* Retards */}
        <Bloc icon={<Clock size={13} />} title="Retards">
          {retardsParZone.length === 0 ? (
            <p className="text-sm text-green-600 font-medium">Aucune zone en retard ✓</p>
          ) : (
            retardsParZone.map(([zone, n]) => (
              <p key={zone} className="text-sm text-red-600">
                {zone} : {n} tâche{n > 1 ? 's' : ''} en retard
              </p>
            ))
          )}
        </Bloc>

        {/* Décisions nécessaires */}
        <Bloc icon={<Zap size={13} />} title={`Décisions nécessaires (${decisions.length})`}>
          {decisions.length === 0 ? (
            <p className="text-sm text-green-600 font-medium">Rien en attente ✓</p>
          ) : (
            <div className="space-y-1">
              {decisions.map((d, i) => (
                <p key={i} className="text-sm text-gray-700">• {d}</p>
              ))}
            </div>
          )}
        </Bloc>
      </div>
    </div>
  )
}
