import { ref, type Ref } from 'vue'
import { metaPut, META } from '../db'

export type ThemeMode = 'system' | 'light' | 'dark'

/**
 * localStorage key kept as a synchronous "pre-paint hint". Dexie is the
 * source of truth, but IndexedDB is async and would flash the wrong
 * theme before hydrateAll finishes. main.ts reads this key synchronously
 * before mount to set <html data-theme>. Every write to Dexie is
 * mirrored here so the two stay in sync.
 */
const PREPAINT_KEY = 'smoking-tracker-theme'

function coerceMode(raw: unknown): ThemeMode {
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  return 'system'
}

function readPrepaintHint(): ThemeMode {
  try {
    return coerceMode(localStorage.getItem(PREPAINT_KEY))
  } catch {
    return 'system'
  }
}

function apply(m: ThemeMode): void {
  if (typeof document === 'undefined') return
  if (m === 'system') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', m)
  }
}

// Initial value comes from the pre-paint hint so the module-level ref
// is correct even before hydrateFromDexie runs. hydrateFromDexie
// upgrades it to Dexie's canonical value if they disagree.
const mode: Ref<ThemeMode> = ref(readPrepaintHint())

apply(mode.value)

/** Applied synchronously from main.ts before Dexie opens. Safe to call
 *  multiple times. */
export function applyPrepaintTheme(): void {
  const hint = readPrepaintHint()
  mode.value = hint
  apply(hint)
}

/** Called by hydrate.ts after Dexie is open. */
export function hydrateThemeFromDexie(value: ThemeMode | undefined): void {
  if (value === undefined) return
  const coerced = coerceMode(value)
  mode.value = coerced
  writePrepaintHint(coerced)
  apply(coerced)
}

function writePrepaintHint(m: ThemeMode): void {
  try {
    localStorage.setItem(PREPAINT_KEY, m)
  } catch {
    // ignore
  }
}

function persist(m: ThemeMode): void {
  writePrepaintHint(m)
  void metaPut(META.settingsTheme, m)
}

export interface UseTheme {
  mode: Ref<ThemeMode>
  setTheme: (m: ThemeMode) => void
  /** Apply a value pulled from the cloud without echoing back to push. */
  applyRemote: (m: ThemeMode) => void
}

export function useTheme(): UseTheme {
  function setTheme(m: ThemeMode): void {
    mode.value = m
    persist(m)
    apply(m)
  }
  function applyRemote(m: ThemeMode): void {
    mode.value = m
    persist(m)
    apply(m)
  }
  return { mode, setTheme, applyRemote }
}
