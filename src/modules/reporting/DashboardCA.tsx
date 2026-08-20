import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Briefcase, RefreshCw, Loader2, Building2, Wind,
  Users, Clock, CalendarDays, Zap, Shield, ChevronRight
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import {
  getTasksByChantier, getEntreprises, getEffectifsAll,
  getZonesByChantier, getTravauxSupp, getEquipes, upsertZoneTakt
} from '@/lib/supabase'
import { currentMondayISO, formatDateFR, todayISO } from '@/utils/dates'
import type { Task, Entreprise, Effectif, ZoneTakt, TravauxSupp, Equipe } from '@/types/models'

const SYSTEME_LABELS: Record<string, string> = {
  soufflage: 'Soufflage', extraction: 'Extraction', desenfumage: 'Désenfumage',
  reprise: 'Reprise', air_neuf: 'Air neuf', autre: 'Autre',
}

/** 1 équipe = 2 monteurs × 8 h → 1 jour-équipe = 16 h */
const HEURES_PAR_JOUR_EQUIPE = 16

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
 * 1. À traiter (travaux supp, blocages, budgets manquants)
 * 2. Avancement validé vs déclaré (pondéré heures)
 * 3. Budget jours-équipe par zone (saisie directe) + acquis
 * 4. Heures cumulées (global vs budget + par entreprise)
 * 5. Avancement par entreprise / bâtiment / système
 */
export default function DashboardCA() {
  const navigate = useNavigate()
  const { chantier } = useAuthStore()
  const [tasks, setTasks] = useState<Task[]>([])
  const [entreprises, setEntreprises] = useState<Entreprise[]>([])
  const [effectifs, setEffectifs] = useState<Effectif[]>([])
  const [zones, setZones] = useState<ZoneTakt[]>([])
  const [travauxSupp, setTravauxSupp] = useState<TravauxSupp[]>([])
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [isLoading, setIsLoading] = useState(true)
  // Saisie budget j/éq en cours (zoneId → valeur du champ)
  const [budgetEdit, setBudgetEdit] = useState<Record<string, string>>({})
  const [budgetSaving, setBudgetSaving] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!chantier?.id) return
    setIsLoading(true)
    Promise.all([
      getTasksByChantier(chantier.id),
      getEntreprises().catch(() => [] as Entreprise[]),
      getEffectifsAll(chantier.id).catch(() => [] as Effectif[]),
      getZonesByChantier(chantier.id).catch(() => [] as ZoneTakt[]),
      getTravauxSupp(chantier.id).catch(() => [] as TravauxSupp[]),
      getEquipes(chantier.id).catch(() => [] as Equipe[]),
    ]).then(([t, ents, eff, z, ts, eq]) => {
      setTasks(t); setEntreprises(ents); setEffectifs(eff)
      setZones(z); setTravauxSupp(ts); setEquipes(eq)
    }).finally(() => setIsLoading(false))
  }, [chantier?.id])

  useEffect(() => { load() }, [load])

  const saveBudget = async (zone: ZoneTakt) => {
    const raw = budgetEdit[zone.id]
    if (raw === undefined) return
    const val = raw.trim() === '' ? null : parseFloat(raw)
    if (val === zone.jours_equipe_prevus) return
    setBudgetSaving(zone.id)
    try {
      await upsertZoneTakt({ id: zone.id, secteur_id: zone.secteur_id, name: zone.name, jours_equipe_prevus: val })
      setZones(prev => prev.map(z => z.id === zone.id ? { ...z, jours_equipe_prevus: val } : z))
    } finally {
      setBudgetSaving(null)
    }
  }

  if (isLoading) return (
    <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-nc-red" /></div>
  )

  // ── Global ────────────────────────────────────────────────
  const avValide = agreger(tasks, pctValide)
  const avDeclare = agreger(tasks, pctDeclare)
  const stockControle = tasks.filter(t => t.status === 'a_controler').length
  const bloquees = tasks.filter(t => t.status === 'blocked').length

  // ── À traiter ─────────────────────────────────────────────
  const tsAValider = travauxSupp.filter(t => t.statut === 'valide_cc').length
  const tsSignales = travauxSupp.filter(t => t.statut === 'signale').length
  const zonesSansBudget = zones.filter(z => z.jours_equipe_prevus == null).length

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

  // Cumul heures par entreprise (effectif → équipe → entreprise)
  const equipeEnt = new Map(equipes.map(e => [e.id, e.entreprise_id]))
  const heuresParEntreprise = new Map<string, number>()
  effectifs.forEach(e => {
    const nom = entNom(equipeEnt.get(e.equipe_id) ?? null)
    heuresParEntreprise.set(nom, (heuresParEntreprise.get(nom) ?? 0) + e.monteurs_presents * (e.heures_jour ?? 8))
  })
  const cumulEntreprises = [...heuresParEntreprise.entries()]
    .map(([nom, h]) => ({ nom, h: Math.round(h) }))
    .sort((a, b) => b.h - a.h)
  const budgetHeuresChantier = chantier?.budget_heures ?? 0
  const pctBudgetConsomme = budgetHeuresChantier > 0
    ? Math.round((heuresConsommees / budgetHeuresChantier) * 100) : null

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

  // ── Budget jours-équipe par zone, groupé par bâtiment ─────
  const avancementZone = (zoneId: string) =>
    agreger(tasks.filter(t => t.zone_takt_id === zoneId), pctValide)
  const batimentDe = (z: ZoneTakt) => z.secteur?.batiment ?? z.secteur?.name ?? 'Sans bâtiment'
  const batiments = [...new Set(zones.map(batimentDe))].sort()
  const totalBudgetJE = zones.reduce((s, z) => s + (z.jours_equipe_prevus ?? 0), 0)
  const totalAcquisJE = zones.reduce((s, z) =>
    s + (z.jours_equipe_prevus ?? 0) * (avancementZone(z.id) / 100), 0)
  const joursEquipeConsommes = heuresConsommees / HEURES_PAR_JOUR_EQUIPE

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
        {/* ── À traiter (actions CA) ── */}
        {(tsAValider > 0 || tsSignales > 0 || bloquees > 0 || zonesSansBudget > 0) && (
          <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-4">
            <p className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-2">À traiter</p>
            <div className="space-y-1.5">
              {tsAValider > 0 && (
                <button onClick={() => navigate('/production/travaux-supp')}
                  className="w-full flex items-center justify-between text-sm text-gray-700 hover:text-nc-blue py-0.5">
                  <span className="flex items-center gap-2"><Zap size={14} className="text-amber-500" />
                    {tsAValider} travau{tsAValider > 1 ? 'x' : 'il'} supp. en attente de TON autorisation</span>
                  <ChevronRight size={14} className="text-gray-300" />
                </button>
              )}
              {tsSignales > 0 && (
                <button onClick={() => navigate('/production/travaux-supp')}
                  className="w-full flex items-center justify-between text-sm text-gray-500 hover:text-nc-blue py-0.5">
                  <span className="flex items-center gap-2"><Zap size={14} className="text-gray-400" />
                    {tsSignales} signalement{tsSignales > 1 ? 's' : ''} chez le chef de chantier</span>
                  <ChevronRight size={14} className="text-gray-300" />
                </button>
              )}
              {bloquees > 0 && (
                <button onClick={() => navigate('/production/blocages')}
                  className="w-full flex items-center justify-between text-sm text-gray-700 hover:text-nc-blue py-0.5">
                  <span className="flex items-center gap-2"><Shield size={14} className="text-red-500" />
                    {bloquees} tâche{bloquees > 1 ? 's' : ''} bloquée{bloquees > 1 ? 's' : ''}</span>
                  <ChevronRight size={14} className="text-gray-300" />
                </button>
              )}
              {zonesSansBudget > 0 && (
                <p className="flex items-center gap-2 text-sm text-red-600 py-0.5">
                  <CalendarDays size={14} />
                  {zonesSansBudget} zone{zonesSansBudget > 1 ? 's' : ''} sans budget jours-équipe — à renseigner ci-dessous
                </p>
              )}
            </div>
          </div>
        )}

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

        {/* ── Budget jours-équipe par zone ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
              <CalendarDays size={13} />Budget jours-équipe (1 éq = 2 monteurs)
            </p>
            <p className="text-[10px] text-gray-400">saisie directe, Entrée pour valider</p>
          </div>

          {/* Synthèse : budget vs consommé vs acquis */}
          <div className="grid grid-cols-3 gap-3 text-center my-3">
            <div>
              <p className="text-xl font-black text-nc-blue">{totalBudgetJE}<span className="text-xs text-gray-400 font-medium"> j/éq</span></p>
              <p className="text-[10px] text-gray-500">budget ({totalBudgetJE * HEURES_PAR_JOUR_EQUIPE} h)</p>
            </div>
            <div>
              <p className="text-xl font-black text-nc-blue">{joursEquipeConsommes.toFixed(1)}<span className="text-xs text-gray-400 font-medium"> j/éq</span></p>
              <p className="text-[10px] text-gray-500">consommés (effectifs)</p>
            </div>
            <div>
              <p className="text-xl font-black"
                style={{ color: totalBudgetJE === 0 ? '#9CA3AF' : totalAcquisJE >= joursEquipeConsommes ? '#22C55E' : '#EF4444' }}>
                {totalAcquisJE.toFixed(1)}<span className="text-xs text-gray-400 font-medium"> j/éq</span>
              </p>
              <p className="text-[10px] text-gray-500">acquis (budget × validé)</p>
            </div>
          </div>

          {batiments.map(bat => {
            const zs = zones.filter(z => batimentDe(z) === bat)
            const sousTotal = zs.reduce((s, z) => s + (z.jours_equipe_prevus ?? 0), 0)
            return (
              <div key={bat} className="mb-2">
                <p className="text-[11px] font-bold text-nc-blue flex items-center justify-between border-b border-gray-100 pb-0.5 mb-1">
                  <span className="flex items-center gap-1"><Building2 size={11} />{bat}</span>
                  <span className="text-gray-400 font-medium">{sousTotal} j/éq</span>
                </p>
                {zs.map(z => {
                  const av = avancementZone(z.id)
                  const manquant = z.jours_equipe_prevus == null
                  const acquis = (z.jours_equipe_prevus ?? 0) * av / 100
                  return (
                    <div key={z.id} className="flex items-center gap-2 py-1 text-sm">
                      <span className={`flex-1 truncate ${manquant ? 'text-red-600 font-medium' : 'text-gray-700'}`}>
                        {z.name}
                      </span>
                      <span className="text-[10px] text-gray-400 w-16 text-right">{av}% validé</span>
                      <span className="text-[10px] text-gray-400 w-14 text-right">
                        {manquant ? '—' : `${acquis.toFixed(1)} acq.`}
                      </span>
                      <input
                        type="number" min={0} step={0.5} inputMode="decimal"
                        value={budgetEdit[z.id] ?? z.jours_equipe_prevus ?? ''}
                        placeholder="j/éq"
                        onChange={e => setBudgetEdit(p => ({ ...p, [z.id]: e.target.value }))}
                        onBlur={() => saveBudget(z)}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                        className={`w-16 text-center text-sm rounded-lg border px-1 py-0.5 outline-none
                          ${manquant ? 'border-red-300 bg-red-50/60' : 'border-gray-200'}
                          ${budgetSaving === z.id ? 'opacity-40' : ''} focus:border-nc-blue`}
                      />
                    </div>
                  )
                })}
              </div>
            )
          })}
          {zones.length === 0 && (
            <p className="text-xs text-gray-400 italic">Aucune zone — crée-les dans Paramètres → Zones & Secteurs</p>
          )}
        </div>

        {/* ── Heures cumulées ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Clock size={13} />Heures cumulées & productivité
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

          {/* Budget heures chantier */}
          {budgetHeuresChantier > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-500">Budget chantier : {budgetHeuresChantier} h</span>
                <span className={`font-bold ${pctBudgetConsomme != null && pctBudgetConsomme > avDeclare ? 'text-red-500' : 'text-nc-blue'}`}>
                  {pctBudgetConsomme}% consommé
                </span>
              </div>
              <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`absolute h-full rounded-full ${pctBudgetConsomme != null && pctBudgetConsomme > 100 ? 'bg-red-500' : 'bg-nc-blue'}`}
                  style={{ width: `${Math.min(100, pctBudgetConsomme ?? 0)}%` }} />
              </div>
              {pctBudgetConsomme != null && pctBudgetConsomme > avDeclare && (
                <p className="text-[10px] text-red-500 mt-1">
                  ⚠ Consommation d'heures ({pctBudgetConsomme}%) en avance sur l'avancement déclaré ({avDeclare}%)
                </p>
              )}
            </div>
          )}

          {/* Cumul par entreprise */}
          {cumulEntreprises.length > 0 && (
            <div className="mt-3 pt-2 border-t border-gray-50">
              {cumulEntreprises.map(c => (
                <div key={c.nom} className="flex items-center justify-between text-xs py-0.5">
                  <span className="text-gray-600 truncate">{c.nom}</span>
                  <span className="font-semibold text-nc-blue">{c.h} h</span>
                </div>
              ))}
            </div>
          )}

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
