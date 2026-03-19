import { useAuthStore } from '@/store/authStore'

export function useAuth() {
  const store = useAuthStore()
  return {
    utilisateur: store.utilisateur,
    chantier: store.chantier,
    equipe: store.equipe,
    role: store.role,
    isAuthenticated: store.isAuthenticated,
    isLoading: store.isLoading,
    error: store.error,
    login: store.login,
    logout: store.logout,
    isMonteur: store.role === 'monteur',
    isChef: store.role === 'chef' || store.role === 'ca' || store.role === 'admin',
    isCA: store.role === 'ca' || store.role === 'admin',
    isAdmin: store.role === 'admin',
    chantierId: store.chantier?.id ?? null,
    equipeId: store.equipe?.id ?? null
  }
}
