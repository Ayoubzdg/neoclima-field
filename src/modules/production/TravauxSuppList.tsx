import { useEffect, useState, useCallback } from 'react'
import {
  Zap, CheckCircle, XCircle, Clock, Loader2, RefreshCw, HardHat, Briefcase
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { getTravauxSupp, updateTravauxSupp } from '@/lib/supabase'
import { formatDateShort } from '@/utils/dates'
import type { TravauxSupp, TravauxSuppStatut } from '@/types/models'

const STATUT_META: Record<TravauxSuppStatut, { label: string; cls: string }> = {
  signale:   { label: 'Signalé — à analyser',      cls: 'bg-amber-100 text-amber-700' },
  valide_cc: { label: 'Analysé — attente CA',      cls: 'bg-blue-100 text-blue-700' },
  valide_ca: { label: 'Autorisé — à réaliser',     cls: 'bg-green-100 text-green-700' },
  realise:   { label: 'Réalisé',                   cls: 'bg-gray-100 text-gray-500' },
  refuse:    { label: 'Refusé',                    cls: 'bg-red-100 text-red-600' },
}

/**
 * Gestion des travaux supplémentaires.
 * Chef de chantier : analyse (estimation heures) → transmet au CA.
 * CA : autorise ou refuse (motif). Rien ne se réalise sans lui.
 */
export default function TravauxSuppList() {
  const { chantier, role, utilisateur, entrepriseId } = useAuthStore()
  const [items, setItems] = useState<TravauxSupp[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const isCA = role === 'ca' || role === 'admin'
  const isChef = role === 'chef' || isCA
  const isST = role === 'chef_equipe'
  const nom = utilisateur ? `${utilisateur.prenom ?? ''} ${utilisateur.nom ?? ''}`.trim() : null

  const load = useCallback(() => {
    if (!chantier?.id) return
    setIsLoading(true)
    getTravauxSupp(chantier.id)
      .then(all => {
        // Cloisonnement : un chef d'équipe ST ne voit que les
        // signalements de SON entreprise
        setItems(isST && entrepriseId ? all.filter(t => t.entreprise_id === entrepriseId) : all)
      })
      .finally(() => setIsLoading(false))
  }, [chantier?.id, isST, entrepriseId])

  useEffect(() => { load() }, [load])

  const applyUpdate = async (id: string, updates: Partial<TravauxSupp>) => {
    setBusyId(id)
    try {
      const updated = await updateTravauxSupp(id, updates)
      setItems(prev => prev.map(t => t.id === id ? updated : t))
    } finally {
      setBusyId(null)
    }
  }

  const analyserCC = async (t: TravauxSupp) => {
    const h = window.prompt('Estimation en heures (ex: 6) :', t.heures_estimees?.toString() ?? '')
    if (h === null) return
    await applyUpdate(t.id, {
      statut: 'valide_cc',
      heures_estimees: parseFloat(h) || null,
      valide_cc_par: nom,
    })
  }

  const autoriserCA = (t: TravauxSupp) =>
    applyUpdate(t.id, { statut: 'valide_ca', valide_ca_par: nom })

  const refuser = async (t: TravauxSupp) => {
    const motif = window.prompt('Motif du refus (obligatoire) :')
    if (!motif?.trim()) return
    await applyUpdate(t.id, { statut: 'refuse', motif_refus: motif.trim() })
  }

  const marquerRealise = (t: TravauxSupp) =>
    applyUpdate(t.id, { statut: 'realise' })

  const enAttente = items.filter(t => t.statut === 'signale' || t.statut === 'valide_cc')
  const autorises = items.filter(t => t.statut === 'valide_ca')
  const clos = items.filter(t => t.statut === 'realise' || t.statut === 'refuse')

  const Section = ({ title, list }: { title: string; list: TravauxSupp[] }) => (
    list.length === 0 ? null : (
      <div className="mb-5">
        <p className="text-sm font-semibold text-gray-700 mb-2">{title} ({list.length})</p>
        <div className="space-y-3">
          {list.map(t => {
            const meta = STATUT_META[t.statut]
            const busy = busyId === t.id
            return (
              <div key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex gap-3 p-3">
                  {t.photo_url && (
                    <a href={t.photo_url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                      <img src={t.photo_url} alt="Constat" className="w-20 h-20 object-cover rounded-xl border border-gray-100" />
                    </a>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${meta.cls}`}>
                        {meta.label}
                      </span>
                      {t.zone_takt?.name && (
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">📍 {t.zone_takt.name}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 leading-snug">{t.description}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {formatDateShort(t.created_at)} · {t.cree_par ?? t.cree_par_role ?? '?'}
                      {t.heures_estimees != null && <span className="text-nc-blue font-medium"> · ~{t.heures_estimees} h</span>}
                      {t.valide_ca_par && <span> · autorisé par {t.valide_ca_par}</span>}
                      {t.motif_refus && <span className="text-red-500"> · refus : {t.motif_refus}</span>}
                    </p>
                  </div>
                </div>

                {/* Actions selon rôle + statut */}
                {(isChef || (t.statut === 'valide_ca' && (isST || role === 'monteur'))) && t.statut !== 'realise' && t.statut !== 'refuse' && (
                  <div className="border-t border-gray-50 px-3 py-2 flex gap-2 justify-end flex-wrap">
                    {t.statut === 'signale' && isChef && (
                      <>
                        <button onClick={() => refuser(t)} disabled={busy}
                          className="px-2.5 py-1.5 rounded-lg border border-red-200 text-red-500 text-xs font-medium hover:bg-red-50 disabled:opacity-40">
                          <XCircle size={12} className="inline mr-1" />Refuser
                        </button>
                        <button onClick={() => analyserCC(t)} disabled={busy}
                          className="px-3 py-1.5 rounded-lg bg-nc-blue text-white text-xs font-semibold hover:bg-nc-blue/90 disabled:opacity-40">
                          {busy ? <Loader2 size={12} className="inline animate-spin" /> : <HardHat size={12} className="inline mr-1" />}
                          Analyser → transmettre au CA
                        </button>
                      </>
                    )}
                    {t.statut === 'valide_cc' && isCA && (
                      <>
                        <button onClick={() => refuser(t)} disabled={busy}
                          className="px-2.5 py-1.5 rounded-lg border border-red-200 text-red-500 text-xs font-medium hover:bg-red-50 disabled:opacity-40">
                          <XCircle size={12} className="inline mr-1" />Refuser
                        </button>
                        <button onClick={() => autoriserCA(t)} disabled={busy}
                          className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-40">
                          {busy ? <Loader2 size={12} className="inline animate-spin" /> : <Briefcase size={12} className="inline mr-1" />}
                          Autoriser les travaux
                        </button>
                      </>
                    )}
                    {t.statut === 'valide_cc' && !isCA && (
                      <span className="text-[10px] text-gray-400 py-1.5 flex items-center gap-1">
                        <Clock size={11} /> En attente de validation du chargé d'affaires
                      </span>
                    )}
                    {t.statut === 'valide_ca' && (
                      <button onClick={() => marquerRealise(t)} disabled={busy}
                        className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-40">
                        {busy ? <Loader2 size={12} className="inline animate-spin" /> : <CheckCircle size={12} className="inline mr-1" />}
                        Marquer réalisé
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  )

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-nc-blue flex items-center gap-2">
            <Zap size={20} className="text-amber-500" />
            Travaux supplémentaires
          </h2>
          <p className="text-gray-500 text-sm mt-0.5">
            Signalement terrain → analyse chef → validation CA → réalisation
          </p>
        </div>
        <button onClick={load} disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-gray-500 text-xs hover:bg-gray-50">
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </div>

      {isLoading && items.length === 0 ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-nc-red" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Zap size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Aucun travail supplémentaire signalé</p>
          <p className="text-sm mt-1">Les monteurs signalent depuis "Mes tâches" → ⚡ Travail non prévu</p>
        </div>
      ) : (
        <>
          <Section title="En attente" list={enAttente} />
          <Section title="Autorisés — à réaliser" list={autorises} />
          <Section title="Clos" list={clos} />
        </>
      )}
    </div>
  )
}
