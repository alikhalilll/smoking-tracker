import { ref, watch, type Ref } from 'vue'
import type { AppData, QuitIntensity, QuitPlan } from '../types'
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
  addEntries: (count: number) => void
  undoLast: () => void
  resetAll: () => void
  startQuitPlan: (intensity: QuitIntensity, baseline: number) => void
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
      // (the next pull will reconcile them with the server).
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

  function addEntries(count: number): void {
    const now = new Date().toISOString()
    const today = getToday()
    for (let i = 0; i < count; i++) {
      data.value.entries.push({
        id: newId(),
        time: now,
        date: today,
        synced: false,
      })
    }
    save()
  }

  function undoLast(): void {
    if (data.value.entries.length > 0) {
      data.value.entries.pop()
      save()
    }
  }

  function resetAll(): void {
    data.value = getDefaultData()
    save()
  }

  function startQuitPlan(intensity: QuitIntensity, baseline: number): void {
    const today = getToday()
    const durationDays = INTENSITY_DURATIONS[intensity]
    const plan: QuitPlan = {
      startDate: today,
      baseline,
      durationDays,
      intensity,
      targetsByDate: generateTargets(baseline, durationDays, today),
    }
    data.value.quitPlan = plan
    save()
  }

  function abandonQuitPlan(): void {
    delete data.value.quitPlan
    save()
  }

  return {
    data,
    addEntries,
    undoLast,
    resetAll,
    startQuitPlan,
    abandonQuitPlan,
  }
}
