<template>
  <div class="fade-in">
    <div v-if="days.length === 0" class="empty-state">
      {{ t('history.empty') }}
    </div>

    <template v-else>
      <!-- Overall gap report -->
      <div class="report-header">
        <div class="section-title" style="margin-bottom: 0">
          {{ t('history.gap_report') }}
        </div>
        <button class="report-btn" @click="emit('open-report')">
          {{ t('home.generate_report') }}
        </button>
      </div>
      <div class="report-grid">
        <div class="report-card">
          <div class="report-label">{{ t('history.avg_gap') }}</div>
          <div class="report-value">{{ formatDuration(gapStats.avg) }}</div>
        </div>
        <div class="report-card">
          <div class="report-label">{{ t('history.median_gap') }}</div>
          <div class="report-value">{{ formatDuration(gapStats.median) }}</div>
        </div>
        <div class="report-card">
          <div class="report-label">{{ t('history.longest_gap') }}</div>
          <div class="report-value">{{ formatDuration(gapStats.longest) }}</div>
        </div>
        <div class="report-card">
          <div class="report-label">{{ t('history.shortest_gap') }}</div>
          <div class="report-value">{{ formatDuration(gapStats.shortest) }}</div>
        </div>
      </div>

      <!-- Per-day breakdown -->
      <div class="section-title" style="margin-top: 1.75rem">
        {{ t('history.daily_breakdown') }}
      </div>

      <div
        v-for="(d, i) in days"
        :key="d"
        class="day-card"
        :style="{ animationDelay: i * 0.03 + 's' }"
      >
        <div class="day-header" @click="toggle(d)">
          <div>
            <div class="day-label">{{ getDayLabel(d) }}</div>
            <div class="day-date">{{ d }}</div>
          </div>
          <div class="day-right">
            <div
              class="day-bar"
              :style="{
                width: barWidth(byDay[d]) + 'px',
                background: getColor(byDay[d]),
              }"
            />
            <div class="day-count" :style="{ color: getColor(byDay[d]) }">
              {{ byDay[d] }}
            </div>
            <div class="caret" :class="{ open: expanded[d] }">›</div>
          </div>
        </div>

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
            <div class="entry-time">{{ formatTime(e.time) }}</div>
            <div class="entry-gap">
              <span v-if="e.gapMs == null" class="gap-muted">
                {{ t('history.first_ever') }}
              </span>
              <span v-else>+{{ formatDuration(e.gapMs) }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div style="height: 2rem" />
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
.section-title {
  font-size: 11px;
  font-weight: 500;
  color: var(--muted);
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.report-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.report-btn {
  padding: 6px 12px;
  border: 1.5px solid var(--faint);
  border-radius: 8px;
  background: transparent;
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  color: var(--text);
  letter-spacing: 0.02em;
}
.report-btn:active {
  background: var(--card);
}
.empty-state {
  color: var(--subtle);
  font-size: 14px;
  padding: 3rem 0;
  text-align: center;
}
.report-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.report-card {
  background: var(--card);
  border-radius: 10px;
  padding: 12px 14px;
}
.report-label {
  font-size: 11px;
  color: var(--muted);
}
.report-value {
  font-size: 18px;
  font-weight: 600;
  margin-top: 3px;
}
.day-card {
  border-bottom: 1px solid var(--border);
  padding: 12px 0;
  animation: slideUp 0.3s ease-out both;
}
.day-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
}
.day-label {
  font-size: 14px;
  font-weight: 500;
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
  font-size: 20px;
  font-weight: 600;
  min-width: 28px;
  text-align: right;
}
.caret {
  color: var(--subtle);
  font-size: 18px;
  transition: transform 0.2s;
  width: 12px;
  text-align: center;
}
.caret.open {
  transform: rotate(90deg);
}
.day-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 11px;
  color: var(--subtle);
  margin-top: 8px;
}
.entries-list {
  margin-top: 12px;
  padding: 10px 12px;
  background: var(--card);
  border-radius: 8px;
}
.entry-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 13px;
  border-bottom: 1px solid var(--border);
}
.entry-row:last-child {
  border-bottom: none;
}
.entry-time {
  font-variant-numeric: tabular-nums;
}
.entry-gap {
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.gap-muted {
  color: var(--subtle);
  font-style: italic;
}
</style>
