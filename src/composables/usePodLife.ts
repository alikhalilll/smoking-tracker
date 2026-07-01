import type { ComputedRef, Ref } from 'vue'
import type { AppData } from '../types'
import { useConsumableLife } from './useConsumableLife'

/**
 * Backward-compat wrapper. The pod ring predated coil / bottle /
 * disposable tracking; `useConsumableLife('pod')` is the new home for
 * this logic. Existing call sites keep their old shape.
 *
 * @deprecated Use `useConsumableLife(data, 'pod')` directly.
 */
export interface UsePodLife {
  puffsThisPod: ComputedRef<number>
  puffsRemaining: ComputedRef<number>
  podLifePct: ComputedRef<number>
  podOverflow: ComputedRef<boolean>
  hasActivePod: ComputedRef<boolean>
  startNewPod: () => void
}

export function usePodLife(data: Ref<AppData>): UsePodLife {
  const life = useConsumableLife(data, 'pod')
  return {
    puffsThisPod: life.puffsThisUnit,
    puffsRemaining: life.puffsRemaining,
    podLifePct: life.lifePct,
    podOverflow: life.overflow,
    hasActivePod: life.hasActive,
    startNewPod: life.startNew,
  }
}
