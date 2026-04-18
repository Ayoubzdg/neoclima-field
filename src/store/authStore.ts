import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Utilisateur, Chantier, Equipe, UserRole, Personne, LoginPersonneResult } from '@/types/models'
import { loginWithPin, logoutUser, getChantierById, loginPersonne as loginPersonneRPC, getEquipes } from '@/lib/supabase'

interface AuthState {
  // ── Session courante ───────────────────────────────────────
  utilisateur: Utilisateur | null
  personne: Personne | null          // Nouveau modèle multi-entreprise
  chantier: Chantier | null
  equipe: Equipe | null
  role: UserRole | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  // Code entreprise mémorisé entre les steps de login
  codeEntrepriseSession: string | null

  // ── Actions ────────────────────────────────────────────────

  // Ancien modèle : login par chantier_id + PIN (utilisateurs table)
  login: (codePin: string, chantierId: string) => Promise<boolean>

  // Nouveau modèle : login multi-entreprise
  // Retourne les chantiers accessibles (0 = erreur, 1 = auto-login, N = sélecteur)
  loginPersonneStep: (codeEntreprise: string, codePin: string) => Promise<LoginPersonneResult[]>
  // Finalise le login une fois le chantier choisi
  loginWithChantier: (result: LoginPersonneResult) => Promise<boolean>

  logout: () => void
  setChantier: (chantier: Chantier) => void
  clearError: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      utilisateur: null,
      personne: null,
      chantier: null,
      equipe: null,
      role: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      codeEntrepriseSession: null,

      // ── Ancien login (chantier list → PIN) ─────────────────
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
            personne: null,
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

      // ── Nouveau login Step 1 : code entreprise + PIN ────────
      loginPersonneStep: async (codeEntreprise: string, codePin: string) => {
        set({ isLoading: true, error: null, codeEntrepriseSession: codeEntreprise })
        try {
          const results = await loginPersonneRPC(codeEntreprise, codePin)
          set({ isLoading: false })

          if (results.length === 0) {
            set({ error: 'Code PIN incorrect ou entreprise introuvable' })
            return []
          }

          // 1 chantier → login automatique
          if (results.length === 1) {
            await get().loginWithChantier(results[0])
          }

          return results
        } catch {
          set({ isLoading: false, error: 'Erreur de connexion' })
          return []
        }
      },

      // ── Nouveau login Step 2 : finaliser avec le chantier ───
      loginWithChantier: async (result: LoginPersonneResult) => {
        set({ isLoading: true, error: null })
        try {
          // Construire un objet Utilisateur compatible avec le reste de l'app
          const utilisateurCompat: Utilisateur = {
            id: result.personne_id,
            chantier_id: result.chantier_id,
            equipe_id: result.equipe_id,
            nom: result.nom,
            prenom: result.prenom,
            role: result.role,
            code_pin: null,
            actif: true,
            created_at: new Date().toISOString()
          }

          // Construire l'objet Personne
          const personne: Personne = {
            id: result.personne_id,
            entreprise_id: '',  // non critique pour la session
            nom: result.nom,
            prenom: result.prenom,
            role: result.role,
            code_pin: null,
            actif: true,
            created_at: new Date().toISOString()
          }

          // Construire l'objet Chantier
          const chantier: Chantier = {
            id: result.chantier_id,
            name: result.chantier_name,
            adresse: null,
            client: result.chantier_client,
            date_debut: null,
            date_fin_prev: null,
            budget_heures: result.chantier_budget_heures,
            takt_duree: result.chantier_takt_duree,
            statut: 'actif',
            created_at: new Date().toISOString()
          }

          // Charger l'équipe si equipe_id fourni
          let equipe: Equipe | null = null
          if (result.equipe_id) {
            try {
              const equipes = await getEquipes(result.chantier_id)
              equipe = equipes.find(e => e.id === result.equipe_id) ?? null
              if (equipe) utilisateurCompat.equipe = equipe
            } catch {
              // non bloquant
            }
          }

          set({
            utilisateur: utilisateurCompat,
            personne,
            chantier,
            equipe,
            role: result.role,
            isAuthenticated: true,
            isLoading: false,
            error: null,
            codeEntrepriseSession: null
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
          personne: null,
          chantier: null,
          equipe: null,
          role: null,
          isAuthenticated: false,
          error: null,
          codeEntrepriseSession: null
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
        personne: state.personne,
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
