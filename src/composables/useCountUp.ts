import { ref, watch, type Ref } from 'vue'

/**
 * Tween a number toward `target` whenever `target` changes. Returns a
 * read-only Ref that updates each animation frame for ~250ms.
 *
 * Used by the today counter and smoke-free counter so the displayed
 * number morphs instead of jumping when it changes.
 */
export function useCountUp(
  target: Ref<number>,
  durationMs = 280
): Ref<number> {
  const display = ref(target.value)
  let raf: number | null = null

  watch(target, (to, from) => {
    if (raf !== null) cancelAnimationFrame(raf)
    const start = performance.now()
    const startVal = from ?? to
    const delta = to - startVal

    const tick = (now: number): void => {
      const t = Math.min(1, (now - start) / durationMs)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3)
      display.value = Math.round(startVal + delta * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
      else raf = null
    }
    raf = requestAnimationFrame(tick)
  })

  return display
}
