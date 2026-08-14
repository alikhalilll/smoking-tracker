/** What was consumed for this entry. Drives the active-mode filter
 *  across the app (Home / History / stats / economy) so a single user
 *  can log both cigarettes and vape puffs without conflating them. */
export type EntryType = 'cigarette' | 'vape'
export const ALL_ENTRY_TYPES = ['cigarette', 'vape'] as const

/**
 * A vape "consumable" — the physical thing that runs out and gets
 * replaced. Every kind is tracked as "puffs since it started" vs
 * a rated capacity so the same ring geometry works for all four.
 *
 * - pod:        prefilled or refillable cartridge (JUUL / Elf Bar refills)
 * - coil:       replaceable heating element inside a mod's tank
 * - bottle:     bottle of e-liquid that fills the tank
 * - disposable: single-use device with a fixed puff rating
 *
 * A user might have several going at once (mod-and-tank user tracks
 * coil AND bottle; pod user just tracks pods). The `heroConsumable`
 * economy setting picks which one occupies the home-screen ring.
 */
export type ConsumableKind = 'pod' | 'coil' | 'bottle' | 'disposable'
export const ALL_CONSUMABLE_KINDS: ReadonlyArray<ConsumableKind> = [
  'pod',
  'coil',
  'bottle',
  'disposable',
]

export interface SmokeEntry {
  /** Stable client-generated UUID — the sync key. */
  id: string
  /** ISO datetime string */
  time: string
  /** YYYY-MM-DD */
  date: string
  /** 'cigarette' | 'vape'. Backfilled to 'cigarette' on load for
   *  pre-v2 entries that predate the toggle. */
  type: EntryType
  /**
   * True once this entry is confirmed to live on the server. Local-only
   * (offline-created) entries have synced=false until the next push.
   * Optional for backward compatibility with pre-sync local data.
   */
  synced?: boolean
  /**
   * Number of units this entry represents. For vape, one entry = one
   * session and `puffCount` is the puffs taken in that session. For
   * cigarette this is unused (each stick is its own entry). Absent on
   * legacy entries — treat as 1 when summing.
   */
  puffCount?: number
}

export interface AppData {
  entries: SmokeEntry[]
  startDate: string
  quitPlan?: QuitPlan
  /**
   * ms timestamp of the user's most recent explicit plan abandon. Used
   * by sync to keep a stale server row from re-appearing if a pull
   * races with a delete that's still in flight: server rows whose
   * `updated_at` is older than this stamp are treated as stale and
   * deleted instead of pulled back into local state.
   */
  quitPlanClearedAt?: number
  /**
   * Tombstones for entries the user removed locally. Sync uses this to
   * explicitly delete those ids from the server — without it, `pushDiff`
   * would have to *infer* deletions by diffing local vs server, which
   * silently wipes rows that another device just created (the stale
   * device thinks they're server-only and deletes them). Cleared by
   * pushDiff after a successful delete.
   */
  deletedIds?: string[]
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
  /** Which entry type this plan targets. Optional — undefined on
   *  pre-v2 plans, treated as 'cigarette'. The plan card on Home is
   *  hidden when the active mode doesn't match. */
  type?: EntryType
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

export interface LeaderboardEntry {
  user_id: string
  display_name: string
  smoke_free_days: number
  reduction_pct: number
  total_logged: number
  daily_avg: number
  updated_at: string
}

export type LeaderboardMetric = 'smoke_free' | 'reduction'

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
  /** Awake gap in ms from the chronologically previous entry (sleep
   *  overlap subtracted). null only for the very first entry overall. */
  gapMs: number | null
  /** Total sleep ms subtracted from the raw gap when computing
   *  `gapMs`. 0 if the gap didn't intersect a bedtime window or the
   *  user was awake through it. null when `gapMs` is null. */
  sleepMs: number | null
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
  /** Sun=0..Sat=6. The display label is rendered by the consumer
   *  via `Intl.DateTimeFormat({ weekday: 'short' })` so it follows
   *  the active locale instead of being baked in English. */
  weekday: number
  count: number
}

export interface GapDistributionBucket {
  /** Translation key under `report.gap_buckets.*` — the view resolves
   *  it at render time so the label localizes with the app locale. */
  key: string
  minMs: number
  maxMs: number
  count: number
}
