import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import { supabase } from '../supabase'
import { useAuth } from './useAuth'
import { formatLocalDate, getToday, daysBetween } from './useDate'
import { validateDisplayName } from '../utils/nameValidator'
import type { AppData, LeaderboardEntry } from '../types'
import { metaPut, META } from '../db'

/**
 * Local-only mocks injected into the leaderboard when
 * VITE_SEED_LEADERBOARD=true so the layout is visible without
 * touching Supabase. Numbers are spread so both metric boards have
 * a meaningful order.
 */
const SEED_USERS: ReadonlyArray<Omit<LeaderboardEntry, 'updated_at'>> = [
  { user_id: 'mock-1',  display_name: 'Kameron Porter',  smoke_free_days: 100, reduction_pct: 100, total_logged: 0,  daily_avg: 0.0 },
  { user_id: 'mock-2',  display_name: 'Michael Kopfler',  smoke_free_days: 75,  reduction_pct: 78,  total_logged: 12, daily_avg: 0.4 },
  { user_id: 'mock-3',  display_name: 'Alice Koller',     smoke_free_days: 73,  reduction_pct: 65,  total_logged: 18, daily_avg: 0.6 },
  { user_id: 'mock-4',  display_name: 'Peter Dinklage',   smoke_free_days: 69,  reduction_pct: 60,  total_logged: 22, daily_avg: 0.7 },
  { user_id: 'mock-5',  display_name: 'George Limbof',    smoke_free_days: 66,  reduction_pct: 55,  total_logged: 14, daily_avg: 0.5 },
  { user_id: 'mock-6',  display_name: 'Julia Berger',     smoke_free_days: 58,  reduction_pct: 50,  total_logged: 30, daily_avg: 0.9 },
  { user_id: 'mock-7',  display_name: 'Dave Jhonson',     smoke_free_days: 54,  reduction_pct: 48,  total_logged: 28, daily_avg: 0.8 },
  { user_id: 'mock-8',  display_name: 'Sarah Lee',        smoke_free_days: 45,  reduction_pct: 42,  total_logged: 35, daily_avg: 1.1 },
  { user_id: 'mock-9',  display_name: 'Marcus Chen',      smoke_free_days: 38,  reduction_pct: 38,  total_logged: 41, daily_avg: 1.4 },
  { user_id: 'mock-10', display_name: 'Elena Vega',       smoke_free_days: 30,  reduction_pct: 30,  total_logged: 50, daily_avg: 1.5 },
  { user_id: 'mock-11', display_name: 'Mia Thompson',     smoke_free_days: 21,  reduction_pct: 22,  total_logged: 60, daily_avg: 1.8 },
  { user_id: 'mock-12', display_name: 'Noah Brooks',      smoke_free_days: 14,  reduction_pct: 18,  total_logged: 72, daily_avg: 2.0 },
]

const SEED_ENABLED = import.meta.env?.VITE_SEED_LEADERBOARD === 'true'

function withMocks(real: LeaderboardEntry[]): LeaderboardEntry[] {
  if (!SEED_ENABLED) return real
  // Don't duplicate mocks if a refresh fired twice.
  const realIds = new Set(real.map((r) => r.user_id))
  const mocks: LeaderboardEntry[] = SEED_USERS.filter(
    (s) => !realIds.has(s.user_id)
  ).map((s) => ({ ...s, updated_at: new Date().toISOString() }))
  return [...real, ...mocks]
}

export interface LeaderboardPrefs {
  optedIn: boolean
  displayName: string
}

const DEFAULT_PREFS: LeaderboardPrefs = {
  optedIn: false,
  displayName: '',
}

function coercePrefs(
  parsed: Partial<LeaderboardPrefs>
): LeaderboardPrefs {
  return {
    optedIn: !!parsed.optedIn,
    displayName:
      typeof parsed.displayName === 'string' ? parsed.displayName : '',
  }
}

function savePrefs(p: LeaderboardPrefs): void {
  void metaPut(META.settingsLeaderboardPrefs, p)
}

const prefs = ref<LeaderboardPrefs>({ ...DEFAULT_PREFS })

/** Called by hydrate.ts after Dexie is open. */
export function hydrateLeaderboardPrefsFromDexie(
  value: Partial<LeaderboardPrefs> | undefined
): void {
  if (!value || typeof value !== 'object') return
  prefs.value = coercePrefs(value)
}

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
  const today = getToday()

  // Smoke-free: days since last log. If the user has never logged,
  // fall back to days since they started tracking — otherwise a
  // brand-new user always shows 0 even after weeks of not smoking.
  let smokeFreeDays = 0
  if (entries.length > 0) {
    const sorted = [...entries].sort((a, b) =>
      a.time.localeCompare(b.time)
    )
    const lastDate = sorted[sorted.length - 1].date
    if (lastDate < today) {
      smokeFreeDays = daysBetween(lastDate, today)
    }
  } else if (data.startDate && data.startDate <= today) {
    smokeFreeDays = Math.max(0, daysBetween(data.startDate, today))
  }

  // Reduction: compare baseline (plan baseline OR avg of first logged
  // days, up to 7) to recent (avg of last 7 calendar days). Only count
  // a baseline when there's enough data to be meaningful.
  const sortedDates = Object.keys(byDay).sort()
  let baseline = 0
  if (data.quitPlan?.baseline && data.quitPlan.baseline > 0) {
    baseline = data.quitPlan.baseline
  } else if (sortedDates.length >= 3) {
    const firstWeek = sortedDates.slice(0, 7)
    const sum = firstWeek.reduce((s, d) => s + byDay[d], 0)
    baseline = sum / firstWeek.length
  }

  // Recent: average of last 7 calendar days from today (inclusive).
  // Only meaningful if we actually have data — otherwise reduction
  // from "I haven't started" to "I haven't started" is meaningless.
  let recent = 0
  if (sortedDates.length > 0) {
    let sum = 0
    for (let i = 0; i < 7; i++) {
      const d = formatLocalDate(new Date(Date.now() - i * 86_400_000))
      sum += byDay[d] ?? 0
    }
    recent = sum / 7
  }

  let reductionPct = 0
  if (baseline > 0 && sortedDates.length >= 3) {
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
    // Tiebreaker is the stable user_id, NOT updated_at. Sorting by
    // updated_at made each device see "themselves on top" when metrics
    // were tied, because every push refreshes the local user's
    // updated_at. user_id makes every client agree on the order.
    const [sf, rd] = await Promise.all([
      supabase
        .from('leaderboard_entries')
        .select('*')
        .order('smoke_free_days', { ascending: false })
        .order('user_id', { ascending: true })
        .limit(50),
      supabase
        .from('leaderboard_entries')
        .select('*')
        .order('reduction_pct', { ascending: false })
        .order('smoke_free_days', { ascending: false })
        .order('user_id', { ascending: true })
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
    // Inject local mocks (only when VITE_SEED_LEADERBOARD=true) so
    // the layout is testable without writing seed data to Supabase.
    const sfMerged = withMocks((sf.data ?? []) as LeaderboardEntry[])
    const rdMerged = withMocks((rd.data ?? []) as LeaderboardEntry[])
    sfMerged.sort((a, b) => {
      if (b.smoke_free_days !== a.smoke_free_days)
        return b.smoke_free_days - a.smoke_free_days
      // Stable tiebreak — see the comment above the supabase query.
      return a.user_id.localeCompare(b.user_id)
    })
    rdMerged.sort((a, b) => {
      if (b.reduction_pct !== a.reduction_pct)
        return b.reduction_pct - a.reduction_pct
      if (b.smoke_free_days !== a.smoke_free_days)
        return b.smoke_free_days - a.smoke_free_days
      return a.user_id.localeCompare(b.user_id)
    })
    topSmokeFree.value = sfMerged.slice(0, 50)
    topReduction.value = rdMerged.slice(0, 50)
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
    // Defense in depth: block invalid names from being persisted, even
    // if a caller bypassed the UI validation. The empty-string case is
    // allowed so users can clear the field before re-entering.
    const trimmed = name.trim()
    if (trimmed.length > 0) {
      const v = validateDisplayName(trimmed)
      if (!v.ok) return
    }
    prefs.value = { ...prefs.value, displayName: trimmed }
    savePrefs(prefs.value)
    if (prefs.value.optedIn) void pushOwnRow().then(refresh)
  }

  // Push our row whenever local stats change, debounced. Two separate
  // sources so Vue can compare each with Object.is: length is a
  // primitive and only fires when the count actually changes (a
  // no-op array reassignment in applyServerEntries no longer
  // cascades into an extra leaderboard push+refresh cycle). The
  // quit-plan source keeps deep so intensity / baseline edits are
  // still caught.
  let pushTimer: ReturnType<typeof setTimeout> | null = null
  watch(
    [() => data.value.entries.length, () => data.value.quitPlan],
    () => {
      if (!prefs.value.optedIn || !isAuthed.value) return
      if (pushTimer) clearTimeout(pushTimer)
      pushTimer = setTimeout(() => {
        void pushOwnRow().then(refresh)
      }, 1500)
    },
    { deep: true }
  )

  // Reconcile local opt-in state with the server. If the user opted
  // in on another device, their row already exists on the server —
  // we should reflect that here without forcing them to "Join" again.
  async function reconcileOwnRow(): Promise<void> {
    if (!supabase || !user.value) return
    const { data: row, error: err } = await supabase
      .from('leaderboard_entries')
      .select('display_name')
      .eq('user_id', user.value.id)
      .maybeSingle()
    if (err) return
    if (row) {
      // Server says we're opted in; sync local state if it doesn't agree.
      const next = {
        optedIn: true,
        displayName:
          row.display_name || prefs.value.displayName || 'Anonymous',
      }
      if (
        next.optedIn !== prefs.value.optedIn ||
        next.displayName !== prefs.value.displayName
      ) {
        prefs.value = next
        savePrefs(prefs.value)
      }
    } else if (prefs.value.optedIn) {
      // Local says opted in but server has no row — treat server as
      // truth and back out the local flag.
      prefs.value = { ...prefs.value, optedIn: false }
      savePrefs(prefs.value)
    }
  }

  // Initial fetch when signed in.
  watch(
    isAuthed,
    async (authed) => {
      if (!authed) return
      await reconcileOwnRow()
      await refresh()
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
