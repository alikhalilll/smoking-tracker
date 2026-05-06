<template>
  <!--
    Faithful port of kube.io's <Switch> from the Liquid Glass article:
    https://github.com/kube/kube.io/blob/main/app/data/articles/2025_10_04_liquid_glass_css_svg/graphics/Switch.tsx

    Behaviors carried over verbatim:
      - thumb (146×92 — bigger than the 160×67 track) sits at scale 0.65,
        grows to 0.9 while pressed
      - drag updates xDragRatio in [0..1] with damped overflow past the ends
      - tap (movement < 4px) toggles; drag past midpoint (>0.5) snaps on
      - thumb backgroundColor opacity fades (1 - 0.9·active) so the colored
        track shows through the glass during interaction
      - track backgroundColor crossfades #94949F77 → #3BBF4EEE based on
        considerChecked
      - inset shadow only while pressed
      - SVG refraction filter on the thumb itself, scale = (0.4 + 0.5·active)
        × refractionBase

    Geometry / parameters are taken directly from the article (lip bezel,
    refractiveIndex 1.5, glassThickness 47, bezelWidth 19, blur 0.2,
    specularOpacity 0.5, specularSaturation 6).

    Springs are matched with stiff CSS transitions (~30ms / cubic-bezier
    out) so the feel maps to motion/react's damping=80 stiffness=2000.
  -->
  <button
    type="button"
    class="lg-switch"
    :class="{ 'is-on': isOn, 'is-pressed': isPressed, 'is-disabled': disabled }"
    role="switch"
    :aria-checked="isOn"
    :disabled="disabled"
    :style="trackStyle"
    @click="onTrackClick"
  >
    <span
      v-liquid-glass="thumbLg"
      class="lg-switch-thumb"
      :style="thumbStyle"
      @mousedown="onMouseDown"
      @touchstart.passive="onTouchStart"
    />
  </button>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useHaptics } from '../composables/useHaptics'

interface Props {
  modelValue: boolean
  disabled?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const haptics = useHaptics()

// === Geometry (verbatim from Switch.tsx) ===========================
const SLIDER_HEIGHT = 67
const SLIDER_WIDTH = 160
const THUMB_WIDTH = 146
const THUMB_HEIGHT = 92
const THUMB_RADIUS = THUMB_HEIGHT / 2
const THUMB_REST_SCALE = 0.65
const THUMB_ACTIVE_SCALE = 0.9
const THUMB_REST_OFFSET = ((1 - THUMB_REST_SCALE) * THUMB_WIDTH) / 2
const TRAVEL =
  SLIDER_WIDTH - SLIDER_HEIGHT - (THUMB_WIDTH - THUMB_HEIGHT) * THUMB_REST_SCALE

// === Filter parameters (verbatim) ==================================
const BLUR = 0.2
const SPECULAR_OPACITY = 0.5
const SPECULAR_SATURATION = 6
const REFRACTION_BASE = 1
const GLASS_THICKNESS = 47
const BEZEL_WIDTH = 19
const REFRACTIVE_INDEX = 1.5

// === Reactive state ================================================
const isOn = computed(() => props.modelValue)
const isPressed = ref(false)
const isDragging = ref(false)
/** Position ratio along the track in [0, 1] (with damped overflow during drag). */
const xDragRatio = ref(0)
const initialPointerX = ref(0)
const movedFlag = ref(false)

// `active` is the source for opacity / scale / filter intensity.
const active = computed(() => (isPressed.value ? 1 : 0))
// Background opacity on the thumb: 1 at rest → 0.1 while pressed.
const thumbBgOpacity = computed(() => 1 - 0.9 * active.value)
// Thumb scale tween input.
const thumbScale = computed(
  () =>
    THUMB_REST_SCALE +
    (THUMB_ACTIVE_SCALE - THUMB_REST_SCALE) * active.value
)
// SVG filter scale ratio = (0.4 + 0.5·active) × refractionBase.
const filterScaleRatio = computed(
  () => (0.4 + 0.5 * active.value) * REFRACTION_BASE
)
// While pressed, considerChecked uses xDragRatio; otherwise checked.
const considerChecked = computed(() =>
  isPressed.value ? xDragRatio.value > 0.5 : isOn.value
)
// Resolved x ratio for transform (during drag follows xDragRatio).
const xRatio = computed(() =>
  isPressed.value ? xDragRatio.value : isOn.value ? 1 : 0
)

// === Styles =========================================================
const trackStyle = computed(() => ({
  width: `${SLIDER_WIDTH}px`,
  height: `${SLIDER_HEIGHT}px`,
  borderRadius: `${SLIDER_HEIGHT / 2}px`,
  backgroundColor: considerChecked.value ? '#3BBF4EEE' : '#94949F77',
}))

const thumbStyle = computed(() => {
  const x = xRatio.value * TRAVEL
  const baseShadow = '0 4px 22px rgba(0,0,0,0.1)'
  const pressedShadow = isPressed.value
    ? ', inset 2px 7px 24px rgba(0,0,0,0.09), inset -2px -7px 24px rgba(255,255,255,0.09)'
    : ''
  return {
    width: `${THUMB_WIDTH}px`,
    height: `${THUMB_HEIGHT}px`,
    borderRadius: `${THUMB_RADIUS}px`,
    marginLeft: `${
      -THUMB_REST_OFFSET +
      (SLIDER_HEIGHT - THUMB_HEIGHT * THUMB_REST_SCALE) / 2
    }px`,
    top: `${SLIDER_HEIGHT / 2}px`,
    transform: `translateY(-50%) translateX(${x}px) scale(${thumbScale.value})`,
    backgroundColor: `rgba(255, 255, 255, ${thumbBgOpacity.value})`,
    boxShadow: baseShadow + pressedShadow,
    // Disable transitions during drag for instant follow; let the spring-y
    // CSS easing handle the snap once released.
    transition: isDragging.value
      ? 'none'
      : 'transform 200ms cubic-bezier(0.2, 0.9, 0.2, 1), background-color 120ms cubic-bezier(0.2, 0.9, 0.2, 1)',
  }
})

const thumbLg = computed(() => ({
  surface: 'lip' as const,
  bezel: BEZEL_WIDTH,
  glassThickness: GLASS_THICKNESS,
  refractiveIndex: REFRACTIVE_INDEX,
  specularOpacity: SPECULAR_OPACITY,
  saturation: SPECULAR_SATURATION,
  blur: BLUR,
  chain: '',
  // The article's filter scale follows a continuous formula. We mirror
  // it with idle/active scaleStates and let the directive interpolate;
  // forceActive pins it during drag (when pointer can leave the thumb).
  scaleStates: { idle: 0.4, hover: 0.4, active: 0.9 },
  forceActive: isPressed.value,
  scaleRatio: filterScaleRatio.value,
}))

// === Pointer handling (matches Switch.tsx flow) =====================

function startDrag(clientX: number) {
  if (props.disabled) return
  isPressed.value = true
  movedFlag.value = false
  initialPointerX.value = clientX
  xDragRatio.value = isOn.value ? 1 : 0
}

function processMove(clientX: number) {
  if (!isPressed.value) return
  const baseRatio = isOn.value ? 1 : 0
  const dx = clientX - initialPointerX.value
  if (Math.abs(dx) > 4) {
    isDragging.value = true
    movedFlag.value = true
  }
  const ratio = baseRatio + dx / TRAVEL
  const overflow = ratio < 0 ? -ratio : ratio > 1 ? ratio - 1 : 0
  const overflowSign = ratio < 0 ? -1 : 1
  const dampedOverflow = (overflowSign * overflow) / 22
  xDragRatio.value = Math.min(1, Math.max(0, ratio)) + dampedOverflow
}

function endDrag(clientX: number) {
  if (!isPressed.value) return
  const dx = clientX - initialPointerX.value
  const moved = Math.abs(dx) > 4
  if (moved) {
    const next = xDragRatio.value > 0.5
    if (next !== isOn.value) {
      haptics.fire('tap')
      emit('update:modelValue', next)
    }
  }
  isPressed.value = false
  isDragging.value = false
}

function onMouseDown(e: MouseEvent) {
  if (props.disabled) return
  e.stopPropagation()
  startDrag(e.clientX)
  window.addEventListener('mousemove', onWindowMouseMove)
  window.addEventListener('mouseup', onWindowMouseUp)
}

function onTouchStart(e: TouchEvent) {
  if (props.disabled) return
  const t = e.touches[0]
  if (!t) return
  e.stopPropagation()
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
  window.removeEventListener('mousemove', onWindowMouseMove)
  window.removeEventListener('mouseup', onWindowMouseUp)
}

function onWindowTouchMove(e: TouchEvent) {
  const t = e.touches[0]
  if (!t) return
  // Prevent the page from horizontally panning while sliding.
  if (e.cancelable) e.preventDefault()
  processMove(t.clientX)
}

function onWindowTouchEnd(e: TouchEvent) {
  const t = e.changedTouches[0]
  endDrag(t ? t.clientX : initialPointerX.value)
  window.removeEventListener('touchmove', onWindowTouchMove)
  window.removeEventListener('touchend', onWindowTouchEnd)
  window.removeEventListener('touchcancel', onWindowTouchEnd)
}

function onTrackClick(e: MouseEvent) {
  // The thumb's mousedown/touchstart fire startDrag; if the pointer
  // didn't move past 4px, the click hits here and toggles. If we
  // already toggled via drag (movedFlag set), swallow this click.
  if (props.disabled) return
  if (movedFlag.value) {
    movedFlag.value = false
    e.preventDefault()
    return
  }
  haptics.fire('tap')
  emit('update:modelValue', !isOn.value)
}

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onWindowMouseMove)
  window.removeEventListener('mouseup', onWindowMouseUp)
  window.removeEventListener('touchmove', onWindowTouchMove)
  window.removeEventListener('touchend', onWindowTouchEnd)
  window.removeEventListener('touchcancel', onWindowTouchEnd)
})
</script>

<style scoped>
.lg-switch {
  appearance: none;
  border: none;
  padding: 0;
  margin: 0;
  position: relative;
  display: inline-block;
  cursor: pointer;
  font-family: inherit;
  flex-shrink: 0;
  /* Allow vertical page scroll, but block horizontal so the drag math
     isn't fighting the browser's gesture handling. */
  touch-action: pan-y;
  /* Track background transition matches the article's spring
     (damping 80, stiffness 1000). */
  transition: background-color 200ms cubic-bezier(0.2, 0.9, 0.2, 1);
  user-select: none;
  -webkit-user-select: none;
  outline: none;
}
.lg-switch:focus-visible {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 40%, transparent);
}
.lg-switch.is-disabled {
  opacity: 0.5;
  cursor: default;
}

.lg-switch-thumb {
  position: absolute;
  display: block;
  left: 0;
  pointer-events: auto;
  /* The directive sets backdrop-filter inline at runtime.
     Default everything else; transform/background/box-shadow are
     written from JS via thumbStyle. */
  will-change: transform, background-color;
}
</style>
