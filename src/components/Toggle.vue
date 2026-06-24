<template>
  <button
    type="button"
    class="lg-switch"
    :class="{ 'is-on': modelValue, 'is-disabled': disabled }"
    :aria-pressed="modelValue"
    :aria-disabled="disabled || undefined"
    :disabled="disabled"
    @click="onClick"
  >
    <span class="lg-switch-track" aria-hidden="true" />
    <span class="lg-switch-thumb" aria-hidden="true" />
  </button>
</template>

<script setup lang="ts">
import { useHaptics } from '../composables/useHaptics'

const props = defineProps<{
  modelValue: boolean
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const haptics = useHaptics()

function onClick(): void {
  if (props.disabled) return
  haptics.fire('tap')
  emit('update:modelValue', !props.modelValue)
}
</script>

<style scoped>
/* Plain binary switch — themed off the existing CSS vars so it lives
   inside the same light/dark surface palette as every other control.
   No SVG refraction; just a tinted track + a frosted thumb that
   slides on toggle, with backdrop-filter blur for the "frosted" feel. */
.lg-switch {
  --switch-w: 48px;
  --switch-h: 28px;
  --thumb-d: 22px;
  --pad: 3px;
  position: relative;
  appearance: none;
  border: none;
  background: transparent;
  width: var(--switch-w);
  height: var(--switch-h);
  padding: 0;
  cursor: pointer;
  flex-shrink: 0;
  font-family: inherit;
}
.lg-switch.is-disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.lg-switch-track {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: var(--btn-ghost-bg);
  border: 1.5px solid var(--hairline);
  transition: background 0.22s ease, border-color 0.22s ease;
}
.lg-switch.is-on .lg-switch-track {
  background: color-mix(in srgb, var(--brand) 70%, transparent);
  border-color: color-mix(in srgb, var(--brand) 80%, transparent);
}
.lg-switch-thumb {
  position: absolute;
  top: var(--pad);
  inset-inline-start: var(--pad);
  width: var(--thumb-d);
  height: var(--thumb-d);
  border-radius: 50%;
  background: var(--card);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.4);
  transition: transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1),
    background 0.22s ease;
  will-change: transform;
}
/* Slide the thumb the width of the track minus its own size and the
   inner padding on both sides. RTL: physical translateX needs an
   explicit sign flip so the thumb still moves toward the end edge. */
.lg-switch.is-on .lg-switch-thumb {
  transform: translateX(calc(var(--switch-w) - var(--thumb-d) - var(--pad) * 2));
}
[dir='rtl'] .lg-switch.is-on .lg-switch-thumb {
  transform: translateX(calc(-1 * (var(--switch-w) - var(--thumb-d) - var(--pad) * 2)));
}
.lg-switch:active:not(.is-disabled) .lg-switch-thumb {
  filter: brightness(1.04);
}
@media (prefers-reduced-motion: reduce) {
  .lg-switch-track,
  .lg-switch-thumb {
    transition: none;
  }
}
</style>
