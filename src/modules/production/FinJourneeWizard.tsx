import { useState, useEffect } from 'react'
import { X, CheckCircle, ChevronRight, Users, Moon } from 'lucide-react'
import type { Task, Equipe, Utilisateur } from '@/types/models'
import { upsertEffectif, getEffectifs } from '@/lib/supabase'
import { todayISO } from '@/utils/dates'
import { useAuthStore } from '@/store/authStore'

interface Props {
  tasks: Task[]
  equipe: Equipe | null
  utilisateur: Utilisateur | null
  onClose: () => void
  onQtyUpdate: (taskId: string, qte: number) => Promise<void>
}

type WizardStep = 'presents' | 'qtys' | 'done'

export default function FinJourneeWizard({ tasks, equipe, onClose, onQtyUpdate }: Props) {
  const { chantier } = useAuthStore()
  const today = todayISO()

  const [step, setStep] = useState<WizardStep>('presents')
  const [presents, setPresents] = useState(1)
  const [prevus, setPrevus] = useState(1)
  const [qtys, setQtys] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    tasks.forEach(t => { map[t.id] = t.qte_realisee })
    return map
  })
  const [isSaving, setIsSaving] = useState(false)

  // Charger les effectifs prévus réels au montage
  useEffect(() => {
    if (!chantier?.id || !equipe?.id) return
    getEffectifs(chantier.id, today).then(effectifs => {
      const eff = effectifs.find(e => e.equipe_id === equipe.id)
      if (eff) {
        setPrevus(eff.monteurs_prevus)
        setPresents(eff.monteurs_presents)
      } else {
        // Pas d'effectif existant : défaut = 1 présent, 1 prévu
        setPrevus(1)
        setPresents(1)
      }
    }).catch(() => { /* silencieux */ })
  }, [chantier?.id, equipe?.id, today])

  const activeTasks = tasks.filter(t => t.status !== 'blocked')

  const handleSavePresents = async () => {
    if (!chantier?.id || !equipe?.id) {
      setStep('qtys')
      return
    }
    try {
      await upsertEffectif({
        chantier_id: chantier.id,
        equipe_id: equipe.id,
        date: today,
        monteurs_presents: presents,
        monteurs_prevus: prevus,
      })
    } catch {
      // Silencieux — pas bloquant
    }
    setStep('qtys')
  }

  const handleSaveQtys = async () => {
    setIsSaving(true)
    try {
      await Promise.all(
        activeTasks.map(t => {
          const newQte = qtys[t.id] ?? t.qte_realisee
          if (newQte !== t.qte_realisee) {
            return onQtyUpdate(t.id, newQte)
          }
          return Promise.resolve()
        })
      )
    } finally {
      setIsSaving(false)
    }
    setStep('done')
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end animate-fade-in">
      <div className="w-full bg-white rounded-t-3xl animate-slide-up max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Moon size={20} className="text-nc-blue" />
            <h3 className="font-bold text-nc-blue">Clôture de journée</h3>
            <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
              {step === 'presents' ? '1/2' : step === 'qtys' ? '2/2' : '✓'}
            </span>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Étape 1 — Présents */}
        {step === 'presents' && (
          <div className="p-5 space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Users size={18} className="text-nc-blue" />
                <p className="font-semibold text-nc-blue">Présents aujourd'hui</p>
              </div>
              <p className="text-sm text-gray-500">Équipe : {equipe?.name ?? '—'}</p>
            </div>

            <div className="flex items-center justify-center gap-6 py-4">
              <button
                onClick={() => setPresents(p => Math.max(0, p - 1))}
                className="w-12 h-12 rounded-2xl bg-gray-100 hover:bg-gray-200 text-2xl font-bold
                           flex items-center justify-center active:scale-90 touch-manipulation"
              >
                −
              </button>
              <div className="text-center">
                <span className="text-5xl font-bold text-nc-blue">{presents}</span>
                <p className="text-sm text-gray-400 mt-1">/ {prevus} prévus</p>
              </div>
              <button
                onClick={() => setPresents(p => p + 1)}
                className="w-12 h-12 rounded-2xl bg-gray-100 hover:bg-gray-200 text-2xl font-bold
                           flex items-center justify-center active:scale-90 touch-manipulation"
              >
                +
              </button>
            </div>

            <button
              onClick={handleSavePresents}
              className="w-full btn-primary flex items-center justify-center gap-2 h-12"
            >
              Suivant
              <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* Étape 2 — Quantités */}
        {step === 'qtys' && (
          <div className="p-5 space-y-4">
            <p className="font-semibold text-nc-blue">Confirmer les quantités réalisées</p>
            <p className="text-sm text-gray-500">Ajustez si nécessaire avant de clôturer.</p>

            <div className="space-y-2">
              {activeTasks.map(task => (
                <div
                  key={task.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border
                    ${task.status === 'done' ? 'border-green-100 bg-green-50/40' : 'border-gray-100 bg-white'}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-nc-blue truncate">{task.label}</p>
                    <p className="text-xs text-gray-400">{task.unite} · prévu: {task.qte_prevue}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => setQtys(q => ({ ...q, [task.id]: Math.max(0, (q[task.id] ?? 0) - 1) }))}
                      className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center
                                 active:scale-90 touch-manipulation text-sm font-bold"
                    >
                      −
                    </button>
                    <span className={`w-8 text-center font-bold text-sm ${
                      (qtys[task.id] ?? task.qte_realisee) > task.qte_prevue
                        ? 'text-amber-600' : 'text-nc-blue'
                    }`}>
                      {qtys[task.id] ?? task.qte_realisee}
                    </span>
                    <button
                      onClick={() => {
                        const cap = Math.max(task.qte_prevue * 2, task.qte_prevue + 20)
                        setQtys(q => ({ ...q, [task.id]: Math.min(cap, (q[task.id] ?? 0) + 1) }))
                      }}
                      className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center
                                 active:scale-90 touch-manipulation text-sm font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
              {activeTasks.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-4">Aucune tâche active</p>
              )}
            </div>

            <button
              onClick={handleSaveQtys}
              disabled={isSaving}
              className="w-full btn-primary flex items-center justify-center gap-2 h-12"
            >
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle size={18} />
                  Clôturer la journée
                </>
              )}
            </button>
          </div>
        )}

        {/* Étape 3 — Confirmation */}
        {step === 'done' && (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle size={32} className="text-green-500" />
            </div>
            <h3 className="font-bold text-nc-blue text-lg">Journée clôturée</h3>
            <p className="text-gray-500 text-sm">
              Présents : {presents} · Tâches synchronisées
            </p>
            <button
              onClick={onClose}
              className="w-full btn-secondary h-11"
            >
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
