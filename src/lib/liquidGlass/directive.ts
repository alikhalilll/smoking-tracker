// `v-liquid-glass` Vue directive — applies kube.io's physics-based
// Liquid Glass refraction to the host element. Chromium-only.
//
// Usage:
//   <button v-liquid-glass="{ surface: 'convex', bezel: 8, radius: 22 }">
//
// On bind we measure the element, compute a per-element displacement
// map and specular layer, mount a unique <filter> into a shared
// off-canvas <defs>, and set `backdrop-filter: url(#that-id)`. We
// observe size changes and recompute, but only every ~120ms so we
// don't burn the CPU during continuous resizes.
//
// Browsers that don't support `backdrop-filter: url(...)` (Safari,
// Firefox at the time of writing) are detected with @supports — we
// short-circuit and let the existing CSS .glass baseline render
// instead.

import type { Directive, DirectiveBinding } from 'vue'
import { buildDisplacementImage } from './displacementMap'
import { buildSpecularImage } from './specular'
import { imageDataToUrl } from './imageDataToUrl'
import { surfaces, type SurfaceName } from './surfaceEquations'

export interface LiquidGlassOptions {
  /** Surface curve: 'convex' for buttons & nav, 'lip' for switches. */
  surface?: SurfaceName
  /** Bezel width in CSS px. Default 8. */
  bezel?: number
  /**
   * Corner radius in CSS px. Default: half the shorter side (full pill).
   * For the nav-bar pass undefined to get a perfect pill.
   */
  radius?: number
  /** Glass thickness — bigger = stronger refraction. Default 200. */
  glassThickness?: number
  /** Refractive index. 1.5 = window glass. Default 1.5. */
  refractiveIndex?: number
  /** Specular highlight opacity 0..1. Default 0.35. */
  specularOpacity?: number
  /** Saturation bump (feColorMatrix saturate value). Default 1.4. */
  saturation?: number
  /** Gaussian blur stdDeviation. Default 6. */
  blur?: number
  /**
   * Multiplier for displacement. 1 = physically derived max; <1 softens.
   * Default 1. When `scaleStates` is provided this is ignored at runtime
   * (it just seeds the initial `idle` value).
   */
  scaleRatio?: number
  /**
   * Per-pointer-state scale ratios. When set, the directive listens to
   * pointer events and animates the SVG `feDisplacementMap.scale`
   * between states with a short rAF tween. Use this to keep idle
   * surfaces flat and only "ripple" the refraction on hover/press —
   * matches Apple's Liquid Glass interactive behavior.
   *
   * Example: `{ idle: 0.15, hover: 0.55, active: 1 }`
   */
  scaleStates?: {
    idle?: number
    hover?: number
    active?: number
  }
  /** Tween duration in ms when transitioning between scale states. Default 220. */
  transitionMs?: number
  /**
   * Extra CSS backdrop-filter chained BEFORE the SVG filter — e.g. to
   * keep the existing .glass `blur() saturate()` as the underlying
   * frosted layer. Default `var(--glass-blur)`. Pass an empty string
   * to skip.
   */
  chain?: string
}

interface State {
  filterId: string
  options: LiquidGlassOptions
  observer: ResizeObserver | null
  rafId: number | null
  lastApplied: { w: number; h: number } | null
  /** Cached <feDisplacementMap> node so we can hot-tween its `scale`. */
  dispMapEl: SVGFEDisplacementMapElement | null
  /** Physically-derived max displacement (px) for the current size. */
  maxDisplacement: number
  /** Currently rendered scale value (in pixels), driven by the rAF tween. */
  currentScale: number
  /** Target scale we're animating toward. */
  targetScale: number
  /** Active rAF id for the scale tween. */
  tweenRaf: number | null
  /** Pointer-state listeners we attached, so we can detach on unmount. */
  detachListeners: (() => void) | null
}

const STATE_KEY = '__liquidGlass'
const DEFS_ID = 'liquid-glass-defs'
const SUPPORTS_KEY = '__liquidGlassSupported'

interface ElementWithState extends HTMLElement {
  [STATE_KEY]?: State
}

interface WindowWithCache extends Window {
  [SUPPORTS_KEY]?: boolean
}

function supportsBackdropFilterUrl(): boolean {
  if (typeof window === 'undefined') return false
  const cached = (window as WindowWithCache)[SUPPORTS_KEY]
  if (typeof cached === 'boolean') return cached
  const ok =
    typeof CSS !== 'undefined' &&
    CSS.supports &&
    CSS.supports('backdrop-filter', 'url(#x)')
  ;(window as WindowWithCache)[SUPPORTS_KEY] = ok
  return ok
}

function ensureDefs(): SVGDefsElement {
  let defs = document.getElementById(DEFS_ID) as unknown as
    | SVGDefsElement
    | null
  if (defs) return defs
  const svg = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'svg'
  )
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('width', '0')
  svg.setAttribute('height', '0')
  svg.style.cssText =
    'position:absolute;width:0;height:0;pointer-events:none;'
  svg.setAttribute('color-interpolation-filters', 'sRGB')
  defs = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'defs'
  ) as SVGDefsElement
  defs.id = DEFS_ID
  svg.appendChild(defs)
  document.body.appendChild(svg)
  return defs
}

function uid(): string {
  return `lg-${Math.random().toString(36).slice(2, 9)}`
}

function setAttr(el: SVGElement, attrs: Record<string, string | number>) {
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, String(v))
  }
}

function makeFilter(
  id: string,
  opts: Required<Omit<LiquidGlassOptions, 'scaleStates'>>,
  rectW: number,
  rectH: number,
  displacementUrl: string,
  specularUrl: string,
  scale: number
): { filter: SVGFilterElement; dispMap: SVGFEDisplacementMapElement } {
  const ns = 'http://www.w3.org/2000/svg'
  const filter = document.createElementNS(ns, 'filter')
  filter.id = id
  setAttr(filter, {
    x: '0%',
    y: '0%',
    width: '100%',
    height: '100%',
    'color-interpolation-filters': 'sRGB',
  })

  const blur = document.createElementNS(ns, 'feGaussianBlur') as SVGFEGaussianBlurElement
  setAttr(blur, {
    in: 'SourceGraphic',
    stdDeviation: opts.blur,
    result: 'blurred_source',
  })
  filter.appendChild(blur)

  const dispImg = document.createElementNS(ns, 'feImage') as SVGFEImageElement
  setAttr(dispImg, {
    href: displacementUrl,
    x: 0,
    y: 0,
    width: rectW,
    height: rectH,
    result: 'displacement_map',
    preserveAspectRatio: 'none',
  })
  // Some browsers prefer xlink:href.
  dispImg.setAttributeNS(
    'http://www.w3.org/1999/xlink',
    'xlink:href',
    displacementUrl
  )
  filter.appendChild(dispImg)

  const dispMap = document.createElementNS(ns, 'feDisplacementMap') as SVGFEDisplacementMapElement
  setAttr(dispMap, {
    in: 'blurred_source',
    in2: 'displacement_map',
    scale,
    xChannelSelector: 'R',
    yChannelSelector: 'G',
    result: 'displaced',
  })
  filter.appendChild(dispMap)

  const sat = document.createElementNS(ns, 'feColorMatrix') as SVGFEColorMatrixElement
  setAttr(sat, {
    in: 'displaced',
    type: 'saturate',
    values: opts.saturation,
    result: 'displaced_saturated',
  })
  filter.appendChild(sat)

  const specImg = document.createElementNS(ns, 'feImage') as SVGFEImageElement
  setAttr(specImg, {
    href: specularUrl,
    x: 0,
    y: 0,
    width: rectW,
    height: rectH,
    result: 'specular_layer',
    preserveAspectRatio: 'none',
  })
  specImg.setAttributeNS(
    'http://www.w3.org/1999/xlink',
    'xlink:href',
    specularUrl
  )
  filter.appendChild(specImg)

  const specularSaturated = document.createElementNS(ns, 'feComposite')
  setAttr(specularSaturated, {
    in: 'displaced_saturated',
    in2: 'specular_layer',
    operator: 'in',
    result: 'specular_saturated',
  })
  filter.appendChild(specularSaturated)

  const compTransfer = document.createElementNS(ns, 'feComponentTransfer')
  setAttr(compTransfer, { in: 'specular_layer', result: 'specular_faded' })
  const funcA = document.createElementNS(ns, 'feFuncA')
  setAttr(funcA, { type: 'linear', slope: opts.specularOpacity })
  compTransfer.appendChild(funcA)
  filter.appendChild(compTransfer)

  const blend1 = document.createElementNS(ns, 'feBlend')
  setAttr(blend1, {
    in: 'specular_saturated',
    in2: 'displaced',
    mode: 'normal',
    result: 'withSaturation',
  })
  filter.appendChild(blend1)

  const blend2 = document.createElementNS(ns, 'feBlend')
  setAttr(blend2, {
    in: 'specular_faded',
    in2: 'withSaturation',
    mode: 'normal',
  })
  filter.appendChild(blend2)

  return { filter, dispMap }
}

function compute(el: HTMLElement, state: State) {
  if (!supportsBackdropFilterUrl()) return
  const rect = el.getBoundingClientRect()
  const w = Math.round(rect.width)
  const h = Math.round(rect.height)
  if (w < 4 || h < 4) return
  if (
    state.lastApplied &&
    state.lastApplied.w === w &&
    state.lastApplied.h === h
  ) {
    return
  }

  const o = state.options
  const opts: Required<Omit<LiquidGlassOptions, 'scaleStates'>> = {
    surface: o.surface ?? 'convex',
    bezel: o.bezel ?? 8,
    radius: o.radius ?? Math.min(w, h) / 2,
    glassThickness: o.glassThickness ?? 200,
    refractiveIndex: o.refractiveIndex ?? 1.5,
    specularOpacity: o.specularOpacity ?? 0.35,
    saturation: o.saturation ?? 1.4,
    blur: o.blur ?? 6,
    scaleRatio: o.scaleRatio ?? 1,
    transitionMs: o.transitionMs ?? 220,
    chain: o.chain ?? 'var(--glass-blur)',
  }

  // Clamp so radius and bezel never exceed half the shorter side, otherwise
  // the bezel math degenerates and you get a black square.
  const half = Math.min(w, h) / 2
  const radius = Math.min(opts.radius, half)
  const bezel = Math.max(2, Math.min(opts.bezel, radius - 1))

  const surface = surfaces[opts.surface] ?? surfaces.convex

  const disp = buildDisplacementImage({
    width: w,
    height: h,
    radius,
    bezelWidth: bezel,
    glassThickness: opts.glassThickness,
    refractiveIndex: opts.refractiveIndex,
    surface,
  })
  const spec = buildSpecularImage({
    width: w,
    height: h,
    radius,
    bezelWidth: bezel,
  })

  const displacementUrl = imageDataToUrl(disp.imageData)
  const specularUrl = imageDataToUrl(spec)

  const defs = ensureDefs()
  // Replace existing filter for this id so we don't leak nodes.
  const existing = document.getElementById(state.filterId)
  if (existing && existing.parentNode === defs) {
    defs.removeChild(existing)
  }
  // Pick the initial scale: if scaleStates is set, default to its idle
  // value; otherwise use the static scaleRatio. The actual SVG scale is
  // in pixels (maxDisplacement × ratio).
  const initialRatio = state.options.scaleStates?.idle ?? opts.scaleRatio
  const initialScalePx = disp.maxDisplacement * initialRatio
  const built = makeFilter(
    state.filterId,
    opts,
    w,
    h,
    displacementUrl,
    specularUrl,
    initialScalePx
  )
  defs.appendChild(built.filter)
  state.dispMapEl = built.dispMap
  state.maxDisplacement = disp.maxDisplacement
  state.currentScale = initialScalePx
  state.targetScale = initialScalePx

  const chain = opts.chain
  const filterCss = chain
    ? `${chain} url(#${state.filterId})`
    : `url(#${state.filterId})`
  el.style.setProperty('-webkit-backdrop-filter', filterCss)
  el.style.setProperty('backdrop-filter', filterCss)
  state.lastApplied = { w, h }
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function tweenScale(
  state: State,
  to: number,
  durationMs: number
): void {
  state.targetScale = to
  if (!state.dispMapEl) return
  if (state.tweenRaf != null) cancelAnimationFrame(state.tweenRaf)
  const from = state.currentScale
  if (from === to) return
  const start = performance.now()
  const tick = (now: number) => {
    const elapsed = now - start
    const t = Math.min(1, elapsed / Math.max(1, durationMs))
    const eased = easeOutCubic(t)
    const value = from + (to - from) * eased
    state.currentScale = value
    if (state.dispMapEl) {
      state.dispMapEl.setAttribute('scale', String(value))
    }
    if (t < 1) {
      state.tweenRaf = requestAnimationFrame(tick)
    } else {
      state.tweenRaf = null
    }
  }
  state.tweenRaf = requestAnimationFrame(tick)
}

function attachPointerStates(el: HTMLElement, state: State): () => void {
  const o = state.options
  const states = o.scaleStates
  if (!states) return () => {}

  const idle = states.idle ?? o.scaleRatio ?? 1
  const hover = states.hover ?? states.active ?? idle
  const active = states.active ?? hover

  const transition = o.transitionMs ?? 220

  // We use Pointer Events so touch and mouse share the same path.
  let isHovering = false
  let isPressed = false

  const update = () => {
    const ratio = isPressed ? active : isHovering ? hover : idle
    tweenScale(state, state.maxDisplacement * ratio, transition)
  }

  const onEnter = () => {
    isHovering = true
    update()
  }
  const onLeave = () => {
    isHovering = false
    isPressed = false
    update()
  }
  const onDown = () => {
    isPressed = true
    update()
  }
  const onUp = () => {
    isPressed = false
    update()
  }

  el.addEventListener('pointerenter', onEnter)
  el.addEventListener('pointerleave', onLeave)
  el.addEventListener('pointerdown', onDown)
  el.addEventListener('pointerup', onUp)
  el.addEventListener('pointercancel', onUp)

  return () => {
    el.removeEventListener('pointerenter', onEnter)
    el.removeEventListener('pointerleave', onLeave)
    el.removeEventListener('pointerdown', onDown)
    el.removeEventListener('pointerup', onUp)
    el.removeEventListener('pointercancel', onUp)
  }
}

function schedule(el: HTMLElement, state: State) {
  if (state.rafId != null) return
  state.rafId = requestAnimationFrame(() => {
    state.rafId = null
    compute(el, state)
  })
}

export const vLiquidGlass: Directive<HTMLElement, LiquidGlassOptions> = {
  mounted(el: ElementWithState, binding: DirectiveBinding<LiquidGlassOptions>) {
    if (!supportsBackdropFilterUrl()) return
    const state: State = {
      filterId: uid(),
      options: binding.value ?? {},
      observer: null,
      rafId: null,
      lastApplied: null,
      dispMapEl: null,
      maxDisplacement: 0,
      currentScale: 0,
      targetScale: 0,
      tweenRaf: null,
      detachListeners: null,
    }
    el[STATE_KEY] = state
    // Initial pass — wait one frame so layout has settled.
    schedule(el, state)
    if (typeof ResizeObserver !== 'undefined') {
      state.observer = new ResizeObserver(() => schedule(el, state))
      state.observer.observe(el)
    }
    state.detachListeners = attachPointerStates(el, state)
  },
  updated(el: ElementWithState, binding: DirectiveBinding<LiquidGlassOptions>) {
    const state = el[STATE_KEY]
    if (!state) return
    const next = binding.value ?? {}
    const prev = state.options
    if (JSON.stringify(prev) === JSON.stringify(next)) return
    state.options = next
    state.lastApplied = null
    // Re-attach pointer listeners so scaleStates changes take effect.
    state.detachListeners?.()
    state.detachListeners = attachPointerStates(el, state)
    schedule(el, state)
  },
  unmounted(el: ElementWithState) {
    const state = el[STATE_KEY]
    if (!state) return
    state.observer?.disconnect()
    if (state.rafId != null) cancelAnimationFrame(state.rafId)
    if (state.tweenRaf != null) cancelAnimationFrame(state.tweenRaf)
    state.detachListeners?.()
    const defs = document.getElementById(DEFS_ID)
    const filter = document.getElementById(state.filterId)
    if (defs && filter && filter.parentNode === defs) {
      defs.removeChild(filter)
    }
    el.style.removeProperty('-webkit-backdrop-filter')
    el.style.removeProperty('backdrop-filter')
    delete el[STATE_KEY]
  },
}
