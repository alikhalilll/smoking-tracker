import { ref, type Ref } from 'vue'

export type ThemeMode = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'smoking-tracker-theme'

function load(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved
    }
  } catch {
    // ignore
  }
  return 'system'
}

function apply(mode: ThemeMode): void {
  if (typeof document === 'undefined') return
  if (mode === 'system') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', mode)
  }
}

const mode: Ref<ThemeMode> = ref(load())

apply(mode.value)

export interface UseTheme {
  mode: Ref<ThemeMode>
  setTheme: (m: ThemeMode) => void
}

export function useTheme(): UseTheme {
  function setTheme(m: ThemeMode): void {
    mode.value = m
    try {
      localStorage.setItem(STORAGE_KEY, m)
    } catch {
      // ignore
    }
    apply(m)
  }
  return { mode, setTheme }
}
