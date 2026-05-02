import { ref, watch } from 'vue'

const STORAGE_KEY = 'smoking-tracker-data'

function getToday() {
  return new Date().toISOString().split('T')[0]
}

function getDefaultData() {
  return {
    entries: [],
    startDate: getToday(),
  }
}

export function useStorage() {
  const data = ref(load())

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return getDefaultData()
      return JSON.parse(raw)
    } catch {
      return getDefaultData()
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data.value))
    } catch (e) {
      console.error('Failed to save:', e)
    }
  }

  function addEntries(count) {
    const now = new Date().toISOString()
    const today = getToday()
    for (let i = 0; i < count; i++) {
      data.value.entries.push({ time: now, date: today })
    }
    save()
  }

  function undoLast() {
    if (data.value.entries.length > 0) {
      data.value.entries.pop()
      save()
    }
  }

  function resetAll() {
    data.value = getDefaultData()
    save()
  }

  return { data, addEntries, undoLast, resetAll }
}
