import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Utilisateur, Chantier, Equipe, UserRole } from '@/types/models'
import { loginWithPin, logoutUser, getChantierById } from '@/lib/supabase'

interface AuthState {
  utilisateur: Utilisateur | null
  chantier: Chantier | null
  equipe: Equipe | null
  role: UserRole | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  // Actions
  login: (codePin: string, chantierId: string) => Promise<boolean>
  logout: () => void
  setChantier: (chantier: Chantier) => void
  clearError: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      utilisateur: null,
      chantier: null,
      equipe: null,
      role: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (codePin: string, chantierId: string) => {
        set({ isLoading: true, error: null })
        try {
          const utilisateur = await loginWithPin(codePin, chantierId)
          if (!utilisateur) {
            set({ isLoading: false, error: 'Code PIN incorrect ou utilisateur inactif' })
            return false
          }

          const chantier = await getChantierById(chantierId)
          if (!chantier) {
            set({ isLoading: false, error: 'Chantier introuvable' })
            return false
          }

          set({
            utilisateur,
            chantier,
            equipe: utilisateur.equipe ?? null,
            role: utilisateur.role,
            isAuthenticated: true,
            isLoading: false,
            error: null
          })
          return true
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Erreur de connexion'
          set({ isLoading: false, error: message })
          return false
        }
      },

      logout: () => {
        logoutUser()
        set({
          utilisateur: null,
          chantier: null,
          equipe: null,
          role: null,
          isAuthenticated: false,
          error: null
        })
      },

      setChantier: (chantier: Chantier) => {
        set({ chantier })
      },

      clearError: () => set({ error: null })
    }),
    {
      name: 'nc-auth',
      // Session persistante 24h
      partialize: (state) => ({
        utilisateur: state.utilisateur,
        chantier: state.chantier,
        equipe: state.equipe,
        role: state.role,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
)

// ── Sélecteurs ──────────────────────────────────────────────

export const selectChantierId = (s: AuthState) => s.chantier?.id ?? null
export const selectEquipeId = (s: AuthState) => s.equipe?.id ?? null
export const selectRole = (s: AuthState) => s.role
export const selectIsMonteur = (s: AuthState) => s.role === 'monteur'
export const selectIsChef = (s: AuthState) => s.role === 'chef' || s.role === 'ca' || s.role === 'admin'
export const selectIsCA = (s: AuthState) => s.role === 'ca' || s.role === 'admin'
