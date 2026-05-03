import { ref, computed, type ComputedRef, type Ref } from 'vue'

export interface EconomySettings {
  /** Price of a pack in `currency`. 0 disables the savings UI. */
  pricePerPack: number
  /** Number of cigarettes in a pack. Defaults to 20. */
  cigsPerPack: number
  /** ISO 4217 code, e.g. 'USD', 'EUR', 'EGP', 'AED'. */
  currency: string
}

const STORAGE_KEY = 'smoking-tracker-economy'

const DEFAULT_SETTINGS: EconomySettings = {
  pricePerPack: 0,
  cigsPerPack: 20,
  currency: 'USD',
}

interface LegacyShape {
  pricePerCigarette?: number
}

function load(): EconomySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<EconomySettings> & LegacyShape

    // Migrate v1 (per-cigarette) → v2 (per-pack of 20). Old users keep
    // their effective price; the input switches to "pack of 20" view.
    let pricePerPack = DEFAULT_SETTINGS.pricePerPack
    let cigsPerPack = DEFAULT_SETTINGS.cigsPerPack
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
    if (
      typeof parsed.cigsPerPack === 'number' &&
      parsed.cigsPerPack >= 1
    ) {
      cigsPerPack = parsed.cigsPerPack
    }

    return {
      pricePerPack,
      cigsPerPack,
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
  /** Derived per-cigarette price. 0 when no pack price is set. */
  pricePerCigarette: ComputedRef<number>
  setPackPrice: (n: number) => void
  setCigsPerPack: (n: number) => void
  setCurrency: (c: string) => void
  /** Apply a value pulled from the cloud without echoing back to push. */
  applyRemote: (s: EconomySettings) => void
}

const pricePerCigaretteSingleton: ComputedRef<number> = computed(() => {
  const s = settings.value
  if (s.pricePerPack <= 0) return 0
  const n = Math.max(1, s.cigsPerPack)
  return s.pricePerPack / n
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
  function setCurrency(c: string): void {
    settings.value = { ...settings.value, currency: c }
    persist(settings.value)
  }
  function applyRemote(s: EconomySettings): void {
    settings.value = {
      pricePerPack: Math.max(0, s.pricePerPack ?? 0),
      cigsPerPack: Math.max(1, s.cigsPerPack ?? 20),
      currency: s.currency || 'USD',
    }
    persist(settings.value)
  }
  return {
    settings,
    pricePerCigarette: pricePerCigaretteSingleton,
    setPackPrice,
    setCigsPerPack,
    setCurrency,
    applyRemote,
  }
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: amount >= 100 ? 0 : 2,
    }).format(amount)
  } catch {
    // Fallback for invalid currency codes — render as a plain number.
    return `${amount.toFixed(2)} ${currency}`
  }
}
