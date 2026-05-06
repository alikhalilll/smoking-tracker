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
      class="lg-seg-thumb"
      v-liquid-glass="thumbLg"
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

interface Option<V> {
  value: V
  label?: string
}

const props = defineProps<{
  modelValue: T
  options: ReadonlyArray<Option<T>>
  /** Drop the track background — useful when embedded inside another
   *  glass surface (e.g. the floating bottom nav) so we don't double up. */
  flat?: boolean
  /** Extra padding between the thumb and the track edges, in px. */
  trackPadding?: number
}>()
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
const tabWidth = computed(() => {
  if (!containerWidth.value || !N.value) return 0
  return (containerWidth.value - PADDING.value * 2) / N.value
})
const thumbHeight = computed(() => Math.max(0, containerHeight.value - PADDING.value * 2))

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

const xRatio = computed(() =>
  isPressed.value ? xDragRatio.value : currentIndex.value
)

function isActive(i: number): boolean {
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
const thumbStyle = computed(() => {
  const x = PADDING.value + xRatio.value * tabWidth.value
  return {
    width: `${tabWidth.value}px`,
    height: `${thumbHeight.value}px`,
    transform: `translateX(${x}px)`,
    transition: isDragging.value
      ? 'none'
      : 'transform 220ms cubic-bezier(0.2, 0.9, 0.2, 1)',
  }
})

const thumbLg = computed(() => ({
  surface: 'lip' as const,
  bezel: 12,
  glassThickness: 47,
  refractiveIndex: 1.5,
  specularOpacity: 0.5,
  saturation: 6,
  blur: 0.2,
  chain: 'var(--glass-blur)',
  scaleStates: { idle: 0.4, hover: 0.4, active: 0.9 },
  forceActive: isPressed.value,
}))

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
  position: absolute;
  top: 4px;
  left: 0;
  border-radius: var(--radius-pill);
  background: var(--card);
  box-shadow: 0 4px 22px rgba(0, 0, 0, 0.10),
              inset 0 1px 0 rgba(255, 255, 255, 0.55);
  /* The thumb sits visually above the tab labels so the brand-tinted
     pill paints on top, but it must NOT capture pointer events —
     taps and drags need to reach the tab buttons / root listeners. */
  z-index: 0;
  pointer-events: none;
}
.lg-seg.is-pressed .lg-seg-thumb {
  box-shadow: 0 4px 22px rgba(0, 0, 0, 0.10),
              inset 2px 7px 24px rgba(0, 0, 0, 0.09),
              inset -2px -7px 24px rgba(255, 255, 255, 0.09);
}
.lg-seg {
  cursor: grab;
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
