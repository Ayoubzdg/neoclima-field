// ── Utilitaires dates ───────────────────────────────────────

export function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + weeks * 7)
  return d
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function formatDateFR(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-CH', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function formatDateShort(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' })
}

export function formatTime(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })
}

export function getSemaineLabel(semaine: string): string {
  const monday = new Date(semaine)
  const friday = addDays(monday, 4)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  return `S${getISOWeek(monday)} · ${monday.toLocaleDateString('fr-CH', opts)} – ${friday.toLocaleDateString('fr-CH', opts)}`
}

export function getISOWeek(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
}

export function joursRestants(dateBesoin: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateBesoin)
  target.setHours(0, 0, 0, 0)
  return Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function urgenceFromJours(jours: number): 'ok' | 'attention' | 'urgent' | 'retard' {
  if (jours < 0) return 'retard'
  if (jours <= 3) return 'urgent'
  if (jours <= 7) return 'attention'
  return 'ok'
}

export function todayISO(): string {
  return formatDateISO(new Date())
}

export function currentMondayISO(): string {
  return formatDateISO(getMonday(new Date()))
}
