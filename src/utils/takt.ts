import type { ZoneTakt, CycleTakt, Equipe } from '@/types/models'
import { addWeeks, formatDateISO, getMonday } from './dates'

// ── Logique Takt Planning ───────────────────────────────────

export interface TaktCell {
  zone: ZoneTakt
  semaine: string
  cycle: CycleTakt | null
  equipe: Equipe | null
}

export interface TaktFluxData {
  zones: ZoneTakt[]
  semaines: string[]
  cells: Map<string, TaktCell> // key: `${zoneId}-${semaine}`
}

export function buildTaktFlux(
  zones: ZoneTakt[],
  cycles: CycleTakt[],
  equipes: Equipe[],
  nombreSemaines = 8,
  startOffset = -2   // offset en semaines depuis la semaine courante
): TaktFluxData {
  const monday = getMonday(new Date())
  const semaines = Array.from({ length: nombreSemaines }, (_, i) =>
    formatDateISO(addWeeks(monday, startOffset + i))
  )

  const equipeMap = new Map(equipes.map(e => [e.id, e]))
  const cycleMap = new Map(
    cycles.map(c => [`${c.zone_takt_id}-${c.semaine}`, c])
  )

  const cells = new Map<string, TaktCell>()
  for (const zone of zones) {
    for (const semaine of semaines) {
      const key = `${zone.id}-${semaine}`
      const cycle = cycleMap.get(key) ?? null
      const equipe = cycle ? (equipeMap.get(cycle.id) ?? null) : null
      cells.set(key, { zone, semaine, cycle, equipe })
    }
  }

  return { zones, semaines, cells }
}

export function getTaktCellColor(cycle: CycleTakt | null): string {
  if (!cycle) return 'transparent'
  switch (cycle.statut) {
    case 'complete': return '#22C55E'
    case 'en_cours': return '#3B82F6'
    case 'partiel': return '#F59E0B'
    case 'planifie': return '#94A3B8'
    default: return 'transparent'
  }
}

export function getTaktCellBg(cycle: CycleTakt | null): string {
  if (!cycle) return 'bg-transparent'
  switch (cycle.statut) {
    case 'complete': return 'bg-green-100 border-green-400'
    case 'en_cours': return 'bg-blue-100 border-blue-400'
    case 'partiel': return 'bg-yellow-100 border-yellow-400'
    case 'planifie': return 'bg-slate-100 border-slate-300'
    default: return 'bg-transparent'
  }
}

// Calcul du débit théorique
export function calculerDebitTheorique(
  zones: ZoneTakt[],
  taktDuree: number
): string {
  if (zones.length === 0) return '—'
  const totalM2 = zones.reduce((s, z) => s + (z.superficie ?? 0), 0)
  return `${Math.round(totalM2 / zones.length)} m²/takt (${taktDuree}j)`
}
