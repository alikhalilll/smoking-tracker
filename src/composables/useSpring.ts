// Critically-damped spring composable. Mirrors motion/react's
// `useSpring` API: pass a target ref/getter and stiffness/damping/mass,
// get back a Ref<number> that smoothly tracks the target.
//
// Used by Toggle and LiquidSegmented to match the kube.io article's
// Switch — every visible motion (thumb x, scale, opacity, color) is
// spring-driven so during a drag the thumb "tracks" the finger with
// slight smoothing rather than snapping 1:1.
//
// Math: F = -k·(x - target) - c·v ; a = F/m ; v += a·dt ; x += v·dt
// At default {stiffness: 1000, damping: 80, mass: 1} the system is
// slightly over-damped — fast (~50ms) settle, no overshoot.

import {
  onBeforeUnmount,
  ref,
  watch,
  type Ref,
  type WatchSource,
} from 'vue'

export interface SpringOptions {
  stiffness?: number
  damping?: number
  mass?: number
}

const SETTLE_EPSILON = 0.0005

export function useSpring(
  source: WatchSource<number>,
  opts: SpringOptions = {}
): Ref<number> {
  const stiffness = opts.stiffness ?? 1000
  const damping = opts.damping ?? 80
  const mass = opts.mass ?? 1

  const getTarget = (): number => {
    if (typeof source === 'function') return (source as () => number)()
    return (source as Ref<number>).value
  }

  const value = ref(getTarget())
  let velocity = 0
  let raf: number | null = null
  let lastTime = 0

  function step(now: number): void {
    let dt = (now - lastTime) / 1000
    if (!Number.isFinite(dt) || dt <= 0) dt = 1 / 60
    if (dt > 0.05) dt = 0.05 // cap at 50ms after a tab switch / throttle
    lastTime = now

    const target = getTarget()
    const force =
      -stiffness * (value.value - target) - damping * velocity
    velocity += (force / mass) * dt
    value.value += velocity * dt

    const settled =
      Math.abs(value.value - target) < SETTLE_EPSILON &&
      Math.abs(velocity) < SETTLE_EPSILON
    if (settled) {
      value.value = target
      velocity = 0
      raf = null
      return
    }
    raf = requestAnimationFrame(step)
  }

  function ensure(): void {
    if (raf !== null) return
    lastTime = performance.now()
    raf = requestAnimationFrame(step)
  }

  // Kick the spring whenever the source changes.
  watch(source, () => ensure(), { flush: 'sync' })

  // If the spring isn't already at the initial target (e.g. the source
  // computed differently after first read), get it moving.
  if (Math.abs(value.value - getTarget()) > SETTLE_EPSILON) ensure()

  onBeforeUnmount(() => {
    if (raf !== null) {
      cancelAnimationFrame(raf)
      raf = null
    }
  })

  return value as Ref<number>
}
