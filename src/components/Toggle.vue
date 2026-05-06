<template>
  <button
    class="toggle"
    :class="{ on: modelValue, disabled }"
    role="switch"
    :aria-checked="modelValue"
    :disabled="disabled"
    @click="onClick"
  >
    <span class="thumb"></span>
  </button>
</template>

<script setup lang="ts">
import { useHaptics } from '../composables/useHaptics'

interface Props {
  modelValue: boolean
  disabled?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const haptics = useHaptics()

function onClick(): void {
  if (props.disabled) return
  haptics.fire('tap')
  emit('update:modelValue', !props.modelValue)
}
</script>

<style scoped>
/* iOS 18 / Telegram-style glass toggle.
   Off state: subtle inset-shadowed track that picks up the surrounding
   surface tint. On state: brand-tinted with a glossy specular line on
   top, soft glow underneath, and a thumb with a fine inner highlight. */
.toggle {
  appearance: none;
  border: none;
  cursor: pointer;
  width: 50px;
  height: 30px;
  border-radius: 15px;
  background: color-mix(in srgb, var(--muted) 18%, transparent);
  position: relative;
  transition: background 0.2s ease, box-shadow 0.2s ease;
  flex-shrink: 0;
  padding: 0;
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.10),
              inset 0 0 0 1px rgba(255, 255, 255, 0.04);
}
.toggle.on {
  background: linear-gradient(
    180deg,
    var(--brand-grad-from),
    var(--brand-grad-to)
  );
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45),
              inset 0 -1px 0 rgba(0, 0, 0, 0.10),
              0 6px 16px color-mix(in srgb, var(--brand) 38%, transparent);
}
.toggle.disabled {
  opacity: 0.5;
  cursor: default;
}
.thumb {
  position: absolute;
  top: 3px;
  inset-inline-start: 3px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(180deg, #ffffff 0%, #f4f1ec 100%);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18),
              inset 0 1px 0 rgba(255, 255, 255, 0.9),
              inset 0 -1px 0 rgba(0, 0, 0, 0.04);
  transition: transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.toggle.on .thumb {
  transform: translateX(20px);
}
[dir='rtl'] .toggle.on .thumb {
  transform: translateX(-20px);
}
[dir='rtl'] .thumb {
  inset-inline-start: 3px;
}
</style>
