import { computed, ref, onMounted, onUnmounted, type ComputedRef, type Ref } from 'vue'

/**
 * Milestones drawn from CDC / NHS / Surgeon General timelines for what
 * the body does after the last cigarette. Times are in milliseconds
 * from the most recent log.
 *
 * Keep `key` stable — the i18n strings reference these.
 */
const MS = (n: number): number => n
const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

export interface HealthMilestone {
  key: string
  /** ms from last cigarette this milestone unlocks. */
  ms: number
  emoji: string
}

export const MILESTONES: ReadonlyArray<HealthMilestone> = [
  { key: 'pulse',         ms: MS(20 * MIN),  emoji: '💗' },
  { key: 'co',            ms: MS(12 * HOUR), emoji: '🫁' },
  { key: 'taste_smell',   ms: MS(2 * DAY),   emoji: '👃' },
  { key: 'circulation',   ms: MS(14 * DAY),  emoji: '🩸' },
  { key: 'lungs',         ms: MS(30 * DAY),  emoji: '🌬️' },
  { key: 'heart',         ms: MS(365 * DAY), emoji: '❤️' },
  { key: 'stroke',        ms: MS(5 * 365 * DAY), emoji: '🧠' },
]

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
  /** ms since the last cigarette (0 if no entries). */
  elapsedMs: ComputedRef<number>
}

/**
 * Computes per-milestone progress relative to `lastSmokeTime`. A 60s
 * ticker keeps the values fresh so the UI shows progress accruing
 * without burning cycles every frame.
 */
export function useHealthMilestones(
  lastSmokeTime: Ref<string | null | undefined>
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
    return MILESTONES.map((m) => {
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
