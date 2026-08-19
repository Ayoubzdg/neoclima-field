import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import type { UserRole } from '@/types/models'

interface Props {
  /** Rôles autorisés à voir la route */
  roles: UserRole[]
  children: React.ReactNode
}

/**
 * Garde de route par rôle.
 *
 * Avant : le filtrage par rôle n'existait que dans le menu (liens
 * masqués) — n'importe quel utilisateur connecté pouvait taper
 * /parametres ou /admin dans l'URL. Ce composant BLOQUE la route.
 *
 * NB : la vraie frontière de sécurité reste le serveur (RLS) —
 * ceci empêche l'accès par l'UI, pas par l'API.
 */
export default function RequireRole({ roles, children }: Props) {
  const role = useAuthStore(s => s.role)

  if (!role || !roles.includes(role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
