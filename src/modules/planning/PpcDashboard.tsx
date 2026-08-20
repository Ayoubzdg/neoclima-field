import { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { useAuthStore } from '@/store/authStore'
import { supabase, getTasksByChantier, getEquipes, getEntreprises } from '@/lib/supabase'
import { calculerPPC, getPpcColor, buildPpcData } from '@/utils/ppc'
import { getMonday, addWeeks, formatDateISO, getSemaineLabel } from '@/utils/dates'
import { TrendingUp, TrendingDown, Minus, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Task, Equipe, Entreprise } from '@/types/models'

// ── Déclinaison PPC par groupe (équipe / entreprise) ─────────

interface LignePpcGroupe {
  id: string
  nom: string
  couleur: string | null
  engagees: number
  completees: number
  ppc: number | null
  /** Écart en points vs semaine précédente (null si pas comparable) */
  trend: number | null
}

const CAUSE_LABELS: Record<string, string> = {
  contrainte_non_levee: 'Contrainte non levée',
  ressource_insuffisante: 'Ressource insuffisante',
  plan_non_disponible: 'Plan non disponible',
  autre: 'Autre',
}

/**
 * Calcule le PPC de chaque groupe (équipe ou entreprise) sur les
 * tâches de la semaine sélectionnée, avec tendance vs semaine N-1.
 * Tri : les groupes engagés du pire au meilleur PPC (pour objectiver
 * en réunion), puis les groupes sans engagement.
 */
function buildLignesGroupe(
  tasksSemaine: Task[],
  tasksPrecedente: Task[],
  groupes: { id: string; nom: string; couleur: string | null }[],
  keyOf: (t: Task) => string | null
): LignePpcGroupe[] {
  const lignes = groupes.map(g => {
    const tasks = tasksSemaine.filter(t => keyOf(t) === g.id)
    const engagees = tasks.filter(t => t.engage)
    const completees = engagees.filter(t => t.status === 'done')
    const ppc = calculerPPC(tasks)
    const ppcPrec = calculerPPC(tasksPrecedente.filter(t => keyOf(t) === g.id))
    return {
      id: g.id,
      nom: g.nom,
      couleur: g.couleur,
      engagees: engagees.length,
      completees: completees.length,
      ppc,
      trend: ppc !== null && ppcPrec !== null ? ppc - ppcPrec : null,
    }
  })
  return lignes.sort((a, b) => {
    if (a.ppc === null && b.ppc === null) return a.nom.localeCompare(b.nom)
    if (a.ppc === null) return 1
    if (b.ppc === null) return -1
    return a.ppc - b.ppc
  })
}

/** Ligne d'affichage : badge couleur, n engagées, barre PPC, tendance */
function LigneGroupe({ ligne }: { ligne: LignePpcGroupe }) {
  const grise = ligne.ppc === null
  return (
    <div className={`px-4 py-3 ${grise ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: ligne.couleur ?? '#94A3B8' }}
          />
          <p className="text-sm font-medium text-nc-blue truncate">{ligne.nom}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {grise ? (
            <span className="text-xs text-gray-400 italic">rien d'engagé</span>
          ) : (
            <>
              <span className="text-xs text-gray-400">
                {ligne.completees}/{ligne.engagees} engagées
              </span>
              <span className="text-sm font-bold w-11 text-right" style={{ color: getPpcColor(ligne.ppc) }}>
                {ligne.ppc}%
              </span>
              {ligne.trend !== null && (
                <span className={`flex items-center gap-0.5 text-xs font-semibold w-14
                  ${ligne.trend > 0 ? 'text-green-600' : ligne.trend < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                  {ligne.trend > 0 ? <TrendingUp size={13} /> : ligne.trend < 0 ? <TrendingDown size={13} /> : <Minus size={13} />}
                  {ligne.trend > 0 ? '+' : ''}{Math.round(ligne.trend)}pts
                </span>
              )}
            </>
          )}
        </div>
      </div>
      {!grise && (
        <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${ligne.ppc}%`, backgroundColor: getPpcColor(ligne.ppc) }}
          />
        </div>
      )}
    </div>
  )
}

export default function PpcDashboard() {
  const { chantier } = useAuthStore()
  const [semaines, setSemaines] = useState<string[]>([])
  const [tasksBySemaine, setTasksBySemaine] = useState<Map<string, Task[]>>(new Map())
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [entreprises, setEntreprises] = useState<Entreprise[]>([])
  const [semaineSelectionnee, setSemaineSelectionnee] = useState<string | null>(null)
  const [causesSemaine, setCausesSemaine] = useState<{ cause: string; count: number }[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!chantier?.id) return
    setIsLoading(true)

    // Charger les 8 dernières semaines
    const monday = getMonday(new Date())
    const sems = Array.from({ length: 8 }, (_, i) =>
      formatDateISO(addWeeks(monday, i - 7))
    )

    Promise.all([
      Promise.all(sems.map(s => getTasksByChantier(chantier.id, { semaine: s }))),
      getEquipes(chantier.id),
      getEntreprises(),
    ]).then(([results, eqs, ents]) => {
      const map = new Map(sems.map((s, i) => [s, results[i]]))
      setSemaines(sems)
      setTasksBySemaine(map)
      setEquipes(eqs)
      setEntreprises(ents)
      // Semaine par défaut : la dernière avec des tâches engagées
      // (≈ dernière semaine clôturée), sinon la semaine courante
      const derniereEngagee = [...sems].reverse()
        .find(s => (map.get(s) ?? []).some(t => t.engage))
      setSemaineSelectionnee(derniereEngagee ?? sems[sems.length - 1])
    }).finally(() => setIsLoading(false))
  }, [chantier?.id])

  // Causes de non-complétion de la semaine sélectionnée
  // (pas de fonction de lecture dans lib/supabase → requête directe,
  //  jointure weekly_plans pour cibler chantier + semaine)
  useEffect(() => {
    if (!chantier?.id || !semaineSelectionnee) return
    supabase
      .from('causes_non_completion')
      .select('cause, weekly_plan:weekly_plans!inner(chantier_id, semaine)')
      .eq('weekly_plan.chantier_id', chantier.id)
      .eq('weekly_plan.semaine', semaineSelectionnee)
      .then(({ data, error }) => {
        if (error || !data) { setCausesSemaine([]); return }
        const counts = new Map<string, number>()
        for (const row of data as unknown as { cause: string }[]) {
          counts.set(row.cause, (counts.get(row.cause) ?? 0) + 1)
        }
        setCausesSemaine(
          [...counts.entries()]
            .map(([cause, count]) => ({ cause, count }))
            .sort((a, b) => b.count - a.count)
        )
      })
  }, [chantier?.id, semaineSelectionnee])

  const ppcData = useMemo(() => buildPpcData(tasksBySemaine), [tasksBySemaine])

  const dernierPPC = ppcData[ppcData.length - 1]?.ppc ?? null
  const avantDernierPPC = ppcData[ppcData.length - 2]?.ppc ?? null
  const trend = dernierPPC !== null && avantDernierPPC !== null
    ? dernierPPC - avantDernierPPC
    : null

  // ── Déclinaison par équipe / entreprise (semaine sélectionnée) ──
  const idxSelection = semaineSelectionnee ? semaines.indexOf(semaineSelectionnee) : -1
  const tasksSemaine = semaineSelectionnee
    ? tasksBySemaine.get(semaineSelectionnee) ?? []
    : []
  const tasksPrecedente = idxSelection > 0
    ? tasksBySemaine.get(semaines[idxSelection - 1]) ?? []
    : []

  const lignesEquipes = useMemo(() =>
    buildLignesGroupe(
      tasksSemaine,
      tasksPrecedente,
      equipes.map(e => ({ id: e.id, nom: e.name, couleur: e.couleur })),
      t => t.equipe_id
    ), [tasksSemaine, tasksPrecedente, equipes])

  const lignesEntreprises = useMemo(() => {
    // Entreprises pertinentes : celles des équipes du chantier
    // + celles portées par les tâches de la semaine
    const ids = new Set<string>()
    equipes.forEach(e => { if (e.entreprise_id) ids.add(e.entreprise_id) })
    tasksSemaine.forEach(t => { if (t.entreprise_id) ids.add(t.entreprise_id) })
    const groupes = entreprises
      .filter(e => ids.has(e.id))
      .map(e => ({ id: e.id, nom: e.name, couleur: null }))
    return buildLignesGroupe(tasksSemaine, tasksPrecedente, groupes, t => t.entreprise_id)
  }, [tasksSemaine, tasksPrecedente, equipes, entreprises])

  const totalCauses = causesSemaine.reduce((s, c) => s + c.count, 0)

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

      {/* ── Déclinaison par équipe / entreprise ─────────────── */}
      {!isLoading && semaineSelectionnee && (
        <>
          {/* Sélecteur de semaine */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-2 py-2 mb-3 flex items-center justify-between">
            <button
              onClick={() => setSemaineSelectionnee(semaines[idxSelection - 1])}
              disabled={idxSelection <= 0}
              className="p-2 rounded-xl text-nc-blue disabled:text-gray-300 active:bg-gray-50"
              aria-label="Semaine précédente"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="text-center">
              <p className="text-sm font-semibold text-nc-blue">{getSemaineLabel(semaineSelectionnee)}</p>
              <p className="text-[11px] text-gray-400">Déclinaison de la semaine</p>
            </div>
            <button
              onClick={() => setSemaineSelectionnee(semaines[idxSelection + 1])}
              disabled={idxSelection < 0 || idxSelection >= semaines.length - 1}
              className="p-2 rounded-xl text-nc-blue disabled:text-gray-300 active:bg-gray-50"
              aria-label="Semaine suivante"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* PPC par équipe */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-3">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-nc-blue">PPC par équipe</p>
              <p className="text-[11px] text-gray-400">terminées / engagées</p>
            </div>
            {lignesEquipes.length === 0 ? (
              <p className="px-4 py-4 text-sm text-gray-400">Aucune équipe active sur ce chantier</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {lignesEquipes.map(l => <LigneGroupe key={l.id} ligne={l} />)}
              </div>
            )}
          </div>

          {/* PPC par entreprise */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-3">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-nc-blue">PPC par entreprise</p>
              <p className="text-[11px] text-gray-400">terminées / engagées</p>
            </div>
            {lignesEntreprises.length === 0 ? (
              <p className="px-4 py-4 text-sm text-gray-400">Aucune entreprise rattachée aux tâches de cette semaine</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {lignesEntreprises.map(l => <LigneGroupe key={l.id} ligne={l} />)}
              </div>
            )}
          </div>

          {/* Causes de non-complétion */}
          {causesSemaine.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-3">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-nc-blue">Causes de non-complétion</p>
              </div>
              <div className="divide-y divide-gray-50">
                {causesSemaine.map(c => (
                  <div key={c.cause} className="px-4 py-2.5 flex items-center justify-between gap-2">
                    <p className="text-sm text-gray-600 min-w-0 truncate">
                      {CAUSE_LABELS[c.cause] ?? c.cause}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-400 rounded-full"
                          style={{ width: `${Math.round((c.count / totalCauses) * 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-nc-blue w-6 text-right">{c.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
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
