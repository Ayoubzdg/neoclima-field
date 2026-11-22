import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { getEquipes, getEffectifs, upsertEffectif, getTasksByChantier } from '@/lib/supabase'
import { todayISO, formatDateFR, getMonday, formatDateISO } from '@/utils/dates'
import type { Equipe, Effectif, ZoneTakt } from '@/types/models'
import { Save, ChevronLeft, ChevronRight, Clock, ChevronDown, ChevronUp, CheckCircle, AlertTriangle } from 'lucide-react'
import VentilationHeures from './VentilationHeures'

export default function Effectifs() {
  const { chantier, role, entrepriseId } = useAuthStore()
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [effectifs, setEffectifs] = useState<Effectif[]>([])
  const [date, setDate] = useState(todayISO())
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  // L'encadrement VALIDE les présents (base de facturation des
  // sous-traitants) ; le terrain ne fait que les proposer.
  const peutValider = role === 'chef' || role === 'ca' || role === 'admin'
  const [localEffectifs, setLocalEffectifs] = useState<Record<string, { prevus: number; presents: number; heures: number }>>({})
  // Équipe dont la ventilation des heures est dépliée
  const [ventilationOuverte, setVentilationOuverte] = useState<string | null>(null)
  // Zones où chaque équipe a des tâches cette semaine (suggestions)
  const [zonesParEquipe, setZonesParEquipe] = useState<Record<string, ZoneTakt[]>>({})

  const semaine = formatDateISO(getMonday(new Date(date)))
  useEffect(() => {
    if (!chantier?.id) return
    getTasksByChantier(chantier.id, { semaine })
      .then(tasks => {
        const map: Record<string, Map<string, ZoneTakt>> = {}
        tasks.forEach(t => {
          if (!t.equipe_id || !t.zone_takt) return
          ;(map[t.equipe_id] ??= new Map()).set(t.zone_takt.id, t.zone_takt)
        })
        setZonesParEquipe(Object.fromEntries(Object.entries(map).map(([k, v]) => [k, [...v.values()]])))
      })
      .catch(() => setZonesParEquipe({}))
  }, [chantier?.id, semaine])

  useEffect(() => {
    if (!chantier?.id) return
    setIsLoading(true)
    Promise.all([
      getEquipes(chantier.id),
      getEffectifs(chantier.id, date)
    ]).then(([eqAll, eff]) => {
      // Cloisonnement : un chef d'équipe ST ne déclare que
      // les effectifs de SES équipes
      const eq = role === 'chef_equipe' && entrepriseId
        ? eqAll.filter(e => e.entreprise_id === entrepriseId)
        : eqAll
      setEquipes(eq)
      setEffectifs(eff)
      const local: Record<string, { prevus: number; presents: number; heures: number }> = {}
      eq.forEach(e => {
        const ef = eff.find(x => x.equipe_id === e.id)
        local[e.id] = {
          prevus: ef?.monteurs_prevus ?? 0,
          presents: ef?.monteurs_presents ?? 0,
          heures: ef?.heures_jour ?? 8,
        }
      })
      setLocalEffectifs(local)
    }).finally(() => setIsLoading(false))
  }, [chantier?.id, date, role, entrepriseId])

  const handleSave = async () => {
    if (!chantier?.id) return
    setIsSaving(true)
    setErreur(null)
    try {
      // allSettled : une équipe refusée (mois clôturé, déjà validée)
      // ne doit pas empêcher l'enregistrement des autres
      // Une équipe jamais déclarée et laissée à zéro n'est PAS enregistrée :
      // sinon la validation du chef créerait une ligne « 0 présent validé »
      // qui bloquerait la déclaration du monteur en fin de journée.
      const aEnregistrer = equipes.filter(e =>
        effectifs.some(x => x.equipe_id === e.id)
        || (localEffectifs[e.id]?.presents ?? 0) > 0
        || (localEffectifs[e.id]?.prevus ?? 0) > 0)
      const resultats = await Promise.allSettled(
        aEnregistrer.map(e =>
          upsertEffectif({
            chantier_id: chantier.id,
            equipe_id: e.id,
            date,
            monteurs_prevus: localEffectifs[e.id]?.prevus ?? 0,
            monteurs_presents: localEffectifs[e.id]?.presents ?? 0,
            heures_jour: localEffectifs[e.id]?.heures ?? 8
          })
        )
      )
      const echecs = resultats
        .map((r, i) => r.status === 'rejected'
          ? `${aEnregistrer[i].name} : ${String(r.reason instanceof Error ? r.reason.message : r.reason).replace(/^\[Supabase [^\]]+\]\s*/, '')}`
          : null)
        .filter(Boolean)
      if (echecs.length > 0) setErreur(echecs.join(' · '))
      // Recharger : affiche l'état réel (validé par qui, valeurs conservées)
      setEffectifs(await getEffectifs(chantier.id, date))
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e))
    } finally {
      setIsSaving(false)
    }
  }

  const navigateDate = (days: number) => {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    setDate(d.toISOString().split('T')[0])
  }

  const totalPrevus = Object.values(localEffectifs).reduce((s, e) => s + e.prevus, 0)
  const totalPresents = Object.values(localEffectifs).reduce((s, e) => s + e.presents, 0)

  return (
    <div className="p-4">
      {/* Navigation date */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => navigateDate(-1)} className="p-2 rounded-xl hover:bg-gray-100">
          <ChevronLeft size={20} className="text-gray-500" />
        </button>
        <div className="text-center">
          <h2 className="font-bold text-nc-blue">{formatDateFR(date)}</h2>
          <p className="text-sm text-gray-500">{totalPresents}/{totalPrevus} présents</p>
        </div>
        <button onClick={() => navigateDate(1)} className="p-2 rounded-xl hover:bg-gray-100">
          <ChevronRight size={20} className="text-gray-500" />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {equipes.map(equipe => (
            <div key={equipe.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: equipe.couleur }} />
                <p className="font-semibold text-nc-blue text-sm flex-1 truncate">{equipe.name}</p>
                {(() => {
                  const ef = effectifs.find(x => x.equipe_id === equipe.id)
                  if (!ef) return <span className="text-[10px] text-gray-400">non déclaré</span>
                  if (ef.valide_at) return (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-green-600">
                      <CheckCircle size={12} />validé{ef.valide_par ? ` · ${ef.valide_par}` : ''}
                    </span>
                  )
                  return (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
                      {peutValider ? 'à valider' : 'en attente de validation'}
                    </span>
                  )
                })()}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Prévus</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setLocalEffectifs(prev => ({ ...prev, [equipe.id]: { ...prev[equipe.id], prevus: Math.max(0, (prev[equipe.id]?.prevus ?? 0) - 1) } }))} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-lg font-bold text-gray-600">-</button>
                    <span className="text-2xl font-black text-nc-blue w-8 text-center">{localEffectifs[equipe.id]?.prevus ?? 0}</span>
                    <button onClick={() => setLocalEffectifs(prev => ({ ...prev, [equipe.id]: { ...prev[equipe.id], prevus: (prev[equipe.id]?.prevus ?? 0) + 1 } }))} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-lg font-bold text-gray-600">+</button>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    Présents
                    <span className="text-gray-300"> · h/jour :</span>
                    <input
                      type="number" min="0" max="12" step="0.5"
                      value={localEffectifs[equipe.id]?.heures ?? 8}
                      onChange={e => setLocalEffectifs(prev => ({
                        ...prev,
                        [equipe.id]: { ...prev[equipe.id], heures: parseFloat(e.target.value) || 0 }
                      }))}
                      className="w-12 ml-1 border border-gray-200 rounded px-1 py-0.5 text-xs text-center focus:outline-none"
                    />
                  </p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setLocalEffectifs(prev => ({ ...prev, [equipe.id]: { ...prev[equipe.id], presents: Math.max(0, (prev[equipe.id]?.presents ?? 0) - 1) } }))} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-lg font-bold text-gray-600">-</button>
                    <span className="text-2xl font-black text-nc-blue w-8 text-center">{localEffectifs[equipe.id]?.presents ?? 0}</span>
                    <button onClick={() => setLocalEffectifs(prev => ({ ...prev, [equipe.id]: { ...prev[equipe.id], presents: (prev[equipe.id]?.presents ?? 0) + 1 } }))} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-lg font-bold text-gray-600">+</button>
                  </div>
                </div>
              </div>

              {/* Ventilation des heures par zone */}
              {(() => {
                const loc = localEffectifs[equipe.id]
                const total = (loc?.presents ?? 0) * (loc?.heures ?? 8)
                const ouvert = ventilationOuverte === equipe.id
                if (total <= 0) return null
                return (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => setVentilationOuverte(ouvert ? null : equipe.id)}
                      className="w-full flex items-center justify-between text-sm font-medium text-nc-blue touch-manipulation"
                    >
                      <span className="flex items-center gap-1.5">
                        <Clock size={15} /> Répartir les {total} h par zone
                      </span>
                      {ouvert ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {ouvert && chantier?.id && (
                      <div className="mt-3">
                        <VentilationHeures
                          chantierId={chantier.id}
                          equipeId={equipe.id}
                          date={date}
                          totalHeures={total}
                          zonesSuggerees={zonesParEquipe[equipe.id] ?? []}
                          labelBouton="Enregistrer la répartition"
                          onSaved={() => setVentilationOuverte(null)}
                        />
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          ))}
        </div>
      )}

      {erreur && (
        <div className="flex items-start gap-2 bg-red-50 text-red-700 rounded-xl px-3 py-2 text-sm mt-4">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{erreur}</span>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full btn-primary mt-5 flex items-center justify-center gap-2"
      >
        <Save size={18} />
        {isSaving ? 'Sauvegarde…' : peutValider ? 'Valider les présents du jour' : 'Sauvegarder les effectifs'}
      </button>
      {peutValider && (
        <p className="text-[11px] text-gray-400 text-center mt-2">
          Valider fige les présents de toutes les équipes pour ce jour : le terrain ne peut plus les modifier.
        </p>
      )}
    </div>
  )
}
