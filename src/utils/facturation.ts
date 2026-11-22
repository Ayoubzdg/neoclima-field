import type { Effectif, Equipe, TarifFacturation, ReleveFacturation } from '@/types/models'

/**
 * CALCUL DU RELEVÉ DE FACTURATION D'UN SOUS-TRAITANT
 *
 * Fonction pure (aucun accès réseau) : même entrée → même
 * relevé. Règles, dans l'ordre :
 *  1. Seuls les présents VALIDÉS par l'encadrement comptent,
 *     à partir de la date de début du tarif.
 *  2. Unité = monteur présent (prix × présents) ou équipe
 *     présente (prix × 1), selon le tarif.
 *  3. Plafond : par équipe, seuls les N premiers jours du mois
 *     sont facturés ; les suivants sont gratuits.
 *  4. Dégressif : chaque jour, au-delà de N unités pour
 *     l'entreprise, les unités suivantes sont au prix réduit.
 *  5. Report : si mois + report antérieur < seuil, le relevé
 *     est reporté au mois suivant au lieu d'être facturé.
 */

export interface LigneEquipeJour {
  equipe_id: string
  equipe_nom: string
  presents: number
  unites: number
  /** false = jour au-delà du plafond mensuel de l'équipe (gratuit) */
  facture: boolean
}

export interface JourReleve {
  date: string
  equipes: LigneEquipeJour[]
  /** Unités facturées ce jour (hors jours plafonnés) */
  unites: number
  /** Dont unités au prix dégressif */
  unites_degressif: number
  montant: number
}

export interface Releve {
  jours: JourReleve[]
  /** Unités facturées dans le mois */
  unites: number
  /** Unités offertes par le plafond */
  unites_offertes: number
  montant_mois: number
  report_anterieur: number
  total: number
  statut: 'a_facturer' | 'reporte'
  /** Présents déclarés mais pas encore validés (non facturables en l'état) */
  non_valides: { date: string; equipe_nom: string; presents: number }[]
}

const arrondi = (v: number) => Math.round(v * 100) / 100

/** Premier jour du mois (YYYY-MM-01) et dernier jour (YYYY-MM-DD) */
export function bornesMois(mois: string): { du: string; au: string } {
  const [y, m] = mois.split('-').map(Number)
  const dernier = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const mm = String(m).padStart(2, '0')
  return { du: `${y}-${mm}-01`, au: `${y}-${mm}-${String(dernier).padStart(2, '0')}` }
}

/** Décale un mois YYYY-MM-01 de n mois */
export function decalerMois(mois: string, n: number): string {
  const [y, m] = mois.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}

/**
 * Report antérieur = somme des mois clôturés « reportés » qui
 * précèdent IMMÉDIATEMENT (mois consécutifs), jusqu'au dernier
 * relevé facturé. Un mois précédent non clôturé coupe la chaîne :
 * son report n'est pas encore connu. La clôture se fait donc
 * dans l'ordre (voir clotureAutorisee).
 */
export function reportAnterieur(releves: ReleveFacturation[], entrepriseId: string, mois: string): number {
  const parMois = new Map(releves.filter(r => r.entreprise_id === entrepriseId).map(r => [r.mois, r]))
  let report = 0
  for (let m = decalerMois(mois, -1); ; m = decalerMois(m, -1)) {
    const r = parMois.get(m)
    if (!r || r.statut !== 'reporte') break
    report += Number(r.montant_mois)
  }
  return arrondi(report)
}

/**
 * Clôture dans l'ordre : une fois un premier mois clôturé, le
 * suivant à clôturer est le mois d'après (même sans activité),
 * sinon un report pourrait être perdu ou compté deux fois.
 * Renvoie null si la clôture est permise, sinon le mois attendu.
 */
export function clotureAutorisee(releves: ReleveFacturation[], entrepriseId: string, mois: string): string | null {
  const clos = releves.filter(r => r.entreprise_id === entrepriseId).map(r => r.mois).sort()
  if (clos.length === 0) return null
  const attendu = decalerMois(clos[clos.length - 1], 1)
  return attendu === mois ? null : attendu
}

/** Seul le dernier mois clôturé peut être rouvert (les suivants en dépendent) */
export function reouvertureAutorisee(releves: ReleveFacturation[], entrepriseId: string, mois: string): boolean {
  return !releves.some(r => r.entreprise_id === entrepriseId && r.mois > mois)
}

export function calculerReleve(params: {
  tarif: TarifFacturation
  /** Effectifs du mois (toutes entreprises : le filtre se fait ici) */
  effectifs: Effectif[]
  /** Équipes du chantier */
  equipes: Equipe[]
  /** Premier jour du mois (YYYY-MM-01) */
  mois: string
  reportAnterieur?: number
}): Releve {
  const { tarif, effectifs, equipes, mois } = params
  const report = params.reportAnterieur ?? 0
  const { du, au } = bornesMois(mois)
  const debut = tarif.date_debut && tarif.date_debut > du ? tarif.date_debut : du

  const equipesEnt = new Map(
    equipes.filter(e => e.entreprise_id === tarif.entreprise_id).map(e => [e.id, e.name])
  )
  const lignes = effectifs
    .filter(e => equipesEnt.has(e.equipe_id) && e.date >= debut && e.date <= au && e.monteurs_presents > 0)
    .sort((a, b) => a.date.localeCompare(b.date))

  const non_valides = lignes
    .filter(e => !e.valide_at)
    .map(e => ({ date: e.date, equipe_nom: equipesEnt.get(e.equipe_id) ?? '?', presents: e.monteurs_presents }))

  const prix = Number(tarif.prix_jour)
  const plafond = tarif.plafond_jours_mois
  const degressifActif = tarif.degressif_seuil != null && tarif.degressif_prix != null
  const joursParEquipe = new Map<string, number>()
  const parJour = new Map<string, LigneEquipeJour[]>()

  for (const e of lignes.filter(x => x.valide_at)) {
    const n = (joursParEquipe.get(e.equipe_id) ?? 0) + 1
    joursParEquipe.set(e.equipe_id, n)
    const ligne: LigneEquipeJour = {
      equipe_id: e.equipe_id,
      equipe_nom: equipesEnt.get(e.equipe_id) ?? '?',
      presents: e.monteurs_presents,
      unites: tarif.unite === 'monteur' ? e.monteurs_presents : 1,
      facture: plafond == null || n <= plafond,
    }
    if (!parJour.has(e.date)) parJour.set(e.date, [])
    parJour.get(e.date)!.push(ligne)
  }

  let unitesOffertes = 0
  const jours: JourReleve[] = [...parJour.entries()].map(([date, eqs]) => {
    const unites = eqs.filter(l => l.facture).reduce((s, l) => s + l.unites, 0)
    unitesOffertes += eqs.filter(l => !l.facture).reduce((s, l) => s + l.unites, 0)
    const pleinTarif = degressifActif ? Math.min(unites, tarif.degressif_seuil!) : unites
    const reduit = unites - pleinTarif
    const montant = arrondi(pleinTarif * prix + reduit * Number(tarif.degressif_prix ?? 0))
    return { date, equipes: eqs, unites, unites_degressif: reduit, montant }
  })

  const montantMois = tarif.facturable ? arrondi(jours.reduce((s, j) => s + j.montant, 0)) : 0
  const total = arrondi(montantMois + report)
  return {
    jours,
    unites: jours.reduce((s, j) => s + j.unites, 0),
    unites_offertes: unitesOffertes,
    montant_mois: montantMois,
    report_anterieur: report,
    total,
    statut: total >= Number(tarif.seuil_facturation) ? 'a_facturer' : 'reporte',
    non_valides,
  }
}
