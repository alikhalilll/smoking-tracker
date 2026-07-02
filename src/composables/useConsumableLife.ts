import { computed, type ComputedRef, type Ref } from 'vue'
import type { AppData, ConsumableKind } from '../types'
import {
  useEconomy,
  capacityKeyFor,
  startedAtKeyFor,
} from './useEconomy'

/**
 * Life-state for one vape consumable (pod / coil / bottle / disposable).
 * The math is identical across kinds — puffs since the "start" stamp
 * vs a rated capacity — so `kind` just picks which economy fields to
 * read. Home renders one of these as the hero ring; Settings can also
 * render several for the vape-mode reset list.
 *
 * `useStorage()` builds a fresh ref on every call, so this takes the
 * app's shared `data` ref as a parameter (same pattern as `useStats`).
 */
export interface UseConsumableLife {
  kind: ConsumableKind
  puffsThisUnit: ComputedRef<number>
  puffsRemaining: ComputedRef<number>
  lifePct: ComputedRef<number>
  overflow: ComputedRef<boolean>
  hasActive: ComputedRef<boolean>
  startNew: () => void
}

export function useConsumableLife(
  data: Ref<AppData>,
  kind: ConsumableKind
): UseConsumableLife {
  const economy = useEconomy()

  const startedAt = computed<string | null>(
    () => economy.settings.value[startedAtKeyFor(kind)] as string | null
  )
  const capacity = computed<number>(() =>
    Math.max(1, economy.settings.value[capacityKeyFor(kind)] as number)
  )

  const puffsThisUnit = computed<number>(() => {
    const startIso = startedAt.value
    if (!startIso) return 0
    const startMs = new Date(startIso).getTime()
    if (!Number.isFinite(startMs)) return 0
    let n = 0
    for (const e of data.value.entries) {
      if ((e.type ?? 'cigarette') !== 'vape') continue
      const t = new Date(e.time).getTime()
      if (t >= startMs) n += e.puffCount ?? 1
    }
    return n
  })

  const puffsRemaining = computed<number>(
    () => capacity.value - puffsThisUnit.value
  )

  const lifePct = computed<number>(() => {
    const pct = 1 - puffsThisUnit.value / capacity.value
    if (pct < 0) return 0
    if (pct > 1) return 1
    return pct
  })

  const overflow = computed<boolean>(
    () => puffsThisUnit.value > capacity.value
  )

  const hasActive = computed<boolean>(() => startedAt.value != null)

  function startNew(): void {
    economy.setConsumableStartedAt(kind, new Date().toISOString())
  }

  return {
    kind,
    puffsThisUnit,
    puffsRemaining,
    lifePct,
    overflow,
    hasActive,
    startNew,
  }
}
