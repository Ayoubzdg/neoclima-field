import type { Task, PpcData, CauseNonCompletion } from '@/types/models'

// ── Calcul PPC côté client ───────────────────────────────────

export function calculerPPC(tasks: Task[]): number | null {
  const engagees = tasks.filter(t => t.engage)
  if (engagees.length === 0) return null
  const completees = engagees.filter(t => t.status === 'done')
  return Math.round((completees.length / engagees.length) * 1000) / 10
}

export function calculerAvancement(tasks: Task[]): number {
  if (tasks.length === 0) return 0
  const done = tasks.filter(t => t.status === 'done').length
  return Math.round((done / tasks.length) * 1000) / 10
}

export function calculerAvancementQte(tasks: Task[]): number {
  const totalPrevu = tasks.reduce((sum, t) => sum + t.qte_prevue, 0)
  if (totalPrevu === 0) return 0
  const totalRealise = tasks.reduce((sum, t) => sum + t.qte_realisee, 0)
  return Math.round((totalRealise / totalPrevu) * 1000) / 10
}

/**
 * Avancement mixte : utilise les quantités quand elles existent,
 * le statut (done=100%) sinon. Idéal pour le dashboard chef.
 *
 * Exemple : tâche "en cours" avec 3/6 zones → 50%, pas 0%.
 */
export function calculerAvancementMixte(tasks: Task[]): number {
  if (tasks.length === 0) return 0
  const totalPoints = tasks.reduce((sum, t) => {
    if (t.qte_prevue > 0) {
      // Tâche avec quantités → proportion réalisée (0..1)
      return sum + Math.min(t.qte_realisee / t.qte_prevue, 1)
    }
    // Tâche sans quantités → 1 si done, 0 sinon
    return sum + (t.status === 'done' ? 1 : 0)
  }, 0)
  return Math.round((totalPoints / tasks.length) * 1000) / 10
}

export function buildPpcData(
  tasksBySemaine: Map<string, Task[]>
): PpcData[] {
  const result: PpcData[] = []

  tasksBySemaine.forEach((tasks, semaine) => {
    const engagees = tasks.filter(t => t.engage)
    const completees = engagees.filter(t => t.status === 'done')
    const ppc = engagees.length > 0
      ? Math.round((completees.length / engagees.length) * 1000) / 10
      : 0

    const causes: Record<CauseNonCompletion, number> = {
      contrainte_non_levee: 0,
      ressource_insuffisante: 0,
      plan_non_disponible: 0,
      autre: 0
    }

    result.push({
      semaine,
      ppc,
      engagees: engagees.length,
      completees: completees.length,
      causes
    })
  })

  return result.sort((a, b) => a.semaine.localeCompare(b.semaine))
}

export function getPpcColor(ppc: number | null): string {
  if (ppc === null) return '#94A3B8'
  if (ppc >= 80) return '#22C55E'
  if (ppc >= 60) return '#F59E0B'
  return '#EF4444'
}

export function getPpcLabel(ppc: number | null): string {
  if (ppc === null) return '—'
  return `${ppc}%`
}
