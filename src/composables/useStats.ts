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
import { useReminders } from './useReminders'
import { useActiveMode } from './useActiveMode'

/**
 * Returns [startMs, endMs] of the bedtime episode that *starts* on the
 * given calendar date. If the window wraps midnight (start > end), the
 * episode ends on the following day.
 */
function bedtimeEpisodeStarting(
  date: Date,
  startHM: string,
  endHM: string
): [number, number] {
  const [hS, mS] = startHM.split(':').map((v) => parseInt(v, 10) || 0)
  const [hE, mE] = endHM.split(':').map((v) => parseInt(v, 10) || 0)
  const start = new Date(date)
  start.setHours(hS, mS, 0, 0)
  const end = new Date(date)
  end.setHours(hE, mE, 0, 0)
  if (end.getTime() <= start.getTime()) {
    end.setDate(end.getDate() + 1)
  }
  return [start.getTime(), end.getTime()]
}

/**
 * Find first index `i` such that `sorted[i] >= value`. Length if none.
 */
function lowerBound(sorted: ReadonlyArray<number>, value: number): number {
  let lo = 0
  let hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (sorted[mid] < value) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * True if any timestamp in `sorted` falls strictly inside (lo, hi).
 * Boundary hits (== lo or == hi) don't count — those mark the
 * transition into / out of sleep, not "during" sleep.
 */
function hasEntryStrictlyInside(
  sorted: ReadonlyArray<number>,
  lo: number,
  hi: number
): boolean {
  const i = lowerBound(sorted, lo + 1)
  return i < sorted.length && sorted[i] < hi
}

/**
 * Split a raw gap into (awake, sleep) ms. Sleep is the portion of
 * [prevMs, currMs] that fell inside a bedtime episode AND wasn't
 * interrupted by a logged cigarette. Awake is `total - sleep`,
 * clamped to ≥ 0.
 *
 * If the user logged a cigarette strictly inside a bedtime episode,
 * that whole episode is treated as awake — they obviously weren't
 * sleeping through it. `entrySortedMs` is the full ascending list of
 * entry timestamps; without it we don't apply the awake exception.
 *
 * Times are inclusive at start, exclusive at end.
 */
export function splitGapMs(
  prevMs: number,
  currMs: number,
  startHM: string,
  endHM: string,
  entrySortedMs: ReadonlyArray<number> = []
): { awakeMs: number; sleepMs: number } {
  const total = currMs - prevMs
  if (total <= 0) return { awakeMs: total, sleepMs: 0 }
  if (startHM === endHM) return { awakeMs: total, sleepMs: 0 }

  // Iterate every calendar day whose bedtime episode could overlap
  // [prev, curr] — that's from the day before `prev` (in case the
  // wrapping window started yesterday) through the day of `curr`.
  const cursor = new Date(prevMs)
  cursor.setHours(0, 0, 0, 0)
  cursor.setDate(cursor.getDate() - 1)
  const last = new Date(currMs)
  last.setHours(0, 0, 0, 0)

  let sleep = 0
  while (cursor.getTime() <= last.getTime()) {
    const [bs, be] = bedtimeEpisodeStarting(cursor, startHM, endHM)
    const overlapStart = Math.max(bs, prevMs)
    const overlapEnd = Math.min(be, currMs)
    if (overlapEnd > overlapStart) {
      if (!hasEntryStrictlyInside(entrySortedMs, bs, be)) {
        sleep += overlapEnd - overlapStart
      }
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return { awakeMs: Math.max(0, total - sleep), sleepMs: sleep }
}

/**
 * Awake-only convenience over `splitGapMs` — preserved as the
 * original public surface so analytics code (allGapsMs, distributions)
 * stays one-liners.
 */
export function awakeGapMs(
  prevMs: number,
  currMs: number,
  startHM: string,
  endHM: string,
  entrySortedMs: ReadonlyArray<number> = []
): number {
  return splitGapMs(prevMs, currMs, startHM, endHM, entrySortedMs).awakeMs
}

/**
 * Two vape entries within this window count as the same session. Chosen
 * because a real vape session (picking up the device, hitting it a few
 * times, putting it down) rarely lasts more than 5–10 minutes; anything
 * beyond that reads as a new sitting. Cigarette mode ignores this — the
 * session concept is vape-specific but the grouping is timestamp-driven
 * so it stays a pure read-time derivation with no schema change.
 */
const SESSION_GAP_MS = 10 * 60_000

const GAP_BUCKET_DEFS: Array<Pick<GapDistributionBucket, 'key' | 'minMs' | 'maxMs'>> = [
  { key: 'report.gap_buckets.lt_15m',  minMs: 0, maxMs: 15 * 60_000 },
  { key: 'report.gap_buckets.b15_30m', minMs: 15 * 60_000, maxMs: 30 * 60_000 },
  { key: 'report.gap_buckets.b30m_1h', minMs: 30 * 60_000, maxMs: 60 * 60_000 },
  { key: 'report.gap_buckets.b1_3h',   minMs: 60 * 60_000, maxMs: 3 * 60 * 60_000 },
  { key: 'report.gap_buckets.b3_6h',   minMs: 3 * 60 * 60_000, maxMs: 6 * 60 * 60_000 },
  { key: 'report.gap_buckets.gte_6h',  minMs: 6 * 60 * 60_000, maxMs: Number.POSITIVE_INFINITY },
]

export function useStats(data: Ref<AppData>) {
  const reminders = useReminders()
  const activeMode = useActiveMode()

  // Every downstream stat (counts, distributions, gaps, streak) reads
  // from this — flipping the active mode toggle automatically rescopes
  // the dashboard. Untyped pre-v2 entries get the same backfill default
  // as the load-time pass in useStorage, so an older user who never
  // touches the toggle keeps seeing their cigarette history.
  const filteredEntries = computed(() =>
    data.value.entries.filter(
      (e) => (e.type ?? 'cigarette') === activeMode.mode.value
    )
  )

  const sortedEntries = computed(() =>
    [...filteredEntries.value].sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
    )
  )

  // Pre-sorted ms timestamps; the awake-gap calc binary-searches into
  // this to detect smokes that fell inside a bedtime window (= the
  // user was awake through that episode, so its sleep is added back).
  const sortedEntriesMs = computed<number[]>(() =>
    sortedEntries.value.map((e) => new Date(e.time).getTime())
  )

  // Each entry annotated with the *awake* gap (ms) from the chronologically
  // previous entry — bedtime overlap is subtracted so an overnight 10h gap
  // with 8h of sleep counts as 2h, unless the user logged a cigarette
  // inside that bedtime window (then the sleep stays in the gap). First
  // entry overall has gapMs = null.
  const entriesWithGaps = computed<AnnotatedEntry[]>(() => {
    const arr = sortedEntries.value
    const ms = sortedEntriesMs.value
    const { bedtimeStart, bedtimeEnd } = reminders.settings.value
    return arr.map((e, i) => {
      if (i === 0) return { ...e, gapMs: null, sleepMs: null }
      const { awakeMs, sleepMs } = splitGapMs(
        new Date(arr[i - 1].time).getTime(),
        new Date(e.time).getTime(),
        bedtimeStart,
        bedtimeEnd,
        ms
      )
      return { ...e, gapMs: awakeMs, sleepMs }
    })
  })

  const byDay = computed<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    for (const e of filteredEntries.value) {
      map[e.date] = (map[e.date] || 0) + 1
    }
    return map
  })

  const days = computed<string[]>(() =>
    Object.keys(byDay.value).sort().reverse()
  )

  const totalDays = computed(() => days.value.length || 1)
  const totalSmoked = computed(() => filteredEntries.value.length)
  const dailyAvg = computed(
    () => Math.round((totalSmoked.value / totalDays.value) * 10) / 10
  )
  const todayCount = computed(() => byDay.value[getToday()] || 0)

  // Sessions today — count of timestamp clusters where consecutive
  // entries within SESSION_GAP_MS collapse into one. Used in vape mode
  // to render "N puffs · M sessions" inline under the pod-life ring.
  // For cigarettes each entry is a session of 1, which happens to be
  // the correct answer for the cigarette case too even though the UI
  // never surfaces it.
  const sessionsToday = computed<number>(() => {
    const today = getToday()
    const times: number[] = []
    for (const e of sortedEntries.value) {
      if (e.date === today) times.push(new Date(e.time).getTime())
    }
    if (times.length === 0) return 0
    let count = 1
    for (let i = 1; i < times.length; i++) {
      if (times[i] - times[i - 1] > SESSION_GAP_MS) count++
    }
    return count
  })

  // Average puffs per session today. 0 when no sessions logged. Used in
  // the vape stats grid to swap "Daily avg" (per-day) for the more
  // vape-native "Avg session" (per-session) number.
  const avgPuffsPerSession = computed<number>(() => {
    const s = sessionsToday.value
    if (s === 0) return 0
    return Math.round((todayCount.value / s) * 10) / 10
  })

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

  // Awake gaps between distinct smoking events. Sleep overlap is removed
  // (so an overnight 10h gap with 8h sleep counts as 2h) — except when
  // a cigarette was logged inside that bedtime window, in which case
  // the sleep stays in the gap. 0ms gaps from batch-logged entries are
  // excluded so min/avg/max aren't skewed.
  const allGapsMs = computed<number[]>(() => {
    const arr = sortedEntries.value
    const ms = sortedEntriesMs.value
    const { bedtimeStart, bedtimeEnd } = reminders.settings.value
    const gaps: number[] = []
    for (let i = 1; i < arr.length; i++) {
      const g = awakeGapMs(
        new Date(arr[i - 1].time).getTime(),
        new Date(arr[i].time).getTime(),
        bedtimeStart,
        bedtimeEnd,
        ms
      )
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
    for (const e of filteredEntries.value) {
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

    for (const e of filteredEntries.value) {
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
    sessionsToday,
    avgPuffsPerSession,
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
