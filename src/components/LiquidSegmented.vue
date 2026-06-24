<template>
  <!--
    N-position segmented control with drag-snap. Stripped of the SVG
    refraction filter — the thumb is now a plain backdrop-blur card
    that lives inside the active theme palette.

    Behaviors kept:
      - pointerdown anywhere on the control starts a "potential drag"
      - window-level mousemove/touchmove updates xDragRatio in [0..N-1]
      - rubber-band overflow past the ends with damping / 22
      - on pointerup: movement < 4px is a tap (the @click on the tab
        you released over emits the selection); >= 4px is a drag and
        we snap to round(xDragRatio), suppressing the trailing click
  -->
  <div
    ref="rootEl"
    class="lg-seg"
    :class="{ 'is-flat': flat, 'is-pressed': isPressed }"
    role="tablist"
    @mousedown="onMouseDown"
    @touchstart.passive="onTouchStart"
  >
    <span class="lg-seg-thumb" :style="thumbStyle" />
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
   *  surface so we don't double up. */
  flat?: boolean
  /** Extra padding between the thumb and the track edges, in px. */
  trackPadding?: number
}>()
const emit = defineEmits<{ 'update:modelValue': [value: T] }>()
const haptics = useHaptics()

const rootEl = ref<HTMLDivElement | null>(null)

// === Sizing ========================================================
const containerWidth = ref(0)
const containerHeight = ref(0)
const PADDING = computed(() => props.trackPadding ?? 4)

const N = computed(() => props.options.length)
const tabWidth = computed(() => {
  if (!containerWidth.value || !N.value) return 0
  return (containerWidth.value - PADDING.value * 2) / N.value
})
const trackHeight = computed(() =>
  Math.max(0, containerHeight.value - PADDING.value * 2)
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
const dragStartIndex = ref(0)

// Eased thumb position. We don't reach for a spring lib — a simple
// CSS transition on `transform` handles rest-state easing, and we
// switch it off mid-drag so the thumb tracks the finger 1:1.
const xRatioDisplay = computed(() =>
  isPressed.value ? xDragRatio.value : currentIndex.value
)

function isActive(i: number): boolean {
  if (isPressed.value) {
    return Math.round(xDragRatio.value) === i
  }
  return i === currentIndex.value
}

// === Geometry observation ==========================================
const isRtl = ref(false)
let resizeObs: ResizeObserver | null = null
function refreshSize() {
  const el = rootEl.value
  if (!el) return
  containerWidth.value = el.clientWidth
  containerHeight.value = el.clientHeight
  isRtl.value = getComputedStyle(el).direction === 'rtl'
}
let dirObs: MutationObserver | null = null
onMounted(() => {
  refreshSize()
  if (typeof ResizeObserver !== 'undefined' && rootEl.value) {
    resizeObs = new ResizeObserver(() => refreshSize())
    resizeObs.observe(rootEl.value)
  }
  if (
    typeof MutationObserver !== 'undefined' &&
    typeof document !== 'undefined'
  ) {
    dirObs = new MutationObserver(() => refreshSize())
    dirObs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['dir', 'lang'],
    })
  }
})
onBeforeUnmount(() => {
  resizeObs?.disconnect()
  dirObs?.disconnect()
  cleanupListeners()
})

// === Styles ========================================================
const thumbStyle = computed(() => {
  // Anchor the thumb to the start edge (RTL flips this via insetInlineStart)
  // and use a physical translateX whose sign flips in RTL so positive
  // xRatio always moves toward the end edge visually.
  const x = PADDING.value + xRatioDisplay.value * tabWidth.value
  const tx = isRtl.value ? -x : x
  return {
    position: 'absolute' as const,
    insetInlineStart: '0',
    top: `${PADDING.value}px`,
    width: `${tabWidth.value}px`,
    height: `${trackHeight.value}px`,
    transform: `translateX(${tx}px)`,
    // Live drag = no transition (finger tracking); rest = ease in.
    transition: isPressed.value
      ? 'none'
      : 'transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1)',
  }
})

// === Drag flow =====================================================

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
  const dxRaw = clientX - initialPointerX.value
  if (Math.abs(dxRaw) > 4) {
    isDragging.value = true
    movedFlag.value = true
  }
  const dx = isRtl.value ? -dxRaw : dxRaw
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
    const snapped = Math.max(
      0,
      Math.min(N.value - 1, Math.round(xDragRatio.value))
    )
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
  border: 1px solid var(--hairline);
  border-radius: var(--radius-pill);
  padding: 4px;
  user-select: none;
  -webkit-user-select: none;
  touch-action: pan-y;
}
.lg-seg.is-flat {
  background: transparent;
  border: none;
}

.lg-seg-thumb {
  /* Plain frosted card — sits behind the active tab. The blur stays
     visible against the page background (which is what backdrop-filter
     reads); the card tint guarantees a readable surface even on
     theme variants where backdrop-filter is unsupported. */
  pointer-events: none;
  z-index: 0;
  border-radius: var(--radius-pill);
  background: var(--card);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow:
    0 2px 10px rgba(0, 0, 0, 0.10),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
}
.lg-seg.is-pressed .lg-seg-thumb {
  box-shadow:
    0 4px 14px rgba(0, 0, 0, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.45);
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
@media (prefers-reduced-motion: reduce) {
  .lg-seg-tab {
    transition: none;
  }
}
</style>
