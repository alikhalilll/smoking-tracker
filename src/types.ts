export interface SmokeEntry {
  /** ISO datetime string */
  time: string
  /** YYYY-MM-DD */
  date: string
}

export interface AppData {
  entries: SmokeEntry[]
  startDate: string
}

export interface AnnotatedEntry extends SmokeEntry {
  /** Gap in ms from the chronologically previous entry. null only for the very first entry overall. */
  gapMs: number | null
}

export interface DayReport {
  count: number
  first: string
  last: string
  activeSpanMs: number
  avgGap: number | null
  longestGap: number | null
  shortestGap: number | null
  entries: AnnotatedEntry[]
}

export interface GapStats {
  avg: number
  longest: number
  shortest: number
  median: number
  count: number
}

export interface DayBucket {
  date: string
  count: number
}

export interface HourBucket {
  hour: number
  count: number
}

export interface WeekdayBucket {
  weekday: number
  label: string
  count: number
}

export interface GapDistributionBucket {
  label: string
  minMs: number
  maxMs: number
  count: number
}
