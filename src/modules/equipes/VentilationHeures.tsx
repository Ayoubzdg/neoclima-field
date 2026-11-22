import { useEffect, useMemo, useState } from 'react'
import { Clock, Plus, AlertTriangle } from 'lucide-react'
import { getHeuresZone, enregistrerHeuresZone, argsHeuresZone, getZonesByChantier } from '@/lib/supabase'
import { addToSyncQueue } from '@/lib/offline/db'
import { useUiStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import type { HeureCategorie, HeureZoneLigne, ZoneTakt } from '@/types/models'

/**
 * Ventilation des heures du jour d'une équipe.
 *
 * Objectif terrain : 15 secondes. Les zones où l'équipe a des
 * tâches sont proposées d'office ; « + reste » verse d'un tap
 * les heures non réparties sur une ligne.
 *
 * Les heures non productives (attente sur blocage, régie,
 * reprise) sont saisies à part : ce sont elles qui justifient
 * une réclamation ou expliquent un dépassement de budget.
 */

interface Props {
  chantierId: string
  equipeId: string
  date: string
  /** Heures à répartir = présents × heures/jour */
  totalHeures: number
  /** Zones où l'équipe a des tâches (proposées d'office) */
  zonesSuggerees: ZoneTakt[]
  labelBouton?: string
  onSaved: () => void
  /** Affiche un lien « Passer » (wizard de fin de journée) */
  onSkip?: () => void
}

const HORS_PRODUCTION: { categorie: Exclude<HeureCategorie, 'productif'>; label: string; aide: string }[] = [
  { categorie: 'attente', label: 'Attente / blocage', aide: 'équipe à l\'arrêt, pas de sa faute' },
  { categorie: 'regie',   label: 'Régie',             aide: 'travaux supplémentaires commandés' },
  { categorie: 'reprise', label: 'Reprise',           aide: 'travail refait (défaut, modification)' },
]

const fmt = (h: number) => (Math.round(h * 10) / 10).toString().replace('.', ',')

export default function VentilationHeures({
  chantierId, equipeId, date, totalHeures, zonesSuggerees, labelBouton = 'Enregistrer', onSaved, onSkip,
}: Props) {
  const utilisateur = useAuthStore(s => s.utilisateur)

  // Heures productives par zone (zoneId → heures)
  const [parZone, setParZone] = useState<Record<string, number>>({})
  // Heures hors production (catégorie → heures)
  const [hors, setHors] = useState<Record<string, number>>({})
  // Zones affichées = suggérées + déjà saisies + ajoutées à la main
  const [zones, setZones] = useState<ZoneTakt[]>(zonesSuggerees)
  const [toutesZones, setToutesZones] = useState<ZoneTakt[] | null>(null)
  const [showAjout, setShowAjout] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const idsSuggeres = zonesSuggerees.map(z => z.id).join(',')

  // Charger la saisie existante du jour
  useEffect(() => {
    let annule = false
    setIsLoading(true)
    getHeuresZone(equipeId, date)
      .then(async lignes => {
        if (annule) return
        const pz: Record<string, number> = {}
        const h: Record<string, number> = {}
        for (const l of lignes) {
          if (l.categorie === 'productif' && l.zone_takt_id) {
            pz[l.zone_takt_id] = (pz[l.zone_takt_id] ?? 0) + Number(l.heures)
          } else {
            h[l.categorie] = (h[l.categorie] ?? 0) + Number(l.heures)
          }
        }
        // Zones déjà saisies mais absentes des suggestions → les retrouver
        const connues = new Set(zonesSuggerees.map(z => z.id))
        const manquantes = Object.keys(pz).filter(id => !connues.has(id))
        let liste = zonesSuggerees
        if (manquantes.length > 0) {
          const all = await getZonesByChantier(chantierId).catch(() => [] as ZoneTakt[])
          if (annule) return
          setToutesZones(all)
          liste = [...zonesSuggerees, ...all.filter(z => manquantes.includes(z.id))]
        }
        // Première saisie avec une seule zone : tout y est versé d'office
        if (lignes.length === 0 && zonesSuggerees.length === 1 && totalHeures > 0) {
          pz[zonesSuggerees[0].id] = totalHeures
        }
        setZones(liste)
        setParZone(pz)
        setHors(h)
      })
      .catch(() => {
        // Hors ligne ou table absente : on part d'une saisie vierge
        if (!annule) { setZones(zonesSuggerees); setParZone({}); setHors({}) }
      })
      .finally(() => { if (!annule) setIsLoading(false) })
    return () => { annule = true }
    // idsSuggeres résume zonesSuggerees (évite de recharger à chaque rendu)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chantierId, equipeId, date, idsSuggeres])

  const reparti = useMemo(
    () => Object.values(parZone).reduce((s, v) => s + (v || 0), 0)
        + Object.values(hors).reduce((s, v) => s + (v || 0), 0),
    [parZone, hors]
  )
  const reste = Math.round((totalHeures - reparti) * 10) / 10

  const ouvrirAjout = async () => {
    setShowAjout(true)
    if (!toutesZones) {
      const all = await getZonesByChantier(chantierId).catch(() => [] as ZoneTakt[])
      setToutesZones(all)
    }
  }

  const ajouterZone = (id: string) => {
    const z = toutesZones?.find(x => x.id === id)
    if (z && !zones.some(x => x.id === id)) setZones(prev => [...prev, z])
    setShowAjout(false)
  }

  const handleSave = async () => {
    setIsSaving(true)
    setErreur(null)
    const lignes: HeureZoneLigne[] = [
      ...Object.entries(parZone).map(([zone_takt_id, heures]) =>
        ({ zone_takt_id, categorie: 'productif' as HeureCategorie, heures: heures || 0 })),
      ...Object.entries(hors).map(([categorie, heures]) =>
        ({ zone_takt_id: null, categorie: categorie as HeureCategorie, heures: heures || 0 })),
    ].filter(l => l.heures > 0)
    const saisiPar = utilisateur ? `${utilisateur.prenom ?? ''} ${utilisateur.nom ?? ''}`.trim() || null : null

    const mettreEnFile = async () => {
      await addToSyncQueue({
        id: crypto.randomUUID(),
        table_name: 'enregistrer_heures_zone',
        operation: 'rpc',
        record_id: null,
        payload: argsHeuresZone(chantierId, equipeId, date, lignes, saisiPar),
        synced: false,
        created_at: new Date().toISOString(),
      })
      useUiStore.getState().refreshSyncCount()
      useUiStore.getState().addNotification({
        type: 'warning',
        message: 'Heures enregistrées hors ligne — envoi au retour du réseau',
        autoDismiss: true,
      })
    }

    try {
      if (!navigator.onLine) {
        await mettreEnFile()
      } else {
        await enregistrerHeuresZone(chantierId, equipeId, date, lignes, saisiPar)
      }
      onSaved()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (/failed to fetch|networkerror|load failed/i.test(msg)) {
        // Réseau coupé pendant l'envoi → file hors ligne, rien n'est perdu
        await mettreEnFile()
        onSaved()
      } else {
        setErreur(msg)
      }
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    )
  }

  const zonesAjoutables = (toutesZones ?? []).filter(z => !zones.some(x => x.id === z.id))

  return (
    <div className="space-y-4">
      {/* Compteur : réparti / total */}
      <div className={`flex items-center justify-between rounded-xl px-4 py-3
        ${reste === 0 ? 'bg-green-50' : reste < 0 ? 'bg-red-50' : 'bg-amber-50'}`}>
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-nc-blue" />
          <span className="text-sm font-semibold text-nc-blue">{fmt(reparti)} / {fmt(totalHeures)} h réparties</span>
        </div>
        <span className={`text-xs font-bold ${reste === 0 ? 'text-green-600' : reste < 0 ? 'text-red-600' : 'text-amber-700'}`}>
          {reste === 0 ? '✓ complet' : reste > 0 ? `reste ${fmt(reste)} h` : `${fmt(-reste)} h en trop`}
        </span>
      </div>

      {/* Heures productives par zone */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Production par zone</p>
        {zones.length === 0 && (
          <p className="text-sm text-gray-400">Aucune zone proposée — ajoute celle où l'équipe a travaillé.</p>
        )}
        {zones.map(z => (
          <LigneHeures
            key={z.id}
            label={z.name}
            sousLabel={z.secteur?.name ?? null}
            valeur={parZone[z.id] ?? 0}
            reste={reste}
            onChange={v => setParZone(p => ({ ...p, [z.id]: v }))}
          />
        ))}

        {showAjout ? (
          <select
            autoFocus
            defaultValue=""
            onChange={e => e.target.value && ajouterZone(e.target.value)}
            onBlur={() => setShowAjout(false)}
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm bg-white"
          >
            <option value="" disabled>
              {toutesZones ? (zonesAjoutables.length ? 'Choisir une zone…' : 'Aucune autre zone') : 'Chargement…'}
            </option>
            {zonesAjoutables.map(z => (
              <option key={z.id} value={z.id}>
                {z.secteur?.name ? `${z.secteur.name} — ` : ''}{z.name}
              </option>
            ))}
          </select>
        ) : (
          <button
            onClick={ouvrirAjout}
            className="flex items-center gap-1.5 text-sm font-medium text-nc-blue py-2 touch-manipulation"
          >
            <Plus size={16} /> Autre zone
          </button>
        )}
      </div>

      {/* Heures hors production */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Heures hors production</p>
        {HORS_PRODUCTION.map(c => (
          <LigneHeures
            key={c.categorie}
            label={c.label}
            sousLabel={c.aide}
            valeur={hors[c.categorie] ?? 0}
            reste={reste}
            onChange={v => setHors(p => ({ ...p, [c.categorie]: v }))}
          />
        ))}
      </div>

      {erreur && (
        <div className="flex items-start gap-2 bg-red-50 text-red-700 rounded-xl px-3 py-2 text-sm">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <span>Enregistrement impossible : {erreur}</span>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full btn-primary flex items-center justify-center gap-2 h-12"
      >
        {isSaving
          ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          : labelBouton}
      </button>
      {onSkip && (
        <button onClick={onSkip} className="w-full text-sm text-gray-400 py-1 touch-manipulation">
          Passer cette étape
        </button>
      )}
    </div>
  )
}

// ── Ligne : libellé + − [heures] + et raccourci « + reste » ──

function LigneHeures({ label, sousLabel, valeur, reste, onChange }: {
  label: string
  sousLabel: string | null
  valeur: number
  reste: number
  onChange: (v: number) => void
}) {
  const clamp = (v: number) => Math.min(500, Math.max(0, Math.round(v * 2) / 2)) // pas de 0,5 h
  return (
    <div className={`flex items-center gap-2 p-3 rounded-xl border
      ${valeur > 0 ? 'border-nc-blue/30 bg-blue-50/30' : 'border-gray-100 bg-white'}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-nc-blue truncate">{label}</p>
        {sousLabel && <p className="text-xs text-gray-400 truncate">{sousLabel}</p>}
      </div>
      {reste > 0 && (
        <button
          onClick={() => onChange(clamp(valeur + reste))}
          className="text-[11px] font-bold text-amber-700 bg-amber-100 rounded-lg px-2 py-1.5
                     active:scale-90 touch-manipulation flex-shrink-0"
        >
          + reste
        </button>
      )}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onChange(clamp(valeur - 1))}
          className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-lg font-bold
                     text-gray-600 active:scale-90 touch-manipulation"
        >−</button>
        <input
          type="number" inputMode="decimal" min="0" step="0.5"
          value={valeur === 0 ? '' : valeur}
          placeholder="0"
          onChange={e => onChange(clamp(parseFloat(e.target.value.replace(',', '.')) || 0))}
          className="w-12 h-9 text-center font-bold text-nc-blue border border-gray-200 rounded-lg
                     focus:outline-none focus:border-nc-blue"
        />
        <button
          onClick={() => onChange(clamp(valeur + 1))}
          className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-lg font-bold
                     text-gray-600 active:scale-90 touch-manipulation"
        >+</button>
      </div>
    </div>
  )
}
