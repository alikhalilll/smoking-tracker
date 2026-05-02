import { ref, watch, type Ref } from 'vue'
import { supabase } from '../supabase'
import { useAuth } from './useAuth'
import type { AppData, QuitPlan, SmokeEntry } from '../types'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline'

interface ServerEntry {
  id: string
  time: string
  date: string
}

interface ServerPlan {
  user_id: string
  start_date: string
  baseline: number
  duration_days: number
  intensity: QuitPlan['intensity']
  targets: Record<string, number>
  updated_at: string
}

export interface UseSync {
  status: Ref<SyncStatus>
  lastSyncedAt: Ref<number | null>
  lastError: Ref<string | null>
  /** Force a full pull + push pass. */
  syncNow: () => Promise<void>
}

export function useSync(data: Ref<AppData>): UseSync {
  const { isAuthed, user } = useAuth()
  const status: Ref<SyncStatus> = ref('idle')
  const lastSyncedAt: Ref<number | null> = ref(null)
  const lastError: Ref<string | null> = ref(null)

  // Suppress the local watcher while we apply server changes locally,
  // so we don't immediately echo them back.
  let applyingRemote = false
  let pushTimer: ReturnType<typeof setTimeout> | null = null

  function setStatus(s: SyncStatus, err?: string): void {
    status.value = s
    if (err !== undefined) lastError.value = err
  }

  async function pull(): Promise<void> {
    if (!supabase || !user.value) return
    setStatus('syncing')

    const { data: serverEntries, error: entriesErr } = await supabase
      .from('entries')
      .select('id, time, date')
      .order('time')
    if (entriesErr) {
      setStatus('error', entriesErr.message)
      return
    }

    const localTimes = new Set(data.value.entries.map((e) => e.time))
    const serverTimes = new Set(
      (serverEntries as ServerEntry[] | null)?.map((e) => e.time) ?? []
    )

    // Take the union (additive merge): keep both sides' entries.
    applyingRemote = true
    try {
      const newOnes =
        (serverEntries as ServerEntry[] | null)?.filter(
          (e) => !localTimes.has(e.time)
        ) ?? []
      if (newOnes.length > 0) {
        data.value.entries = [
          ...data.value.entries,
          ...newOnes.map((e) => ({ time: e.time, date: e.date })),
        ].sort((a, b) => a.time.localeCompare(b.time))
      }
    } finally {
      applyingRemote = false
    }

    // Push local-only entries up.
    const toPush: SmokeEntry[] = data.value.entries.filter(
      (e) => !serverTimes.has(e.time)
    )
    if (toPush.length > 0) {
      const { error: insertErr } = await supabase.from('entries').insert(
        toPush.map((e) => ({
          user_id: user.value!.id,
          time: e.time,
          date: e.date,
        }))
      )
      if (insertErr) {
        setStatus('error', insertErr.message)
        return
      }
    }

    // Sync the quit plan: server version wins if its updated_at is newer
    // than what we have locally; local wins otherwise.
    const { data: serverPlan, error: planErr } = await supabase
      .from('quit_plans')
      .select('*')
      .eq('user_id', user.value.id)
      .maybeSingle()
    if (planErr) {
      setStatus('error', planErr.message)
      return
    }

    if (serverPlan && !data.value.quitPlan) {
      applyingRemote = true
      try {
        data.value.quitPlan = serverPlanToLocal(serverPlan as ServerPlan)
      } finally {
        applyingRemote = false
      }
    } else if (data.value.quitPlan && !serverPlan) {
      await pushPlan(data.value.quitPlan)
    } else if (data.value.quitPlan && serverPlan) {
      // Both exist — prefer the one with the later start date.
      if (
        (serverPlan as ServerPlan).start_date > data.value.quitPlan.startDate
      ) {
        applyingRemote = true
        try {
          data.value.quitPlan = serverPlanToLocal(serverPlan as ServerPlan)
        } finally {
          applyingRemote = false
        }
      } else {
        await pushPlan(data.value.quitPlan)
      }
    }

    setStatus('synced')
    lastSyncedAt.value = Date.now()
  }

  async function pushDiff(): Promise<void> {
    if (!supabase || !user.value) return
    setStatus('syncing')

    // Fetch server entries to compute the diff.
    const { data: serverEntries, error } = await supabase
      .from('entries')
      .select('id, time')
    if (error) {
      setStatus('error', error.message)
      return
    }
    const serverByTime = new Map<string, ServerEntry>()
    for (const e of (serverEntries as ServerEntry[] | null) ?? []) {
      serverByTime.set(e.time, e)
    }
    const localTimes = new Set(data.value.entries.map((e) => e.time))

    // Insert local-only.
    const toInsert: SmokeEntry[] = data.value.entries.filter(
      (e) => !serverByTime.has(e.time)
    )
    if (toInsert.length > 0) {
      const { error: insertErr } = await supabase.from('entries').insert(
        toInsert.map((e) => ({
          user_id: user.value!.id,
          time: e.time,
          date: e.date,
        }))
      )
      if (insertErr) {
        setStatus('error', insertErr.message)
        return
      }
    }

    // Delete server-only (the user undid them locally).
    const toDeleteIds: string[] = []
    for (const [time, srv] of serverByTime) {
      if (!localTimes.has(time)) toDeleteIds.push(srv.id)
    }
    if (toDeleteIds.length > 0) {
      const { error: deleteErr } = await supabase
        .from('entries')
        .delete()
        .in('id', toDeleteIds)
      if (deleteErr) {
        setStatus('error', deleteErr.message)
        return
      }
    }

    // Push the plan snapshot too.
    if (data.value.quitPlan) {
      await pushPlan(data.value.quitPlan)
    } else {
      await supabase
        .from('quit_plans')
        .delete()
        .eq('user_id', user.value.id)
    }

    setStatus('synced')
    lastSyncedAt.value = Date.now()
  }

  async function pushPlan(plan: QuitPlan): Promise<void> {
    if (!supabase || !user.value) return
    const { error } = await supabase.from('quit_plans').upsert({
      user_id: user.value.id,
      start_date: plan.startDate,
      baseline: plan.baseline,
      duration_days: plan.durationDays,
      intensity: plan.intensity,
      targets: plan.targetsByDate,
    })
    if (error) {
      setStatus('error', error.message)
    }
  }

  function serverPlanToLocal(p: ServerPlan): QuitPlan {
    return {
      startDate: p.start_date,
      baseline: p.baseline,
      durationDays: p.duration_days,
      intensity: p.intensity,
      targetsByDate: p.targets,
    }
  }

  // Initial pull whenever the user becomes authed.
  watch(
    isAuthed,
    async (authed) => {
      if (!authed) {
        setStatus('idle')
        return
      }
      await pull().catch((err) => setStatus('error', String(err)))
    },
    { immediate: true }
  )

  // Debounced push on local changes.
  watch(
    () => [data.value.entries.length, data.value.quitPlan],
    () => {
      if (applyingRemote) return
      if (!isAuthed.value) return
      if (pushTimer) clearTimeout(pushTimer)
      pushTimer = setTimeout(() => {
        void pushDiff().catch((err) => setStatus('error', String(err)))
      }, 800)
    },
    { deep: true }
  )

  // Mark offline when the device goes offline.
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      if (isAuthed.value) void pull()
    })
    window.addEventListener('offline', () => {
      if (status.value !== 'idle') setStatus('offline')
    })
  }

  async function syncNow(): Promise<void> {
    await pull()
  }

  return { status, lastSyncedAt, lastError, syncNow }
}
