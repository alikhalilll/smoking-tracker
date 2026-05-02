/**
 * Local-date helpers — never use UTC for the calendar bucket.
 *
 * `new Date().toISOString().split('T')[0]` returns the UTC date, so a 00:30
 * local-time log in Egypt (UTC+2) was getting bucketed under the previous
 * day. Everything that decides "what day is this entry on?" goes through
 * here so logging and stats always agree.
 */

/** Local YYYY-MM-DD for a given Date. */
export function formatLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Today's local YYYY-MM-DD. */
export function getToday(): string {
  return formatLocalDate(new Date())
}

/** Local YYYY-MM-DD for `n` days from today (negative for past). */
export function getDateOffset(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return formatLocalDate(d)
}

/** Days between two local YYYY-MM-DD strings (`to - from`). */
export function daysBetween(from: string, to: string): number {
  const a = new Date(from + 'T00:00:00').getTime()
  const b = new Date(to + 'T00:00:00').getTime()
  return Math.round((b - a) / 86_400_000)
}
