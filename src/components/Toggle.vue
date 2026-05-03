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
interface Props {
  modelValue: boolean
  disabled?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

function onClick(): void {
  if (props.disabled) return
  emit('update:modelValue', !props.modelValue)
}
</script>

<style scoped>
.toggle {
  appearance: none;
  border: none;
  cursor: pointer;
  width: 48px;
  height: 28px;
  border-radius: 14px;
  background: var(--faint);
  position: relative;
  transition: background 0.2s ease;
  flex-shrink: 0;
  padding: 0;
}
.toggle.on {
  background: var(--brand);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--brand) 35%, transparent);
}
.toggle.disabled {
  opacity: 0.5;
  cursor: default;
}
.thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.toggle.on .thumb {
  transform: translateX(20px);
}
[dir='rtl'] .toggle.on .thumb {
  transform: translateX(-20px);
}
</style>
