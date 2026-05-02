import { computed } from 'vue'

function formatDate(d) {
  return d.toISOString().split('T')[0]
}

function getToday() {
  return formatDate(new Date())
}

export function useStats(data) {
  const sortedEntries = computed(() =>
    [...data.value.entries].sort(
      (a, b) => new Date(a.time) - new Date(b.time)
    )
  )

  // Each entry annotated with the gap (ms) from the previous entry,
  // chronologically. First entry has gapMs = null.
  const entriesWithGaps = computed(() => {
    const arr = sortedEntries.value
    return arr.map((e, i) => ({
      ...e,
      gapMs:
        i === 0 ? null : new Date(e.time) - new Date(arr[i - 1].time),
    }))
  })

  const byDay = computed(() => {
    const map = {}
    data.value.entries.forEach((e) => {
      map[e.date] = (map[e.date] || 0) + 1
    })
    return map
  })

  const days = computed(() => Object.keys(byDay.value).sort().reverse())

  const totalDays = computed(() => days.value.length || 1)
  const totalSmoked = computed(() => data.value.entries.length)
  const dailyAvg = computed(
    () => Math.round((totalSmoked.value / totalDays.value) * 10) / 10
  )
  const todayCount = computed(() => byDay.value[getToday()] || 0)

  const lastSmoke = computed(() => {
    if (sortedEntries.value.length === 0) return null
    return sortedEntries.value[sortedEntries.value.length - 1].time
  })

  const last7 = computed(() => {
    const result = []
    for (let i = 6; i >= 0; i--) {
      const d = formatDate(new Date(Date.now() - i * 86400000))
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

  // Gaps between distinct smoking events. Multiple entries logged at the
  // exact same timestamp (batch-logged) count as one event for gap purposes,
  // so a 0ms gap doesn't pollute the stats.
  const allGapsMs = computed(() => {
    const arr = sortedEntries.value
    const gaps = []
    for (let i = 1; i < arr.length; i++) {
      const g = new Date(arr[i].time) - new Date(arr[i - 1].time)
      if (g > 0) gaps.push(g)
    }
    return gaps
  })

  const gapStats = computed(() => {
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

  // Per-day report: first/last time, intra-day gap stats, and the full
  // annotated entry list. Each entry carries its gap from the chronologically
  // previous log — so the first entry of a day shows the cross-day (overnight)
  // gap from the previous day's last log. Only the very first log overall has
  // gapMs = null.
  const dayReports = computed(() => {
    const groups = {}
    entriesWithGaps.value.forEach((e) => {
      if (!groups[e.date]) groups[e.date] = []
      groups[e.date].push(e)
    })
    const reports = {}
    for (const date in groups) {
      const entries = groups[date]
      // Intra-day gaps: skip the first entry (its gap is cross-day) and
      // skip 0ms gaps from batch-logged entries so day stats stay meaningful.
      const intraGaps = entries
        .slice(1)
        .map((e) => e.gapMs)
        .filter((g) => g != null && g > 0)
      const first = entries[0]
      const last = entries[entries.length - 1]
      reports[date] = {
        count: entries.length,
        first: first.time,
        last: last.time,
        activeSpanMs: new Date(last.time) - new Date(first.time),
        avgGap:
          intraGaps.length > 0
            ? intraGaps.reduce((s, g) => s + g, 0) / intraGaps.length
            : null,
        longestGap:
          intraGaps.length > 0 ? Math.max(...intraGaps) : null,
        shortestGap:
          intraGaps.length > 0 ? Math.min(...intraGaps) : null,
        entries,
      }
    }
    return reports
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
    maxLast7,
    bestDay,
    gapStats,
    dayReports,
  }
}

export function timeAgo(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function formatDuration(ms) {
  if (ms == null || isNaN(ms)) return '—'
  if (ms < 1000) return '0s'
  const secs = Math.round(ms / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  const remM = mins % 60
  if (hrs < 24) return remM > 0 ? `${hrs}h ${remM}m` : `${hrs}h`
  const days = Math.floor(hrs / 24)
  const remH = hrs % 24
  return remH > 0 ? `${days}d ${remH}h` : `${days}d`
}

export function formatTime(isoStr) {
  const d = new Date(isoStr)
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function getDayLabel(dateStr) {
  const today = getToday()
  const yesterday = formatDate(new Date(Date.now() - 86400000))
  if (dateStr === today) return 'Today'
  if (dateStr === yesterday) return 'Yesterday'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function getColor(count) {
  if (count > 10) return 'var(--red)'
  if (count > 5) return 'var(--amber)'
  return 'var(--green)'
}
