import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import { supabase } from '../supabase'
import { useAuth } from './useAuth'
import type { AppData, LeaderboardEntry } from '../types'

const STORAGE_KEY = 'smoking-tracker-leaderboard-prefs'

export interface LeaderboardPrefs {
  optedIn: boolean
  displayName: string
}

const DEFAULT_PREFS: LeaderboardPrefs = {
  optedIn: false,
  displayName: '',
}

function loadPrefs(): LeaderboardPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    const parsed = JSON.parse(raw) as Partial<LeaderboardPrefs>
    return {
      optedIn: !!parsed.optedIn,
      displayName:
        typeof parsed.displayName === 'string' ? parsed.displayName : '',
    }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

function savePrefs(p: LeaderboardPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {
    // ignore
  }
}

const prefs = ref<LeaderboardPrefs>(loadPrefs())

export interface ComputedMetrics {
  smokeFreeDays: number
  reductionPct: number
  totalLogged: number
  dailyAvg: number
}

/** Compute the leaderboard-relevant metrics from local stats. */
function computeMetrics(data: AppData): ComputedMetrics {
  const entries = data.entries
  const totalLogged = entries.length
  const byDay: Record<string, number> = {}
  for (const e of entries) byDay[e.date] = (byDay[e.date] || 0) + 1

  const days = Object.keys(byDay).length || 1
  const dailyAvg = Math.round((totalLogged / days) * 10) / 10

  // Smoke-free: days since last log.
  let smokeFreeDays = 0
  if (entries.length > 0) {
    const sorted = [...entries].sort((a, b) =>
      a.time.localeCompare(b.time)
    )
    const lastDate = sorted[sorted.length - 1].date
    const today = new Date().toISOString().split('T')[0]
    if (lastDate < today) {
      const a = new Date(lastDate + 'T00:00:00').getTime()
      const b = new Date(today + 'T00:00:00').getTime()
      smokeFreeDays = Math.round((b - a) / 86_400_000)
    }
  }

  // Reduction: compare baseline (plan baseline OR avg of first 7 logged
  // days) to recent (avg of last 7 calendar days).
  const sortedDates = Object.keys(byDay).sort()
  let baseline = 0
  if (data.quitPlan?.baseline) {
    baseline = data.quitPlan.baseline
  } else if (sortedDates.length >= 3) {
    const firstWeek = sortedDates.slice(0, 7)
    const sum = firstWeek.reduce((s, d) => s + byDay[d], 0)
    baseline = sum / firstWeek.length
  }

  let recent = 0
  if (sortedDates.length > 0) {
    const today = new Date()
    const last7 = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(today.getTime() - i * 86_400_000)
        .toISOString()
        .split('T')[0]
      last7.push(byDay[d] ?? 0)
    }
    recent = last7.reduce((s, n) => s + n, 0) / 7
  }

  let reductionPct = 0
  if (baseline > 0) {
    reductionPct = Math.max(
      0,
      Math.round(((baseline - recent) / baseline) * 1000) / 10
    )
  }

  return { smokeFreeDays, reductionPct, totalLogged, dailyAvg }
}

export interface UseLeaderboard {
  prefs: Ref<LeaderboardPrefs>
  topSmokeFree: Ref<LeaderboardEntry[]>
  topReduction: Ref<LeaderboardEntry[]>
  ownEntry: ComputedRef<LeaderboardEntry | null>
  loading: Ref<boolean>
  error: Ref<string | null>
  setOptIn: (b: boolean) => Promise<void>
  setDisplayName: (name: string) => void
  refresh: () => Promise<void>
}

export function useLeaderboard(data: Ref<AppData>): UseLeaderboard {
  const { user, isAuthed } = useAuth()
  const topSmokeFree: Ref<LeaderboardEntry[]> = ref([])
  const topReduction: Ref<LeaderboardEntry[]> = ref([])
  const loading: Ref<boolean> = ref(false)
  const error: Ref<string | null> = ref(null)

  const ownEntry = computed<LeaderboardEntry | null>(() => {
    if (!user.value) return null
    const all = [...topSmokeFree.value, ...topReduction.value]
    return all.find((e) => e.user_id === user.value!.id) ?? null
  })

  async function refresh(): Promise<void> {
    if (!supabase || !isAuthed.value) return
    loading.value = true
    error.value = null
    const [sf, rd] = await Promise.all([
      supabase
        .from('leaderboard_entries')
        .select('*')
        .order('smoke_free_days', { ascending: false })
        .limit(50),
      supabase
        .from('leaderboard_entries')
        .select('*')
        .order('reduction_pct', { ascending: false })
        .limit(50),
    ])
    loading.value = false
    if (sf.error) {
      error.value = sf.error.message
      return
    }
    if (rd.error) {
      error.value = rd.error.message
      return
    }
    topSmokeFree.value = (sf.data ?? []) as LeaderboardEntry[]
    topReduction.value = (rd.data ?? []) as LeaderboardEntry[]
  }

  async function pushOwnRow(): Promise<void> {
    if (!supabase || !user.value || !prefs.value.optedIn) return
    const m = computeMetrics(data.value)
    const { error: err } = await supabase
      .from('leaderboard_entries')
      .upsert({
        user_id: user.value.id,
        display_name: prefs.value.displayName.trim() || 'Anonymous',
        smoke_free_days: m.smokeFreeDays,
        reduction_pct: m.reductionPct,
        total_logged: m.totalLogged,
        daily_avg: m.dailyAvg,
        updated_at: new Date().toISOString(),
      })
    if (err) {
      error.value = err.message
    }
  }

  async function deleteOwnRow(): Promise<void> {
    if (!supabase || !user.value) return
    const { error: err } = await supabase
      .from('leaderboard_entries')
      .delete()
      .eq('user_id', user.value.id)
    if (err) error.value = err.message
  }

  async function setOptIn(b: boolean): Promise<void> {
    prefs.value = { ...prefs.value, optedIn: b }
    savePrefs(prefs.value)
    if (b) {
      await pushOwnRow()
    } else {
      await deleteOwnRow()
    }
    await refresh()
  }

  function setDisplayName(name: string): void {
    prefs.value = { ...prefs.value, displayName: name }
    savePrefs(prefs.value)
    if (prefs.value.optedIn) void pushOwnRow().then(refresh)
  }

  // Push our row whenever local stats change, debounced.
  let pushTimer: ReturnType<typeof setTimeout> | null = null
  watch(
    () => [data.value.entries.length, data.value.quitPlan],
    () => {
      if (!prefs.value.optedIn || !isAuthed.value) return
      if (pushTimer) clearTimeout(pushTimer)
      pushTimer = setTimeout(() => {
        void pushOwnRow().then(refresh)
      }, 1500)
    },
    { deep: true }
  )

  // Initial fetch when signed in.
  watch(
    isAuthed,
    async (authed) => {
      if (authed) await refresh()
    },
    { immediate: true }
  )

  return {
    prefs,
    topSmokeFree,
    topReduction,
    ownEntry,
    loading,
    error,
    setOptIn,
    setDisplayName,
    refresh,
  }
}
