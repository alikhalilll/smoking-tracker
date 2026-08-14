import { ref, type Ref } from 'vue'
import type { EntryType } from '../types'
import { metaPut, META } from '../db'

const DEFAULT_MODE: EntryType = 'cigarette'

function coerceMode(raw: unknown): EntryType {
  if (raw === 'cigarette' || raw === 'vape') return raw
  return DEFAULT_MODE
}

// Module-level singleton so every consumer (Home, Stats, Economy,
// SettingsView) sees the same ref.
const mode: Ref<EntryType> = ref(DEFAULT_MODE)

/** Called by hydrate.ts after Dexie is open. */
export function hydrateActiveModeFromDexie(
  value: EntryType | undefined
): void {
  if (value === undefined) return
  mode.value = coerceMode(value)
}

function persist(m: EntryType): void {
  void metaPut(META.settingsActiveMode, m)
}

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
