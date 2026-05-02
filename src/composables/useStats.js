import { computed } from 'vue'

function formatDate(d) {
  return d.toISOString().split('T')[0]
}

function getToday() {
  return formatDate(new Date())
}

export function useStats(data) {
  const byDay = computed(() => {
    const map = {}
    data.value.entries.forEach((e) => {
      map[e.date] = (map[e.date] || 0) + 1
    })
    return map
  })

  const days = computed(() => {
    return Object.keys(byDay.value).sort().reverse()
  })

  const totalDays = computed(() => days.value.length || 1)
  const totalSmoked = computed(() => data.value.entries.length)
  const dailyAvg = computed(() => Math.round((totalSmoked.value / totalDays.value) * 10) / 10)
  const todayCount = computed(() => byDay.value[getToday()] || 0)

  const lastSmoke = computed(() => {
    if (data.value.entries.length === 0) return null
    return data.value.entries[data.value.entries.length - 1].time
  })

  const last7 = computed(() => {
    const result = []
    for (let i = 6; i >= 0; i--) {
      const d = formatDate(new Date(Date.now() - i * 86400000))
      result.push({ date: d, count: byDay.value[d] || 0 })
    }
    return result
  })

  const maxLast7 = computed(() => Math.max(...last7.value.map((d) => d.count), 1))

  const bestDay = computed(() => {
    if (days.value.length === 0) return 0
    return Math.min(...days.value.map((d) => byDay.value[d]))
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

export function getDayLabel(dateStr) {
  const today = getToday()
  const yesterday = formatDate(new Date(Date.now() - 86400000))
  if (dateStr === today) return 'Today'
  if (dateStr === yesterday) return 'Yesterday'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function getColor(count) {
  if (count > 10) return 'var(--red)'
  if (count > 5) return 'var(--amber)'
  return 'var(--green)'
}
