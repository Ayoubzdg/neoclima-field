import type { TaskStatus, UserRole } from '@/types/models'

/**
 * MACHINE À ÉTATS UNIQUE des statuts de tâche.
 *
 * Remplace les 3 copies divergentes qui vivaient dans
 * MesTaches, TacheDetail et ZoneTasksView.
 *
 * Workflow :
 *   todo → en_cours → a_controler → done (= VALIDÉ)
 *              ↕ blocked
 *
 * Règles :
 * · Le monteur "termine" → a_controler. Il peut annuler tant
 *   que ce n'est pas validé, mais ne touche jamais à done.
 * · chef / ca / admin valident (a_controler → done), refusent
 *   (a_controler → en_cours) ou dévalident (done → a_controler).
 * · Seul done compte dans l'avancement et le PPC.
 */

// ── Rôles autorisés à valider ────────────────────────────────
export function canValidate(role: UserRole | string | null | undefined): boolean {
  return role === 'chef' || role === 'ca' || role === 'admin'
}

// ── Transition au tap (bouton statut) selon le rôle ─────────
// Retourne null si aucune transition n'est autorisée.
export function nextStatus(current: TaskStatus, role: UserRole | string | null | undefined): TaskStatus | null {
  switch (current) {
    case 'todo':     return 'en_cours'
    case 'en_cours': return 'a_controler'
    case 'blocked':  return 'en_cours'
    case 'a_controler':
      // chef+ : valide · monteur : annule son "terminé"
      return canValidate(role) ? 'done' : 'en_cours'
    case 'done':
      // seul chef+ peut dévalider (retour au contrôle)
      return canValidate(role) ? 'a_controler' : null
    default:
      return null
  }
}

// ── Libellés d'état ──────────────────────────────────────────
export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo:        'À faire',
  en_cours:    'En cours',
  a_controler: 'À contrôler',
  done:        'Validé',
  blocked:     'Bloqué',
}

// ── Libellés d'action (texte du bouton "état suivant") ──────
export function actionLabel(current: TaskStatus, role: UserRole | string | null | undefined): string {
  switch (current) {
    case 'todo':     return 'Démarrer'
    case 'en_cours': return 'Terminer'
    case 'blocked':  return 'Reprendre'
    case 'a_controler':
      return canValidate(role) ? 'Valider les travaux' : 'En attente de contrôle'
    case 'done':
      return canValidate(role) ? 'Remettre à contrôler' : 'Validé ✓'
    default:
      return ''
  }
}

// ── Helpers ─────────────────────────────────────────────────
/** Terminé côté terrain (déclaré ou validé) */
export const isTermine = (s: TaskStatus): boolean => s === 'a_controler' || s === 'done'
/** Compté dans l'avancement / le PPC */
export const isValide = (s: TaskStatus): boolean => s === 'done'

// ── Ordre de tri (priorité d'affichage terrain) ─────────────
export const PRIORITY_ORDER: Record<TaskStatus, number> = {
  blocked:     0,
  en_cours:    1,
  todo:        2,
  a_controler: 3,
  done:        4,
}
