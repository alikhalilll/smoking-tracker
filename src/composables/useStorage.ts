import { ref, type Ref } from 'vue'
import type { AppData } from '../types'

const STORAGE_KEY = 'smoking-tracker-data'

function getToday(): string {
  return new Date().toISOString().split('T')[0]
}

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
}

export function useStorage(): UseStorage {
  const data: Ref<AppData> = ref(load())

  function load(): AppData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return getDefaultData()
      return JSON.parse(raw) as AppData
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

  function addEntries(count: number): void {
    const now = new Date().toISOString()
    const today = getToday()
    for (let i = 0; i < count; i++) {
      data.value.entries.push({ time: now, date: today })
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

  return { data, addEntries, undoLast, resetAll }
}
