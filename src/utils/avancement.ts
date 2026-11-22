import type { Task } from '@/types/models'

/**
 * Règles de calcul d'avancement partagées par les dashboards
 * (CA, main-d'œuvre). Une seule définition : deux écrans ne
 * doivent jamais afficher deux avancements différents.
 */

/** 1 équipe = 2 monteurs × 8 h → 1 jour-équipe = 16 h */
export const HEURES_PAR_JOUR_EQUIPE = 16

/** Poids d'une tâche = ses heures prévues (fallback 1 si non chiffrée) */
export const poids = (t: Task) => t.heures_prevues > 0 ? t.heures_prevues : 1

/** Avancement déclaré d'une tâche (0..1) : quantités si chiffrées, sinon statut */
export const pctDeclare = (t: Task) => {
  if (t.qte_prevue > 0) return Math.min(1, t.qte_realisee / t.qte_prevue)
  return (t.status === 'done' || t.status === 'a_controler') ? 1 : 0
}

/** Avancement VALIDÉ (0..1) : seul le statut done compte — base des situations */
export const pctValide = (t: Task) => t.status === 'done' ? 1 : 0

/** Avancement pondéré d'un lot de tâches, en % entier */
export function agreger(tasks: Task[], fn: (t: Task) => number): number {
  const totalW = tasks.reduce((s, t) => s + poids(t), 0)
  if (totalW === 0) return 0
  return Math.round((tasks.reduce((s, t) => s + poids(t) * fn(t), 0) / totalW) * 100)
}
