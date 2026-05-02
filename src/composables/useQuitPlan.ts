import { computed, type ComputedRef, type Ref } from 'vue'
import type {
  AppData,
  QuitDay,
  QuitIntensity,
  QuitPlan,
  QuitProgress,
} from '../types'

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function getToday(): string {
  return formatDate(new Date())
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return formatDate(d)
}

function daysBetween(fromDate: string, toDate: string): number {
  const from = new Date(fromDate + 'T00:00:00').getTime()
  const to = new Date(toDate + 'T00:00:00').getTime()
  return Math.round((to - from) / 86_400_000)
}

export const INTENSITY_DURATIONS: Record<QuitIntensity, number> = {
  quick: 7,
  standard: 14,
  gradual: 28,
  extended: 50,
}

export const INTENSITY_LABELS: Record<QuitIntensity, string> = {
  quick: 'Quick — 7 days',
  standard: 'Standard — 14 days',
  gradual: 'Gradual — 28 days',
  extended: 'Extended — 50 days',
}

export const INTENSITY_BLURBS: Record<QuitIntensity, string> = {
  quick: 'Steepest taper. For when you want to be done fast.',
  standard: 'Even reduction over two weeks. A solid default.',
  gradual: 'Gentler taper across four weeks.',
  extended: 'Slowest taper — small daily steps over almost two months.',
}

/**
 * Linear taper from baseline → 0 across `durationDays` days. Day 0 is the
 * starting day (target close to baseline), the last day is the quit day
 * (target = 0).
 */
export function generateTargets(
  baseline: number,
  durationDays: number,
  startDate: string
): Record<string, number> {
  const targets: Record<string, number> = {}
  const safeBaseline = Math.max(1, Math.round(baseline))
  const span = Math.max(1, durationDays - 1)
  for (let i = 0; i < durationDays; i++) {
    const raw = safeBaseline * (1 - i / span)
    targets[addDays(startDate, i)] = Math.max(0, Math.round(raw))
  }
  return targets
}

export interface UseQuitPlan {
  plan: ComputedRef<QuitPlan | null>
  isActive: ComputedRef<boolean>
  isComplete: ComputedRef<boolean>
  todayTarget: ComputedRef<number | null>
  todayActual: ComputedRef<number>
  todayStatus: ComputedRef<'on-track' | 'over' | null>
  planDays: ComputedRef<QuitDay[]>
  progress: ComputedRef<QuitProgress | null>
  suggestedBaseline: ComputedRef<number>
}

export function useQuitPlan(
  data: Ref<AppData>,
  byDay: ComputedRef<Record<string, number>>,
  dailyAvg: ComputedRef<number>
): UseQuitPlan {
  const plan = computed<QuitPlan | null>(() => data.value.quitPlan ?? null)

  const isActive = computed(() => plan.value !== null)

  const planDays = computed<QuitDay[]>(() => {
    const p = plan.value
    if (!p) return []
    const today = getToday()
    const out: QuitDay[] = []
    for (let i = 0; i < p.durationDays; i++) {
      const date = addDays(p.startDate, i)
      const target = p.targetsByDate[date] ?? 0
      const actual = byDay.value[date] ?? 0
      const cmp = date < today ? 'past' : date > today ? 'future' : 'today'
      const status: 'on-track' | 'over' | null =
        cmp === 'future' ? null : actual <= target ? 'on-track' : 'over'
      out.push({ date, dayIndex: i, target, actual, when: cmp, status })
    }
    return out
  })

  const isComplete = computed(() => {
    const p = plan.value
    if (!p) return false
    const today = getToday()
    const lastDate = addDays(p.startDate, p.durationDays - 1)
    return today > lastDate
  })

  const todayTarget = computed<number | null>(() => {
    const p = plan.value
    if (!p) return null
    const today = getToday()
    if (today < p.startDate) return null
    return p.targetsByDate[today] ?? null
  })

  const todayActual = computed(() => byDay.value[getToday()] ?? 0)

  const todayStatus = computed<'on-track' | 'over' | null>(() => {
    if (todayTarget.value == null) return null
    return todayActual.value <= todayTarget.value ? 'on-track' : 'over'
  })

  const progress = computed<QuitProgress | null>(() => {
    const p = plan.value
    if (!p) return null
    const today = getToday()
    const elapsedRaw = daysBetween(p.startDate, today)
    const daysElapsed = Math.max(0, Math.min(p.durationDays, elapsedRaw))
    const daysRemaining = Math.max(0, p.durationDays - daysElapsed)
    const completed = planDays.value.filter(
      (d) => d.when === 'past' || d.when === 'today'
    )
    const onTrack = completed.filter((d) => d.status === 'on-track').length
    const over = completed.filter((d) => d.status === 'over').length

    // Current streak: count back from today across consecutive on-track days.
    let streak = 0
    for (let i = completed.length - 1; i >= 0; i--) {
      if (completed[i].status === 'on-track') streak++
      else break
    }

    return {
      daysElapsed,
      daysRemaining,
      daysOnTrack: onTrack,
      daysOver: over,
      successRate: completed.length === 0 ? 0 : onTrack / completed.length,
      currentStreak: streak,
    }
  })

  const suggestedBaseline = computed(() => {
    // Prefer the average of the last 7 logged days; fall back to overall.
    const today = getToday()
    let sum = 0
    let counted = 0
    for (let i = 0; i < 7; i++) {
      const d = addDays(today, -i)
      const v = byDay.value[d]
      if (v != null) {
        sum += v
        counted++
      }
    }
    if (counted >= 3) return Math.max(1, Math.round(sum / counted))
    return Math.max(1, Math.round(dailyAvg.value))
  })

  return {
    plan,
    isActive,
    isComplete,
    todayTarget,
    todayActual,
    todayStatus,
    planDays,
    progress,
    suggestedBaseline,
  }
}
