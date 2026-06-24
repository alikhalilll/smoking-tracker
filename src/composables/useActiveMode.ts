import { ref, type Ref } from 'vue'
import type { EntryType } from '../types'

const STORAGE_KEY = 'smoking-tracker-active-mode'
const DEFAULT_MODE: EntryType = 'cigarette'

function load(): EntryType {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'cigarette' || raw === 'vape') return raw
    return DEFAULT_MODE
  } catch {
    return DEFAULT_MODE
  }
}

function persist(m: EntryType): void {
  try {
    localStorage.setItem(STORAGE_KEY, m)
  } catch {
    // ignore
  }
}

// Module-level singleton so every consumer (Home, Stats, Economy,
// SettingsView) sees the same ref. Mirrors the useEconomy pattern.
const mode: Ref<EntryType> = ref(load())

export interface UseActiveMode {
  mode: Ref<EntryType>
  setMode: (m: EntryType) => void
  /** Apply a value pulled from the cloud without echoing back to push.
   *  Consumed by useSettingsSync. */
  applyRemote: (m: EntryType) => void
}

export function useActiveMode(): UseActiveMode {
  function setMode(m: EntryType): void {
    if (m !== 'cigarette' && m !== 'vape') return
    if (mode.value === m) return
    mode.value = m
    persist(m)
  }
  function applyRemote(m: EntryType): void {
    if (m !== 'cigarette' && m !== 'vape') return
    mode.value = m
    persist(m)
  }
  return { mode, setMode, applyRemote }
}
