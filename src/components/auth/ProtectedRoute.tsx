import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

interface Props {
  children: React.ReactNode
}

/** Durée de validité d'une session : 12 h */
const SESSION_TTL_MS = 12 * 60 * 60 * 1000

export default function ProtectedRoute({ children }: Props) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const loginAt = useAuthStore(s => s.loginAt)
  const logout = useAuthStore(s => s.logout)

  // Session expirée → déconnexion (re-PIN, ~10 secondes pour l'utilisateur).
  // Avant : la session localStorage était éternelle — un téléphone volé
  // ou un utilisateur désactivé gardait l'accès indéfiniment.
  const expired = isAuthenticated && loginAt != null && Date.now() - loginAt > SESSION_TTL_MS

  useEffect(() => {
    if (expired) logout()
  }, [expired, logout])

  if (!isAuthenticated || expired) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
