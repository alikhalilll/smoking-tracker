export interface SmokeEntry {
  /** Stable client-generated UUID — the sync key. */
  id: string
  /** ISO datetime string */
  time: string
  /** YYYY-MM-DD */
  date: string
}

export interface AppData {
  entries: SmokeEntry[]
  startDate: string
  quitPlan?: QuitPlan
}

export type QuitIntensity = 'quick' | 'standard' | 'gradual' | 'extended'

export interface QuitPlan {
  /** YYYY-MM-DD on which the plan starts (day 0). */
  startDate: string
  /** Daily average at the time the plan was generated. */
  baseline: number
  /** Total number of days in the plan, ending on the quit day (target 0). */
  durationDays: number
  intensity: QuitIntensity
  /** date (YYYY-MM-DD) → target cigarette count for that day. */
  targetsByDate: Record<string, number>
}

export interface QuitDay {
  date: string
  /** Day index, 0-based. */
  dayIndex: number
  target: number
  /** Actual logged count for that date (0 if none). */
  actual: number
  /** 'future' | 'today' | 'past'. */
  when: 'future' | 'today' | 'past'
  /** 'on-track' if actual <= target, 'over' otherwise. null for future days. */
  status: 'on-track' | 'over' | null
}

export interface QuitProgress {
  daysElapsed: number
  daysRemaining: number
  daysOnTrack: number
  daysOver: number
  /** 0..1 percentage of completed days that were on-track. */
  successRate: number
  /** Current streak of consecutive on-track days ending today (or yesterday if today is incomplete). */
  currentStreak: number
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
