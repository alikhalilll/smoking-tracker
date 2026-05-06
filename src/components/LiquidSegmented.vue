<template>
  <!--
    N-position segmented control with the kube.io <Switch> drag flow:

      - pointerdown anywhere on the control starts a "potential drag"
        (the article puts mousedown on the thumb, but our thumb is only
        1/N of the bar so we widen the target to the whole control)
      - window-level mousemove/touchmove updates xDragRatio in [0..N-1]
        with the same baseRatio + dx/tabWidth math
      - rubber-band overflow past the ends with damping / 22
      - on pointerup: movement < 4px is a tap (the @click on the tab
        you released over emits the selection); >= 4px is a drag and
        we snap to round(xDragRatio), suppressing the trailing click

    The thumb is the glass surface — backdrop-filter is applied to it
    via the v-liquid-glass directive with the article's lip bezel
    parameters. Track + tab labels live alongside.
  -->
  <div
    ref="rootEl"
    class="lg-seg"
    :class="{ 'is-flat': flat, 'is-pressed': isPressed }"
    role="tablist"
    @mousedown="onMouseDown"
    @touchstart.passive="onTouchStart"
  >
    <span
      v-liquid-glass="thumbLg"
      class="lg-seg-thumb"
      :style="thumbStyle"
    />
    <button
      v-for="(opt, i) in options"
      :key="opt.value"
      class="lg-seg-tab"
      :class="{ 'is-active': isActive(i) }"
      type="button"
      role="tab"
      :aria-selected="isActive(i)"
      @click="onTabClick(i, $event)"
    >
      <slot name="label" :option="opt" :active="isActive(i)">
        {{ opt.label }}
      </slot>
    </button>
  </div>
</template>

<script setup lang="ts" generic="T extends string | number">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'
import { useHaptics } from '../composables/useHaptics'
import { useSpring } from '../composables/useSpring'
import {
  LIQUID_INPUT_TOKENS,
  liquidFilterOptions,
  type LiquidFilterParams,
  type LiquidGeometryParams,
} from '../lib/liquidGlass/tokens'

interface Option<V> {
  value: V
  label?: string
}

type ComponentProps = {
  modelValue: T
  options: ReadonlyArray<Option<T>>
  /** Drop the track background — useful when embedded inside another
   *  glass surface (e.g. the floating bottom nav) so we don't double up. */
  flat?: boolean
  /** Extra padding between the thumb and the track edges, in px. */
  trackPadding?: number
} & Partial<LiquidFilterParams & LiquidGeometryParams>

const props = defineProps<ComponentProps>()
const emit = defineEmits<{ 'update:modelValue': [value: T] }>()
const haptics = useHaptics()

const rootEl = ref<HTMLDivElement | null>(null)

// === Sizing ========================================================
// We measure the container on mount and on resize. The thumb width is
// `(containerWidth - 2*PADDING) / N`; travel = thumbWidth * (N - 1).
const containerWidth = ref(0)
const containerHeight = ref(0)
const PADDING = computed(() => props.trackPadding ?? 4)

const N = computed(() => props.options.length)
// Width of one tab slot — the *visible* thumb at rest matches this.
const tabWidth = computed(() => {
  if (!containerWidth.value || !N.value) return 0
  return (containerWidth.value - PADDING.value * 2) / N.value
})
const trackHeight = computed(() => Math.max(0, containerHeight.value - PADDING.value * 2))

// Geometry constants pulled from tokens (article-faithful defaults).
// Thumb is bigger than its visible slot, scaled DOWN at rest so its
// bezel stays inside the track, and grows toward 0.9 when active for
// the "splash" effect.
const THUMB_REST_SCALE =
  props.thumbRestScale ?? LIQUID_INPUT_TOKENS.geometry.thumbRestScale
const THUMB_ACTIVE_SCALE =
  props.thumbActiveScale ?? LIQUID_INPUT_TOKENS.geometry.thumbActiveScale
// Actual (unscaled) thumb dims. Multiplying by 1/REST_SCALE keeps the
// rest-state visual size equal to the tab slot (and the active scale
// then overflows slightly into neighbors — same as Switch.tsx).
const thumbActualWidth = computed(() => tabWidth.value / THUMB_REST_SCALE)
const thumbActualHeight = computed(
  () => trackHeight.value / THUMB_REST_SCALE
)
const THUMB_REST_OFFSET = computed(
  () => ((1 - THUMB_REST_SCALE) * thumbActualWidth.value) / 2
)

// === State =========================================================
const currentIndex = computed(() => {
  const i = props.options.findIndex((o) => o.value === props.modelValue)
  return i >= 0 ? i : 0
})

const isPressed = ref(false)
const isDragging = ref(false)
/** Position in [0, N-1] (with damped overflow during drag). */
const xDragRatio = ref(0)
const initialPointerX = ref(0)
const movedFlag = ref(false)
/** Index from which the current drag started — used as the base ratio. */
const dragStartIndex = ref(0)

// === Spring state (mirrors Switch.tsx motion values) ================
// `activeRaw` = 1 while pressed, 0 otherwise. Drives every derived
// motion (scale, opacity, filter intensity); each is spring-smoothed
// individually below to match the article's per-value spring configs.
const activeRaw = computed(() => (isPressed.value ? 1 : 0))

// Thumb scale: 0.65 → 0.9, spring-smoothed.
const thumbScaleRaw = computed(
  () =>
    THUMB_REST_SCALE +
    (THUMB_ACTIVE_SCALE - THUMB_REST_SCALE) * activeRaw.value
)
const thumbScale = useSpring(
  thumbScaleRaw,
  LIQUID_INPUT_TOKENS.springs.thumbScale
)

// Background opacity on the thumb: 1 at rest → 0.1 while pressed.
const thumbBgOpacityRaw = computed(() => 1 - 0.9 * activeRaw.value)
const thumbBgOpacity = useSpring(
  thumbBgOpacityRaw,
  LIQUID_INPUT_TOKENS.springs.thumbBgOpacity
)

// Filter scale ratio: (0.4 + 0.5·active)·refractionBase.
const refractionBase =
  props.refractionBase ?? LIQUID_INPUT_TOKENS.filter.refractionBase
const filterScaleRatioRaw = computed(
  () => (0.4 + 0.5 * activeRaw.value) * refractionBase
)
const filterScaleRatio = useSpring(
  filterScaleRatioRaw,
  LIQUID_INPUT_TOKENS.springs.filterScale
)

// xRatio: thumb position in [0..N-1]. Spring-tracks xDragRatio during
// drag and currentIndex when at rest.
const xRatioTarget = computed(() =>
  isPressed.value ? xDragRatio.value : currentIndex.value
)
const xRatio = useSpring(xRatioTarget, LIQUID_INPUT_TOKENS.springs.xRatio)

function isActive(i: number): boolean {
  // While pressed, the active label tracks the snap target preview
  // (round of xDragRatio) — the article's `considerChecked`.
  if (isPressed.value) {
    return Math.round(xDragRatio.value) === i
  }
  return i === currentIndex.value
}

// === Geometry observation ==========================================
let resizeObs: ResizeObserver | null = null
function refreshSize() {
  const el = rootEl.value
  if (!el) return
  containerWidth.value = el.clientWidth
  containerHeight.value = el.clientHeight
}
onMounted(() => {
  refreshSize()
  if (typeof ResizeObserver !== 'undefined' && rootEl.value) {
    resizeObs = new ResizeObserver(() => refreshSize())
    resizeObs.observe(rootEl.value)
  }
})
onBeforeUnmount(() => {
  resizeObs?.disconnect()
  cleanupListeners()
})

// === Styles ========================================================
// Position the thumb's BOUNDING BOX so that — at rest scale 0.65 —
// the visible thumb sits exactly inside the tab slot. The rest of the
// math is verbatim from Switch.tsx: marginLeft = -REST_OFFSET +
// (slot - actual·rest)/2, and we add x = ratio·tabWidth so the
// position interpolates between segments.
const thumbStyle = computed(() => {
  const x = PADDING.value + xRatio.value * tabWidth.value
  const baseShadow = '0 4px 22px rgba(0,0,0,0.10)'
  const pressedShadow = isPressed.value
    ? ', inset 2px 7px 24px rgba(0,0,0,0.09), inset -2px -7px 24px rgba(255,255,255,0.09)'
    : ''
  const top = PADDING.value + trackHeight.value / 2
  const ml =
    -THUMB_REST_OFFSET.value +
    (tabWidth.value - thumbActualWidth.value * THUMB_REST_SCALE) / 2
  // Fade the theme-aware --card color toward transparent on press (so
  // the warped track behind shows through the glass). Doing the fade
  // via color-mix keeps the rest-state colour theme-correct in both
  // light and dark; an `rgba(255,255,255,X)` fill would always be
  // white regardless of theme.
  const opPct = (
    Math.max(0, Math.min(1, thumbBgOpacity.value)) * 100
  ).toFixed(1)
  return {
    position: 'absolute' as const,
    left: '0',
    top: `${top}px`,
    width: `${thumbActualWidth.value}px`,
    height: `${thumbActualHeight.value}px`,
    marginLeft: `${ml}px`,
    borderRadius: '999px',
    transform: `translateY(-50%) translateX(${x}px) scale(${thumbScale.value})`,
    backgroundColor: `color-mix(in srgb, var(--card) ${opPct}%, transparent)`,
    boxShadow: baseShadow + pressedShadow,
    transition: 'none',
  }
})

// Refraction lives on the THUMB (matches the article's switch). The
// thumb's backdrop is the colored track around it (--btn-ghost-bg);
// that translucent fill plus the parent card behind gives the warp
// enough contrast to read. Whole-track refraction was tried but the
// uniform card backdrop in settings made the warp invisible — only
// surfaces with rich page content behind them (the bottom nav) read
// well with whole-surface refraction.
const thumbLg = computed(() =>
  liquidFilterOptions({
    blur: props.blur,
    specularOpacity: props.specularOpacity,
    specularSaturation: props.specularSaturation,
    refractionBase: props.refractionBase,
    surface: props.surface ?? 'convex',
    bezelWidth: props.bezelWidth,
    glassThickness: props.glassThickness,
    refractiveIndex: props.refractiveIndex,
    forceActive: isPressed.value,
    refractionRatio: filterScaleRatio.value,
  })
)

// === Drag flow (mirrors Switch.tsx) ================================

function startDrag(clientX: number) {
  isPressed.value = true
  movedFlag.value = false
  initialPointerX.value = clientX
  dragStartIndex.value = currentIndex.value
  xDragRatio.value = currentIndex.value
}

function processMove(clientX: number) {
  if (!isPressed.value || tabWidth.value === 0) return
  const base = dragStartIndex.value
  const dx = clientX - initialPointerX.value
  if (Math.abs(dx) > 4) {
    isDragging.value = true
    movedFlag.value = true
  }
  const ratio = base + dx / tabWidth.value
  const max = Math.max(0, N.value - 1)
  const overflow = ratio < 0 ? -ratio : ratio > max ? ratio - max : 0
  const overflowSign = ratio < 0 ? -1 : 1
  const dampedOverflow = (overflowSign * overflow) / 22
  xDragRatio.value = Math.min(max, Math.max(0, ratio)) + dampedOverflow
}

function endDrag(clientX: number) {
  if (!isPressed.value) return
  const dx = clientX - initialPointerX.value
  const moved = Math.abs(dx) > 4
  if (moved) {
    const snapped = Math.max(0, Math.min(N.value - 1, Math.round(xDragRatio.value)))
    const next = props.options[snapped]
    if (next && next.value !== props.modelValue) {
      haptics.fire('tap')
      emit('update:modelValue', next.value)
    }
  }
  isPressed.value = false
  isDragging.value = false
}

function onMouseDown(e: MouseEvent) {
  // Only primary button. Don't preventDefault — the @click on the
  // child tab is how taps select; we just attach window listeners to
  // catch any subsequent drag.
  if (e.button !== 0) return
  startDrag(e.clientX)
  window.addEventListener('mousemove', onWindowMouseMove)
  window.addEventListener('mouseup', onWindowMouseUp)
}
function onTouchStart(e: TouchEvent) {
  const t = e.touches[0]
  if (!t) return
  startDrag(t.clientX)
  window.addEventListener('touchmove', onWindowTouchMove, { passive: false })
  window.addEventListener('touchend', onWindowTouchEnd)
  window.addEventListener('touchcancel', onWindowTouchEnd)
}
function onWindowMouseMove(e: MouseEvent) {
  processMove(e.clientX)
}
function onWindowMouseUp(e: MouseEvent) {
  endDrag(e.clientX)
  cleanupListeners()
}
function onWindowTouchMove(e: TouchEvent) {
  const t = e.touches[0]
  if (!t) return
  if (e.cancelable) e.preventDefault()
  processMove(t.clientX)
}
function onWindowTouchEnd(e: TouchEvent) {
  const t = e.changedTouches[0]
  endDrag(t ? t.clientX : initialPointerX.value)
  cleanupListeners()
}

function cleanupListeners() {
  window.removeEventListener('mousemove', onWindowMouseMove)
  window.removeEventListener('mouseup', onWindowMouseUp)
  window.removeEventListener('touchmove', onWindowTouchMove)
  window.removeEventListener('touchend', onWindowTouchEnd)
  window.removeEventListener('touchcancel', onWindowTouchEnd)
}

function onTabClick(i: number, e: MouseEvent) {
  // The post-drag synthetic click should not register as a selection —
  // the snap on release already handled it.
  if (movedFlag.value) {
    movedFlag.value = false
    e.preventDefault()
    e.stopPropagation()
    return
  }
  const next = props.options[i]
  if (!next) return
  if (next.value !== props.modelValue) {
    haptics.fire('tap')
    emit('update:modelValue', next.value)
  }
}

// If the bound value is changed externally (e.g. from a hash route),
// keep xDragRatio in sync at rest.
watch(
  () => props.modelValue,
  () => {
    if (!isPressed.value) xDragRatio.value = currentIndex.value
  }
)
</script>

<style scoped>
.lg-seg {
  position: relative;
  display: flex;
  width: 100%;
  background: var(--btn-ghost-bg);
  border-radius: var(--radius-pill);
  padding: 4px;
  user-select: none;
  -webkit-user-select: none;
  /* Allow page to pan vertically; we own horizontal gestures. */
  touch-action: pan-y;
}
.lg-seg.is-flat {
  background: transparent;
}

.lg-seg-thumb {
  /* Position / size / transform are written inline from the spring-
     driven thumbStyle. Background lives here so it can theme via
     CSS vars; pointer-events stay disabled so taps fall through to
     the tab buttons / root drag listeners. */
  pointer-events: none;
  z-index: 0;
  background: var(--card);
  box-shadow: 0 4px 22px rgba(0, 0, 0, 0.10),
              inset 0 1px 0 rgba(255, 255, 255, 0.55);
}
.lg-seg.is-pressed .lg-seg-thumb {
  box-shadow: 0 4px 22px rgba(0, 0, 0, 0.10),
              inset 2px 7px 24px rgba(0, 0, 0, 0.09),
              inset -2px -7px 24px rgba(255, 255, 255, 0.09);
}
.lg-seg.is-pressed {
  cursor: grabbing;
}

.lg-seg-tab {
  position: relative;
  z-index: 1;
  flex: 1 1 0;
  appearance: none;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
  padding: 9px 6px;
  border-radius: var(--radius-pill);
  cursor: pointer;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.2s ease;
}
.lg-seg-tab.is-active {
  color: var(--text);
}
</style>
