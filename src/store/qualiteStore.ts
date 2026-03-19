import { create } from 'zustand'
import type { NonConformite, Mesure, NcStatut, NcGravite } from '@/types/models'
import { getNonConformites, upsertNonConformite, getMesures, upsertMesure } from '@/lib/supabase'

interface QualiteState {
  nonConformites: NonConformite[]
  mesures: Mesure[]
  isLoading: boolean
  error: string | null
  filtreStatut: NcStatut | 'all'
  filtreGravite: NcGravite | 'all'

  loadNonConformites: (chantierId: string) => Promise<void>
  loadMesures: (chantierId: string) => Promise<void>
  createNC: (nc: Partial<NonConformite>) => Promise<NonConformite>
  updateNC: (nc: Partial<NonConformite>) => Promise<NonConformite>
  createMesure: (mesure: Partial<Mesure>) => Promise<Mesure>
  setFiltreStatut: (statut: NcStatut | 'all') => void
  setFiltreGravite: (gravite: NcGravite | 'all') => void
}

export const useQualiteStore = create<QualiteState>((set, get) => ({
  nonConformites: [],
  mesures: [],
  isLoading: false,
  error: null,
  filtreStatut: 'all',
  filtreGravite: 'all',

  loadNonConformites: async (chantierId: string) => {
    set({ isLoading: true, error: null })
    try {
      const filters: { statut?: string; gravite?: string } = {}
      const { filtreStatut, filtreGravite } = get()
      if (filtreStatut !== 'all') filters.statut = filtreStatut
      if (filtreGravite !== 'all') filters.gravite = filtreGravite

      const ncs = await getNonConformites(chantierId, filters)
      set({ nonConformites: ncs, isLoading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur chargement NC'
      set({ isLoading: false, error: message })
    }
  },

  loadMesures: async (chantierId: string) => {
    try {
      const mesures = await getMesures(chantierId)
      set({ mesures })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur chargement mesures'
      set({ error: message })
    }
  },

  createNC: async (nc: Partial<NonConformite>) => {
    const created = await upsertNonConformite(nc)
    set(state => ({ nonConformites: [created, ...state.nonConformites] }))
    return created
  },

  updateNC: async (nc: Partial<NonConformite>) => {
    const updated = await upsertNonConformite(nc)
    set(state => ({
      nonConformites: state.nonConformites.map(n => n.id === updated.id ? updated : n)
    }))
    return updated
  },

  createMesure: async (mesure: Partial<Mesure>) => {
    const created = await upsertMesure(mesure)
    set(state => ({ mesures: [created, ...state.mesures] }))
    return created
  },

  setFiltreStatut: (statut) => set({ filtreStatut: statut }),
  setFiltreGravite: (gravite) => set({ filtreGravite: gravite })
}))
