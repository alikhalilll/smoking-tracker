<template>
  <div class="fade-in">
    <div v-if="days.length === 0" class="empty-state card">
      <div class="empty-hero">📒</div>
      <p>{{ t('history.empty') }}</p>
    </div>

    <template v-else>
      <!-- Overall gap report -->
      <div class="report-header">
        <h2 class="h-section" style="margin-bottom: 0">
          {{ t('history.gap_report') }}
        </h2>
        <button class="btn btn-ghost report-cta" @click="emit('open-report')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 14l3-3 3 3 5-5"/></svg>
          {{ t('home.generate_report') }}
        </button>
      </div>
      <div class="report-grid">
        <div class="report-card">
          <div class="report-bullet icon-peach"></div>
          <div class="report-label">{{ t('history.avg_gap') }}</div>
          <div class="report-value tabular">{{ formatDuration(gapStats.avg) }}</div>
        </div>
        <div class="report-card">
          <div class="report-bullet icon-mint"></div>
          <div class="report-label">{{ t('history.median_gap') }}</div>
          <div class="report-value tabular">{{ formatDuration(gapStats.median) }}</div>
        </div>
        <div class="report-card">
          <div class="report-bullet icon-lavender"></div>
          <div class="report-label">{{ t('history.longest_gap') }}</div>
          <div class="report-value tabular">{{ formatDuration(gapStats.longest) }}</div>
        </div>
        <div class="report-card">
          <div class="report-bullet icon-sun"></div>
          <div class="report-label">{{ t('history.shortest_gap') }}</div>
          <div class="report-value tabular">{{ formatDuration(gapStats.shortest) }}</div>
        </div>
      </div>

      <!-- Per-day breakdown -->
      <h2 class="h-section" style="margin-top: 1.75rem">
        {{ t('history.daily_breakdown') }}
      </h2>

      <div class="day-list">
        <div
          v-for="(d, i) in days"
          :key="d"
          class="day-card card"
          :style="{ animationDelay: i * 0.03 + 's', borderLeftColor: getColor(byDay[d]) }"
        >
          <button class="day-header" @click="toggle(d)">
            <div>
              <div class="day-label">{{ getDayLabel(d) }}</div>
              <div class="day-date tabular">{{ d }}</div>
            </div>
            <div class="day-right">
              <div
                class="day-bar"
                :style="{
                  width: barWidth(byDay[d]) + 'px',
                  background: getColor(byDay[d]),
                }"
              />
              <div class="day-count tabular" :style="{ color: getColor(byDay[d]) }">
                {{ byDay[d] }}
              </div>
              <div class="caret" :class="{ open: expanded[d] }">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>
          </button>

          <div class="day-meta">
            <span>{{ t('history.first_at', { time: formatTime(dayReports[d].first) }) }}</span>
            <span>·</span>
            <span>{{ t('history.last_at', { time: formatTime(dayReports[d].last) }) }}</span>
            <span v-if="dayReports[d].avgGap != null">·</span>
            <span v-if="dayReports[d].avgGap != null">
              {{ t('history.avg_gap_inline', { duration: formatDuration(dayReports[d].avgGap) }) }}
            </span>
          </div>

          <div v-if="expanded[d]" class="entries-list">
            <div
              v-for="(e, idx) in dayReports[d].entries"
              :key="idx"
              class="entry-row"
            >
              <div class="entry-time tabular">{{ formatTime(e.time) }}</div>
              <div class="entry-gap tabular">
                <span v-if="e.gapMs == null" class="gap-muted">
                  {{ t('history.first_ever') }}
                </span>
                <span v-else>+{{ formatDuration(e.gapMs) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  getDayLabel,
  getColor,
  formatDuration,
  formatTime,
} from '../composables/useStats'
import { useI18n } from '../i18n'
import type { DayReport, GapStats } from '../types'

const { t } = useI18n()

interface Props {
  days: string[]
  byDay: Record<string, number>
  gapStats: GapStats
  dayReports: Record<string, DayReport>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'open-report': []
}>()

const expanded = ref<Record<string, boolean>>({})

function toggle(d: string): void {
  expanded.value[d] = !expanded.value[d]
}

function barWidth(count: number): number {
  const maxCount = Math.max(...Object.values(props.byDay), 1)
  return Math.max(20, (count / maxCount) * 80)
}
</script>

<style scoped>
.empty-state {
  text-align: center;
  padding: 36px 22px;
  color: var(--muted);
  font-size: 14px;
}
.empty-hero {
  font-size: 44px;
  line-height: 1;
  margin-bottom: 10px;
}
.report-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}
.report-cta {
  font-size: 12px;
  padding: 8px 12px;
}
.report-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.report-card {
  position: relative;
  padding: 14px 16px;
  border-radius: 18px;
  background: var(--card);
  box-shadow: var(--shadow-sm);
}
.report-bullet {
  width: 8px;
  height: 24px;
  border-radius: 4px;
  margin-bottom: 8px;
}
.report-bullet.icon-peach { background: var(--brand); }
.report-bullet.icon-mint { background: var(--success); }
.report-bullet.icon-lavender { background: var(--accent); }
.report-bullet.icon-sun { background: var(--accent-warm); }
.report-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
}
.report-value {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin-top: 4px;
  color: var(--text);
}

.day-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.day-card {
  padding: 14px;
  animation: slideUp 0.3s ease-out both;
  border-inline-start: 4px solid var(--brand);
}
.day-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  width: 100%;
  background: transparent;
  border: none;
  padding: 0;
  font-family: inherit;
  text-align: start;
}
.day-label {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
}
.day-date {
  font-size: 11px;
  color: var(--subtle);
  margin-top: 2px;
}
.day-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.day-bar {
  height: 6px;
  border-radius: 3px;
  transition: width 0.3s;
}
.day-count {
  font-size: 22px;
  font-weight: 800;
  min-width: 28px;
  text-align: end;
}
.caret {
  color: var(--subtle);
  display: flex;
  align-items: center;
  transition: transform 0.2s;
}
.caret.open {
  transform: rotate(180deg);
}
.day-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 11px;
  color: var(--subtle);
  margin-top: 10px;
}
.entries-list {
  margin-top: 12px;
  padding: 10px 12px;
  background: var(--surface-tint);
  border-radius: 14px;
}
.entry-row {
  display: flex;
  justify-content: space-between;
  padding: 7px 0;
  font-size: 13px;
  border-bottom: 1px solid var(--hairline);
}
.entry-row:last-child {
  border-bottom: none;
}
.entry-gap {
  color: var(--muted);
}
.gap-muted {
  color: var(--subtle);
  font-style: italic;
}
</style>
