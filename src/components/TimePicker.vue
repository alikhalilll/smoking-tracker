<template>
  <DrawerRoot v-model:open="open">
    <DrawerTrigger as-child>
      <button type="button" class="tp-trigger">
        <span class="tp-time tabular">{{ formatted }}</span>
      </button>
    </DrawerTrigger>

    <DrawerPortal>
      <DrawerOverlay class="sheet-overlay" />
      <DrawerContent class="sheet-content">
        <div class="sheet-handle-row"><span class="sheet-handle" /></div>
        <DrawerTitle class="sheet-title">{{ t('history.edit_entry_title') }}</DrawerTitle>

        <div class="sheet-time-row">
          <div class="sheet-time-group">
            <label class="sheet-time-label">{{ t('history.edit_entry_hour') }}</label>
            <input
              type="number"
              min="1"
              max="12"
              :value="hour12"
              class="sheet-time-input"
              @input="onHourInput"
            />
          </div>
          <span class="sheet-time-sep">:</span>
          <div class="sheet-time-group">
            <label class="sheet-time-label">{{ t('history.edit_entry_minute') }}</label>
            <input
              type="number"
              min="0"
              max="59"
              :value="minutePadded"
              class="sheet-time-input"
              @input="onMinuteInput"
            />
          </div>
          <div class="sheet-period">
            <button
              type="button"
              class="sheet-period-btn"
              :class="{ active: period === 'AM' }"
              @click="setPeriod('AM')"
            >
              {{ t('history.edit_entry_am') }}
            </button>
            <button
              type="button"
              class="sheet-period-btn"
              :class="{ active: period === 'PM' }"
              @click="setPeriod('PM')"
            >
              {{ t('history.edit_entry_pm') }}
            </button>
          </div>
        </div>

        <div class="sheet-actions">
          <button type="button" class="btn btn-primary" @click="open = false">
            {{ t('history.edit_entry_save') }}
          </button>
        </div>
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
import { useI18n, intlLocale } from '../i18n'

interface Props {
  /** "HH:MM" 24-hour clock string. */
  modelValue: string
}
const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const { t } = useI18n()
const open = ref(false)

function parse(hm: string): { h: number; m: number } {
  const [hRaw, mRaw] = hm.split(':')
  const h = Math.min(23, Math.max(0, parseInt(hRaw, 10) || 0))
  const m = Math.min(59, Math.max(0, parseInt(mRaw, 10) || 0))
  return { h, m }
}
function toHm(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const parts = computed(() => parse(props.modelValue))

const hour12 = computed<number>(() => {
  const h = parts.value.h % 12
  return h === 0 ? 12 : h
})
const minutePadded = computed<string>(() =>
  String(parts.value.m).padStart(2, '0')
)
const period = computed<'AM' | 'PM'>(() => (parts.value.h >= 12 ? 'PM' : 'AM'))

// Render the trigger label via Intl so Arabic mode shows
// "٩:٠٠ ص" instead of the hand-built "9:00 AM" string.
const formatted = computed<string>(() => {
  const d = new Date()
  d.setHours(parts.value.h, parts.value.m, 0, 0)
  return d.toLocaleTimeString(intlLocale(), {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
})

function setHours24(h12: number, p: 'AM' | 'PM'): number {
  const c = Math.min(12, Math.max(1, h12))
  if (p === 'AM') return c === 12 ? 0 : c
  return c === 12 ? 12 : c + 12
}

function onHourInput(e: Event): void {
  const v = parseInt((e.target as HTMLInputElement).value, 10)
  if (!Number.isFinite(v)) return
  emit('update:modelValue', toHm(setHours24(v, period.value), parts.value.m))
}
function onMinuteInput(e: Event): void {
  const v = parseInt((e.target as HTMLInputElement).value, 10)
  if (!Number.isFinite(v)) return
  emit(
    'update:modelValue',
    toHm(parts.value.h, Math.min(59, Math.max(0, v)))
  )
}
function setPeriod(p: 'AM' | 'PM'): void {
  if (p === period.value) return
  emit('update:modelValue', toHm(setHours24(hour12.value, p), parts.value.m))
}
</script>

<style scoped>
.tp-trigger {
  appearance: none;
  border: none;
  background: transparent;
  padding: 0;
  width: 100%;
  text-align: start;
  cursor: pointer;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
}
.tp-time {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text);
}
</style>
