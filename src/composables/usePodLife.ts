import { computed, type ComputedRef, type Ref } from 'vue'
import type { AppData } from '../types'
import { useEconomy } from './useEconomy'

/**
 * Pod-life state for vape mode. Puffs since `podStartedAt` are counted
 * against `puffsPerPod` to drive the pod-life ring on the home screen.
 *
 * `useStorage()` builds a fresh ref on every call, so this composable
 * takes the app's shared `data` ref as a parameter (same pattern as
 * `useStats`). Economy is a module-level singleton so we read it here.
 */
export interface UsePodLife {
  /** Vape entries with time >= podStartedAt. 0 when no pod is active. */
  puffsThisPod: ComputedRef<number>
  /** Puffs remaining before the pod hits its rated capacity. Can go
   *  negative when the user vapes past the estimate. */
  puffsRemaining: ComputedRef<number>
  /** 0..1 of pod life left. Clamped so callers can render the ring
   *  without branching. Real over/under is exposed via `podOverflow`. */
  podLifePct: ComputedRef<number>
  /** True when `puffsThisPod > puffsPerPod`. */
  podOverflow: ComputedRef<boolean>
  /** False until the user taps "start new pod" for the first time —
   *  drives the CTA in the ring's empty state. */
  hasActivePod: ComputedRef<boolean>
  /** Stamps `podStartedAt = now` via the economy composable. Rides the
   *  existing settings-sync path, so it propagates across devices. */
  startNewPod: () => void
}

export function usePodLife(data: Ref<AppData>): UsePodLife {
  const economy = useEconomy()

  const podStartedAt = computed<string | null>(
    () => economy.settings.value.podStartedAt
  )
  const puffsPerPod = computed<number>(() =>
    Math.max(1, economy.settings.value.puffsPerPod)
  )

  const puffsThisPod = computed<number>(() => {
    const startIso = podStartedAt.value
    if (!startIso) return 0
    const startMs = new Date(startIso).getTime()
    if (!Number.isFinite(startMs)) return 0
    let n = 0
    for (const e of data.value.entries) {
      if ((e.type ?? 'cigarette') !== 'vape') continue
      const t = new Date(e.time).getTime()
      if (t >= startMs) n++
    }
    return n
  })

  const puffsRemaining = computed<number>(
    () => puffsPerPod.value - puffsThisPod.value
  )

  const podLifePct = computed<number>(() => {
    const pct = 1 - puffsThisPod.value / puffsPerPod.value
    // Clamp to [0, 1] for the ring geometry. Overflow is signaled
    // separately so the UI can swap into a red state.
    if (pct < 0) return 0
    if (pct > 1) return 1
    return pct
  })

  const podOverflow = computed<boolean>(
    () => puffsThisPod.value > puffsPerPod.value
  )

  const hasActivePod = computed<boolean>(() => podStartedAt.value != null)

  function startNewPod(): void {
    economy.setPodStartedAt(new Date().toISOString())
  }

  return {
    puffsThisPod,
    puffsRemaining,
    podLifePct,
    podOverflow,
    hasActivePod,
    startNewPod,
  }
}
