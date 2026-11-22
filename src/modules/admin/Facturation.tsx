import { useEffect, useState, useCallback } from 'react'
import {
  Loader2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Receipt, Lock, Unlock,
  Download, Printer, AlertTriangle, Save, CheckCircle
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import {
  getEntreprises, getEquipes, getTarifs, getReleves, getEffectifsPeriode,
  getHeuresZoneAll, getTasksByChantier, upsertTarif, upsertEntreprise,
  cloturerReleve, rouvrirReleve
} from '@/lib/supabase'
import {
  calculerReleve, reportAnterieur, clotureAutorisee, reouvertureAutorisee,
  bornesMois, decalerMois, type Releve
} from '@/utils/facturation'
import { todayISO } from '@/utils/dates'
import type {
  Entreprise, Equipe, Effectif, TarifFacturation, ReleveFacturation, HeureZone, Task
} from '@/types/models'

/**
 * FACTURATION DES SOUS-TRAITANTS (admin)
 *
 * Par entreprise présente sur le chantier : tarif, fiche de
 * facturation, relevé du mois calculé sur les présents VALIDÉS,
 * alertes de fiabilité, clôture (qui verrouille les effectifs),
 * export CSV et impression du relevé.
 *
 * L'app produit le RELEVÉ (pièce justificative). La facture
 * (numéro, TVA, QR-facture) reste dans l'outil comptable.
 */

const chf = (v: number) => `CHF ${v.toLocaleString('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const jourFR = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('fr-CH', { weekday: 'short', day: '2-digit', month: '2-digit' })
const moisFR = (m: string) => new Date(m + 'T12:00:00').toLocaleDateString('fr-CH', { month: 'long', year: 'numeric' })
const moisCourant = () => todayISO().slice(0, 7) + '-01'

/** Détail figé dans le relevé clôturé */
interface DetailFige { releve: Releve; tarif: TarifFacturation }

type BrouillonTarif = {
  facturable: boolean; unite: 'monteur' | 'equipe'; prix_jour: string; plafond_jours_mois: string
  degressif_seuil: string; degressif_prix: string; seuil_facturation: string; date_debut: string
}
const versBrouillon = (t: TarifFacturation | undefined): BrouillonTarif => ({
  facturable: t?.facturable ?? true,
  unite: t?.unite ?? 'monteur',
  prix_jour: String(t?.prix_jour ?? 4.5),
  plafond_jours_mois: t ? (t.plafond_jours_mois == null ? '' : String(t.plafond_jours_mois)) : '20',
  degressif_seuil: t?.degressif_seuil == null ? '' : String(t.degressif_seuil),
  degressif_prix: t?.degressif_prix == null ? '' : String(t.degressif_prix),
  seuil_facturation: String(t?.seuil_facturation ?? 50),
  date_debut: t?.date_debut ?? '',
})
const num = (s: string) => { const v = parseFloat(s.replace(',', '.')); return Number.isFinite(v) ? v : null }

export default function Facturation() {
  const { chantier, utilisateur } = useAuthStore()
  const [mois, setMois] = useState(moisCourant())
  const [entreprises, setEntreprises] = useState<Entreprise[]>([])
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [tarifs, setTarifs] = useState<TarifFacturation[]>([])
  const [releves, setReleves] = useState<ReleveFacturation[]>([])
  const [effectifs, setEffectifs] = useState<Effectif[]>([])
  const [heures, setHeures] = useState<HeureZone[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [ouverte, setOuverte] = useState<string | null>(null)
  const [aImprimer, setAImprimer] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!chantier?.id) return
    const { du, au } = bornesMois(mois)
    setIsLoading(true)
    setErreur(null)
    Promise.all([
      getEntreprises(),
      getEquipes(chantier.id),
      getTarifs(chantier.id),
      getReleves(chantier.id),
      getEffectifsPeriode(chantier.id, du, au),
      // Signaux d'activité (alertes) : non bloquants
      getHeuresZoneAll(chantier.id).catch(() => [] as HeureZone[]),
      getTasksByChantier(chantier.id).catch(() => [] as Task[]),
    ]).then(([ents, eq, t, r, eff, hz, tk]) => {
      setEntreprises(ents); setEquipes(eq); setTarifs(t); setReleves(r)
      setEffectifs(eff); setHeures(hz); setTasks(tk)
    }).catch(e => setErreur(e instanceof Error ? e.message : String(e)))
      .finally(() => setIsLoading(false))
  }, [chantier?.id, mois])

  useEffect(() => { load() }, [load])

  // Impression d'un relevé : on rend le bloc imprimable puis on lance l'impression
  useEffect(() => {
    if (!aImprimer) return
    const t = setTimeout(() => { window.print(); setAImprimer(null) }, 150)
    return () => clearTimeout(t)
  }, [aImprimer])

  if (isLoading) return (
    <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-nc-red" /></div>
  )

  if (erreur) return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="bg-red-50 text-red-700 rounded-2xl p-4 text-sm">
        <p className="font-semibold mb-1">Impossible de charger la facturation.</p>
        <p>{erreur}</p>
        <p className="mt-2 text-red-600/80">Si les tables n'existent pas encore : exécuter supabase/facturation.sql.</p>
      </div>
    </div>
  )

  if (!chantier) return null
  const { du, au } = bornesMois(mois)
  const moisTermine = au < todayISO()

  // Entreprises présentes sur le chantier = celles qui y ont des équipes
  const idsPresents = new Set(equipes.map(e => e.entreprise_id).filter(Boolean) as string[])
  const lignes = entreprises.filter(e => idsPresents.has(e.id)).map(ent => {
    const tarif = tarifs.find(t => t.entreprise_id === ent.id)
    const cloture = releves.find(r => r.entreprise_id === ent.id && r.mois === mois)
    const fige = cloture ? (cloture.detail as DetailFige | null) : null
    const releve: Releve | null = fige?.releve
      ?? (tarif ? calculerReleve({
        tarif, effectifs, equipes, mois,
        reportAnterieur: reportAnterieur(releves, ent.id, mois),
      }) : null)

    // Alerte : activité sans présents déclarés (heures ventilées ou tâche
    // démarrée/terminée un jour où l'équipe n'a déclaré personne)
    const eqIds = new Set(equipes.filter(e => e.entreprise_id === ent.id).map(e => e.id))
    const nomEq = (id: string) => equipes.find(e => e.id === id)?.name ?? '?'
    const declares = new Set(effectifs.filter(e => eqIds.has(e.equipe_id) && e.monteurs_presents > 0)
      .map(e => `${e.equipe_id}|${e.date}`))
    const activite = new Map<string, string>() // clé équipe|date → origine
    heures.filter(x => eqIds.has(x.equipe_id) && x.date >= du && x.date <= au)
      .forEach(x => activite.set(`${x.equipe_id}|${x.date}`, 'heures ventilées'))
    tasks.filter(t => t.equipe_id && eqIds.has(t.equipe_id)).forEach(t => {
      for (const d of [t.date_debut_reel, t.date_fin_reel]) {
        const j = d?.slice(0, 10)
        if (j && j >= du && j <= au && !activite.has(`${t.equipe_id}|${j}`)) {
          activite.set(`${t.equipe_id}|${j}`, 'tâche avancée')
        }
      }
    })
    const sansPresents = [...activite.entries()]
      .filter(([k]) => !declares.has(k))
      .map(([k, origine]) => { const [eq, date] = k.split('|'); return { date, equipe: nomEq(eq), origine } })
      .sort((a, b) => a.date.localeCompare(b.date))

    return {
      ent, tarif: fige?.tarif ?? tarif, tarifActuel: tarif, cloture, releve, sansPresents,
      // Clôture dans l'ordre : mois à clôturer d'abord (null = celui-ci est permis)
      moisAttendu: clotureAutorisee(releves, ent.id, mois),
      peutRouvrir: reouvertureAutorisee(releves, ent.id, mois),
    }
  })

  const facturees = lignes.filter(l => l.tarif?.facturable && l.releve)
  const totalAFacturer = facturees.filter(l => l.releve!.statut === 'a_facturer').reduce((s, l) => s + l.releve!.total, 0)
  const totalReporte = facturees.filter(l => l.releve!.statut === 'reporte').reduce((s, l) => s + l.releve!.total, 0)
  const nbNonCloturees = facturees.filter(l => !l.cloture).length

  const exporterCSV = (l: typeof lignes[number]) => {
    if (!l.releve || !l.tarif) return
    const n = (v: number) => v.toFixed(2).replace('.', ',')
    const rows: string[][] = [
      ['Relevé Neoclima Field', moisFR(mois)],
      ['Chantier', chantier.name],
      ['Entreprise', l.ent.raison_sociale || l.ent.name],
      ['Tarif', `${n(Number(l.tarif.prix_jour))} CHF par ${l.tarif.unite === 'monteur' ? 'monteur présent' : 'équipe présente'} et par jour`],
      [],
      ['Date', 'Équipes (présents)', 'Unités facturées', 'Dont prix dégressif', 'Montant HT (CHF)'],
      ...l.releve.jours.map(j => [
        j.date,
        j.equipes.map(e => `${e.equipe_nom} (${e.presents})${e.facture ? '' : ' — offert, plafond'}`).join(' / '),
        String(j.unites), String(j.unites_degressif), n(j.montant),
      ]),
      [],
      ['Total du mois', '', String(l.releve.unites), '', n(l.releve.montant_mois)],
      ['Report antérieur', '', '', '', n(l.releve.report_anterieur)],
      ['Total', '', '', '', n(l.releve.total)],
      ['Statut', l.releve.statut === 'a_facturer' ? 'À facturer' : 'Reporté au mois suivant'],
    ]
    const csv = '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `releve-${mois.slice(0, 7)}-${l.ent.name.replace(/[^\w-]+/g, '_')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const imprime = lignes.find(l => l.ent.id === aImprimer)

  return (
    <>
      {/* ── Écran ── */}
      <div className="p-4 max-w-3xl mx-auto space-y-4 print:hidden">
        <div>
          <h2 className="font-bold text-nc-blue flex items-center gap-2"><Receipt size={20} />Facturation sous-traitants</h2>
          <p className="text-xs text-gray-500">{chantier.name} — présents validés par l'encadrement uniquement</p>
        </div>

        {/* Sélecteur de mois */}
        <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm px-2 py-2">
          <button onClick={() => setMois(m => decalerMois(m, -1))} className="p-2 rounded-xl hover:bg-gray-100">
            <ChevronLeft size={20} className="text-gray-500" />
          </button>
          <p className="font-bold text-nc-blue capitalize">{moisFR(mois)}{!moisTermine && <span className="text-xs font-medium text-amber-600"> · en cours</span>}</p>
          <button onClick={() => setMois(m => decalerMois(m, 1))} disabled={mois >= moisCourant()}
            className="p-2 rounded-xl hover:bg-gray-100 disabled:opacity-30">
            <ChevronRight size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Synthèse */}
        <div className="grid grid-cols-3 gap-3 text-center bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div>
            <p className="text-lg font-black text-nc-blue">{chf(totalAFacturer)}</p>
            <p className="text-[10px] text-gray-500">à facturer (HT)</p>
          </div>
          <div>
            <p className="text-lg font-black text-gray-500">{chf(totalReporte)}</p>
            <p className="text-[10px] text-gray-500">reporté (sous le seuil)</p>
          </div>
          <div>
            <p className="text-lg font-black" style={{ color: nbNonCloturees > 0 ? '#F59E0B' : '#22C55E' }}>{nbNonCloturees}</p>
            <p className="text-[10px] text-gray-500">relevé{nbNonCloturees > 1 ? 's' : ''} non clôturé{nbNonCloturees > 1 ? 's' : ''}</p>
          </div>
        </div>

        {lignes.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">Aucune entreprise n'a d'équipe sur ce chantier.</p>
        )}

        {lignes.map(l => (
          <CarteEntreprise
            key={l.ent.id}
            ligne={l}
            mois={mois}
            moisTermine={moisTermine}
            chantierId={chantier.id}
            auteur={utilisateur ? `${utilisateur.prenom ?? ''} ${utilisateur.nom ?? ''}`.trim() || null : null}
            ouverte={ouverte === l.ent.id}
            onToggle={() => setOuverte(ouverte === l.ent.id ? null : l.ent.id)}
            onChange={load}
            onCSV={() => exporterCSV(l)}
            onPrint={() => setAImprimer(l.ent.id)}
          />
        ))}
      </div>

      {/* ── Relevé imprimable (visible uniquement à l'impression) ── */}
      {imprime?.releve && imprime.tarif && (
        <div className="hidden print:block p-8 text-sm text-black">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-xl font-bold">Relevé d'utilisation — Neoclima Field</p>
              <p className="capitalize">{moisFR(mois)} · {chantier.name}</p>
            </div>
            <div className="text-right text-xs">
              <p className="font-bold">Neoclima Sàrl</p>
              <p>Relevé {imprime.cloture ? `clôturé le ${new Date(imprime.cloture.cloture_at).toLocaleDateString('fr-CH')}` : 'provisoire (non clôturé)'}</p>
            </div>
          </div>
          <div className="mb-4">
            <p className="font-bold">{imprime.ent.raison_sociale || imprime.ent.name}</p>
            {imprime.ent.adresse && <p>{imprime.ent.adresse}</p>}
            {imprime.ent.npa_localite && <p>{imprime.ent.npa_localite}</p>}
            {imprime.ent.contact_nom && <p>À l'attention de {imprime.ent.contact_nom}</p>}
          </div>
          <p className="mb-3 text-xs">
            Tarif : {chf(Number(imprime.tarif.prix_jour))} par {imprime.tarif.unite === 'monteur' ? 'monteur présent' : 'équipe présente'} et par jour
            {imprime.tarif.plafond_jours_mois != null && <> · plafond {imprime.tarif.plafond_jours_mois} jours facturés par équipe et par mois</>}
            {imprime.tarif.degressif_seuil != null && imprime.tarif.degressif_prix != null &&
              <> · {chf(Number(imprime.tarif.degressif_prix))} au-delà de {imprime.tarif.degressif_seuil} unités par jour</>}
            . Base : présents validés par le chef de chantier.
          </p>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-black text-left">
                <th className="py-1">Date</th><th>Équipes (présents)</th>
                <th className="text-right">Unités</th><th className="text-right">Montant HT</th>
              </tr>
            </thead>
            <tbody>
              {imprime.releve.jours.map(j => (
                <tr key={j.date} className="border-b border-gray-300">
                  <td className="py-1">{jourFR(j.date)}</td>
                  <td>{j.equipes.map(e => `${e.equipe_nom} (${e.presents})${e.facture ? '' : ' — offert'}`).join(' · ')}</td>
                  <td className="text-right">{j.unites}</td>
                  <td className="text-right">{chf(j.montant)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 ml-auto w-64 text-sm">
            <div className="flex justify-between"><span>Total du mois ({imprime.releve.unites} unités)</span><span>{chf(imprime.releve.montant_mois)}</span></div>
            {imprime.releve.report_anterieur > 0 &&
              <div className="flex justify-between"><span>Report antérieur</span><span>{chf(imprime.releve.report_anterieur)}</span></div>}
            <div className="flex justify-between font-bold border-t-2 border-black mt-1 pt-1"><span>Total HT</span><span>{chf(imprime.releve.total)}</span></div>
          </div>
          {imprime.releve.statut === 'reporte' && (
            <p className="mt-3 text-xs">Montant inférieur au seuil de facturation : reporté sur le relevé suivant.</p>
          )}
          <p className="mt-6 text-[10px] text-gray-600">Ce relevé est une pièce justificative, pas une facture. Montants hors TVA.</p>
        </div>
      )}
    </>
  )
}

// ── Carte d'une entreprise ──────────────────────────────────

interface Ligne {
  ent: Entreprise
  tarif: TarifFacturation | undefined
  tarifActuel: TarifFacturation | undefined
  cloture: ReleveFacturation | undefined
  releve: Releve | null
  sansPresents: { date: string; equipe: string; origine: string }[]
  moisAttendu: string | null
  peutRouvrir: boolean
}

function CarteEntreprise({ ligne, mois, moisTermine, chantierId, auteur, ouverte, onToggle, onChange, onCSV, onPrint }: {
  ligne: Ligne; mois: string; moisTermine: boolean; chantierId: string; auteur: string | null
  ouverte: boolean; onToggle: () => void; onChange: () => void; onCSV: () => void; onPrint: () => void
}) {
  const { ent, tarif, tarifActuel, cloture, releve, sansPresents, moisAttendu, peutRouvrir } = ligne
  const [bt, setBt] = useState<BrouillonTarif>(versBrouillon(tarifActuel))
  const [fiche, setFiche] = useState({
    raison_sociale: ent.raison_sociale ?? '', adresse: ent.adresse ?? '', npa_localite: ent.npa_localite ?? '',
    contact_nom: ent.contact_nom ?? '', contact_email: ent.contact_email ?? '',
  })
  const [occupe, setOccupe] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [confirmer, setConfirmer] = useState(false)

  const facturable = !!tarif?.facturable
  const champ = 'w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-nc-blue'

  const agir = async (nom: string, fn: () => Promise<unknown>) => {
    setOccupe(nom); setErreur(null)
    try { await fn(); onChange() }
    catch (e) { setErreur(e instanceof Error ? e.message : String(e)) }
    finally { setOccupe(null); setConfirmer(false) }
  }

  const sauverTarif = () => agir('tarif', () => {
    const prix = num(bt.prix_jour)
    if (prix == null || prix < 0) throw new Error('Prix par jour invalide')
    const seuilD = num(bt.degressif_seuil), prixD = num(bt.degressif_prix)
    if ((seuilD == null) !== (prixD == null)) throw new Error('Dégressif : renseigner le seuil ET le prix, ou laisser les deux vides')
    return upsertTarif({
      entreprise_id: ent.id, chantier_id: chantierId,
      facturable: bt.facturable, unite: bt.unite, prix_jour: prix,
      plafond_jours_mois: num(bt.plafond_jours_mois) == null ? null : Math.round(num(bt.plafond_jours_mois)!),
      degressif_seuil: seuilD == null ? null : Math.round(seuilD), degressif_prix: prixD,
      seuil_facturation: num(bt.seuil_facturation) ?? 0,
      date_debut: bt.date_debut || null,
    })
  })

  const sauverFiche = () => agir('fiche', () => upsertEntreprise({
    ...ent,
    raison_sociale: fiche.raison_sociale || null, adresse: fiche.adresse || null,
    npa_localite: fiche.npa_localite || null, contact_nom: fiche.contact_nom || null,
    contact_email: fiche.contact_email || null,
  }))

  const cloturer = () => agir('cloture', () => {
    if (!releve || !tarifActuel) throw new Error('Aucun tarif défini')
    const detail: DetailFige = { releve, tarif: tarifActuel }
    return cloturerReleve({
      entreprise_id: ent.id, chantier_id: chantierId, mois, statut: releve.statut,
      unites: releve.unites, montant_mois: releve.montant_mois,
      report_anterieur: releve.report_anterieur, total: releve.total,
      detail, cloture_par: auteur,
    })
  })

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-4 text-left">
        <div className="min-w-0">
          <p className="font-semibold text-nc-blue truncate">{ent.name}</p>
          <p className="text-xs text-gray-500">
            {!tarif ? 'Aucun tarif — non facturée'
              : !tarif.facturable ? 'Non facturable'
              : releve ? `${releve.unites} unité${releve.unites > 1 ? 's' : ''} · ${releve.jours.length} jour${releve.jours.length > 1 ? 's' : ''}` : ''}
            {facturable && releve && releve.non_valides.length > 0 &&
              <span className="text-amber-600 font-medium"> · {releve.non_valides.length} à valider</span>}
            {facturable && sansPresents.length > 0 &&
              <span className="text-red-500 font-medium"> · {sansPresents.length} jour{sansPresents.length > 1 ? 's' : ''} sans présents</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {facturable && releve && (
            <div className="text-right">
              <p className="font-black text-nc-blue text-sm">{chf(releve.total)}</p>
              <p className="text-[10px]" style={{ color: cloture ? '#22C55E' : '#9CA3AF' }}>
                {cloture ? (cloture.statut === 'a_facturer' ? '🔒 à facturer' : '🔒 reporté') : releve.statut === 'reporte' ? 'sous le seuil' : 'provisoire'}
              </p>
            </div>
          )}
          {ouverte ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </div>
      </button>

      {ouverte && (
        <div className="px-4 pb-4 space-y-5 border-t border-gray-100 pt-4">
          {erreur && (
            <div className="flex items-start gap-2 bg-red-50 text-red-700 rounded-xl px-3 py-2 text-sm">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" /><span>{erreur}</span>
            </div>
          )}

          {/* ── Relevé du mois ── */}
          {facturable && releve && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Relevé du mois</p>

              {releve.non_valides.length > 0 && (
                <div className="bg-amber-50 text-amber-800 rounded-xl px-3 py-2 text-xs mb-2">
                  <p className="font-bold mb-0.5">Présents déclarés mais non validés — non facturés en l'état</p>
                  {releve.non_valides.map((n, i) => <p key={i}>{jourFR(n.date)} · {n.equipe_nom} · {n.presents} présent{n.presents > 1 ? 's' : ''}</p>)}
                  <p className="mt-1">À valider par le chef de chantier dans Équipes → Effectifs.</p>
                </div>
              )}
              {sansPresents.length > 0 && (
                <div className="bg-red-50 text-red-700 rounded-xl px-3 py-2 text-xs mb-2">
                  <p className="font-bold mb-0.5">Activité sans présents déclarés</p>
                  {sansPresents.map((s, i) => <p key={i}>{jourFR(s.date)} · {s.equipe} · {s.origine}</p>)}
                </div>
              )}

              {releve.jours.length === 0 ? (
                <p className="text-sm text-gray-400">Aucun présent validé ce mois.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-gray-100">
                        <th className="py-1 font-medium">Date</th><th className="font-medium">Équipes (présents)</th>
                        <th className="text-right font-medium">Unités</th><th className="text-right font-medium">Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {releve.jours.map(j => (
                        <tr key={j.date} className="border-b border-gray-50">
                          <td className="py-1 whitespace-nowrap text-gray-600">{jourFR(j.date)}</td>
                          <td className="text-gray-600">
                            {j.equipes.map((e, i) => (
                              <span key={e.equipe_id} className={e.facture ? '' : 'text-gray-400 line-through'}>
                                {i > 0 && ' · '}{e.equipe_nom} ({e.presents})
                              </span>
                            ))}
                          </td>
                          <td className="text-right text-gray-600">{j.unites}</td>
                          <td className="text-right font-medium text-nc-blue whitespace-nowrap">{chf(j.montant)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-2 text-sm space-y-0.5">
                <div className="flex justify-between text-gray-600"><span>Total du mois</span><span>{chf(releve.montant_mois)}</span></div>
                {releve.unites_offertes > 0 && (
                  <div className="flex justify-between text-xs text-gray-400"><span>Unités offertes par le plafond</span><span>{releve.unites_offertes}</span></div>
                )}
                {releve.report_anterieur > 0 && (
                  <div className="flex justify-between text-gray-600"><span>Report antérieur</span><span>{chf(releve.report_anterieur)}</span></div>
                )}
                <div className="flex justify-between font-bold text-nc-blue border-t border-gray-100 pt-1">
                  <span>Total HT {releve.statut === 'reporte' && <span className="text-xs font-medium text-gray-400">(sous le seuil → reporté)</span>}</span>
                  <span>{chf(releve.total)}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-3">
                <button onClick={onCSV} className="flex items-center gap-1.5 text-xs font-medium text-nc-blue bg-blue-50 rounded-lg px-3 py-2">
                  <Download size={14} />CSV
                </button>
                <button onClick={onPrint} className="flex items-center gap-1.5 text-xs font-medium text-nc-blue bg-blue-50 rounded-lg px-3 py-2">
                  <Printer size={14} />Imprimer / PDF
                </button>
                {cloture ? (
                  <button onClick={() => confirmer ? agir('rouvrir', () => rouvrirReleve(cloture.id)) : setConfirmer(true)}
                    disabled={occupe != null || !peutRouvrir}
                    title={peutRouvrir ? '' : 'Rouvrir d\'abord les mois clôturés suivants'}
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg px-3 py-2 ml-auto disabled:opacity-40">
                    <Unlock size={14} />{confirmer ? 'Confirmer la réouverture' : 'Rouvrir le mois'}
                  </button>
                ) : (
                  <button onClick={() => confirmer ? cloturer() : setConfirmer(true)}
                    disabled={occupe != null || !moisTermine || moisAttendu != null}
                    title={moisTermine ? '' : 'Le mois doit être terminé'}
                    className="flex items-center gap-1.5 text-xs font-bold text-white bg-nc-red rounded-lg px-3 py-2 ml-auto disabled:opacity-40">
                    <Lock size={14} />
                    {!moisTermine ? 'Clôture en fin de mois'
                      : moisAttendu ? `Clôturer d'abord ${moisFR(moisAttendu)}`
                      : confirmer ? 'Confirmer la clôture' : 'Clôturer le mois'}
                  </button>
                )}
              </div>
              {confirmer && !cloture && (
                <p className="text-[11px] text-gray-500 mt-2">
                  La clôture fige ce relevé et verrouille les présents du mois pour cette entreprise.
                  {releve.non_valides.length > 0 && <b className="text-amber-700"> {releve.non_valides.length} déclaration(s) non validée(s) ne seront pas facturées.</b>}
                </p>
              )}
              {cloture && (
                <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1">
                  <CheckCircle size={12} className="text-green-500" />
                  Clôturé le {new Date(cloture.cloture_at).toLocaleDateString('fr-CH')}{cloture.cloture_par ? ` par ${cloture.cloture_par}` : ''} — tarif et présents figés.
                </p>
              )}
            </div>
          )}

          {/* ── Tarif ── */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Tarif sur ce chantier</p>
            <label className="flex items-center gap-2 text-sm text-nc-blue mb-3">
              <input type="checkbox" checked={bt.facturable} onChange={e => setBt({ ...bt, facturable: e.target.checked })} />
              Entreprise facturable
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-gray-500">Unité
                <select value={bt.unite} onChange={e => setBt({ ...bt, unite: e.target.value as 'monteur' | 'equipe' })} className={champ}>
                  <option value="monteur">Par monteur présent</option>
                  <option value="equipe">Par équipe présente</option>
                </select>
              </label>
              <label className="text-xs text-gray-500">Prix par jour (CHF HT)
                <input inputMode="decimal" value={bt.prix_jour} onChange={e => setBt({ ...bt, prix_jour: e.target.value })} className={champ} />
              </label>
              <label className="text-xs text-gray-500">Plafond : jours facturés / équipe / mois
                <input inputMode="numeric" placeholder="vide = aucun" value={bt.plafond_jours_mois} onChange={e => setBt({ ...bt, plafond_jours_mois: e.target.value })} className={champ} />
              </label>
              <label className="text-xs text-gray-500">Seuil de facturation (CHF)
                <input inputMode="decimal" value={bt.seuil_facturation} onChange={e => setBt({ ...bt, seuil_facturation: e.target.value })} className={champ} />
              </label>
              <label className="text-xs text-gray-500">Dégressif : au-delà de N unités / jour
                <input inputMode="numeric" placeholder="vide = désactivé" value={bt.degressif_seuil} onChange={e => setBt({ ...bt, degressif_seuil: e.target.value })} className={champ} />
              </label>
              <label className="text-xs text-gray-500">Prix dégressif (CHF HT)
                <input inputMode="decimal" placeholder="vide = désactivé" value={bt.degressif_prix} onChange={e => setBt({ ...bt, degressif_prix: e.target.value })} className={champ} />
              </label>
              <label className="text-xs text-gray-500">Facturer à partir du
                <input type="date" value={bt.date_debut} onChange={e => setBt({ ...bt, date_debut: e.target.value })} className={champ} />
              </label>
            </div>
            <button onClick={sauverTarif} disabled={occupe != null}
              className="mt-3 flex items-center gap-1.5 text-xs font-bold text-white bg-nc-blue rounded-lg px-3 py-2 disabled:opacity-40">
              <Save size={14} />{occupe === 'tarif' ? 'Enregistrement…' : tarifActuel ? 'Enregistrer le tarif' : 'Créer le tarif'}
            </button>
            {cloture && <p className="text-[11px] text-gray-400 mt-1">Le mois affiché est clôturé : un changement de tarif ne s'applique qu'aux mois non clôturés.</p>}
          </div>

          {/* ── Fiche de facturation ── */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Fiche de facturation</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-gray-500 col-span-2">Raison sociale
                <input value={fiche.raison_sociale} placeholder={ent.name} onChange={e => setFiche({ ...fiche, raison_sociale: e.target.value })} className={champ} />
              </label>
              <label className="text-xs text-gray-500">Adresse
                <input value={fiche.adresse} onChange={e => setFiche({ ...fiche, adresse: e.target.value })} className={champ} />
              </label>
              <label className="text-xs text-gray-500">NPA et localité
                <input value={fiche.npa_localite} onChange={e => setFiche({ ...fiche, npa_localite: e.target.value })} className={champ} />
              </label>
              <label className="text-xs text-gray-500">Contact (direction)
                <input value={fiche.contact_nom} onChange={e => setFiche({ ...fiche, contact_nom: e.target.value })} className={champ} />
              </label>
              <label className="text-xs text-gray-500">E-mail
                <input type="email" value={fiche.contact_email} onChange={e => setFiche({ ...fiche, contact_email: e.target.value })} className={champ} />
              </label>
            </div>
            <button onClick={sauverFiche} disabled={occupe != null}
              className="mt-3 flex items-center gap-1.5 text-xs font-bold text-white bg-nc-blue rounded-lg px-3 py-2 disabled:opacity-40">
              <Save size={14} />{occupe === 'fiche' ? 'Enregistrement…' : 'Enregistrer la fiche'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
