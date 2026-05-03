<template>
  <DrawerRoot :open="open" @update:open="(v) => emit('update:open', v)">
    <DrawerPortal>
      <DrawerOverlay class="sheet-overlay" />
      <DrawerContent class="sheet-content dtp-sheet">
        <div class="sheet-handle-row"><span class="sheet-handle" /></div>
        <DrawerTitle class="sheet-title">{{ t('history.edit_entry_title') }}</DrawerTitle>

        <!-- Read-only "this day" chip when the calendar is locked.
             Surfaces which day's entry the user is editing. -->
        <div v-if="lockDate" class="dtp-day-chip tabular">
          {{ formattedDay }}
        </div>

        <!-- Calendar (reka-ui Calendar primitive — UI library boundary
             is reka-ui per project convention). Hidden in lockDate
             mode since the day is fixed by the entry being edited. -->
        <CalendarRoot
          v-if="!lockDate"
          v-slot="{ weekDays, grid }"
          :model-value="calendarValue"
          :locale="appLocaleTag"
          :weekday-format="'short'"
          fixed-weeks
          @update:model-value="onDatePicked"
        >
          <header class="sheet-cal-header">
            <CalendarPrev class="sheet-cal-nav">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </CalendarPrev>
            <CalendarHeading class="sheet-cal-heading" />
            <CalendarNext class="sheet-cal-nav">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </CalendarNext>
          </header>

          <div class="sheet-cal-grids">
            <CalendarGrid
              v-for="month in grid"
              :key="month.value.toString()"
              class="sheet-cal-grid"
            >
              <CalendarGridHead>
                <CalendarGridRow class="sheet-cal-row">
                  <CalendarHeadCell
                    v-for="day in weekDays"
                    :key="day"
                    class="sheet-cal-head-cell"
                  >
                    {{ day }}
                  </CalendarHeadCell>
                </CalendarGridRow>
              </CalendarGridHead>
              <CalendarGridBody>
                <CalendarGridRow
                  v-for="(weekDates, idx) in month.rows"
                  :key="`row-${idx}`"
                  class="sheet-cal-row"
                >
                  <CalendarCell
                    v-for="weekDate in weekDates"
                    :key="weekDate.toString()"
                    :date="weekDate"
                    class="sheet-cal-cell"
                  >
                    <CalendarCellTrigger
                      :day="weekDate"
                      :month="month.value"
                      class="sheet-cal-trigger"
                    />
                  </CalendarCell>
                </CalendarGridRow>
              </CalendarGridBody>
            </CalendarGrid>
          </div>
        </CalendarRoot>

        <!-- Time row -->
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
          <button type="button" class="btn btn-ghost" @click="onCancel">
            {{ t('history.edit_entry_cancel') }}
          </button>
          <button type="button" class="btn btn-primary" @click="onSave">
            {{ t('history.edit_entry_save') }}
          </button>
        </div>
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  DrawerRoot,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerTitle,
} from 'vaul-vue'
import {
  CalendarRoot,
  CalendarHeading,
  CalendarPrev,
  CalendarNext,
  CalendarGrid,
  CalendarGridHead,
  CalendarGridBody,
  CalendarGridRow,
  CalendarHeadCell,
  CalendarCell,
  CalendarCellTrigger,
} from 'reka-ui'
import {
  CalendarDate,
  type DateValue,
} from '@internationalized/date'
import { useI18n, intlLocale } from '../i18n'
import { useHaptics } from '../composables/useHaptics'

interface Props {
  modelValue: Date | null
  open: boolean
  /** When true, the calendar is hidden and only time can be edited.
   *  Used by the log-edit flow ("edit in the same day"). */
  lockDate?: boolean
  /** Optional upper bound — the draft is clamped so it never exceeds
   *  this. Used to keep edits from drifting into the future. */
  maxDate?: Date | null
}
const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: Date | null]
  'update:open': [value: boolean]
}>()

const { t } = useI18n()
const appLocaleTag = computed<string>(() => intlLocale())
const haptics = useHaptics()

// Internal working copy. Reset to modelValue every time the sheet opens
// so a Cancel doesn't leak a stale draft into the next open.
const draft = ref<Date>(new Date())

watch(
  () => [props.open, props.modelValue] as const,
  ([nowOpen, mv]) => {
    if (nowOpen) draft.value = mv ? new Date(mv) : new Date()
  },
  { immediate: true }
)

const calendarValue = computed<DateValue>(() => {
  const d = draft.value
  return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
})

const formattedDay = computed<string>(() =>
  new Intl.DateTimeFormat(appLocaleTag.value, {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(draft.value)
)

function onDatePicked(v: DateValue | DateValue[] | undefined): void {
  if (!v || Array.isArray(v)) return
  const next = new Date(draft.value)
  next.setFullYear(v.year, v.month - 1, v.day)
  draft.value = next
}

const hour12 = computed<number>(() => {
  const h = draft.value.getHours() % 12
  return h === 0 ? 12 : h
})
const minutePadded = computed<string>(() =>
  String(draft.value.getMinutes()).padStart(2, '0')
)
const period = computed<'AM' | 'PM'>(() =>
  draft.value.getHours() >= 12 ? 'PM' : 'AM'
)

function setHours24(h12: number, p: 'AM' | 'PM'): number {
  const c = Math.min(12, Math.max(1, h12))
  if (p === 'AM') return c === 12 ? 0 : c
  return c === 12 ? 12 : c + 12
}

/** Clamp a candidate draft to props.maxDate so the user can't pick
 *  the future. If maxDate isn't set, return the candidate as-is. */
function clampToMax(candidate: Date): Date {
  const max = props.maxDate
  if (!max) return candidate
  return candidate.getTime() > max.getTime() ? new Date(max) : candidate
}

function onHourInput(e: Event): void {
  const v = parseInt((e.target as HTMLInputElement).value, 10)
  if (!Number.isFinite(v)) return
  const next = new Date(draft.value)
  next.setHours(setHours24(v, period.value))
  draft.value = clampToMax(next)
}
function onMinuteInput(e: Event): void {
  const v = parseInt((e.target as HTMLInputElement).value, 10)
  if (!Number.isFinite(v)) return
  const next = new Date(draft.value)
  next.setMinutes(Math.min(59, Math.max(0, v)))
  draft.value = clampToMax(next)
}
function setPeriod(p: 'AM' | 'PM'): void {
  if (p === period.value) return
  const next = new Date(draft.value)
  next.setHours(setHours24(hour12.value, p))
  draft.value = clampToMax(next)
}

function onSave(): void {
  haptics.fire('success')
  // Final clamp on Save in case maxDate moved forward (or just to be
  // belt-and-braces against any unclamped path above).
  emit('update:modelValue', clampToMax(new Date(draft.value)))
  emit('update:open', false)
}
function onCancel(): void {
  emit('update:open', false)
}
</script>

<style scoped>
/* Slightly more breathing room when the calendar is in the sheet */
.dtp-sheet {
  gap: 12px;
}

/* Read-only day chip shown when the calendar is locked */
.dtp-day-chip {
  background: var(--surface-tint);
  color: var(--text);
  border-radius: 12px;
  padding: 12px 14px;
  text-align: center;
  font-size: 14px;
  font-weight: 600;
}
</style>
