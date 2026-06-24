import { ref, computed, type ComputedRef, type Ref } from 'vue'
import { intlLocale } from '../i18n'
import { useActiveMode } from './useActiveMode'

export interface EconomySettings {
  /** Price of a pack in `currency`. 0 disables the savings UI. */
  pricePerPack: number
  /** Number of cigarettes in a pack. Defaults to 20. */
  cigsPerPack: number
  /** Price of one vape pod in `currency`. 0 disables the savings UI
   *  while the user is in vape mode. */
  pricePerPod: number
  /** Estimated puffs per pod. Defaults to 600 (typical disposable). */
  puffsPerPod: number
  /** ISO 4217 code, e.g. 'USD', 'EUR', 'EGP', 'AED'. */
  currency: string
}

const STORAGE_KEY = 'smoking-tracker-economy'

const DEFAULT_SETTINGS: EconomySettings = {
  pricePerPack: 0,
  cigsPerPack: 20,
  pricePerPod: 0,
  puffsPerPod: 600,
  currency: 'EGP',
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

    let pricePerPod = DEFAULT_SETTINGS.pricePerPod
    let puffsPerPod = DEFAULT_SETTINGS.puffsPerPod
    if (typeof parsed.pricePerPod === 'number' && parsed.pricePerPod >= 0) {
      pricePerPod = parsed.pricePerPod
    }
    if (typeof parsed.puffsPerPod === 'number' && parsed.puffsPerPod >= 1) {
      puffsPerPod = parsed.puffsPerPod
    }

    return {
      pricePerPack,
      cigsPerPack,
      pricePerPod,
      puffsPerPod,
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
  /** Derived per-unit price for the currently active mode. 0 when no
   *  price is configured for that mode (cigarette → pricePerPack/cigs,
   *  vape → pricePerPod/puffs). */
  pricePerUnit: ComputedRef<number>
  setPackPrice: (n: number) => void
  setCigsPerPack: (n: number) => void
  setPodPrice: (n: number) => void
  setPuffsPerPod: (n: number) => void
  setCurrency: (c: string) => void
  /** Apply a value pulled from the cloud without echoing back to push. */
  applyRemote: (s: EconomySettings) => void
}

// Read the active mode at the module level so the singleton computed
// reactively re-evaluates when the user flips the Home toggle.
const activeModeRef = useActiveMode().mode

const pricePerUnitSingleton: ComputedRef<number> = computed(() => {
  const s = settings.value
  if (activeModeRef.value === 'vape') {
    if (s.pricePerPod <= 0) return 0
    return s.pricePerPod / Math.max(1, s.puffsPerPod)
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
  function setPodPrice(n: number): void {
    settings.value = {
      ...settings.value,
      pricePerPod: Number.isFinite(n) && n >= 0 ? n : 0,
    }
    persist(settings.value)
  }
  function setPuffsPerPod(n: number): void {
    settings.value = {
      ...settings.value,
      puffsPerPod: Number.isFinite(n) && n >= 1 ? Math.round(n) : 1,
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
      pricePerPod: Math.max(0, s.pricePerPod ?? 0),
      puffsPerPod: Math.max(1, s.puffsPerPod ?? 600),
      currency: s.currency || 'USD',
    }
    persist(settings.value)
  }
  return {
    settings,
    pricePerUnit: pricePerUnitSingleton,
    setPackPrice,
    setCigsPerPack,
    setPodPrice,
    setPuffsPerPod,
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
