import { ref, watch, type Ref } from 'vue'
import type { AppData, EntryType, QuitIntensity, QuitPlan } from '../types'
import { generateTargets, INTENSITY_DURATIONS } from './useQuitPlan'
import { getToday } from './useDate'

const STORAGE_KEY = 'smoking-tracker-data'

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
}

export function useStorage(): UseStorage {
  const data: Ref<AppData> = ref(load())

  function newId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID()
    }
    // Fallback for very old browsers / non-secure contexts.
    return (
      Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
    )
  }

  function load(): AppData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return getDefaultData()
      const parsed = JSON.parse(raw) as AppData
      // Backfill IDs and assume previously-stored entries are unsynced
      // (the next pull will reconcile them with the server). Pre-v2
      // entries lack a `type` — coerce to 'cigarette' so filters and
      // counts treat them the same as they always did. We deliberately
      // do NOT flip `synced` here: the server's DB-level default for
      // `type` is also 'cigarette', so the local + server values match
      // and there's nothing to push.
      let mutated = false
      for (const e of parsed.entries) {
        if (!e.id) {
          e.id = newId()
          mutated = true
        }
        if (e.synced === undefined) {
          e.synced = false
          mutated = true
        }
        if (!e.type) {
          e.type = 'cigarette'
          mutated = true
        }
      }
      if (mutated) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
        } catch {
          // ignore
        }
      }
      return parsed
    } catch {
      return getDefaultData()
    }
  }

  function save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data.value))
    } catch (e) {
      console.error('Failed to save:', e)
    }
  }

  // Auto-persist any deep mutation (e.g. useSync flipping `synced: true`
  // on entries after a successful push). Without this, in-memory updates
  // are lost on reload and sync re-pushes the same rows → 409 collision.
  watch(data, save, { deep: true })

  function addEntries(count: number, type: EntryType): void {
    const now = new Date().toISOString()
    const today = getToday()
    for (let i = 0; i < count; i++) {
      data.value.entries.push({
        id: newId(),
        time: now,
        date: today,
        type,
        synced: false,
      })
    }
    save()
  }

  function undoLast(type: EntryType): void {
    // Find the chronologically-last entry of the requested type. We
    // walk backwards because the array is roughly time-ordered (and
    // the most-recent log is the one the user expects "undo" to act
    // on). Skip-and-find rather than reverse-sort to keep this cheap.
    for (let i = data.value.entries.length - 1; i >= 0; i--) {
      const e = data.value.entries[i]
      if ((e.type ?? 'cigarette') === type) {
        data.value.entries.splice(i, 1)
        save()
        return
      }
    }
  }

  function deleteDay(date: string, type: EntryType): void {
    data.value.entries = data.value.entries.filter(
      (e) => !(e.date === date && (e.type ?? 'cigarette') === type)
    )
    save()
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
    save()
  }

  function resetAll(): void {
    data.value = getDefaultData()
    save()
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
    save()
  }

  function abandonQuitPlan(): void {
    delete data.value.quitPlan
    // Stamp the moment of abandon so a racing pull can't restore a
    // stale server row written before this point.
    data.value.quitPlanClearedAt = Date.now()
    save()
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
  }
}
