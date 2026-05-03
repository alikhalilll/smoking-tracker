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
  /** Immediate server-side wipe — used by the Reset action. */
  clearServer: () => Promise<void>
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

    // Step 1 — push any not-yet-synced local entries first, so offline
    // writes (and edits to existing entries) don't get wiped by the
    // authoritative replace below. Upsert WITHOUT ignoreDuplicates so
    // an edit (id present on server, synced=false locally) actually
    // updates the row instead of silently skipping. Last-write-wins.
    const unsyncedLocal = data.value.entries.filter((e) => !e.synced)
    if (unsyncedLocal.length > 0) {
      const { error: insertErr } = await supabase
        .from('entries')
        .upsert(
          unsyncedLocal.map((e) => ({
            id: e.id,
            user_id: user.value!.id,
            time: e.time,
            date: e.date,
          })),
          { onConflict: 'id' }
        )
      if (insertErr) {
        setStatus('error', insertErr.message)
        return
      }
    }

    // Step 2 — re-fetch the canonical server set.
    const { data: serverEntries, error: entriesErr } = await supabase
      .from('entries')
      .select('id, time, date')
      .order('time')
    if (entriesErr) {
      setStatus('error', entriesErr.message)
      return
    }

    // Step 3 — REPLACE local entries with the server snapshot. The DB
    // is the source of truth; an entry deleted on another device is
    // gone here too once the pull lands.
    applyingRemote = true
    try {
      data.value.entries = (
        (serverEntries as ServerEntry[] | null) ?? []
      ).map((e) => ({
        id: e.id,
        time: e.time,
        date: e.date,
        synced: true,
      }))
    } finally {
      applyingRemote = false
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

    // Honor the local abandon stamp: a server row written *before* the
    // user's most recent abandon is stale (the delete just hasn't
    // landed yet, or this is a race against the periodic pull). Treat
    // it as gone and tell the server to delete it, so the abandon
    // converges across devices.
    const clearedAt = data.value.quitPlanClearedAt ?? 0
    const serverPlanMs =
      serverPlan != null
        ? new Date((serverPlan as ServerPlan).updated_at).getTime()
        : 0
    const serverPlanIsStale =
      serverPlan != null && serverPlanMs <= clearedAt

    if (serverPlanIsStale) {
      const { error: delErr } = await supabase
        .from('quit_plans')
        .delete()
        .eq('user_id', user.value.id)
      if (delErr) {
        setStatus('error', delErr.message)
        return
      }
    } else if (serverPlan && !data.value.quitPlan) {
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

    // Fetch server ids for the diff.
    const { data: serverEntries, error } = await supabase
      .from('entries')
      .select('id')
    if (error) {
      setStatus('error', error.message)
      return
    }
    const serverIds = new Set(
      ((serverEntries as { id: string }[] | null) ?? []).map((e) => e.id)
    )
    const localIds = new Set(data.value.entries.map((e) => e.id))

    // Push every unsynced entry — covers both new logs (id not on server)
    // and local edits (id on server, time/date changed). UPSERT without
    // ignoreDuplicates so existing rows are updated. Last-write-wins.
    const toUpsert: SmokeEntry[] = data.value.entries.filter((e) => !e.synced)
    if (toUpsert.length > 0) {
      const { error: upsertErr } = await supabase
        .from('entries')
        .upsert(
          toUpsert.map((e) => ({
            id: e.id,
            user_id: user.value!.id,
            time: e.time,
            date: e.date,
          })),
          { onConflict: 'id' }
        )
      if (upsertErr) {
        setStatus('error', upsertErr.message)
        return
      }
      const upsertedIds = new Set(toUpsert.map((e) => e.id))
      applyingRemote = true
      try {
        for (const e of data.value.entries) {
          if (upsertedIds.has(e.id)) e.synced = true
        }
      } finally {
        applyingRemote = false
      }
    }

    // Delete server-only ids (the user undid them locally).
    const toDeleteIds: string[] = []
    for (const id of serverIds) {
      if (!localIds.has(id)) toDeleteIds.push(id)
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

  // Entry changes are debounced — a user logging 3 cigarettes in a row
  // shouldn't fire 3 separate pushes. We track length AND the count of
  // unsynced rows so an edit (which doesn't change length but flips
  // `synced` to false on a row) still wakes the watcher.
  // flush: 'sync' so applyingRemote (cleared synchronously after pushDiff
  // marks rows synced=true) holds across the watcher fire — without it,
  // every successful push would queue a redundant pushDiff right after.
  watch(
    () => [
      data.value.entries.length,
      data.value.entries.filter((e) => !e.synced).length,
    ],
    () => {
      if (applyingRemote) return
      if (!isAuthed.value) return
      if (pushTimer) clearTimeout(pushTimer)
      pushTimer = setTimeout(() => {
        void pushDiff().catch((err) => setStatus('error', String(err)))
      }, 800)
    },
    { flush: 'sync' }
  )

  // Quit plan changes push immediately — every plan action (start /
  // abandon / future edits) must hit the server right away so closing
  // the app within the debounce window can't drop the change.
  watch(
    () => data.value.quitPlan,
    async (next) => {
      if (applyingRemote) return
      if (!isAuthed.value || !supabase || !user.value) return
      try {
        if (next) {
          await pushPlan(next)
        } else {
          const { error } = await supabase
            .from('quit_plans')
            .delete()
            .eq('user_id', user.value.id)
          if (error) setStatus('error', error.message)
        }
      } catch (err) {
        setStatus('error', String(err))
      }
    },
    { deep: true }
  )

  // Background sync triggers — keep things in sync without the user
  // ever noticing or having to press a button.
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      if (isAuthed.value) void pull()
    })
    window.addEventListener('offline', () => {
      if (status.value !== 'idle') setStatus('offline')
    })

    // Re-pull whenever the app comes back to the foreground (tab focus,
    // PWA resume, switch back from another window).
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && isAuthed.value) {
        void pull()
      }
    })

    // Periodic poll while the app is visible. 60s is a sensible
    // compromise between freshness and Supabase request volume.
    const POLL_MS = 60_000
    setInterval(() => {
      if (document.visibilityState !== 'visible') return
      if (!isAuthed.value) return
      void pull()
    }, POLL_MS)
  }

  async function syncNow(): Promise<void> {
    await pull()
  }

  /**
   * Wipe the user's data on the server immediately. Called from the Reset
   * action so the DB clear happens BEFORE any background pull can re-pull
   * the old rows down.
   */
  async function clearServer(): Promise<void> {
    if (!supabase || !user.value) return
    setStatus('syncing')
    const { error: entriesErr } = await supabase
      .from('entries')
      .delete()
      .eq('user_id', user.value.id)
    if (entriesErr) {
      setStatus('error', entriesErr.message)
      return
    }
    const { error: planErr } = await supabase
      .from('quit_plans')
      .delete()
      .eq('user_id', user.value.id)
    if (planErr) {
      setStatus('error', planErr.message)
      return
    }
    setStatus('synced')
    lastSyncedAt.value = Date.now()
  }

  return { status, lastSyncedAt, lastError, syncNow, clearServer }
}
