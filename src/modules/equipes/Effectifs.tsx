import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { getEquipes, getEffectifs, upsertEffectif } from '@/lib/supabase'
import { todayISO, formatDateFR } from '@/utils/dates'
import type { Equipe, Effectif } from '@/types/models'
import { Save, ChevronLeft, ChevronRight } from 'lucide-react'

export default function Effectifs() {
  const { chantier } = useAuthStore()
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [effectifs, setEffectifs] = useState<Effectif[]>([])
  const [date, setDate] = useState(todayISO())
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [localEffectifs, setLocalEffectifs] = useState<Record<string, { prevus: number; presents: number }>>({})

  useEffect(() => {
    if (!chantier?.id) return
    setIsLoading(true)
    Promise.all([
      getEquipes(chantier.id),
      getEffectifs(chantier.id, date)
    ]).then(([eq, eff]) => {
      setEquipes(eq)
      setEffectifs(eff)
      const local: Record<string, { prevus: number; presents: number }> = {}
      eq.forEach(e => {
        const ef = eff.find(x => x.equipe_id === e.id)
        local[e.id] = { prevus: ef?.monteurs_prevus ?? 0, presents: ef?.monteurs_presents ?? 0 }
      })
      setLocalEffectifs(local)
    }).finally(() => setIsLoading(false))
  }, [chantier?.id, date])

  const handleSave = async () => {
    if (!chantier?.id) return
    setIsSaving(true)
    try {
      await Promise.all(
        equipes.map(e =>
          upsertEffectif({
            chantier_id: chantier.id,
            equipe_id: e.id,
            date,
            monteurs_prevus: localEffectifs[e.id]?.prevus ?? 0,
            monteurs_presents: localEffectifs[e.id]?.presents ?? 0
          })
        )
      )
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
                <p className="font-semibold text-nc-blue text-sm">{equipe.name}</p>
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
                  <p className="text-xs text-gray-500 mb-1">Présents</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setLocalEffectifs(prev => ({ ...prev, [equipe.id]: { ...prev[equipe.id], presents: Math.max(0, (prev[equipe.id]?.presents ?? 0) - 1) } }))} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-lg font-bold text-gray-600">-</button>
                    <span className="text-2xl font-black text-nc-blue w-8 text-center">{localEffectifs[equipe.id]?.presents ?? 0}</span>
                    <button onClick={() => setLocalEffectifs(prev => ({ ...prev, [equipe.id]: { ...prev[equipe.id], presents: (prev[equipe.id]?.presents ?? 0) + 1 } }))} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-lg font-bold text-gray-600">+</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full btn-primary mt-5 flex items-center justify-center gap-2"
      >
        <Save size={18} />
        {isSaving ? 'Sauvegarde…' : 'Sauvegarder les effectifs'}
      </button>
    </div>
  )
}
