<template>
  <!--
    LiquidPress — global theme wrapper for any tappable input that
    should respond with the Liquid Glass press feedback (spring scale,
    opacity fade, refraction filter blooming in).

    Implements the "press-only" collapse of the spec
    (src/lib/liquidGlass/SPEC.md §10) — no drag, just press/release.

    Usage:
      <LiquidPress @click="logCigarette">
        <span class="my-button-content">Log a cigarette</span>
      </LiquidPress>

    The host element is a <button>, fully accessible (focusable,
    keyboard-activated). All four article parameters are exposed as
    props with token defaults:
  -->
  <button
    v-liquid-glass="lgOptionsWithRatio"
    v-bind="bind"
    type="button"
    class="lg-press"
    :class="{ 'is-pressed': isPressed, 'is-disabled': disabled }"
    :disabled="disabled"
    :style="rootStyle"
    @click="onClick"
  >
    <slot :is-pressed="isPressed" />
  </button>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useLiquidPress } from '../composables/useLiquidPress'
import {
  LIQUID_INPUT_TOKENS,
  type LiquidFilterParams,
  type LiquidGeometryParams,
} from '../lib/liquidGlass/tokens'

interface Props
  extends Partial<LiquidFilterParams & LiquidGeometryParams> {
  disabled?: boolean
  /**
   * If true, the component fades the white inner fill on press
   * (matching the article's thumbBgOpacity behavior). Off by default
   * for buttons that have their own brand-colored fill.
   */
  fadeOnPress?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  fadeOnPress: false,
})
const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const disabledRef = toRef(props, 'disabled')

const {
  isPressed,
  thumbScale,
  thumbBgOpacity,
  filterScaleRatio,
  lgOptions,
  bind,
} = useLiquidPress({
  blur: props.blur,
  specularOpacity: props.specularOpacity,
  specularSaturation: props.specularSaturation,
  refractionBase: props.refractionBase,
  surface: props.surface,
  bezelWidth: props.bezelWidth,
  glassThickness: props.glassThickness,
  refractiveIndex: props.refractiveIndex,
  thumbRestScale: props.thumbRestScale,
  thumbActiveScale: props.thumbActiveScale,
  disabled: disabledRef,
})

// Wire the spring-driven filterScaleRatio into the directive options
// via the `refractionRatio` field. The directive multiplies it through
// scaleStates so refractionBase changes affect the visible warp.
const lgOptionsWithRatio = computed(() => ({
  ...lgOptions.value,
  refractionRatio: filterScaleRatio.value,
}))

const restScale =
  props.thumbRestScale ?? LIQUID_INPUT_TOKENS.geometry.thumbRestScale

const rootStyle = computed(() => {
  // The `transform: scale()` mirrors thumbScale's spring so the whole
  // button breathes on press. We start at restScale so visual size
  // doesn't shift if thumbRestScale is overridden.
  const scale = thumbScale.value / restScale
  const styles: Record<string, string> = {
    transform: `scale(${scale})`,
    transition: 'none',
  }
  if (props.fadeOnPress) {
    styles.backgroundColor = `rgba(255, 255, 255, ${thumbBgOpacity.value})`
  }
  return styles
})

function onClick(e: MouseEvent): void {
  if (props.disabled) return
  emit('click', e)
}
</script>

<style scoped>
.lg-press {
  appearance: none;
  border: none;
  padding: 0;
  margin: 0;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  -webkit-user-select: none;
  /* Allow vertical page scroll; horizontal gestures aren't ours. */
  touch-action: manipulation;
  transform-origin: center;
  outline: none;
}
.lg-press:focus-visible {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 40%, transparent);
}
.lg-press.is-disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
