<template>
  <DrawerRoot v-model:open="open">
    <DrawerTrigger as-child>
      <button type="button" class="select-trigger field-input">
        <span class="select-value">{{ selectedLabel }}</span>
        <span class="select-chevron" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      </button>
    </DrawerTrigger>

    <DrawerPortal>
      <DrawerOverlay class="sheet-overlay" />
      <DrawerContent class="sheet-content">
        <div class="sheet-handle-row">
          <span class="sheet-handle" />
        </div>
        <DrawerTitle class="sheet-title">{{ title || '' }}</DrawerTitle>
        <ul class="sheet-list" role="listbox">
          <li
            v-for="opt in options"
            :key="opt.value"
            role="option"
            :aria-selected="opt.value === modelValue"
            class="sheet-option"
            :class="{ active: opt.value === modelValue }"
            @click="onPick(opt.value)"
          >
            <span class="sheet-option-label">{{ opt.label }}</span>
            <span v-if="opt.value === modelValue" class="sheet-option-check" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>
            </span>
          </li>
        </ul>
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  DrawerRoot,
  DrawerTrigger,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerTitle,
} from 'vaul-vue'

export interface SelectOption {
  value: string
  label: string
}

interface Props {
  modelValue: string
  options: ReadonlyArray<SelectOption>
  /** Optional title shown at the top of the bottom sheet. */
  title?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const open = ref(false)

const selectedLabel = computed<string>(() => {
  const hit = props.options.find((o) => o.value === props.modelValue)
  return hit ? hit.label : props.modelValue
})

function onPick(v: string): void {
  emit('update:modelValue', v)
  open.value = false
}
</script>

<style scoped>
/* Trigger — matches .field-input + chevron + pointer cursor */
.select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  text-align: start;
  cursor: pointer;
  padding-inline-end: 36px;
  position: relative;
  appearance: none;
  border: 1.5px solid var(--hairline);
  background: var(--card);
  color: var(--text);
  font-family: inherit;
  font-size: 14px;
}
.select-trigger:focus-visible {
  outline: none;
  border-color: var(--brand);
  box-shadow: 0 0 0 4px var(--brand-soft);
}
.select-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.select-chevron {
  position: absolute;
  inset-inline-end: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted);
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Bottom-sheet styles are global — see styles/sheet.css. They're shared
   with TimePicker and DateTimePicker so the same look applies. */
</style>
