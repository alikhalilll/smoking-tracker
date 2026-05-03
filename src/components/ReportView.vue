<template>
  <DrawerRoot :open="open" @update:open="onOpenChange">
    <DrawerPortal>
      <DrawerOverlay class="sheet-overlay" />
      <DrawerContent class="sheet-content report-sheet">
        <div class="sheet-handle-row"><span class="sheet-handle" /></div>
        <div class="report-top">
          <div>
            <DrawerTitle class="brand">{{ t('report.title') }}</DrawerTitle>
            <div class="generated-at">
              {{ t('report.generated_at', { when: generatedAt }) }}
            </div>
          </div>
          <button class="close-btn" @click="emit('close')">
            {{ t('report.close') }}
          </button>
        </div>

      <!-- Summary -->
      <section class="report-section">
        <div class="section-title">{{ t('report.summary') }}</div>
        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-label">{{ t('home.total_logged') }}</div>
            <div class="summary-value">{{ totalSmoked }}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">{{ t('home.days_tracked') }}</div>
            <div class="summary-value">{{ totalDays }}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">{{ t('home.daily_avg') }}</div>
            <div class="summary-value">{{ dailyAvg }}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">{{ t('report.logged_gaps') }}</div>
            <div class="summary-value">{{ gapStats.count }}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">{{ t('history.avg_gap') }}</div>
            <div class="summary-value">
              {{ formatDuration(gapStats.avg) }}
            </div>
          </div>
          <div class="summary-card">
            <div class="summary-label">{{ t('history.longest_gap') }}</div>
            <div class="summary-value">
              {{ formatDuration(gapStats.longest) }}
            </div>
          </div>
        </div>
      </section>

      <!-- Daily timeline -->
      <section class="report-section">
        <div class="section-title">{{ t('report.last_30_days') }}</div>
        <div class="daily-chart">
          <div
            v-for="d in last30"
            :key="d.date"
            class="daily-col"
            :title="`${d.date}: ${d.count}`"
          >
            <div
              class="daily-bar"
              :style="{
                height: dailyBarHeight(d.count) + 'px',
                background:
                  d.count === 0
                    ? 'var(--bar-empty)'
                    : isToday(d.date)
                      ? 'var(--bar-today)'
                      : 'var(--bar-default)',
              }"
            />
          </div>
        </div>
        <div class="axis-row">
          <span>{{ shortDate(last30[0].date) }}</span>
          <span>{{ shortDate(last30[last30.length - 1].date) }}</span>
        </div>
      </section>

      <!-- Hourly distribution -->
      <section class="report-section">
        <div class="section-title">{{ t('report.by_hour') }}</div>
        <div class="hour-chart">
          <div v-for="b in hourlyDistribution" :key="b.hour" class="hour-col">
            <div
              class="hour-bar"
              :style="{
                height: hourBarHeight(b.count) + 'px',
                background: b.count > 0 ? 'var(--bar-default)' : 'var(--bar-empty)',
              }"
            />
          </div>
        </div>
        <div class="hour-axis">
          <span>0</span>
          <span>6</span>
          <span>12</span>
          <span>18</span>
          <span>23</span>
        </div>
        <div class="muted-line">
          {{ t('report.peak_hour') }}
          <strong>{{ peakHourLabel }}</strong>
        </div>
      </section>

      <!-- Weekday distribution -->
      <section class="report-section">
        <div class="section-title">{{ t('report.by_weekday') }}</div>
        <div class="weekday-chart">
          <div
            v-for="b in weekdayDistribution"
            :key="b.weekday"
            class="weekday-col"
          >
            <div class="weekday-value">{{ b.count || '·' }}</div>
            <div
              class="weekday-bar"
              :style="{
                height: weekdayBarHeight(b.count) + 'px',
                background: b.count > 0 ? 'var(--bar-default)' : 'var(--bar-empty)',
              }"
            />
            <div class="weekday-label">{{ b.label }}</div>
          </div>
        </div>
      </section>

      <!-- Gap distribution -->
      <section class="report-section">
        <div class="section-title">{{ t('report.gap_distribution') }}</div>
        <div class="gap-rows">
          <div v-for="b in gapDistribution" :key="b.label" class="gap-row">
            <div class="gap-row-label">{{ b.label }}</div>
            <div class="gap-row-track">
              <div
                class="gap-row-fill"
                :style="{ width: gapRowWidth(b.count) + '%' }"
              />
            </div>
            <div class="gap-row-count">{{ b.count }}</div>
          </div>
        </div>
        <div v-if="gapStats.count === 0" class="muted-line">
          {{ t('report.not_enough_data') }}
        </div>
      </section>

        <div style="height: 2rem" />
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  DrawerRoot,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerTitle,
} from 'vaul-vue'
import { formatDuration } from '../composables/useStats'
import { useI18n, intlLocale } from '../i18n'
import { getToday } from '../composables/useDate'
import type {
  DayBucket,
  GapDistributionBucket,
  GapStats,
  HourBucket,
  WeekdayBucket,
} from '../types'

const { t } = useI18n()

interface Props {
  open: boolean
  totalSmoked: number
  totalDays: number
  dailyAvg: number
  gapStats: GapStats
  last30: DayBucket[]
  hourlyDistribution: HourBucket[]
  weekdayDistribution: WeekdayBucket[]
  gapDistribution: GapDistributionBucket[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  'update:open': [value: boolean]
}>()

// Bridge vaul's open state to the parent's `close` semantics: any
// drawer-driven close (drag-down, outside tap, Esc) emits both an
// update:open(false) and our existing `close` event so callers don't
// need to know the drawer details.
function onOpenChange(v: boolean): void {
  emit('update:open', v)
  if (!v) emit('close')
}
// Reference the prop in the script section to keep TS happy in templates.
void props

const generatedAt = computed(() =>
  new Date().toLocaleString(intlLocale(), {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
)

const maxDaily = computed(() =>
  Math.max(...props.last30.map((d) => d.count), 1)
)
const maxHour = computed(() =>
  Math.max(...props.hourlyDistribution.map((b) => b.count), 1)
)
const maxWeekday = computed(() =>
  Math.max(...props.weekdayDistribution.map((b) => b.count), 1)
)
const maxGapBucket = computed(() =>
  Math.max(...props.gapDistribution.map((b) => b.count), 1)
)

const peakHourLabel = computed(() => {
  const peak = [...props.hourlyDistribution].sort(
    (a, b) => b.count - a.count
  )[0]
  if (!peak || peak.count === 0) return '—'
  return `${formatHour(peak.hour)} (${peak.count})`
})

function formatHour(h: number): string {
  if (h === 0) return '12 AM'
  if (h === 12) return '12 PM'
  return h < 12 ? `${h} AM` : `${h - 12} PM`
}

function dailyBarHeight(count: number): number {
  if (count === 0) return 3
  return Math.max(6, (count / maxDaily.value) * 80)
}

function hourBarHeight(count: number): number {
  if (count === 0) return 3
  return Math.max(4, (count / maxHour.value) * 70)
}

function weekdayBarHeight(count: number): number {
  if (count === 0) return 4
  return Math.max(10, (count / maxWeekday.value) * 80)
}

function gapRowWidth(count: number): number {
  return (count / maxGapBucket.value) * 100
}

function isToday(dateStr: string): boolean {
  return dateStr === getToday()
}

function shortDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(intlLocale(), {
    month: 'short',
    day: 'numeric',
  })
}
</script>

<style scoped>
/* Report-specific layout. Long-form content, so this sheet opts back
   into outer scroll (the base .sheet-content disables it because the
   Select list and time pickers are short and rely on inner scroll
   instead — vaul's drag handler conflicts with both having overflow). */
.report-sheet {
  padding-left: 16px;
  padding-right: 16px;
  max-height: 92vh;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}
.report-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}
.brand {
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 500;
}
.generated-at {
  font-size: 12px;
  color: var(--subtle);
  margin-top: 4px;
}
.close-btn {
  padding: 7px 14px;
  border: 1.5px solid var(--faint);
  border-radius: 8px;
  background: transparent;
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  color: var(--text);
}
.close-btn:active {
  background: var(--card);
}
.report-section {
  margin-bottom: 1.75rem;
}
.section-title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text);
  margin-bottom: 12px;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.summary-card {
  background: var(--card);
  border-radius: 10px;
  padding: 12px 14px;
}
.summary-label {
  font-size: 11px;
  color: var(--muted);
}
.summary-value {
  font-size: 18px;
  font-weight: 600;
  margin-top: 3px;
}

/* Daily chart */
.daily-chart {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 90px;
  padding: 6px 0;
}
.daily-col {
  flex: 1;
  display: flex;
  align-items: flex-end;
  height: 100%;
}
.daily-bar {
  width: 100%;
  border-radius: 2px;
  transition: height 0.3s ease;
}
.axis-row {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--subtle);
  margin-top: 4px;
}

/* Hour chart */
.hour-chart {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 80px;
  padding: 4px 0;
}
.hour-col {
  flex: 1;
  display: flex;
  align-items: flex-end;
  height: 100%;
}
.hour-bar {
  width: 100%;
  border-radius: 2px;
  transition: height 0.3s ease;
}
.hour-axis {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--subtle);
  margin-top: 4px;
}

/* Weekday chart */
.weekday-chart {
  display: flex;
  gap: 6px;
  align-items: flex-end;
  height: 110px;
}
.weekday-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}
.weekday-value {
  font-size: 11px;
  font-weight: 500;
  color: var(--text);
}
.weekday-bar {
  width: 100%;
  border-radius: 4px;
  transition: height 0.3s ease;
}
.weekday-label {
  font-size: 10px;
  color: var(--subtle);
}

/* Gap distribution */
.gap-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.gap-row {
  display: grid;
  grid-template-columns: 70px 1fr 32px;
  align-items: center;
  gap: 10px;
  font-size: 12px;
}
.gap-row-label {
  color: var(--muted);
}
.gap-row-track {
  height: 8px;
  background: var(--bar-empty);
  border-radius: 4px;
  overflow: hidden;
}
.gap-row-fill {
  height: 100%;
  background: var(--bar-default);
  border-radius: 4px;
  transition: width 0.3s ease;
}
.gap-row-count {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}
.muted-line {
  font-size: 11px;
  color: var(--subtle);
  margin-top: 8px;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
