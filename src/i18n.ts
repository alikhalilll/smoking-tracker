import { ref, computed, type ComputedRef, type Ref } from 'vue'
import en from './locales/en'
import ar from './locales/ar'
import { metaPut, META } from './db'

export type Locale = 'en' | 'ar'

const LOCALES = { en, ar } as const

/**
 * localStorage key kept as a synchronous "pre-paint hint". Dexie is the
 * source of truth for locale, but IndexedDB is async and would flash
 * the wrong lang/dir before hydrateAll finishes. main.ts reads this
 * key synchronously before mount to set <html lang> and <html dir>.
 */
const PREPAINT_KEY = 'smoking-tracker-locale'

function coerceLocale(raw: unknown): Locale | null {
  if (raw === 'en' || raw === 'ar') return raw
  return null
}

function readPrepaintHint(): Locale {
  try {
    const coerced = coerceLocale(localStorage.getItem(PREPAINT_KEY))
    if (coerced) return coerced
  } catch {
    // ignore
  }
  if (typeof navigator !== 'undefined') {
    const lang = (navigator.language ?? '').toLowerCase()
    if (lang.startsWith('ar')) return 'ar'
  }
  return 'en'
}

export const currentLocale: Ref<Locale> = ref(readPrepaintHint())

function apply(l: Locale): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = l
  document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr'
}

apply(currentLocale.value)

/** Applied synchronously from main.ts before Dexie opens. */
export function applyPrepaintLocale(): void {
  const hint = readPrepaintHint()
  currentLocale.value = hint
  apply(hint)
}

/** Called by hydrate.ts after Dexie is open. */
export function hydrateLocaleFromDexie(value: Locale | undefined): void {
  const coerced = value ? coerceLocale(value) : null
  if (!coerced) return
  currentLocale.value = coerced
  writePrepaintHint(coerced)
  apply(coerced)
}

function writePrepaintHint(l: Locale): void {
  try {
    localStorage.setItem(PREPAINT_KEY, l)
  } catch {
    // ignore
  }
}

function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (o, k) =>
      o == null || typeof o !== 'object'
        ? undefined
        : (o as Record<string, unknown>)[k],
    obj
  )
}

function intlTagFor(loc: Locale): string {
  return loc === 'ar' ? 'ar-u-nu-arab' : 'en-US'
}

function interpolate(
  s: string,
  params: Record<string, string | number> | undefined,
  loc: Locale
): string {
  if (!params) return s
  // Numeric params are routed through the target locale's number
  // formatter so Arabic mode renders Arabic-Indic digits everywhere a
  // translation interpolates {n}, {count}, etc. — without touching
  // each call site. String params pass through verbatim.
  const tag = intlTagFor(loc)
  return s.replace(/\{(\w+)\}/g, (_, k) => {
    const v = params[k]
    if (v == null) return `{${k}}`
    if (typeof v === 'number') return new Intl.NumberFormat(tag).format(v)
    return v
  })
}

export function t(
  key: string,
  params?: Record<string, string | number>
): string {
  const loc = currentLocale.value
  const dict = LOCALES[loc]
  const found = getPath(dict, key)
  if (typeof found !== 'string') return key
  return interpolate(found, params, loc)
}

/** Look up a key in a specific locale, regardless of the current app locale. */
export function tIn(
  loc: Locale,
  key: string,
  params?: Record<string, string | number>
): string {
  const dict = LOCALES[loc]
  const found = getPath(dict, key)
  if (typeof found !== 'string') return key
  return interpolate(found, params, loc)
}

export function tArray(key: string): readonly string[] {
  const dict = LOCALES[currentLocale.value]
  const found = getPath(dict, key)
  return Array.isArray(found) ? (found as readonly string[]) : []
}

export function setLocale(l: Locale): void {
  currentLocale.value = l
  writePrepaintHint(l)
  void metaPut(META.settingsLocale, l)
  apply(l)
}

/** Apply a locale pulled from the cloud. Same effect as setLocale today,
 * but kept distinct so the sync layer has a clear callsite. */
export const applyRemoteLocale = setLocale

/** Locale tag suitable for Intl APIs.
 *
 * The bare `ar` tag yields Latin digits (CLDR's default numbering for
 * the language is `latn`); pinning the `-u-nu-arab` extension forces
 * Arabic-Indic numerals (٠١٢…) wherever Intl is used — including the
 * home stopwatch, time/date strings, and currency. */
export function intlLocale(): string {
  return intlTagFor(currentLocale.value)
}

/** Format an integer-or-decimal in the current locale's numbering
 * system. In Arabic that's Arabic-Indic (٠١٢…). Use this anywhere a
 * raw number would otherwise leak Latin digits into the UI. */
export function formatNumber(
  n: number,
  opts: Intl.NumberFormatOptions = {}
): string {
  return new Intl.NumberFormat(intlLocale(), opts).format(n)
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
