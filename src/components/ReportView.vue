<template>
  <DrawerRoot :open="open" @update:open="onOpenChange">
    <DrawerPortal>
      <DrawerOverlay class="sheet-overlay" />
      <DrawerContent class="sheet-content report-sheet">
        <div class="sheet-handle-row"><span class="sheet-handle" /></div>
        <div class="report-scroll">
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

      <!-- Summary. Uses the shared <StatsCard> so the report reads as
           a natural extension of the dashboard. Tints cycle so no two
           adjacent cards share a hue. -->
      <section v-reveal class="report-section">
        <div class="section-title">{{ t('report.summary') }}</div>
        <div class="summary-grid">
          <StatsCard tint="peach" :label="t('home.total_logged')" :value="formatNumber(totalSmoked)">
            <template #icon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="4" rx="1"/><path d="M17 11V9M20 11V9"/></svg>
            </template>
            <template #flourish>
              <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="60" y="46" width="8" height="30" rx="1"/>
                <rect x="72" y="30" width="8" height="46" rx="1"/>
                <rect x="84" y="52" width="8" height="24" rx="1"/>
                <rect x="96" y="38" width="8" height="38" rx="1"/>
              </svg>
            </template>
          </StatsCard>
          <StatsCard tint="mint" :label="t('home.days_tracked')" :value="formatNumber(totalDays)">
            <template #icon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M8 3v4M16 3v4"/></svg>
            </template>
            <template #flourish>
              <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="66" y="30" width="34" height="34" rx="4"/>
                <path d="M66 42 L100 42"/>
                <path d="M74 30 V26 M92 30 V26"/>
              </svg>
            </template>
          </StatsCard>
          <StatsCard tint="lavender" :label="t('home.daily_avg')" :value="formatNumber(dailyAvg)">
            <template #icon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M7 15l3.5-3.5 3 3L21 6"/><path d="M17 6h4v4"/></svg>
            </template>
            <template #flourish>
              <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 82 Q30 62 48 74 T96 56"/>
                <circle cx="96" cy="56" r="3" fill="currentColor" stroke="none"/>
              </svg>
            </template>
          </StatsCard>
          <StatsCard tint="sun" :label="t('report.logged_gaps')" :value="formatNumber(gapStats.count)">
            <template #icon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h4l2-6 4 12 2-6h4"/></svg>
            </template>
            <template #flourish>
              <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 58 L26 58 L34 34 L48 82 L56 46 L72 66 L110 50"/>
              </svg>
            </template>
          </StatsCard>
          <StatsCard tint="peach" :label="t('history.avg_gap')" :value="formatDuration(gapStats.avg)">
            <template #icon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            </template>
            <template #flourish>
              <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="88" cy="46" r="26"/>
                <path d="M88 30 v16 l10 6"/>
              </svg>
            </template>
          </StatsCard>
          <StatsCard tint="lavender" :label="t('history.longest_gap')" :value="formatDuration(gapStats.longest)">
            <template #icon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 8v5l3 2"/><path d="M19 4l2 2"/></svg>
            </template>
            <template #flourish>
              <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M74 20 h28 v10 l-14 20 14 20 v10 h-28 v-10 l14 -20 -14 -20 z"/>
              </svg>
            </template>
          </StatsCard>
        </div>
      </section>

      <!-- Daily timeline -->
      <section v-reveal class="report-section">
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
      <section v-reveal class="report-section">
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
          <span>{{ formatNumber(0) }}</span>
          <span>{{ formatNumber(6) }}</span>
          <span>{{ formatNumber(12) }}</span>
          <span>{{ formatNumber(18) }}</span>
          <span>{{ formatNumber(23) }}</span>
        </div>
        <div class="muted-line">
          {{ t('report.peak_hour') }}
          <strong>{{ peakHourLabel }}</strong>
        </div>
      </section>

      <!-- Weekday distribution -->
      <section v-reveal class="report-section">
        <div class="section-title">{{ t('report.by_weekday') }}</div>
        <div class="weekday-chart">
          <div
            v-for="b in weekdayDistribution"
            :key="b.weekday"
            class="weekday-col"
          >
            <div class="weekday-value">{{ b.count > 0 ? formatNumber(b.count) : '·' }}</div>
            <div
              class="weekday-bar"
              :style="{
                height: weekdayBarHeight(b.count) + 'px',
                background: b.count > 0 ? 'var(--bar-default)' : 'var(--bar-empty)',
              }"
            />
            <div class="weekday-label">{{ weekdayShort(b.weekday) }}</div>
          </div>
        </div>
      </section>

      <!-- Gap distribution -->
      <section v-reveal class="report-section">
        <div class="section-title">{{ t('report.gap_distribution') }}</div>
        <div class="gap-rows">
          <div v-for="b in gapDistribution" :key="b.key" class="gap-row">
            <div class="gap-row-label">{{ t(b.key) }}</div>
            <div class="gap-row-track">
              <div
                class="gap-row-fill"
                :style="{ width: gapRowWidth(b.count) + '%' }"
              />
            </div>
            <div class="gap-row-count">{{ formatNumber(b.count) }}</div>
          </div>
        </div>
        <div v-if="gapStats.count === 0" class="muted-line">
          {{ t('report.not_enough_data') }}
        </div>
      </section>

          <div style="height: 2rem" />
        </div>
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
import { useI18n, intlLocale, formatNumber } from '../i18n'
import { getToday } from '../composables/useDate'
import type {
  DayBucket,
  GapDistributionBucket,
  GapStats,
  HourBucket,
  WeekdayBucket,
} from '../types'
import StatsCard from './StatsCard.vue'

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
  return `${formatHour(peak.hour)} (${formatNumber(peak.count)})`
})

function formatHour(h: number): string {
  // Use the locale's time formatter so Arabic mode renders Arabic-Indic
  // digits and the locale-correct AM/PM marker (ص / م).
  const d = new Date()
  d.setHours(h, 0, 0, 0)
  return d.toLocaleTimeString(intlLocale(), {
    hour: 'numeric',
    hour12: true,
  })
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

// Render a 0..6 weekday index in the active locale ("Sun" / "أحد").
// Anchored on a known Sunday so the math is independent of "today".
function weekdayShort(wd: number): string {
  const SUNDAY = new Date(2024, 0, 7) // Sun, Jan 7 2024
  const d = new Date(SUNDAY)
  d.setDate(SUNDAY.getDate() + wd)
  return d.toLocaleDateString(intlLocale(), { weekday: 'short' })
}

function shortDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(intlLocale(), {
    month: 'short',
    day: 'numeric',
  })
}
</script>

<style scoped>
/* Report has long content — scroll is delegated to an inner wrapper
   so the DrawerContent itself stays non-scrollable. Putting overflow
   on the drawer surface conflicts with vaul's [data-vaul-drawer]
   { touch-action: none } and breaks touch scrolling on mobile. */
.report-scroll {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  margin: 0 -16px;
  padding: 0 16px;
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
/* Summary grid — 2 cols. Tile styling comes from <StatsCard>. */
.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
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
