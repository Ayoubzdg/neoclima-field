import { useEffect, useState, useCallback } from 'react'
import { Loader2, RefreshCw, Clock, Building2, Users, AlertTriangle, Download, HardHat } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import {
  getTasksByChantier, getEntreprises, getEffectifsAll,
  getZonesByChantier, getEquipes, getHeuresZoneAll
} from '@/lib/supabase'
import { formatDateFR } from '@/utils/dates'
import { HEURES_PAR_JOUR_EQUIPE, pctDeclare, pctValide, agreger } from '@/utils/avancement'
import type { Task, Entreprise, Effectif, ZoneTakt, Equipe, HeureZone, HeureCategorie } from '@/types/models'

/**
 * DASHBOARD MAIN-D'ŒUVRE (chargé d'affaires)
 *
 * Répond à trois questions :
 *  1. Où partent les heures ?      → répartition production / attente / régie / reprise
 *  2. Quelle zone dérape ?         → heures consommées vs budget et vs acquis, par zone
 *  3. Qui tient ses rendements ?   → coefficient heures consommées / heures produites, par entreprise
 *
 * Source : la ventilation saisie chaque soir (heures_zone).
 * Les heures déclarées (effectifs) servent de contrôle de
 * couverture : un chiffre n'est fiable que si la saisie suit.
 */

const CATEGORIES: { id: HeureCategorie; label: string; couleur: string }[] = [
  { id: 'productif', label: 'Production', couleur: '#22C55E' },
  { id: 'attente',   label: 'Attente / blocage', couleur: '#EF4444' },
  { id: 'regie',     label: 'Régie', couleur: '#3B82F6' },
  { id: 'reprise',   label: 'Reprise', couleur: '#F59E0B' },
]

const h = (v: number) => Math.round(v).toLocaleString('fr-CH')
const coefCouleur = (c: number | null) =>
  c == null ? '#9CA3AF' : c <= 1.05 ? '#22C55E' : c <= 1.2 ? '#F59E0B' : '#EF4444'

export default function MainOeuvre() {
  const { chantier } = useAuthStore()
  const [tasks, setTasks] = useState<Task[]>([])
  const [entreprises, setEntreprises] = useState<Entreprise[]>([])
  const [effectifs, setEffectifs] = useState<Effectif[]>([])
  const [zones, setZones] = useState<ZoneTakt[]>([])
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [heures, setHeures] = useState<HeureZone[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!chantier?.id) return
    setIsLoading(true)
    setErreur(null)
    Promise.all([
      getTasksByChantier(chantier.id),
      getEntreprises().catch(() => [] as Entreprise[]),
      getEffectifsAll(chantier.id).catch(() => [] as Effectif[]),
      getZonesByChantier(chantier.id).catch(() => [] as ZoneTakt[]),
      getEquipes(chantier.id).catch(() => [] as Equipe[]),
      getHeuresZoneAll(chantier.id),
    ]).then(([t, ents, eff, z, eq, hz]) => {
      setTasks(t); setEntreprises(ents); setEffectifs(eff)
      setZones(z); setEquipes(eq); setHeures(hz)
    }).catch(e => setErreur(e instanceof Error ? e.message : String(e)))
      .finally(() => setIsLoading(false))
  }, [chantier?.id])

  useEffect(() => { load() }, [load])

  if (isLoading) return (
    <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-nc-red" /></div>
  )

  const Entete = () => (
    <div className="flex items-center justify-between mb-4">
      <h2 className="font-bold text-nc-blue flex items-center gap-2"><HardHat size={20} />Main-d'œuvre</h2>
      <button onClick={load} className="p-2 rounded-xl hover:bg-gray-100"><RefreshCw size={18} className="text-gray-500" /></button>
    </div>
  )

  if (erreur) return (
    <div className="p-4 max-w-3xl mx-auto">
      <Entete />
      <div className="bg-red-50 text-red-700 rounded-2xl p-4 text-sm">
        <p className="font-semibold mb-1">Impossible de charger les heures ventilées.</p>
        <p>{erreur}</p>
        <p className="mt-2 text-red-600/80">Si la table n'existe pas encore : exécuter supabase/heures-zone.sql.</p>
      </div>
    </div>
  )

  if (heures.length === 0) return (
    <div className="p-4 max-w-3xl mx-auto">
      <Entete />
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center text-sm text-gray-500">
        <Clock size={28} className="mx-auto mb-2 text-gray-300" />
        <p className="font-semibold text-nc-blue mb-1">Aucune heure ventilée pour l'instant</p>
        <p>Les équipes répartissent leurs heures par zone à la clôture de journée
          (ou le chef d'équipe dans Équipes → Effectifs). Les chiffres apparaîtront ici dès la première saisie.</p>
      </div>
    </div>
  )

  // ── Période : la ventilation ne couvre que depuis sa mise en service ──
  const debut = heures.reduce((m, x) => x.date < m ? x.date : m, heures[0].date)
  const heuresEff = (e: Effectif) => e.monteurs_presents * (e.heures_jour ?? 8)
  const effDepuis = effectifs.filter(e => e.date >= debut)

  // ── 1. Couverture de saisie ───────────────────────────────
  const declarees = effDepuis.reduce((s, e) => s + heuresEff(e), 0)
  const ventilees = heures.reduce((s, x) => s + Number(x.heures), 0)
  const couverture = declarees > 0 ? Math.round((ventilees / declarees) * 100) : null

  const couvertureEquipes = equipes.map(eq => {
    const d = effDepuis.filter(e => e.equipe_id === eq.id).reduce((s, e) => s + heuresEff(e), 0)
    const v = heures.filter(x => x.equipe_id === eq.id).reduce((s, x) => s + Number(x.heures), 0)
    return { nom: eq.name, declarees: d, ventilees: v, pct: d > 0 ? Math.round((v / d) * 100) : null }
  }).filter(e => e.declarees > 0 && (e.pct ?? 0) < 80)
    .sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0))

  // ── 2. Répartition par catégorie ──────────────────────────
  const parCat = CATEGORIES.map(c => ({
    ...c,
    heures: heures.filter(x => x.categorie === c.id).reduce((s, x) => s + Number(x.heures), 0),
  }))
  const heuresPerdues = parCat.filter(c => c.id === 'attente' || c.id === 'reprise').reduce((s, c) => s + c.heures, 0)

  // ── 3. Par zone ───────────────────────────────────────────
  const batimentDe = (z: ZoneTakt) => z.secteur?.batiment ?? z.secteur?.name ?? 'Sans bâtiment'
  const lignesZones = zones.map(z => {
    const tz = tasks.filter(t => t.zone_takt_id === z.id)
    const conso = heures
      .filter(x => x.zone_takt_id === z.id && x.categorie === 'productif')
      .reduce((s, x) => s + Number(x.heures), 0)
    const budget = z.jours_equipe_prevus != null ? z.jours_equipe_prevus * HEURES_PAR_JOUR_EQUIPE : null
    const valide = agreger(tz, pctValide)
    const declare = agreger(tz, pctDeclare)
    const acquis = budget != null ? budget * (valide / 100) : null
    // Heures "catalogue" des tâches validées de la zone
    const produit = tz.reduce((s, t) => s + t.heures_prevues * pctValide(t), 0)
    const coef = produit > 0 && conso > 0 ? conso / produit : null
    // Projection : au rythme actuel, heures totales à terminaison
    const projection = valide >= 10 && conso > 0 ? conso / (valide / 100) : null
    return { zone: z, batiment: batimentDe(z), conso, budget, valide, declare, acquis, produit, coef, projection }
  }).filter(l => l.conso > 0)
    // Les zones qui brûlent le plus d'heures au-delà de l'acquis d'abord
    .sort((a, b) => (b.conso - (b.acquis ?? b.conso)) - (a.conso - (a.acquis ?? a.conso)))

  // ── 4. Par entreprise ─────────────────────────────────────
  const entNom = (id: string | null) => entreprises.find(e => e.id === id)?.name ?? 'Non rattachée'
  const entDeEquipe = new Map(equipes.map(e => [e.id, e.entreprise_id]))
  const idsEnt = [...new Set(heures.map(x => x.entreprise_id ?? entDeEquipe.get(x.equipe_id) ?? null))]
  const lignesEnt = idsEnt.map(id => {
    const hz = heures.filter(x => (x.entreprise_id ?? entDeEquipe.get(x.equipe_id) ?? null) === id)
    const cat = (c: HeureCategorie) => hz.filter(x => x.categorie === c).reduce((s, x) => s + Number(x.heures), 0)
    const productif = cat('productif')
    const produit = tasks.filter(t => t.entreprise_id === id).reduce((s, t) => s + t.heures_prevues * pctValide(t), 0)
    return {
      nom: entNom(id), productif, attente: cat('attente'), regie: cat('regie'), reprise: cat('reprise'),
      total: hz.reduce((s, x) => s + Number(x.heures), 0),
      produit, coef: produit > 0 && productif > 0 ? productif / produit : null,
    }
  }).sort((a, b) => b.total - a.total)

  // ── Export CSV (Excel FR : séparateur ; et BOM UTF-8) ─────
  const exporter = () => {
    const n = (v: number | null, d = 1) => v == null ? '' : v.toFixed(d).replace('.', ',')
    const lignes = [
      ['Bâtiment', 'Zone', 'Budget (h)', 'Heures consommées', 'Avancement validé (%)', 'Avancement déclaré (%)',
        'Heures acquises', 'Heures catalogue validées', 'Coefficient consommé/catalogue', 'Projection à terminaison (h)'],
      ...lignesZones.map(l => [
        l.batiment, l.zone.name, n(l.budget, 0), n(l.conso), String(l.valide), String(l.declare),
        n(l.acquis), n(l.produit), n(l.coef, 2), n(l.projection, 0),
      ]),
    ]
    const csv = '﻿' + lignes.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `heures-par-zone-${(chantier?.name ?? 'chantier').replace(/[^\w-]+/g, '_')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <Entete />

      {/* ── Couverture de saisie ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Clock size={13} />Fiabilité de la saisie — depuis le {formatDateFR(debut)}
        </p>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xl font-black text-nc-blue">{h(declarees)}<span className="text-xs text-gray-400 font-medium"> h</span></p>
            <p className="text-[10px] text-gray-500">déclarées (effectifs)</p>
          </div>
          <div>
            <p className="text-xl font-black text-nc-blue">{h(ventilees)}<span className="text-xs text-gray-400 font-medium"> h</span></p>
            <p className="text-[10px] text-gray-500">ventilées par zone</p>
          </div>
          <div>
            <p className="text-xl font-black"
              style={{ color: couverture == null ? '#9CA3AF' : couverture >= 90 ? '#22C55E' : couverture >= 70 ? '#F59E0B' : '#EF4444' }}>
              {couverture != null ? `${couverture}%` : '—'}
            </p>
            <p className="text-[10px] text-gray-500">couverture</p>
          </div>
        </div>
        {couverture != null && couverture < 70 && (
          <p className="mt-3 text-xs text-red-600 flex items-start gap-1.5">
            <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
            Moins de 70 % des heures sont ventilées : les chiffres ci-dessous sous-estiment la consommation réelle.
          </p>
        )}
        {couvertureEquipes.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-[11px] font-bold text-gray-500 mb-1">Équipes à relancer (moins de 80 % ventilé)</p>
            {couvertureEquipes.map(e => (
              <div key={e.nom} className="flex items-center justify-between text-xs py-0.5">
                <span className="text-nc-blue truncate">{e.nom}</span>
                <span className="text-gray-500">{h(e.ventilees)} / {h(e.declarees)} h · <b className="text-red-500">{e.pct}%</b></span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Où partent les heures ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Où partent les heures</p>
        <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 mb-3">
          {parCat.filter(c => c.heures > 0).map(c => (
            <div key={c.id} style={{ width: `${(c.heures / ventilees) * 100}%`, backgroundColor: c.couleur }} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {parCat.map(c => (
            <div key={c.id} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-gray-600">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.couleur }} />{c.label}
              </span>
              <span className="font-bold text-nc-blue">
                {h(c.heures)} h
                <span className="text-xs text-gray-400 font-medium"> · {ventilees > 0 ? Math.round((c.heures / ventilees) * 100) : 0}%</span>
              </span>
            </div>
          ))}
        </div>
        {heuresPerdues > 0 && (
          <p className="mt-3 text-xs text-gray-500">
            <b className="text-red-600">{h(heuresPerdues)} h perdues</b> (attente + reprise),
            soit {(heuresPerdues / HEURES_PAR_JOUR_EQUIPE).toFixed(1)} jours-équipe.
          </p>
        )}
      </div>

      {/* ── Par zone ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
            <Building2 size={13} />Heures par zone
          </p>
          <button onClick={exporter} className="flex items-center gap-1 text-xs font-medium text-nc-blue">
            <Download size={13} />Export CSV
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mb-3">
          Coef. = heures consommées ÷ heures catalogue des tâches validées (1,00 = rendement du chiffrage).
          Les zones entamées avant le {formatDateFR(debut)} paraissent meilleures qu'en réalité : leurs heures antérieures ne sont pas comptées.
        </p>
        {lignesZones.length === 0 && (
          <p className="text-xs text-gray-400 italic">Aucune heure de production affectée à une zone.</p>
        )}
        <div className="space-y-3">
          {lignesZones.map(l => {
            const depasse = l.acquis != null && l.conso > l.acquis * 1.1
            const pctBudget = l.budget ? Math.min(100, (l.conso / l.budget) * 100) : 0
            return (
              <div key={l.zone.id}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-nc-blue truncate">
                    {l.zone.name}<span className="text-xs text-gray-400 font-normal"> · {l.batiment}</span>
                  </p>
                  <p className="text-xs flex-shrink-0 ml-2">
                    <span className="font-bold" style={{ color: coefCouleur(l.coef) }}>
                      {l.coef != null ? `coef. ${l.coef.toFixed(2).replace('.', ',')}` : 'coef. —'}
                    </span>
                  </p>
                </div>
                {l.budget != null && (
                  <div className="relative h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="absolute inset-y-0 left-0 rounded-full"
                      style={{ width: `${pctBudget}%`, backgroundColor: depasse ? '#EF4444' : '#3B82F6' }} />
                    {/* Repère : avancement validé */}
                    <div className="absolute inset-y-0 w-0.5 bg-green-600" style={{ left: `${Math.min(100, l.valide)}%` }} />
                  </div>
                )}
                <p className="text-[11px] text-gray-500 mt-1">
                  <b className={depasse ? 'text-red-600' : 'text-nc-blue'}>{h(l.conso)} h</b> consommées
                  {l.budget != null ? <> / {h(l.budget)} h budget</> : <> · <span className="text-amber-600">budget non renseigné</span></>}
                  {' · '}validé {l.valide}% <span className="text-gray-400">(déclaré {l.declare}%)</span>
                  {l.projection != null && l.budget != null && (
                    <> · projection <b className={l.projection > l.budget ? 'text-red-600' : 'text-green-600'}>{h(l.projection)} h</b></>
                  )}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Par entreprise ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Users size={13} />Heures par entreprise
        </p>
        <div className="space-y-3">
          {lignesEnt.map(e => (
            <div key={e.nom}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-nc-blue truncate">{e.nom}</p>
                <p className="text-xs flex-shrink-0 ml-2">
                  <span className="text-gray-500">{h(e.total)} h · </span>
                  <span className="font-bold" style={{ color: coefCouleur(e.coef) }}>
                    {e.coef != null ? `coef. ${e.coef.toFixed(2).replace('.', ',')}` : 'coef. —'}
                  </span>
                </p>
              </div>
              <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
                {CATEGORIES.map(c => {
                  const v = e[c.id]
                  return v > 0 ? <div key={c.id} style={{ width: `${(v / e.total) * 100}%`, backgroundColor: c.couleur }} /> : null
                })}
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                production {h(e.productif)} h
                {e.attente > 0 && <> · <span className="text-red-600">attente {h(e.attente)} h</span></>}
                {e.regie > 0 && <> · régie {h(e.regie)} h</>}
                {e.reprise > 0 && <> · <span className="text-amber-600">reprise {h(e.reprise)} h</span></>}
                {' · '}catalogue validé {h(e.produit)} h
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
