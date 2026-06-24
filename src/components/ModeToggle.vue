<template>
  <div
    class="mode-toggle"
    :class="`is-${modelValue}`"
    role="tablist"
    :aria-label="ariaLabel"
  >
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      role="tab"
      :aria-selected="opt.value === modelValue"
      class="mode-tab"
      :class="{ 'is-active': opt.value === modelValue }"
      @click="select(opt.value)"
    >
      <span v-if="opt.emoji" class="mode-emoji" aria-hidden="true">{{ opt.emoji }}</span>
      <span class="mode-label">{{ opt.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts" generic="T extends string">
import { useHaptics } from '../composables/useHaptics'

interface Option {
  value: T
  label: string
  emoji?: string
}

defineProps<{
  modelValue: T
  options: ReadonlyArray<Option>
  ariaLabel?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: T] }>()
const haptics = useHaptics()

function select(v: T): void {
  haptics.fire('tap')
  emit('update:modelValue', v)
}
</script>

<style scoped>
/* Plain blurred-pill toggle. Active tab gets a tinted background +
   subtle backdrop blur, inactive tabs blur softly on hover. No SVG
   refraction filter — keeps the control fast and predictable. */
.mode-toggle {
  display: flex;
  gap: 8px;
  padding: 6px;
  border-radius: var(--radius-pill);
  background: var(--btn-ghost-bg);
  width: 100%;
}

.mode-tab {
  flex: 1 1 0;
  appearance: none;
  border: 1.5px solid transparent;
  background: transparent;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
  padding: 9px 12px;
  border-radius: var(--radius-pill);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: background 0.18s ease, color 0.18s ease,
    border-color 0.18s ease, transform 0.1s ease,
    backdrop-filter 0.18s ease;
}

.mode-tab:hover:not(.is-active) {
  background: color-mix(in srgb, var(--card) 50%, transparent);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  color: var(--text);
}

.mode-tab:active {
  transform: scale(0.97);
}

.mode-tab.is-active {
  color: var(--text);
  background: var(--card);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
}

.mode-emoji {
  font-size: 16px;
  line-height: 1;
}

/* Mode accents — cheap visual insurance against logging in the wrong
   mode. Cigarette = brand orange; vape = teal accent. The active tab
   borrows the accent on its border + a faint tint on the background. */
.mode-toggle.is-cigarette .mode-tab.is-active {
  border-color: color-mix(in srgb, var(--brand) 45%, transparent);
  background: color-mix(in srgb, var(--brand) 12%, var(--card));
}

.mode-toggle.is-vape .mode-tab.is-active {
  --vape-accent: #14b8a6;
  border-color: color-mix(in srgb, var(--vape-accent) 50%, transparent);
  background: color-mix(in srgb, var(--vape-accent) 14%, var(--card));
}

@media (prefers-reduced-motion: reduce) {
  .mode-tab {
    transition: none;
  }
}
</style>
