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
import { useSpring } from '../composables/useSpring'
import {
  LIQUID_INPUT_TOKENS,
  liquidFilterOptions,
  type LiquidFilterParams,
  type LiquidGeometryParams,
} from '../lib/liquidGlass/tokens'

interface Props extends Partial<LiquidFilterParams & LiquidGeometryParams> {
  modelValue: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const haptics = useHaptics()

// === Geometry (verbatim from Switch.tsx) ===========================
const SLIDER_HEIGHT = 67
const SLIDER_WIDTH = 160
const THUMB_WIDTH = 146
const THUMB_HEIGHT = 92
const THUMB_RADIUS = THUMB_HEIGHT / 2
const THUMB_REST_SCALE = computed(
  () => props.thumbRestScale ?? LIQUID_INPUT_TOKENS.geometry.thumbRestScale
)
const THUMB_ACTIVE_SCALE = computed(
  () => props.thumbActiveScale ?? LIQUID_INPUT_TOKENS.geometry.thumbActiveScale
)
const THUMB_REST_OFFSET = computed(
  () => ((1 - THUMB_REST_SCALE.value) * THUMB_WIDTH) / 2
)
const TRAVEL = computed(
  () =>
    SLIDER_WIDTH -
    SLIDER_HEIGHT -
    (THUMB_WIDTH - THUMB_HEIGHT) * THUMB_REST_SCALE.value
)

// === Filter parameters (token-defaulted, prop-overridable) =========
const BLUR = computed(() => props.blur ?? LIQUID_INPUT_TOKENS.filter.blur)
const SPECULAR_OPACITY = computed(
  () => props.specularOpacity ?? LIQUID_INPUT_TOKENS.filter.specularOpacity
)
const SPECULAR_SATURATION = computed(
  () =>
    props.specularSaturation ?? LIQUID_INPUT_TOKENS.filter.specularSaturation
)
const REFRACTION_BASE = computed(
  () => props.refractionBase ?? LIQUID_INPUT_TOKENS.filter.refractionBase
)

// === Reactive state ================================================
const isOn = computed(() => props.modelValue)
const isPressed = ref(false)
const isDragging = ref(false)
/** Position ratio along the track in [0, 1] (with damped overflow during drag). */
const xDragRatio = ref(0)
const initialPointerX = ref(0)
const movedFlag = ref(false)

// `active` is the source for opacity / scale / filter intensity.
const activeRaw = computed(() => (isPressed.value ? 1 : 0))

// Background opacity on the thumb: 1 at rest → 0.1 while pressed.
// Spring config from tokens (springs.thumbBgOpacity).
const thumbBgOpacityRaw = computed(() => 1 - 0.9 * activeRaw.value)
const thumbBgOpacity = useSpring(
  thumbBgOpacityRaw,
  LIQUID_INPUT_TOKENS.springs.thumbBgOpacity
)

// Thumb scale: 0.65 → 0.9, spring config from tokens (springs.thumbScale).
const thumbScaleRaw = computed(
  () =>
    THUMB_REST_SCALE.value +
    (THUMB_ACTIVE_SCALE.value - THUMB_REST_SCALE.value) * activeRaw.value
)
const thumbScale = useSpring(
  thumbScaleRaw,
  LIQUID_INPUT_TOKENS.springs.thumbScale
)

// SVG filter scale ratio = (0.4 + 0.5·active) × refractionBase, then
// spring-smoothed (spec §3, springs.filterScale).
const filterScaleRatioRaw = computed(
  () => (0.4 + 0.5 * activeRaw.value) * REFRACTION_BASE.value
)
const filterScaleRatio = useSpring(
  filterScaleRatioRaw,
  LIQUID_INPUT_TOKENS.springs.filterScale
)

// During drag, considerChecked uses xDragRatio; otherwise checked.
// Spring config from tokens (springs.considerChecked).
const considerCheckedRaw = computed(() =>
  isPressed.value ? (xDragRatio.value > 0.5 ? 1 : 0) : isOn.value ? 1 : 0
)
const considerChecked = useSpring(
  considerCheckedRaw,
  LIQUID_INPUT_TOKENS.springs.considerChecked
)

// xRatio: thumb position ratio in [0..1]. During drag it follows
// xDragRatio (which itself includes rubber-band overflow), otherwise
// it's the discrete on/off. Spring config from tokens (springs.xRatio).
const xRatioTarget = computed(() =>
  isPressed.value ? xDragRatio.value : isOn.value ? 1 : 0
)
const xRatio = useSpring(xRatioTarget, LIQUID_INPUT_TOKENS.springs.xRatio)

// Mix two hex colors with alpha. Used to crossfade the track.
function mixHex(a: string, b: string, t: number): string {
  // Both inputs are 8-char hex (#RRGGBBAA) from the article.
  const ax = parseInt(a.slice(1, 3), 16)
  const ay = parseInt(a.slice(3, 5), 16)
  const az = parseInt(a.slice(5, 7), 16)
  const aa = parseInt(a.slice(7, 9), 16)
  const bx = parseInt(b.slice(1, 3), 16)
  const by = parseInt(b.slice(3, 5), 16)
  const bz = parseInt(b.slice(5, 7), 16)
  const ba = parseInt(b.slice(7, 9), 16)
  const ti = Math.max(0, Math.min(1, t))
  const r = Math.round(ax + (bx - ax) * ti)
  const g = Math.round(ay + (by - ay) * ti)
  const bl = Math.round(az + (bz - az) * ti)
  const al = Math.round(aa + (ba - aa) * ti)
  return `rgba(${r}, ${g}, ${bl}, ${(al / 255).toFixed(3)})`
}

// === Styles =========================================================
const trackStyle = computed(() => ({
  width: `${SLIDER_WIDTH}px`,
  height: `${SLIDER_HEIGHT}px`,
  borderRadius: `${SLIDER_HEIGHT / 2}px`,
  // Track color crossfades between off-grey and on-green driven by the
  // spring on considerChecked — exact colors from the tokens.
  backgroundColor: mixHex(
    LIQUID_INPUT_TOKENS.switchTrack.off,
    LIQUID_INPUT_TOKENS.switchTrack.on,
    considerChecked.value
  ),
}))

const thumbStyle = computed(() => {
  const x = xRatio.value * TRAVEL.value
  const baseShadow = '0 4px 22px rgba(0,0,0,0.1)'
  // Inset shadow appears only while pressed (verbatim from the article).
  const pressedShadow = isPressed.value
    ? ', inset 2px 7px 24px rgba(0,0,0,0.09), inset -2px -7px 24px rgba(255,255,255,0.09)'
    : ''
  return {
    width: `${THUMB_WIDTH}px`,
    height: `${THUMB_HEIGHT}px`,
    borderRadius: `${THUMB_RADIUS}px`,
    marginLeft: `${
      -THUMB_REST_OFFSET.value +
      (SLIDER_HEIGHT - THUMB_HEIGHT * THUMB_REST_SCALE.value) / 2
    }px`,
    top: `${SLIDER_HEIGHT / 2}px`,
    transform: `translateY(-50%) translateX(${x}px) scale(${thumbScale.value})`,
    backgroundColor: `rgba(255, 255, 255, ${thumbBgOpacity.value})`,
    boxShadow: baseShadow + pressedShadow,
    // No CSS transitions — every animated value is spring-driven by the
    // useSpring composables above, matching the article verbatim.
    transition: 'none',
  }
})

// Build the v-liquid-glass options from the tokens helper. Per-instance
// prop overrides flow through here, so a Toggle with refractionBase=0.5
// gets idle:0.2 / active:0.45 endpoints automatically.
const thumbLg = computed(() =>
  liquidFilterOptions({
    blur: BLUR.value,
    specularOpacity: SPECULAR_OPACITY.value,
    specularSaturation: SPECULAR_SATURATION.value,
    refractionBase: REFRACTION_BASE.value,
    surface: props.surface,
    bezelWidth: props.bezelWidth,
    glassThickness: props.glassThickness,
    refractiveIndex: props.refractiveIndex,
    forceActive: isPressed.value,
    refractionRatio: filterScaleRatio.value,
  })
)

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
  if (Math.abs(dx) > LIQUID_INPUT_TOKENS.drag.tapThreshold) {
    isDragging.value = true
    movedFlag.value = true
  }
  const ratio = baseRatio + dx / TRAVEL.value
  const overflow = ratio < 0 ? -ratio : ratio > 1 ? ratio - 1 : 0
  const overflowSign = ratio < 0 ? -1 : 1
  const dampedOverflow =
    (overflowSign * overflow) / LIQUID_INPUT_TOKENS.drag.overflowDamping
  xDragRatio.value = Math.min(1, Math.max(0, ratio)) + dampedOverflow
}

function endDrag(clientX: number) {
  if (!isPressed.value) return
  const dx = clientX - initialPointerX.value
  const moved = Math.abs(dx) > LIQUID_INPUT_TOKENS.drag.tapThreshold
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
  /* Track background is set inline from a JS-driven spring, no CSS
     transition needed — matches the article's spring on backgroundColor. */
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
