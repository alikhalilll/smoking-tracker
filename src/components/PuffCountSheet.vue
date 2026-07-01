<template>
  <DrawerRoot :open="open" @update:open="onOpenChange">
    <DrawerPortal>
      <DrawerOverlay class="sheet-overlay" />
      <DrawerContent class="sheet-content puff-sheet">
        <div class="sheet-handle-row"><span class="sheet-handle" /></div>

        <DrawerTitle class="sheet-title">
          {{ t('home.custom_sheet_title') }}
        </DrawerTitle>
        <DrawerDescription class="sheet-hint">
          {{ t('home.custom_sheet_hint') }}
        </DrawerDescription>

        <div class="preview-number tabular">{{ formatNumber(value) }}</div>

        <input
          v-model.number="value"
          class="puff-slider"
          type="range"
          min="1"
          max="100"
          step="1"
        />
        <div class="scale-row">
          <button
            v-for="tick in [5, 15, 30, 50, 100]"
            :key="tick"
            type="button"
            class="scale-tick"
            :class="{ active: value === tick }"
            @click="value = tick"
          >
            {{ formatNumber(tick) }}
          </button>
        </div>

        <div class="sheet-actions">
          <button type="button" class="btn btn-ghost" @click="onOpenChange(false)">
            {{ t('confirm.cancel') }}
          </button>
          <button type="button" class="btn btn-primary" @click="onLog">
            {{ t('home.custom_sheet_confirm', { n: formatNumber(value) }) }}
          </button>
        </div>
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  DrawerRoot,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from 'vaul-vue'
import { useI18n, formatNumber } from '../i18n'

interface Props {
  open: boolean
  /** Seed value for the slider when the sheet opens. Falls back to 15. */
  initial?: number
}

const props = withDefaults(defineProps<Props>(), { initial: 15 })
const emit = defineEmits<{
  'update:open': [open: boolean]
  log: [count: number]
}>()

const { t } = useI18n()

const value = ref<number>(clamp(props.initial))

// Re-seed on each open — the previous session's value shouldn't linger.
watch(
  () => props.open,
  (o) => {
    if (o) value.value = clamp(props.initial)
  }
)

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 15
  return Math.max(1, Math.min(100, Math.round(n)))
}

function onOpenChange(next: boolean): void {
  emit('update:open', next)
}

function onLog(): void {
  emit('log', value.value)
  emit('update:open', false)
}
</script>

<style scoped>
.puff-sheet {
  gap: 14px;
  align-items: stretch;
}
.sheet-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text);
  margin: 4px 0 0;
  text-align: center;
}
.sheet-hint {
  font-size: 12px;
  color: var(--muted);
  text-align: center;
  margin: 0;
}
.preview-number {
  font-size: 64px;
  font-weight: 800;
  color: var(--text);
  text-align: center;
  line-height: 1;
  letter-spacing: -0.03em;
  margin: 8px 0 4px;
}
.puff-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 8px;
  border-radius: 999px;
  background: var(--surface-tint);
  outline: none;
}
.puff-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: linear-gradient(135deg, #22d3c5, #14b8a6);
  border: 3px solid #fff;
  box-shadow: 0 2px 10px rgba(20, 184, 166, 0.35);
  cursor: pointer;
}
.puff-slider::-moz-range-thumb {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: linear-gradient(135deg, #22d3c5, #14b8a6);
  border: 3px solid #fff;
  box-shadow: 0 2px 10px rgba(20, 184, 166, 0.35);
  cursor: pointer;
}
.scale-row {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  margin-top: -4px;
}
.scale-tick {
  appearance: none;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  color: var(--subtle);
  padding: 4px 8px;
  border-radius: 8px;
  cursor: pointer;
}
.scale-tick.active {
  color: var(--text);
  background: var(--surface-tint);
}
</style>
