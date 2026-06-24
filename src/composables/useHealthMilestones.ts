import { computed, ref, onMounted, onUnmounted, type ComputedRef, type Ref } from 'vue'
import type { EntryType } from '../types'

/**
 * Milestones for what the body does after the last log. Two parallel
 * sets — cigarette numbers come from CDC / NHS / Surgeon General
 * timelines, vape numbers come from Truth Initiative / Johns Hopkins
 * / Mayo Clinic guidance on nicotine and vape cessation. Times are
 * in milliseconds from the most recent log.
 *
 * Keep each `key` stable — the i18n strings live at `health.<key>.label`
 * and `health.<key>.body`.
 */
const MS = (n: number): number => n
const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

export interface HealthMilestone {
  key: string
  /** ms from last log this milestone unlocks. */
  ms: number
  emoji: string
}

export const CIGARETTE_MILESTONES: ReadonlyArray<HealthMilestone> = [
  { key: 'pulse',         ms: MS(20 * MIN),  emoji: '💗' },
  { key: 'co',            ms: MS(12 * HOUR), emoji: '🫁' },
  { key: 'taste_smell',   ms: MS(2 * DAY),   emoji: '👃' },
  { key: 'circulation',   ms: MS(14 * DAY),  emoji: '🩸' },
  { key: 'lungs',         ms: MS(30 * DAY),  emoji: '🌬️' },
  { key: 'heart',         ms: MS(365 * DAY), emoji: '❤️' },
  { key: 'stroke',        ms: MS(5 * 365 * DAY), emoji: '🧠' },
]

// Vape cessation milestones. Vape products primarily deliver nicotine
// (no combustion / tar), so the timeline is centered on nicotine
// withdrawal + clearance and oral/respiratory irritation easing — not
// on cilia / lung-clearing milestones that apply to cigarettes.
export const VAPE_MILESTONES: ReadonlyArray<HealthMilestone> = [
  { key: 'vape_pulse',          ms: MS(20 * MIN),  emoji: '💗' },
  { key: 'vape_nicotine_half',  ms: MS(8 * HOUR),  emoji: '⏳' },
  { key: 'vape_cravings_peak',  ms: MS(1 * DAY),   emoji: '🌀' },
  { key: 'vape_nicotine_clear', ms: MS(3 * DAY),   emoji: '✨' },
  { key: 'vape_taste_throat',   ms: MS(7 * DAY),   emoji: '👅' },
  { key: 'vape_oral',           ms: MS(30 * DAY),  emoji: '🦷' },
  { key: 'vape_lung',           ms: MS(90 * DAY),  emoji: '🌬️' },
]

export function milestonesFor(type: EntryType): ReadonlyArray<HealthMilestone> {
  return type === 'vape' ? VAPE_MILESTONES : CIGARETTE_MILESTONES
}

// Kept exported for any older callers that pull MILESTONES directly.
// New code should use milestonesFor(type) so it stays mode-aware.
export const MILESTONES = CIGARETTE_MILESTONES

export interface MilestoneState extends HealthMilestone {
  /** True once `elapsed >= ms`. */
  reached: boolean
  /** 0..1 progress toward this milestone (1 if reached). */
  progress: number
  /** ms remaining until reached (0 if reached). */
  remainingMs: number
}

export interface UseHealthMilestones {
  /** All milestones with computed state. */
  all: ComputedRef<MilestoneState[]>
  /** The most recently *unlocked* milestone, if any. */
  current: ComputedRef<MilestoneState | null>
  /** The next still-locked milestone, if any. */
  next: ComputedRef<MilestoneState | null>
  /** ms since the last log (0 if no entries). */
  elapsedMs: ComputedRef<number>
}

/**
 * Computes per-milestone progress relative to `lastSmokeTime`. A 60s
 * ticker keeps the values fresh so the UI shows progress accruing
 * without burning cycles every frame.
 *
 * `type` is reactive — swapping the active mode on Home flips the
 * milestone set without remounting.
 */
export function useHealthMilestones(
  lastSmokeTime: Ref<string | null | undefined>,
  type: Ref<EntryType>
): UseHealthMilestones {
  const now = ref(Date.now())
  let timer: ReturnType<typeof setInterval> | null = null
  onMounted(() => {
    timer = setInterval(() => (now.value = Date.now()), 60_000)
  })
  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })

  const elapsedMs = computed<number>(() => {
    const t = lastSmokeTime.value
    if (!t) return 0
    return Math.max(0, now.value - new Date(t).getTime())
  })

  const all = computed<MilestoneState[]>(() => {
    const e = elapsedMs.value
    return milestonesFor(type.value).map((m) => {
      const reached = e >= m.ms
      return {
        ...m,
        reached,
        progress: reached ? 1 : Math.max(0, Math.min(1, e / m.ms)),
        remainingMs: reached ? 0 : m.ms - e,
      }
    })
  })

  const current = computed<MilestoneState | null>(() => {
    const reached = all.value.filter((m) => m.reached)
    return reached.length === 0 ? null : reached[reached.length - 1]
  })

  const next = computed<MilestoneState | null>(
    () => all.value.find((m) => !m.reached) ?? null
  )

  return { all, current, next, elapsedMs }
}
