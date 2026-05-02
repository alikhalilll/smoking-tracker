import { ref, computed, type ComputedRef, type Ref } from 'vue'
import en from './locales/en'
import ar from './locales/ar'

export type Locale = 'en' | 'ar'

const LOCALES = { en, ar } as const

const STORAGE_KEY = 'smoking-tracker-locale'

function load(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'ar') return saved
  } catch {
    // ignore
  }
  if (typeof navigator !== 'undefined') {
    const lang = (navigator.language ?? '').toLowerCase()
    if (lang.startsWith('ar')) return 'ar'
  }
  return 'en'
}

export const currentLocale: Ref<Locale> = ref(load())

function apply(l: Locale): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = l
  document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr'
}

apply(currentLocale.value)

function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (o, k) =>
      o == null || typeof o !== 'object'
        ? undefined
        : (o as Record<string, unknown>)[k],
    obj
  )
}

function interpolate(
  s: string,
  params?: Record<string, string | number>
): string {
  if (!params) return s
  return s.replace(/\{(\w+)\}/g, (_, k) =>
    params[k] != null ? String(params[k]) : `{${k}}`
  )
}

export function t(
  key: string,
  params?: Record<string, string | number>
): string {
  const dict = LOCALES[currentLocale.value]
  const found = getPath(dict, key)
  if (typeof found !== 'string') return key
  return interpolate(found, params)
}

export function tArray(key: string): readonly string[] {
  const dict = LOCALES[currentLocale.value]
  const found = getPath(dict, key)
  return Array.isArray(found) ? (found as readonly string[]) : []
}

export function setLocale(l: Locale): void {
  currentLocale.value = l
  try {
    localStorage.setItem(STORAGE_KEY, l)
  } catch {
    // ignore
  }
  apply(l)
}

/** Locale tag suitable for Intl APIs. */
export function intlLocale(): string {
  return currentLocale.value === 'ar' ? 'ar' : 'en-US'
}

export interface UseI18n {
  locale: Ref<Locale>
  setLocale: (l: Locale) => void
  t: typeof t
  tArray: typeof tArray
  isRtl: ComputedRef<boolean>
}

export function useI18n(): UseI18n {
  const isRtl = computed(() => currentLocale.value === 'ar')
  return { locale: currentLocale, setLocale, t, tArray, isRtl }
}
