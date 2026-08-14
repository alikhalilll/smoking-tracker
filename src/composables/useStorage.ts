import { ref, type Ref } from 'vue'
import type { AppData, EntryType, QuitIntensity, QuitPlan, SmokeEntry } from '../types'
import { generateTargets, INTENSITY_DURATIONS } from './useQuitPlan'
import { getToday } from './useDate'
import { db, META, metaGet, metaPut } from '../db'

interface AppDataMeta {
  startDate: string
  quitPlan?: QuitPlan
  quitPlanClearedAt?: number
}

function getDefaultData(): AppData {
  return {
    entries: [],
    startDate: getToday(),
  }
}

export interface UseStorage {
  data: Ref<AppData>
  addEntries: (count: number, type: EntryType) => void
  /** Undo the last entry of the given type. Scoping by type means an
   *  "undo" tap in vape mode never silently rolls back a cigarette
   *  the user logged ten minutes ago. */
  undoLast: (type: EntryType) => void
  /** Delete every entry of the given type for the given date. History
   *  is mode-scoped, so deleting a day from the vape view must NOT
   *  wipe the cigarette entries that share the date. */
  deleteDay: (date: string, type: EntryType) => void
  /** Update an entry's timestamp. Recomputes `date` from the new time
   *  and marks `synced: false` so the next sync pass UPSERTs it. */
  editEntryTime: (id: string, newIsoTime: string) => void
  resetAll: () => void
  startQuitPlan: (
    intensity: QuitIntensity,
    baseline: number,
    type: EntryType
  ) => void
  abandonQuitPlan: () => void
  // ── Server-driven mutations called by useSync. Each one flips the
  //    applyingRemote guard synchronously so useSync's watcher can't
  //    see the mutation as a fresh local change and echo it back.
  markSynced: (ids: string[]) => void
  applyServerEntries: (rows: SmokeEntry[]) => void
  consumeDeletedIds: (ids: string[]) => void
  applyRemoteQuitPlan: (plan: QuitPlan) => void
  clearRemoteQuitPlan: () => void
  /** True while a server-driven mutation is in flight. useSync reads
   *  this in its `flush: 'sync'` watcher to suppress echo pushes. */
  isApplyingRemote: () => boolean
}

// Module-level singletons so App.vue's single useStorage() call and any
// server-driven method share the same reactive state.
const data: Ref<AppData> = ref(getDefaultData())
let applyingRemote = false

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  // Fallback for very old browsers / non-secure contexts.
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  )
}

async function persistAppDataMeta(): Promise<void> {
  // JSON round-trip strips Vue's reactive Proxy wrapper. Real Chrome's
  // structured-clone handles Proxies, but not all IDB implementations
  // do (fake-indexeddb / Node's structuredClone don't), and writing
  // plain data to persistence is more portable regardless.
  const meta: AppDataMeta = JSON.parse(
    JSON.stringify({
      startDate: data.value.startDate,
      quitPlan: data.value.quitPlan,
      quitPlanClearedAt: data.value.quitPlanClearedAt,
    })
  )
  await metaPut(META.appDataMeta, meta)
}

/**
 * Called by hydrate.ts before the app mounts. Loads entries,
 * tombstones and app-data-meta into the reactive `data` ref. Never
 * throws — a Dexie failure just leaves defaults in place.
 */
export async function hydrateStorageFromDexie(): Promise<void> {
  try {
    const [rows, tombstoneRows, meta] = await Promise.all([
      db.entries.toArray(),
      db.tombstones.toArray(),
      metaGet<AppDataMeta>(META.appDataMeta),
    ])
    const startDate = meta?.startDate ?? getToday()
    const deletedIds = tombstoneRows.map((t) => t.id)
    data.value = {
      entries: rows,
      startDate,
      ...(meta?.quitPlan ? { quitPlan: meta.quitPlan } : {}),
      ...(meta?.quitPlanClearedAt != null
        ? { quitPlanClearedAt: meta.quitPlanClearedAt }
        : {}),
      ...(deletedIds.length > 0 ? { deletedIds } : {}),
    }
    if (!meta) {
      // First-ever boot on a device with no legacy data: persist the
      // default startDate so subsequent sessions read a stable value
      // instead of drifting to "today" every launch.
      await persistAppDataMeta()
    }
  } catch (err) {
    console.error('[useStorage] hydrate failed — defaults in memory:', err)
  }
}

export function useStorage(): UseStorage {
  function addEntries(count: number, type: EntryType): void {
    if (count <= 0) return
    const now = new Date().toISOString()
    const today = getToday()
    const toAdd: SmokeEntry[] = []
    if (type === 'vape') {
      // One entry per session — puffCount carries the puff count.
      // History and sessionsToday derive naturally from row count.
      toAdd.push({
        id: newId(),
        time: now,
        date: today,
        type,
        synced: false,
        puffCount: count,
      })
    } else {
      // Cigarettes stay one-entry-per-stick: each stick is a discrete
      // event the user reasons about individually.
      for (let i = 0; i < count; i++) {
        toAdd.push({
          id: newId(),
          time: now,
          date: today,
          type,
          synced: false,
        })
      }
    }
    data.value.entries.push(...toAdd)
    void db.entries.bulkAdd(toAdd).catch((err) => {
      console.error('[useStorage] bulkAdd failed:', err)
    })
  }

  function addTombstone(id: string): void {
    // Only server-known rows need a tombstone — an unsynced local-only
    // row never made it to the DB, so there's nothing to delete there.
    // (Also keeps tombstones from growing unbounded on rapid create/undo.)
    const list = (data.value.deletedIds ??= [])
    if (!list.includes(id)) {
      list.push(id)
      void db.tombstones.put({ id }).catch((err) => {
        console.error('[useStorage] tombstone put failed:', err)
      })
    }
  }

  function undoLast(type: EntryType): void {
    // Find the chronologically-last entry of the requested type. We
    // walk backwards because the array is roughly time-ordered (and
    // the most-recent log is the one the user expects "undo" to act
    // on). Skip-and-find rather than reverse-sort to keep this cheap.
    for (let i = data.value.entries.length - 1; i >= 0; i--) {
      const e = data.value.entries[i]
      if ((e.type ?? 'cigarette') === type) {
        if (e.synced) addTombstone(e.id)
        const [removed] = data.value.entries.splice(i, 1)
        void db.entries.delete(removed.id).catch((err) => {
          console.error('[useStorage] entry delete failed:', err)
        })
        return
      }
    }
  }

  function deleteDay(date: string, type: EntryType): void {
    const kept: typeof data.value.entries = []
    const removedIds: string[] = []
    for (const e of data.value.entries) {
      const match = e.date === date && (e.type ?? 'cigarette') === type
      if (match) {
        removedIds.push(e.id)
        if (e.synced) addTombstone(e.id)
      } else {
        kept.push(e)
      }
    }
    data.value.entries = kept
    if (removedIds.length > 0) {
      void db.entries.bulkDelete(removedIds).catch((err) => {
        console.error('[useStorage] bulkDelete failed:', err)
      })
    }
  }

  function editEntryTime(id: string, newIsoTime: string): void {
    const e = data.value.entries.find((x) => x.id === id)
    if (!e) return
    e.time = newIsoTime
    // Local-date string from the ISO timestamp. The server `date` column
    // tracks the local calendar day, so an edit that crosses midnight
    // moves the entry to the new day's bucket.
    const d = new Date(newIsoTime)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    e.date = `${yyyy}-${mm}-${dd}`
    e.synced = false
    void db.entries
      .update(id, { time: e.time, date: e.date, synced: false })
      .catch((err) => {
        console.error('[useStorage] entry update failed:', err)
      })
  }

  function resetAll(): void {
    // getDefaultData() has no deletedIds — a full reset wipes the
    // tombstone list along with everything else. Sync clears the
    // server via clearServer() separately.
    data.value = getDefaultData()
    void db
      .transaction('rw', db.entries, db.tombstones, db.meta, async () => {
        await db.entries.clear()
        await db.tombstones.clear()
        await db.meta.put({
          key: META.appDataMeta,
          value: {
            startDate: data.value.startDate,
          } satisfies AppDataMeta,
        })
      })
      .catch((err) => {
        console.error('[useStorage] resetAll transaction failed:', err)
      })
  }

  function startQuitPlan(
    intensity: QuitIntensity,
    baseline: number,
    type: EntryType
  ): void {
    const today = getToday()
    const durationDays = INTENSITY_DURATIONS[intensity]
    // Single-plan model: starting a vape plan while a cigarette plan
    // exists (or vice versa) overwrites the previous one. Multi-plan
    // support is a follow-up if users ask for it.
    const plan: QuitPlan = {
      startDate: today,
      baseline,
      durationDays,
      intensity,
      targetsByDate: generateTargets(baseline, durationDays, today),
      type,
    }
    data.value.quitPlan = plan
    // Starting a fresh plan invalidates any prior abandon stamp — the
    // new plan is what we want sync to converge on.
    delete data.value.quitPlanClearedAt
    void persistAppDataMeta()
  }

  function abandonQuitPlan(): void {
    delete data.value.quitPlan
    // Stamp the moment of abandon so a racing pull can't restore a
    // stale server row written before this point.
    data.value.quitPlanClearedAt = Date.now()
    void persistAppDataMeta()
  }

  // ── Server-driven mutations ─────────────────────────────────────
  // Ordering invariant: set applyingRemote=true, mutate the ref
  // *synchronously*, kick off the Dexie write, then clear the flag
  // *synchronously*. The `flush: 'sync'` watcher in useSync reads
  // isApplyingRemote() the moment the ref changes, so the guard MUST
  // still be true at that point. Awaiting the Dexie write here would
  // yield the microtask and let the watcher slip through with the
  // flag already cleared.

  function markSynced(ids: string[]): void {
    if (ids.length === 0) return
    applyingRemote = true
    try {
      const idSet = new Set(ids)
      for (const e of data.value.entries) {
        if (idSet.has(e.id)) e.synced = true
      }
    } finally {
      applyingRemote = false
    }
    void db.transaction('rw', db.entries, async () => {
      for (const id of ids) {
        await db.entries.update(id, { synced: true })
      }
    }).catch((err) => {
      console.error('[useStorage] markSynced failed:', err)
    })
  }

  function applyServerEntries(rows: SmokeEntry[]): void {
    // Preserve locally-stored puffCount for ids the server returns —
    // the server schema doesn't carry it, so a naive replace collapses
    // every vape session back to a single puff. (Once the server row
    // grows a puffCount column this merge can drop.)
    const puffCountById = new Map<string, number>()
    for (const e of data.value.entries) {
      if (e.puffCount != null) puffCountById.set(e.id, e.puffCount)
    }
    const serverIds = new Set(rows.map((r) => r.id))
    const localUnsyncedNotOnServer = data.value.entries.filter(
      (e) => !e.synced && !serverIds.has(e.id)
    )
    const merged: SmokeEntry[] = [
      ...rows.map((r) => ({
        ...r,
        type: r.type ?? ('cigarette' as EntryType),
        synced: true,
        ...(puffCountById.has(r.id)
          ? { puffCount: puffCountById.get(r.id) }
          : {}),
      })),
      ...localUnsyncedNotOnServer,
    ]
    applyingRemote = true
    try {
      data.value.entries = merged
    } finally {
      applyingRemote = false
    }
    // One transaction: replace the server-known slice and keep the
    // unsynced local rows in place. bulkPut is idempotent on the
    // primary key so this stays safe on repeated pulls. JSON
    // round-trip strips Vue's reactive Proxy from the local-unsynced
    // rows in `merged` — Node's structuredClone (and some stricter
    // IDB polyfills) reject Proxies, and writing plain data to
    // persistence is more portable regardless.
    const plainMerged: SmokeEntry[] = JSON.parse(JSON.stringify(merged))
    void db
      .transaction('rw', db.entries, async () => {
        // Drop any entry that is neither on the server nor unsynced
        // locally — those were deleted on another device.
        const keepIds = new Set(plainMerged.map((e) => e.id))
        const allLocal = await db.entries.toArray()
        const staleIds = allLocal
          .filter((e) => !keepIds.has(e.id))
          .map((e) => e.id)
        if (staleIds.length > 0) await db.entries.bulkDelete(staleIds)
        await db.entries.bulkPut(plainMerged)
      })
      .catch((err) => {
        console.error('[useStorage] applyServerEntries failed:', err)
      })
  }

  function consumeDeletedIds(ids: string[]): void {
    if (ids.length === 0) return
    applyingRemote = true
    try {
      const idSet = new Set(ids)
      data.value.deletedIds = (data.value.deletedIds ?? []).filter(
        (id) => !idSet.has(id)
      )
    } finally {
      applyingRemote = false
    }
    void db.tombstones.bulkDelete(ids).catch((err) => {
      console.error('[useStorage] tombstone delete failed:', err)
    })
  }

  function applyRemoteQuitPlan(plan: QuitPlan): void {
    applyingRemote = true
    try {
      data.value.quitPlan = plan
    } finally {
      applyingRemote = false
    }
    void persistAppDataMeta()
  }

  function clearRemoteQuitPlan(): void {
    applyingRemote = true
    try {
      delete data.value.quitPlan
    } finally {
      applyingRemote = false
    }
    void persistAppDataMeta()
  }

  function isApplyingRemote(): boolean {
    return applyingRemote
  }

  return {
    data,
    addEntries,
    undoLast,
    deleteDay,
    editEntryTime,
    resetAll,
    startQuitPlan,
    abandonQuitPlan,
    markSynced,
    applyServerEntries,
    consumeDeletedIds,
    applyRemoteQuitPlan,
    clearRemoteQuitPlan,
    isApplyingRemote,
  }
}
