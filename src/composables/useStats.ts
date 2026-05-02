import { computed, type Ref } from 'vue'
import type {
  AnnotatedEntry,
  AppData,
  DayBucket,
  DayReport,
  GapDistributionBucket,
  GapStats,
  HourBucket,
  WeekdayBucket,
} from '../types'

import { formatLocalDate as formatDate, getToday } from './useDate'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

const GAP_BUCKET_DEFS: Array<Pick<GapDistributionBucket, 'label' | 'minMs' | 'maxMs'>> = [
  { label: '< 15m', minMs: 0, maxMs: 15 * 60_000 },
  { label: '15–30m', minMs: 15 * 60_000, maxMs: 30 * 60_000 },
  { label: '30m–1h', minMs: 30 * 60_000, maxMs: 60 * 60_000 },
  { label: '1–3h', minMs: 60 * 60_000, maxMs: 3 * 60 * 60_000 },
  { label: '3–6h', minMs: 3 * 60 * 60_000, maxMs: 6 * 60 * 60_000 },
  { label: '6h+', minMs: 6 * 60 * 60_000, maxMs: Number.POSITIVE_INFINITY },
]

export function useStats(data: Ref<AppData>) {
  const sortedEntries = computed(() =>
    [...data.value.entries].sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
    )
  )

  // Each entry annotated with the gap (ms) from the chronologically previous
  // entry. First entry overall has gapMs = null.
  const entriesWithGaps = computed<AnnotatedEntry[]>(() => {
    const arr = sortedEntries.value
    return arr.map((e, i) => ({
      ...e,
      gapMs:
        i === 0
          ? null
          : new Date(e.time).getTime() - new Date(arr[i - 1].time).getTime(),
    }))
  })

  const byDay = computed<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    for (const e of data.value.entries) {
      map[e.date] = (map[e.date] || 0) + 1
    }
    return map
  })

  const days = computed<string[]>(() =>
    Object.keys(byDay.value).sort().reverse()
  )

  const totalDays = computed(() => days.value.length || 1)
  const totalSmoked = computed(() => data.value.entries.length)
  const dailyAvg = computed(
    () => Math.round((totalSmoked.value / totalDays.value) * 10) / 10
  )
  const todayCount = computed(() => byDay.value[getToday()] || 0)

  const lastSmoke = computed<string | null>(() => {
    if (sortedEntries.value.length === 0) return null
    return sortedEntries.value[sortedEntries.value.length - 1].time
  })

  const last7 = computed<DayBucket[]>(() => {
    const result: DayBucket[] = []
    for (let i = 6; i >= 0; i--) {
      const d = formatDate(new Date(Date.now() - i * 86_400_000))
      result.push({ date: d, count: byDay.value[d] || 0 })
    }
    return result
  })

  const maxLast7 = computed(() =>
    Math.max(...last7.value.map((d) => d.count), 1)
  )

  const bestDay = computed(() => {
    if (days.value.length === 0) return 0
    return Math.min(...days.value.map((d) => byDay.value[d]))
  })

  // Gaps between distinct smoking events. Excludes 0ms gaps from batch-logged
  // entries so min/avg/max are not skewed.
  const allGapsMs = computed<number[]>(() => {
    const arr = sortedEntries.value
    const gaps: number[] = []
    for (let i = 1; i < arr.length; i++) {
      const g =
        new Date(arr[i].time).getTime() - new Date(arr[i - 1].time).getTime()
      if (g > 0) gaps.push(g)
    }
    return gaps
  })

  const gapStats = computed<GapStats>(() => {
    const gaps = allGapsMs.value
    if (gaps.length === 0) {
      return { avg: 0, longest: 0, shortest: 0, median: 0, count: 0 }
    }
    const sorted = [...gaps].sort((a, b) => a - b)
    const sum = gaps.reduce((s, g) => s + g, 0)
    return {
      avg: sum / gaps.length,
      longest: sorted[sorted.length - 1],
      shortest: sorted[0],
      median: sorted[Math.floor(sorted.length / 2)],
      count: gaps.length,
    }
  })

  // Per-day report, with each row carrying the gap from the chronologically
  // previous log — including the cross-day (overnight) gap on the first row.
  const dayReports = computed<Record<string, DayReport>>(() => {
    const groups: Record<string, AnnotatedEntry[]> = {}
    for (const e of entriesWithGaps.value) {
      if (!groups[e.date]) groups[e.date] = []
      groups[e.date].push(e)
    }
    const reports: Record<string, DayReport> = {}
    for (const date in groups) {
      const entries = groups[date]
      const intraGaps: number[] = entries
        .slice(1)
        .map((e) => e.gapMs)
        .filter((g): g is number => g != null && g > 0)
      const first = entries[0]
      const last = entries[entries.length - 1]
      reports[date] = {
        count: entries.length,
        first: first.time,
        last: last.time,
        activeSpanMs:
          new Date(last.time).getTime() - new Date(first.time).getTime(),
        avgGap:
          intraGaps.length > 0
            ? intraGaps.reduce((s, g) => s + g, 0) / intraGaps.length
            : null,
        longestGap: intraGaps.length > 0 ? Math.max(...intraGaps) : null,
        shortestGap: intraGaps.length > 0 ? Math.min(...intraGaps) : null,
        entries,
      }
    }
    return reports
  })

  // Distribution of all logs across the 24 hours of the day (local time).
  const hourlyDistribution = computed<HourBucket[]>(() => {
    const buckets: HourBucket[] = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      count: 0,
    }))
    for (const e of data.value.entries) {
      const h = new Date(e.time).getHours()
      buckets[h].count++
    }
    return buckets
  })

  // Average logs per weekday (local time). Sun=0..Sat=6.
  const weekdayDistribution = computed<WeekdayBucket[]>(() => {
    const totals = new Array(7).fill(0)
    const dayCounts = new Array(7).fill(0)
    const seenDates = new Set<string>()

    for (const e of data.value.entries) {
      const d = new Date(e.time)
      const wd = d.getDay()
      totals[wd]++
      const key = `${wd}-${e.date}`
      if (!seenDates.has(key)) {
        seenDates.add(key)
        dayCounts[wd]++
      }
    }

    return totals.map((total, wd) => ({
      weekday: wd,
      label: WEEKDAY_LABELS[wd],
      count: dayCounts[wd] === 0 ? 0 : Math.round((total / dayCounts[wd]) * 10) / 10,
    }))
  })

  // Histogram of gap durations (excludes 0ms batch-log gaps).
  const gapDistribution = computed<GapDistributionBucket[]>(() => {
    const buckets: GapDistributionBucket[] = GAP_BUCKET_DEFS.map((b) => ({
      ...b,
      count: 0,
    }))
    for (const g of allGapsMs.value) {
      for (const b of buckets) {
        if (g >= b.minMs && g < b.maxMs) {
          b.count++
          break
        }
      }
    }
    return buckets
  })

  // Last N days of counts (used in the report's daily timeline chart).
  function recentDays(n: number): DayBucket[] {
    const out: DayBucket[] = []
    for (let i = n - 1; i >= 0; i--) {
      const d = formatDate(new Date(Date.now() - i * 86_400_000))
      out.push({ date: d, count: byDay.value[d] || 0 })
    }
    return out
  }

  const last30 = computed<DayBucket[]>(() => recentDays(30))

  // Days since the last logged cigarette (i.e. consecutive smoke-free days
  // ending today). Returns 0 if they smoked today or haven't logged yet.
  const smokeFreeDays = computed<number>(() => {
    if (sortedEntries.value.length === 0) return 0
    const lastDate = sortedEntries.value[sortedEntries.value.length - 1].date
    const today = getToday()
    if (lastDate >= today) return 0
    const a = new Date(lastDate + 'T00:00:00').getTime()
    const b = new Date(today + 'T00:00:00').getTime()
    return Math.round((b - a) / 86_400_000)
  })

  return {
    byDay,
    days,
    totalDays,
    totalSmoked,
    dailyAvg,
    todayCount,
    lastSmoke,
    last7,
    last30,
    maxLast7,
    bestDay,
    gapStats,
    dayReports,
    hourlyDistribution,
    weekdayDistribution,
    gapDistribution,
    smokeFreeDays,
  }
}

import { t, intlLocale } from '../i18n'

export function timeAgo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return t('time_ago.just_now')
  if (mins < 60) return t('time_ago.minutes', { n: mins })
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)
    return t('time_ago.hours_minutes', { h: hrs, m: mins % 60 })
  return t('time_ago.days', { n: Math.floor(hrs / 24) })
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || isNaN(ms)) return t('duration.none')
  if (ms < 1000) return t('duration.seconds', { n: 0 })
  const secs = Math.round(ms / 1000)
  if (secs < 60) return t('duration.seconds', { n: secs })
  const mins = Math.round(ms / 60_000)
  if (mins < 60) return t('duration.minutes', { n: mins })
  const hrs = Math.floor(mins / 60)
  const remM = mins % 60
  if (hrs < 24) {
    return remM > 0
      ? t('duration.hours_minutes', { h: hrs, m: remM })
      : t('duration.hours_only', { h: hrs })
  }
  const days = Math.floor(hrs / 24)
  const remH = hrs % 24
  return remH > 0
    ? t('duration.days_hours', { d: days, h: remH })
    : t('duration.days_only', { d: days })
}

export function formatTime(isoStr: string): string {
  const d = new Date(isoStr)
  // hour12 in both locales — English renders "10:00 PM", Arabic renders
  // "١٠:٠٠ ص / م" via the Arabic numbering system.
  return d.toLocaleTimeString(intlLocale(), {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function getDayLabel(dateStr: string): string {
  const today = getToday()
  const yesterday = formatDate(new Date(Date.now() - 86_400_000))
  if (dateStr === today) return t('history.today')
  if (dateStr === yesterday) return t('history.yesterday')
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString(intlLocale(), {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function getColor(count: number): string {
  if (count > 10) return 'var(--red)'
  if (count > 5) return 'var(--amber)'
  return 'var(--green)'
}
