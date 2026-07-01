import { ref, computed, type ComputedRef, type Ref } from 'vue'
import { intlLocale } from '../i18n'
import { useActiveMode } from './useActiveMode'
import { ALL_CONSUMABLE_KINDS, type ConsumableKind } from '../types'

/**
 * Money-and-consumable settings for both modes. Vape supports four
 * consumables that can run out (pod / coil / bottle / disposable);
 * cigarette just has pack + cig count. Field names for vape follow
 * `pricePer{Kind}` / `puffsPer{Kind}` / `{kind}StartedAt` so the
 * generic per-kind setters can address them by string key.
 */
export interface EconomySettings {
  /** Price of a pack in `currency`. 0 disables the savings UI. */
  pricePerPack: number
  /** Number of cigarettes in a pack. Defaults to 20. */
  cigsPerPack: number

  // ── Vape consumables. Any that the user doesn't own just sits idle
  //    with `xStartedAt: null` so its ring never appears. ──
  pricePerPod: number
  puffsPerPod: number
  podStartedAt: string | null

  pricePerCoil: number
  puffsPerCoil: number
  coilStartedAt: string | null

  pricePerBottle: number
  /** Puffs a bottle lasts. E-liquid is measured in ml but we count
   *  in puffs so the same ring geometry works everywhere; typical
   *  30 ml at ~0.02 ml/puff ≈ 1500. */
  puffsPerBottle: number
  bottleStartedAt: string | null

  pricePerDisposable: number
  puffsPerDisposable: number
  disposableStartedAt: string | null

  /** Which consumable's ring occupies the home hero in vape mode. */
  heroConsumable: ConsumableKind

  /** ISO 4217 code, e.g. 'USD', 'EUR', 'EGP', 'AED'. */
  currency: string
}

const STORAGE_KEY = 'smoking-tracker-economy'

const DEFAULT_SETTINGS: EconomySettings = {
  pricePerPack: 0,
  cigsPerPack: 20,

  pricePerPod: 0,
  puffsPerPod: 600,
  podStartedAt: null,

  pricePerCoil: 0,
  puffsPerCoil: 1500,
  coilStartedAt: null,

  pricePerBottle: 0,
  puffsPerBottle: 1500,
  bottleStartedAt: null,

  pricePerDisposable: 0,
  puffsPerDisposable: 5000,
  disposableStartedAt: null,

  heroConsumable: 'pod',

  currency: 'EGP',
}

interface LegacyShape {
  pricePerCigarette?: number
}

// Per-kind field-name helpers. Centralized so the ring, settings, and
// the persistence layer never disagree on the field names — a typo
// here would silently break sync.
export function priceKeyFor(kind: ConsumableKind): keyof EconomySettings {
  switch (kind) {
    case 'pod': return 'pricePerPod'
    case 'coil': return 'pricePerCoil'
    case 'bottle': return 'pricePerBottle'
    case 'disposable': return 'pricePerDisposable'
  }
}
export function capacityKeyFor(kind: ConsumableKind): keyof EconomySettings {
  switch (kind) {
    case 'pod': return 'puffsPerPod'
    case 'coil': return 'puffsPerCoil'
    case 'bottle': return 'puffsPerBottle'
    case 'disposable': return 'puffsPerDisposable'
  }
}
export function startedAtKeyFor(kind: ConsumableKind): keyof EconomySettings {
  switch (kind) {
    case 'pod': return 'podStartedAt'
    case 'coil': return 'coilStartedAt'
    case 'bottle': return 'bottleStartedAt'
    case 'disposable': return 'disposableStartedAt'
  }
}

function coerceNumberOr(fallback: number, v: unknown, min = 0): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min) return fallback
  return v
}
function coerceIntOr(fallback: number, v: unknown, min = 1): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min) return fallback
  return Math.round(v)
}
function coerceIsoOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}
function coerceKindOr(fallback: ConsumableKind, v: unknown): ConsumableKind {
  return ALL_CONSUMABLE_KINDS.includes(v as ConsumableKind)
    ? (v as ConsumableKind)
    : fallback
}

function load(): EconomySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<EconomySettings> & LegacyShape

    // Migrate v1 (per-cigarette) → v2 (per-pack of 20). Old users keep
    // their effective price; the input switches to "pack of 20" view.
    let pricePerPack = DEFAULT_SETTINGS.pricePerPack
    if (
      typeof parsed.pricePerPack === 'number' &&
      parsed.pricePerPack >= 0
    ) {
      pricePerPack = parsed.pricePerPack
    } else if (
      typeof parsed.pricePerCigarette === 'number' &&
      parsed.pricePerCigarette > 0
    ) {
      pricePerPack = parsed.pricePerCigarette * 20
    }

    return {
      pricePerPack,
      cigsPerPack: coerceIntOr(DEFAULT_SETTINGS.cigsPerPack, parsed.cigsPerPack),

      pricePerPod: coerceNumberOr(DEFAULT_SETTINGS.pricePerPod, parsed.pricePerPod),
      puffsPerPod: coerceIntOr(DEFAULT_SETTINGS.puffsPerPod, parsed.puffsPerPod),
      podStartedAt: coerceIsoOrNull(parsed.podStartedAt),

      pricePerCoil: coerceNumberOr(DEFAULT_SETTINGS.pricePerCoil, parsed.pricePerCoil),
      puffsPerCoil: coerceIntOr(DEFAULT_SETTINGS.puffsPerCoil, parsed.puffsPerCoil),
      coilStartedAt: coerceIsoOrNull(parsed.coilStartedAt),

      pricePerBottle: coerceNumberOr(DEFAULT_SETTINGS.pricePerBottle, parsed.pricePerBottle),
      puffsPerBottle: coerceIntOr(DEFAULT_SETTINGS.puffsPerBottle, parsed.puffsPerBottle),
      bottleStartedAt: coerceIsoOrNull(parsed.bottleStartedAt),

      pricePerDisposable: coerceNumberOr(DEFAULT_SETTINGS.pricePerDisposable, parsed.pricePerDisposable),
      puffsPerDisposable: coerceIntOr(DEFAULT_SETTINGS.puffsPerDisposable, parsed.puffsPerDisposable),
      disposableStartedAt: coerceIsoOrNull(parsed.disposableStartedAt),

      heroConsumable: coerceKindOr(DEFAULT_SETTINGS.heroConsumable, parsed.heroConsumable),

      currency:
        typeof parsed.currency === 'string' && parsed.currency.length > 0
          ? parsed.currency
          : DEFAULT_SETTINGS.currency,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function persist(s: EconomySettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    // ignore
  }
}

const settings: Ref<EconomySettings> = ref(load())

export interface UseEconomy {
  settings: Ref<EconomySettings>
  /** Derived per-unit price for the currently active mode. In vape it
   *  follows `heroConsumable` — the money card should reflect whichever
   *  consumable is featured on the home ring. */
  pricePerUnit: ComputedRef<number>
  setPackPrice: (n: number) => void
  setCigsPerPack: (n: number) => void
  /** Generic per-consumable capacity setter (puffs per pod/coil/etc). */
  setConsumableCapacity: (kind: ConsumableKind, n: number) => void
  /** Generic per-consumable price setter. */
  setConsumablePrice: (kind: ConsumableKind, n: number) => void
  /** Generic per-consumable start-time setter. `null` clears the ring. */
  setConsumableStartedAt: (kind: ConsumableKind, iso: string | null) => void
  /** Picks which consumable's ring occupies the home hero. */
  setHeroConsumable: (kind: ConsumableKind) => void
  // Legacy pod-specific setters — kept for existing callers.
  setPodPrice: (n: number) => void
  setPuffsPerPod: (n: number) => void
  setPodStartedAt: (iso: string | null) => void
  setCurrency: (c: string) => void
  applyRemote: (s: EconomySettings) => void
}

// Read the active mode at the module level so the singleton computed
// reactively re-evaluates when the user flips the Home toggle.
const activeModeRef = useActiveMode().mode

const pricePerUnitSingleton: ComputedRef<number> = computed(() => {
  const s = settings.value
  if (activeModeRef.value === 'vape') {
    const price = s[priceKeyFor(s.heroConsumable)] as number
    const capacity = s[capacityKeyFor(s.heroConsumable)] as number
    if (!(price > 0) || !(capacity > 0)) return 0
    return price / capacity
  }
  if (s.pricePerPack <= 0) return 0
  return s.pricePerPack / Math.max(1, s.cigsPerPack)
})

export function useEconomy(): UseEconomy {
  function setPackPrice(n: number): void {
    settings.value = {
      ...settings.value,
      pricePerPack: Number.isFinite(n) && n >= 0 ? n : 0,
    }
    persist(settings.value)
  }
  function setCigsPerPack(n: number): void {
    settings.value = {
      ...settings.value,
      cigsPerPack: Number.isFinite(n) && n >= 1 ? Math.round(n) : 1,
    }
    persist(settings.value)
  }
  function setConsumablePrice(kind: ConsumableKind, n: number): void {
    const key = priceKeyFor(kind)
    settings.value = {
      ...settings.value,
      [key]: Number.isFinite(n) && n >= 0 ? n : 0,
    }
    persist(settings.value)
  }
  function setConsumableCapacity(kind: ConsumableKind, n: number): void {
    const key = capacityKeyFor(kind)
    settings.value = {
      ...settings.value,
      [key]: Number.isFinite(n) && n >= 1 ? Math.round(n) : 1,
    }
    persist(settings.value)
  }
  function setConsumableStartedAt(kind: ConsumableKind, iso: string | null): void {
    const key = startedAtKeyFor(kind)
    settings.value = {
      ...settings.value,
      [key]: typeof iso === 'string' && iso.length > 0 ? iso : null,
    }
    persist(settings.value)
  }
  function setHeroConsumable(kind: ConsumableKind): void {
    if (!ALL_CONSUMABLE_KINDS.includes(kind)) return
    settings.value = { ...settings.value, heroConsumable: kind }
    persist(settings.value)
  }
  function setPodPrice(n: number): void { setConsumablePrice('pod', n) }
  function setPuffsPerPod(n: number): void { setConsumableCapacity('pod', n) }
  function setPodStartedAt(iso: string | null): void { setConsumableStartedAt('pod', iso) }
  function setCurrency(c: string): void {
    settings.value = { ...settings.value, currency: c }
    persist(settings.value)
  }
  function applyRemote(s: EconomySettings): void {
    settings.value = {
      pricePerPack: coerceNumberOr(DEFAULT_SETTINGS.pricePerPack, s.pricePerPack),
      cigsPerPack: coerceIntOr(DEFAULT_SETTINGS.cigsPerPack, s.cigsPerPack),

      pricePerPod: coerceNumberOr(DEFAULT_SETTINGS.pricePerPod, s.pricePerPod),
      puffsPerPod: coerceIntOr(DEFAULT_SETTINGS.puffsPerPod, s.puffsPerPod),
      podStartedAt: coerceIsoOrNull(s.podStartedAt),

      pricePerCoil: coerceNumberOr(DEFAULT_SETTINGS.pricePerCoil, s.pricePerCoil),
      puffsPerCoil: coerceIntOr(DEFAULT_SETTINGS.puffsPerCoil, s.puffsPerCoil),
      coilStartedAt: coerceIsoOrNull(s.coilStartedAt),

      pricePerBottle: coerceNumberOr(DEFAULT_SETTINGS.pricePerBottle, s.pricePerBottle),
      puffsPerBottle: coerceIntOr(DEFAULT_SETTINGS.puffsPerBottle, s.puffsPerBottle),
      bottleStartedAt: coerceIsoOrNull(s.bottleStartedAt),

      pricePerDisposable: coerceNumberOr(DEFAULT_SETTINGS.pricePerDisposable, s.pricePerDisposable),
      puffsPerDisposable: coerceIntOr(DEFAULT_SETTINGS.puffsPerDisposable, s.puffsPerDisposable),
      disposableStartedAt: coerceIsoOrNull(s.disposableStartedAt),

      heroConsumable: coerceKindOr(DEFAULT_SETTINGS.heroConsumable, s.heroConsumable),

      currency: s.currency || 'USD',
    }
    persist(settings.value)
  }
  return {
    settings,
    pricePerUnit: pricePerUnitSingleton,
    setPackPrice,
    setCigsPerPack,
    setConsumableCapacity,
    setConsumablePrice,
    setConsumableStartedAt,
    setHeroConsumable,
    setPodPrice,
    setPuffsPerPod,
    setPodStartedAt,
    setCurrency,
    applyRemote,
  }
}

export function formatMoney(amount: number, currency: string): string {
  try {
    // Route through the active app locale so Arabic mode renders
    // Arabic-Indic digits in the currency string (e.g. "١٬٢٣٤ ج.م.").
    return new Intl.NumberFormat(intlLocale(), {
      style: 'currency',
      currency,
      maximumFractionDigits: amount >= 100 ? 0 : 2,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}
