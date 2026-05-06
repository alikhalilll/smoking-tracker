// useLiquidPress — global theme for tappable inputs (no drag).
//
// Implements the press-only collapse of the Liquid Glass spec
// (src/lib/liquidGlass/SPEC.md §10):
//
//   isPressed = mousedown ↦ true ; mouseup/cancel/leave ↦ false
//   active    = isPressed ? 1 : 0
//
// Returns the same five spring values the Switch uses, plus a
// pre-built `lgOptions` for v-liquid-glass and a `bind` object of
// pointer handlers ready to spread on the host element. All four
// article parameters (blur / specularOpacity / specularSaturation /
// refractionBase) are configurable per call with token defaults.

import { computed, ref, type Ref } from 'vue'
import {
  LIQUID_INPUT_TOKENS,
  liquidFilterOptions,
  type LiquidFilterParams,
  type LiquidGeometryParams,
} from '../lib/liquidGlass/tokens'
import { useSpring } from './useSpring'

export interface UseLiquidPressOptions
  extends Partial<LiquidFilterParams & LiquidGeometryParams> {
  /** Disabled controls never enter pressed state. */
  disabled?: Ref<boolean> | (() => boolean)
}

export interface UseLiquidPressReturn {
  /** Pointer-down on the host element. Bind to `@mousedown / @touchstart`. */
  isPressed: Ref<boolean>
  /** Spring 1 ↔ 0.1 — for `backgroundColor: rgba(255,255,255,X)` if desired. */
  thumbBgOpacity: Ref<number>
  /** Spring 0.65 ↔ 0.9 — for `transform: scale(X)`. */
  thumbScale: Ref<number>
  /**
   * Spring on `(0.4 + 0.5·active) · refractionBase` — passed via
   * `lgOptions.refractionRatio` so the directive uses the same value
   * the user sees on every other animated property.
   */
  filterScaleRatio: Ref<number>
  /** Ready-to-bind options for `v-liquid-glass="lgOptions"`. */
  lgOptions: Ref<ReturnType<typeof liquidFilterOptions>>
  /**
   * Spread on the host: `<button v-bind="bind" v-liquid-glass="lgOptions">`.
   */
  bind: {
    onMousedown: (e: MouseEvent) => void
    onMouseup: () => void
    onMouseleave: () => void
    onTouchstart: (e: TouchEvent) => void
    onTouchend: () => void
    onTouchcancel: () => void
  }
}

function readDisabled(
  d: UseLiquidPressOptions['disabled']
): boolean {
  if (!d) return false
  if (typeof d === 'function') return d()
  return d.value
}

export function useLiquidPress(
  opts: UseLiquidPressOptions = {}
): UseLiquidPressReturn {
  const isPressed = ref(false)
  const activeRaw = computed(() => (isPressed.value ? 1 : 0))

  // Geometry tokens, used to derive the rest/active scales.
  const restScale =
    opts.thumbRestScale ?? LIQUID_INPUT_TOKENS.geometry.thumbRestScale
  const activeScale =
    opts.thumbActiveScale ?? LIQUID_INPUT_TOKENS.geometry.thumbActiveScale

  // Five springs, each with the spec's exact stiffness/damping.
  const thumbBgOpacity = useSpring(
    () => 1 - 0.9 * activeRaw.value,
    LIQUID_INPUT_TOKENS.springs.thumbBgOpacity
  )
  const thumbScale = useSpring(
    () => restScale + (activeScale - restScale) * activeRaw.value,
    LIQUID_INPUT_TOKENS.springs.thumbScale
  )

  const refractionBase =
    opts.refractionBase ?? LIQUID_INPUT_TOKENS.filter.refractionBase
  const filterScaleRatio = useSpring(
    () => (0.4 + 0.5 * activeRaw.value) * refractionBase,
    LIQUID_INPUT_TOKENS.springs.filterScale
  )

  const lgOptions = computed(() =>
    liquidFilterOptions({
      ...opts,
      forceActive: isPressed.value,
    })
  )

  function press(): void {
    if (readDisabled(opts.disabled)) return
    isPressed.value = true
  }
  function release(): void {
    isPressed.value = false
  }

  const bind = {
    onMousedown: (e: MouseEvent) => {
      if (e.button !== 0) return
      press()
    },
    onMouseup: release,
    onMouseleave: release,
    onTouchstart: (_e: TouchEvent) => press(),
    onTouchend: release,
    onTouchcancel: release,
  }

  return {
    isPressed,
    thumbBgOpacity,
    thumbScale,
    filterScaleRatio,
    lgOptions,
    bind,
  }
}
