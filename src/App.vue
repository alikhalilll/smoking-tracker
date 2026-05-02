<template>
  <div class="app-shell">
    <!-- Header -->
    <div class="header">
      <div class="brand">Smoke tracker</div>
      <div class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="tab"
          :class="{ active: view === tab.id }"
          @click="view = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <div class="divider" />

    <!-- Views -->
    <HomeView
      v-if="view === 'home'"
      :today-count="todayCount"
      :last-smoke-text="lastSmokeText ?? undefined"
      :last7="last7"
      :max-last7="maxLast7"
      :daily-avg="dailyAvg"
      :total-smoked="totalSmoked"
      :total-days="totalDays"
      :best-day="bestDay"
      :has-entries="data.entries.length > 0"
      @log="handleLog"
      @undo="undoLast"
      @open-report="showReport = true"
    />

    <HistoryView
      v-else-if="view === 'history'"
      :days="days"
      :by-day="byDay"
      :gap-stats="gapStats"
      :day-reports="dayReports"
      @open-report="showReport = true"
    />

    <SettingsView
      v-else-if="view === 'settings'"
      :start-date="data.startDate"
      :total-smoked="totalSmoked"
      :total-days="totalDays"
      :daily-avg="dailyAvg"
      @reset="resetAll"
    />

    <!-- Full report overlay -->
    <ReportView
      v-if="showReport"
      :total-smoked="totalSmoked"
      :total-days="totalDays"
      :daily-avg="dailyAvg"
      :gap-stats="gapStats"
      :last30="last30"
      :hourly-distribution="hourlyDistribution"
      :weekday-distribution="weekdayDistribution"
      :gap-distribution="gapDistribution"
      @close="showReport = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useStorage } from './composables/useStorage'
import { useStats, timeAgo } from './composables/useStats'
import HomeView from './components/HomeView.vue'
import HistoryView from './components/HistoryView.vue'
import SettingsView from './components/SettingsView.vue'
import ReportView from './components/ReportView.vue'

type TabId = 'home' | 'history' | 'settings'

const tabs: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'history', label: 'History' },
  { id: 'settings', label: '···' },
]

const view = ref<TabId>('home')
const showReport = ref(false)

const { data, addEntries, undoLast, resetAll } = useStorage()
const {
  byDay,
  days,
  totalDays,
  totalSmoked,
  dailyAvg,
  todayCount,
  lastSmoke,
  last7,
  last30,
  maxLast7,
  bestDay,
  gapStats,
  dayReports,
  hourlyDistribution,
  weekdayDistribution,
  gapDistribution,
} = useStats(data)

// Update "time ago" every minute
const tick = ref(0)
let tickInterval: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  tickInterval = setInterval(() => tick.value++, 60_000)
})
onUnmounted(() => {
  if (tickInterval) clearInterval(tickInterval)
})

const lastSmokeText = computed<string | null>(() => {
  if (!lastSmoke.value) return null
  // Touch tick to force reactivity each minute.
  void tick.value
  return timeAgo(lastSmoke.value)
})

function handleLog(count: number): void {
  addEntries(count)
}
</script>

<style scoped>
.app-shell {
  max-width: 440px;
  margin: 0 auto;
  padding: 0 1rem;
  min-height: 100dvh;
}
.header {
  padding: 1.5rem 0 0.75rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.brand {
  font-size: 11px;
  color: var(--muted);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 500;
}
.tabs {
  display: flex;
  gap: 2px;
}
.tab {
  padding: 7px 14px;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  color: var(--muted);
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
}
.tab.active {
  color: var(--text);
  border-bottom-color: var(--text);
}
.divider {
  height: 1px;
  background: var(--border);
  margin-bottom: 1.5rem;
}
</style>
