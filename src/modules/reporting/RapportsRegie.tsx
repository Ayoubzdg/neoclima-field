import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  FileSignature, Plus, Printer, Save, Trash2, ArrowLeft, Loader2, ChevronRight
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import {
  getRapportsRegie, getRapportRegie, createRapportRegie, updateRapportRegie,
  getEntrepriseTitulaire
} from '@/lib/supabase'
import { todayISO, formatDateFR } from '@/utils/dates'
import type { RapportRegie, LigneRegie } from '@/types/models'

/* ════════════════════════════════════════════════════════════
   RAPPORTS DE RÉGIE — équivalent numérique du carnet papier
   "Rapport journalier / de régie". Numéro unique automatique,
   éditable à tout moment, imprimable avec double signature.
   ════════════════════════════════════════════════════════════ */

const ligneVide = (): LigneRegie => ({ ref: '', nombre: 1, fonction: 'monteur', heures: 0, heures_supp: 0 })

// ── LISTE ────────────────────────────────────────────────────
export function RegieList() {
  const navigate = useNavigate()
  const { chantier, utilisateur } = useAuthStore()
  const [rapports, setRapports] = useState<RapportRegie[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!chantier?.id) return
    getRapportsRegie(chantier.id).then(setRapports).finally(() => setIsLoading(false))
  }, [chantier?.id])

  const nouveau = async () => {
    if (!chantier?.id || creating) return
    setCreating(true)
    try {
      const nom = utilisateur ? `${utilisateur.prenom ?? ''} ${utilisateur.nom ?? ''}`.trim() : null
      const r = await createRapportRegie({
        chantier_id: chantier.id,
        client: chantier.client ?? null,
        date_rapport: todayISO(),
        lignes: [ligneVide()],
        cree_par: nom,
      })
      navigate(`/reporting/regie/${r.id}`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-nc-blue flex items-center gap-2">
            <FileSignature size={20} className="text-nc-red" />
            Rapports de régie
          </h2>
          <p className="text-gray-500 text-sm">Rapports journaliers numérotés — à faire signer au client</p>
        </div>
        <button onClick={nouveau} disabled={creating}
          className="btn-primary text-sm flex items-center gap-1.5">
          {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          Nouveau
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-nc-red" /></div>
      ) : rapports.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileSignature size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Aucun rapport de régie</p>
          <p className="text-sm mt-1">Crée le premier — le numéro est attribué automatiquement</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rapports.map(r => (
            <button key={r.id} onClick={() => navigate(`/reporting/regie/${r.id}`)}
              className="w-full bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3
                         flex items-center gap-3 text-left hover:bg-blue-50/30 transition-colors">
              <span className="flex-shrink-0 w-14 text-center font-black text-nc-blue text-lg">
                N° {r.numero}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {r.description?.slice(0, 70) || <span className="text-gray-400 italic">Sans description</span>}
                </p>
                <p className="text-xs text-gray-400">
                  {formatDateFR(r.date_rapport)} · {r.lignes.length} ligne{r.lignes.length > 1 ? 's' : ''}
                  {r.cree_par && ` · ${r.cree_par}`}
                </p>
              </div>
              <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── ÉDITEUR + IMPRESSION ─────────────────────────────────────
export function RegieEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { chantier, entrepriseName } = useAuthStore()
  const [r, setR] = useState<RapportRegie | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  // Entreprise titulaire du chantier (ex : ROOS) — c'est elle qui
  // émet le rapport, quel que soit l'utilisateur connecté
  const [titulaire, setTitulaire] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    getRapportRegie(id).then(setR).finally(() => setIsLoading(false))
  }, [id])

  useEffect(() => {
    if (!chantier?.id) return
    getEntrepriseTitulaire(chantier.id).then(setTitulaire)
  }, [chantier?.id])

  const set = (patch: Partial<RapportRegie>) => setR(prev => prev ? { ...prev, ...patch } : prev)

  const setLigne = (i: number, patch: Partial<LigneRegie>) =>
    set({ lignes: r!.lignes.map((l, j) => j === i ? { ...l, ...patch } : l) })

  const demandeurManquant = !r?.demandeur?.trim()

  const save = async () => {
    if (!r) return
    if (demandeurManquant) {
      alert('Le nom du DEMANDEUR est obligatoire (qui a demandé ces travaux ?).')
      return
    }
    setIsSaving(true)
    try {
      await updateRapportRegie(r.id, {
        date_rapport: r.date_rapport,
        client: r.client,
        demandeur: r.demandeur,
        description: r.description,
        lignes: r.lignes,
        materiel: r.materiel,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setIsSaving(false)
    }
  }

  const imprimer = async () => {
    if (demandeurManquant) {
      alert('Impression impossible : le nom du DEMANDEUR est obligatoire.')
      return
    }
    await save()
    window.print()
  }

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-nc-red" /></div>
  if (!r) return <div className="p-4 text-center text-gray-400">Rapport introuvable</div>

  const totalH = r.lignes.reduce((s, l) => s + (l.heures || 0) * (l.nombre || 1), 0)
  const totalHS = r.lignes.reduce((s, l) => s + (l.heures_supp || 0) * (l.nombre || 1), 0)

  return (
    <div className="p-4 max-w-2xl mx-auto print:p-0 print:max-w-none">

      {/* ── Barre d'actions (masquée à l'impression) ── */}
      <div className="flex items-center justify-between mb-4 print:hidden">
        <button onClick={() => navigate('/reporting/regie')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-nc-blue">
          <ArrowLeft size={16} />Rapports
        </button>
        <div className="flex gap-2">
          <button onClick={save} disabled={isSaving}
            className="btn-secondary text-sm flex items-center gap-1.5">
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saved ? 'Enregistré ✓' : 'Enregistrer'}
          </button>
          <button onClick={imprimer} className="btn-primary text-sm flex items-center gap-1.5">
            <Printer size={14} />Imprimer
          </button>
        </div>
      </div>

      {/* ── LE RAPPORT (édition à l'écran, papier à l'impression) ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5
                      print:border-0 print:shadow-none print:rounded-none print:p-2">

        {/* En-tête */}
        <div className="flex justify-between items-start border-b-2 border-nc-blue pb-3 mb-3">
          <div>
            <p className="font-black text-nc-blue text-lg leading-tight uppercase">
              {titulaire ?? entrepriseName ?? 'Entreprise'}
            </p>
            <p className="text-[10px] text-gray-400">Rapport de travaux en régie</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-nc-blue">Rapport journalier / de régie</p>
            <p className="text-2xl font-black text-nc-red">N° {r.numero}</p>
            <input type="date" value={r.date_rapport}
              onChange={e => set({ date_rapport: e.target.value })}
              className="text-sm text-gray-600 text-right border-b border-dashed border-gray-300 outline-none print:border-0" />
          </div>
        </div>

        {/* Chantier / Client / Demandeur */}
        <div className="grid grid-cols-3 gap-4 mb-3">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase">Chantier</p>
            <p className="text-sm font-semibold text-gray-800">{chantier?.name}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase">Client</p>
            <input value={r.client ?? ''} onChange={e => set({ client: e.target.value })}
              placeholder="Nom du client"
              className="text-sm font-semibold text-gray-800 w-full border-b border-dashed border-gray-300 outline-none print:border-0" />
          </div>
          <div>
            <p className={`text-[10px] font-bold uppercase ${demandeurManquant ? 'text-red-500' : 'text-gray-400'}`}>
              Demandeur *
            </p>
            <input value={r.demandeur ?? ''} onChange={e => set({ demandeur: e.target.value })}
              placeholder="Qui a demandé ?"
              className={`text-sm font-semibold text-gray-800 w-full border-b outline-none print:border-0
                ${demandeurManquant ? 'border-red-400 border-solid bg-red-50/50' : 'border-dashed border-gray-300'}`} />
          </div>
        </div>

        {/* Travaux exécutés */}
        <div className="mb-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Travaux exécutés</p>
          <textarea value={r.description ?? ''} onChange={e => set({ description: e.target.value })}
            placeholder="Description des travaux réalisés…" rows={3}
            className="w-full text-sm text-gray-800 border border-gray-200 rounded-lg p-2 resize-none outline-none
                       focus:border-nc-blue print:border-0 print:p-0" />
        </div>

        {/* Tableau ouvriers / heures */}
        <div className="mb-1">
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Ouvriers · Heures</p>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-[10px] text-gray-500 uppercase border-b border-gray-300">
                <th className="text-left py-1 pr-1 w-[34%]">Date / Réf.</th>
                <th className="text-center py-1 w-[10%]">Nbre</th>
                <th className="text-left py-1 px-1">Fonction</th>
                <th className="text-center py-1 w-[13%]">Heures</th>
                <th className="text-center py-1 w-[13%]">H. suppl.</th>
                <th className="w-[6%] print:hidden"></th>
              </tr>
            </thead>
            <tbody>
              {r.lignes.map((l, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-1 pr-1">
                    <input value={l.ref} onChange={e => setLigne(i, { ref: e.target.value })}
                      placeholder="20/03 — P09 démontage"
                      className="w-full outline-none border-b border-dashed border-gray-200 print:border-0" />
                  </td>
                  <td className="py-1 text-center">
                    <input type="number" min={1} value={l.nombre}
                      onChange={e => setLigne(i, { nombre: parseInt(e.target.value) || 1 })}
                      className="w-12 text-center outline-none border-b border-dashed border-gray-200 print:border-0" />
                  </td>
                  <td className="py-1 px-1">
                    <input value={l.fonction} onChange={e => setLigne(i, { fonction: e.target.value })}
                      placeholder="monteur"
                      className="w-full outline-none border-b border-dashed border-gray-200 print:border-0" />
                  </td>
                  <td className="py-1 text-center">
                    <input type="number" min={0} step={0.5} value={l.heures}
                      onChange={e => setLigne(i, { heures: parseFloat(e.target.value) || 0 })}
                      className="w-14 text-center outline-none border-b border-dashed border-gray-200 print:border-0" />
                  </td>
                  <td className="py-1 text-center">
                    <input type="number" min={0} step={0.5} value={l.heures_supp}
                      onChange={e => setLigne(i, { heures_supp: parseFloat(e.target.value) || 0 })}
                      className="w-14 text-center outline-none border-b border-dashed border-gray-200 print:border-0" />
                  </td>
                  <td className="print:hidden text-center">
                    <button onClick={() => set({ lignes: r.lignes.filter((_, j) => j !== i) })}
                      className="text-gray-300 hover:text-red-500 p-1">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
              {/* Totaux */}
              <tr className="font-bold text-nc-blue">
                <td className="py-1.5 text-right pr-2" colSpan={3}>Total</td>
                <td className="py-1.5 text-center">{totalH} h</td>
                <td className="py-1.5 text-center">{totalHS > 0 ? `${totalHS} h` : '—'}</td>
                <td className="print:hidden"></td>
              </tr>
            </tbody>
          </table>
          <button onClick={() => set({ lignes: [...r.lignes, ligneVide()] })}
            className="mt-1 text-xs text-nc-blue flex items-center gap-1 print:hidden">
            <Plus size={13} />Ajouter une ligne
          </button>
        </div>

        {/* Matériel */}
        <div className="mt-3 mb-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">
            Matériel, outils utilisés et transports
          </p>
          <textarea value={r.materiel ?? ''} onChange={e => set({ materiel: e.target.value })}
            placeholder={"1 ensemble de petites fixations\n2 gaines 600 et 1200…"} rows={3}
            className="w-full text-sm text-gray-800 border border-gray-200 rounded-lg p-2 resize-none outline-none
                       focus:border-nc-blue print:border-0 print:p-0" />
        </div>

        {/* Mention légale — validation impérative */}
        <div className="border border-nc-red/40 bg-red-50/40 rounded-lg px-3 py-2 mb-2
                        print:bg-transparent print:rounded-none">
          <p className="text-[10px] leading-snug text-gray-700">
            <b className="text-nc-red">Validation impérative :</b> aucun travail supplémentaire ne peut être
            engagé sans validation préalable du client. La prestation sera effectuée au tarif en régie.
            Le présent rapport atteste de travaux exécutés à la demande du demandeur mentionné ci-dessus
            et vaut reconnaissance des heures et fournitures indiquées.
          </p>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-8 pt-6 mt-2 border-t border-gray-200">
          <div>
            <div className="h-16 border-b border-gray-400" />
            <p className="text-[10px] text-gray-500 mt-1">Signature du client</p>
          </div>
          <div>
            <div className="h-16 border-b border-gray-400" />
            <p className="text-[10px] text-gray-500 mt-1">
              Signature de l'entrepreneur{r.cree_par ? ` — ${r.cree_par}` : ''}
            </p>
          </div>
        </div>

        {/* Pied de page : powered by Neoclima */}
        <div className="flex items-center justify-center gap-1.5 mt-5 pt-2 border-t border-gray-100">
          <span className="text-[9px] text-gray-400">powered by</span>
          <img src="/logo.png" alt="Neoclima" className="h-3.5 w-auto object-contain opacity-60" />
        </div>
      </div>
    </div>
  )
}
