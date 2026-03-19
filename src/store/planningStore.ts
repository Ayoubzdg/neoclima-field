import { create } from 'zustand'
import type { CycleTakt, WeeklyPlan, Contrainte, ZoneTakt, Secteur } from '@/types/models'
import {
  getCyclesBySemaine, getWeeklyPlan, upsertWeeklyPlan,
  getContraintesUrgentes, getZonesByChantier, getSecteurs,
  upsertCycle
} from '@/lib/supabase'
import { getMonday, addWeeks, formatDateISO } from '@/utils/dates'

interface PlanningState {
  cycles: CycleTakt[]
  weeklyPlan: WeeklyPlan | null
  contraintes: Contrainte[]
  zones: ZoneTakt[]
  secteurs: Secteur[]
  semaineCourante: string
  isLoading: boolean
  error: string | null

  loadPlanning: (chantierId: string, semaine?: string) => Promise<void>
  loadLookahead: (chantierId: string, semaineDebut: string) => Promise<void>
  setSemaine: (semaine: string) => void
  engagerTache: (taskId: string, engaged: boolean) => void
  cloturerSemaine: (chantierId: string, semaine: string) => Promise<void>
  decloturerSemaine: (chantierId: string, semaine: string) => Promise<void>
  upsertCycleLocal: (cycle: Partial<CycleTakt>) => Promise<void>
}

export const usePlanningStore = create<PlanningState>((set, get) => ({
  cycles: [],
  weeklyPlan: null,
  contraintes: [],
  zones: [],
  secteurs: [],
  semaineCourante: formatDateISO(getMonday(new Date())),
  isLoading: false,
  error: null,

  loadPlanning: async (chantierId: string, semaine?: string) => {
    const sem = semaine ?? get().semaineCourante
    set({ isLoading: true, error: null })
    try {
      const [cycles, weeklyPlan, zones, contraintes] = await Promise.all([
        getCyclesBySemaine(chantierId, sem),
        getWeeklyPlan(chantierId, sem),
        getZonesByChantier(chantierId),
        getContraintesUrgentes(chantierId)
      ])
      set({ cycles, weeklyPlan, zones, contraintes, isLoading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur chargement planning'
      set({ isLoading: false, error: message })
    }
  },

  loadLookahead: async (chantierId: string, semaineDebut: string) => {
    set({ isLoading: true })
    try {
      const monday = new Date(semaineDebut)
      const semaines = [0, 1, 2].map(n => formatDateISO(addWeeks(monday, n)))
      const allCycles = await Promise.all(
        semaines.map(s => getCyclesBySemaine(chantierId, s))
      )
      const contraintes = await getContraintesUrgentes(chantierId)
      set({ cycles: allCycles.flat(), contraintes, isLoading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lookahead'
      set({ isLoading: false, error: message })
    }
  },

  setSemaine: (semaine: string) => {
    set({ semaineCourante: semaine })
  },

  engagerTache: (_taskId: string, _engaged: boolean) => {
    // Mis à jour optimiste — géré dans productionStore
  },

  cloturerSemaine: async (chantierId: string, semaine: string) => {
    try {
      const plan = await upsertWeeklyPlan({
        chantier_id: chantierId,
        semaine,
        statut: 'cloture'
      })
      set({ weeklyPlan: plan })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur clôture semaine'
      set({ error: message })
    }
  },

  decloturerSemaine: async (chantierId: string, semaine: string) => {
    try {
      const plan = await upsertWeeklyPlan({
        chantier_id: chantierId,
        semaine,
        statut: 'engage'
      })
      set({ weeklyPlan: plan })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur déclôture semaine'
      set({ error: message })
    }
  },

  upsertCycleLocal: async (cycle: Partial<CycleTakt>) => {
    try {
      const updated = await upsertCycle(cycle)
      set(state => ({
        cycles: state.cycles.some(c => c.id === updated.id)
          ? state.cycles.map(c => c.id === updated.id ? updated : c)
          : [...state.cycles, updated]
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur mise à jour cycle'
      set({ error: message })
    }
  }
}))
