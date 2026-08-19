import { useEffect, useState, useCallback } from 'react'
import {
  Briefcase, RefreshCw, Loader2, TrendingUp, Building2, Wind,
  Users, AlertTriangle, Clock
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import {
  getTasksByChantier, getEntreprises, getEffectifsAll
} from '@/lib/supabase'
import { currentMondayISO, formatDateFR, todayISO } from '@/utils/dates'
import ProgressBar from '@/components/ui/ProgressBar'
import type { Task, Entreprise, Effectif } from '@/types/models'

const SYSTEME_LABELS: Record<string, string> = {
  soufflage: 'Soufflage', extraction: 'Extraction', desenfumage: 'Désenfumage',
  reprise: 'Reprise', air_neuf: 'Air neuf', autre: 'Autre',
}

/** Poids d'une tâche = ses heures prévues (fallback 1 si non chiffrée) */
const poids = (t: Task) => t.heures_prevues > 0 ? t.heures_prevues : 1

/** Avancement déclaré d'une tâche (0..1) : quantités si chiffrées, sinon statut */
const pctDeclare = (t: Task) => {
  if (t.qte_prevue > 0) return Math.min(1, t.qte_realisee / t.qte_prevue)
  return (t.status === 'done' || t.status === 'a_controler') ? 1 : 0
}

/** Avancement VALIDÉ (0..1) : seul le statut done compte — base des situations */
const pctValide = (t: Task) => t.status === 'done' ? 1 : 0

function agreger(tasks: Task[], fn: (t: Task) => number): number {
  const totalW = tasks.reduce((s, t) => s + poids(t), 0)
  if (totalW === 0) return 0
  return Math.round((tasks.reduce((s, t) => s + poids(t) * fn(t), 0) / totalW) * 100)
}

/**
 * DASHBOARD CHARGÉ D'AFFAIRES
 * Avancement validé vs déclaré, pondéré par les heures prévues,
 * décliné par bâtiment / système / entreprise. Heures produites
 * vs consommées (productivité) et prévision de fin.
 * Objectif : comprendre le chantier en 5 minutes.
 */
export default function DashboardCA() {
  const { chantier } = useAuthStore()
  const [tasks, setTasks] = useState<Task[]>([])
  const [entreprises, setEntreprises] = useState<Entreprise[]>([])
  const [effectifs, setEffectifs] = useState<Effectif[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(() => {
    if (!chantier?.id) return
    setIsLoading(true)
    Promise.all([
      getTasksByChantier(chantier.id),
      getEntreprises().catch(() => [] as Entreprise[]),
      getEffectifsAll(chantier.id).catch(() => [] as Effectif[]),
    ]).then(([t, ents, eff]) => {
      setTasks(t); setEntreprises(ents); setEffectifs(eff)
    }).finally(() => setIsLoading(false))
  }, [chantier?.id])

  useEffect(() => { load() }, [load])

  if (isLoading) return (
    <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-nc-red" /></div>
  )

  // ── Global ────────────────────────────────────────────────
  const avValide = agreger(tasks, pctValide)
  const avDeclare = agreger(tasks, pctDeclare)
  const stockControle = tasks.filter(t => t.status === 'a_controler').length
  const bloquees = tasks.filter(t => t.status === 'blocked').length

  // ── Groupements ───────────────────────────────────────────
  const groupBy = (keyFn: (t: Task) => string) => {
    const map = new Map<string, Task[]>()
    tasks.forEach(t => {
      const k = keyFn(t)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(t)
    })
    return [...map.entries()]
      .map(([k, list]) => ({
        nom: k,
        valide: agreger(list, pctValide),
        declare: agreger(list, pctDeclare),
        n: list.length,
        bloquees: list.filter(t => t.status === 'blocked').length,
        aControler: list.filter(t => t.status === 'a_controler').length,
      }))
      .sort((a, b) => a.nom.localeCompare(b.nom))
  }

  const parBatiment = groupBy(t => t.zone_takt?.secteur?.batiment ?? t.zone_takt?.secteur?.name ?? 'Sans secteur')
  const parSysteme = groupBy(t => SYSTEME_LABELS[t.systeme ?? ''] ?? (t.systeme ?? 'Non renseigné'))
  const entNom = (id: string | null) => entreprises.find(e => e.id === id)?.name ?? 'Non rattachée'
  const parEntreprise = groupBy(t => entNom(t.entreprise_id))

  // ── Heures : produites vs consommées ──────────────────────
  const heuresPrevuesTotal = tasks.reduce((s, t) => s + t.heures_prevues, 0)
  const heuresProduites = Math.round(tasks.reduce((s, t) => s + t.heures_prevues * pctValide(t), 0))
  const heuresConsommees = Math.round(effectifs.reduce((s, e) => s + e.monteurs_presents * (e.heures_jour ?? 8), 0))
  const productivite = heuresConsommees > 0 ? Math.round((heuresProduites / heuresConsommees) * 100) : null
  const heuresRestantes = Math.max(0, Math.round(heuresPrevuesTotal - heuresProduites))

  // Rythme récent = moyenne des heures/jour des 5 derniers jours déclarés
  const derniersJours = [...new Set(effectifs.map(e => e.date))].sort().slice(-5)
  const heuresParJourRecent = derniersJours.length > 0
    ? derniersJours.reduce((s, d) =>
        s + effectifs.filter(e => e.date === d).reduce((x, e) => x + e.monteurs_presents * (e.heures_jour ?? 8), 0), 0
      ) / derniersJours.length
    : 0
  const joursRestants = heuresParJourRecent > 0 && productivite
    ? Math.ceil(heuresRestantes / (heuresParJourRecent * (productivite / 100)))
    : null

  // ── Retards ───────────────────────────────────────────────
  const monday = currentMondayISO()
  const enRetard = tasks.filter(t =>
    t.date_planifiee && t.date_planifiee < monday && t.status !== 'done' && t.status !== 'a_controler').length

  const AxeBloc = ({ icon, title, rows }: {
    icon: React.ReactNode; title: string
    rows: { nom: string; valide: number; declare: number; n: number; bloquees: number; aControler: number }[]
  }) => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
        {icon}{title}
      </p>
      <div className="space-y-3">
        {rows.map(r => (
          <div key={r.nom}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-nc-blue truncate">{r.nom}</p>
              <p className="text-xs">
                <span className="font-bold text-green-600">{r.valide}%</span>
                <span className="text-gray-400"> / {r.declare}% décl.</span>
                {r.bloquees > 0 && <span className="text-red-500 font-medium ml-1.5">⚠{r.bloquees}</span>}
                {r.aControler > 0 && <span className="text-amber-600 ml-1.5">◉{r.aControler}</span>}
              </p>
            </div>
            {/* Double barre : validé (plein) sur déclaré (clair) */}
            <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="absolute h-full bg-amber-200 rounded-full" style={{ width: `${r.declare}%` }} />
              <div className="absolute h-full bg-green-500 rounded-full" style={{ width: `${r.valide}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {/* En-tête */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-nc-blue flex items-center gap-2">
            <Briefcase size={20} className="text-nc-red" />
            Dashboard CA
          </h2>
          <p className="text-gray-500 text-sm">{chantier?.name} · {formatDateFR(todayISO())}</p>
        </div>
        <button onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-gray-500 text-xs hover:bg-gray-50">
          <RefreshCw size={13} />Actualiser
        </button>
      </div>

      <div className="space-y-3">
        {/* ── Global ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-end justify-between mb-2">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Avancement (pondéré heures)</p>
              <p className="text-3xl font-black text-green-600 mt-1">
                {avValide}%
                <span className="text-base text-gray-400 font-medium"> validé · {avDeclare}% déclaré</span>
              </p>
            </div>
            <div className="text-right text-xs text-gray-500">
              {stockControle > 0 && <p className="text-amber-600 font-medium">{stockControle} à contrôler</p>}
              {bloquees > 0 && <p className="text-red-500 font-medium">{bloquees} bloquée{bloquees > 1 ? 's' : ''}</p>}
              {enRetard > 0 && <p className="text-red-500">{enRetard} en retard</p>}
            </div>
          </div>
          <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="absolute h-full bg-amber-200 rounded-full" style={{ width: `${avDeclare}%` }} />
            <div className="absolute h-full bg-green-500 rounded-full" style={{ width: `${avValide}%` }} />
          </div>
          <p className="text-[10px] text-gray-400 mt-1">Vert = validé (base facturation) · Ambre = déclaré terrain</p>
        </div>

        {/* ── Heures & productivité ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Clock size={13} />Heures & productivité
          </p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xl font-black text-nc-blue">{heuresProduites}<span className="text-xs text-gray-400 font-medium"> h</span></p>
              <p className="text-[10px] text-gray-500">produites (validées)</p>
            </div>
            <div>
              <p className="text-xl font-black text-nc-blue">{heuresConsommees}<span className="text-xs text-gray-400 font-medium"> h</span></p>
              <p className="text-[10px] text-gray-500">consommées (effectifs)</p>
            </div>
            <div>
              <p className="text-xl font-black" style={{ color: productivite == null ? '#9CA3AF' : productivite >= 90 ? '#22C55E' : productivite >= 70 ? '#F59E0B' : '#EF4444' }}>
                {productivite != null ? `${productivite}%` : '—'}
              </p>
              <p className="text-[10px] text-gray-500">productivité</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between text-xs">
            <span className="text-gray-500">Reste ~{heuresRestantes} h prévues</span>
            <span className="font-medium text-nc-blue">
              {joursRestants != null
                ? `≈ ${joursRestants} j ouvrés au rythme actuel`
                : 'Prévision : déclarer les effectifs quotidiens'}
            </span>
          </div>
          {heuresConsommees === 0 && (
            <p className="text-[10px] text-amber-600 mt-2">
              ⚠ Aucune heure consommée enregistrée — les chefs d'équipe doivent déclarer les effectifs (présents × h/jour) chaque soir.
            </p>
          )}
        </div>

        {/* ── Par entreprise (base des situations ST) ── */}
        <AxeBloc icon={<Users size={13} />} title="Par entreprise" rows={parEntreprise} />

        {/* ── Par bâtiment ── */}
        <AxeBloc icon={<Building2 size={13} />} title="Par bâtiment / secteur" rows={parBatiment} />

        {/* ── Par système ── */}
        <AxeBloc icon={<Wind size={13} />} title="Par système" rows={parSysteme} />
      </div>
    </div>
  )
}
