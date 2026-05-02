<template>
  <div class="app-shell">
    <!-- Header -->
    <div class="header">
      <div class="brand">{{ t('app.brand') }}</div>
      <div class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="tab"
          :class="{ active: view === tab.id }"
          @click="view = tab.id"
        >
          {{ t(`tabs.${tab.id}`) }}
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
      :quit-today-target="quit.todayTarget.value"
      :quit-today-status="quit.todayStatus.value"
      :quit-is-complete="quit.isComplete.value"
      :smoke-free-days="smokeFreeDays"
      @log="handleLog"
      @undo="undoLast"
      @open-report="showReport = true"
      @open-quit="view = 'quit'"
    />

    <HistoryView
      v-else-if="view === 'history'"
      :days="days"
      :by-day="byDay"
      :gap-stats="gapStats"
      :day-reports="dayReports"
      @open-report="showReport = true"
    />

    <QuitView
      v-else-if="view === 'quit'"
      :plan="quit.plan.value"
      :is-active="quit.isActive.value"
      :is-complete="quit.isComplete.value"
      :today-target="quit.todayTarget.value"
      :today-actual="quit.todayActual.value"
      :today-status="quit.todayStatus.value"
      :plan-days="quit.planDays.value"
      :progress="quit.progress.value"
      :suggested-baseline="quit.suggestedBaseline.value"
      :smoke-free-days="smokeFreeDays"
      @start="handleStartQuit"
      @abandon="abandonQuitPlan"
    />

    <SettingsView
      v-else-if="view === 'settings'"
      :start-date="data.startDate"
      :total-smoked="totalSmoked"
      :total-days="totalDays"
      :daily-avg="dailyAvg"
      :sync="sync"
      @reset="handleReset"
      @reminders-changed="handleRemindersChanged"
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

    <!-- Footer (matches portfolio style: copyright left, links right) -->
    <footer class="app-footer">
      <div class="copyright">
        {{ t('footer.copyright', { from: 2019, to: currentYear }) }}
      </div>
      <div class="footer-links">
        <a
          href="https://alikhalilll.github.io/"
          target="_blank"
          rel="noopener noreferrer"
        >{{ t('footer.portfolio') }}</a>
        <a
          href="https://github.com/alikhalilll"
          target="_blank"
          rel="noopener noreferrer"
        >{{ t('footer.github') }}</a>
        <a
          href="https://www.linkedin.com/in/alikhalilll/"
          target="_blank"
          rel="noopener noreferrer"
        >{{ t('footer.linkedin') }}</a>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useStorage } from './composables/useStorage'
import { useStats, timeAgo } from './composables/useStats'
import { useQuitPlan } from './composables/useQuitPlan'
import { useReminders } from './composables/useReminders'
import { useSync } from './composables/useSync'
import { isSupabaseConfigured } from './supabase'
import { useI18n } from './i18n'
import HomeView from './components/HomeView.vue'
import HistoryView from './components/HistoryView.vue'
import QuitView from './components/QuitView.vue'
import SettingsView from './components/SettingsView.vue'
import ReportView from './components/ReportView.vue'
import type { QuitIntensity } from './types'

type TabId = 'home' | 'history' | 'quit' | 'settings'

const { t } = useI18n()

const tabs: ReadonlyArray<{ id: TabId }> = [
  { id: 'home' },
  { id: 'history' },
  { id: 'quit' },
  { id: 'settings' },
]

const view = ref<TabId>('home')
const showReport = ref(false)

const {
  data,
  addEntries,
  undoLast,
  resetAll,
  startQuitPlan,
  abandonQuitPlan,
} = useStorage()

const stats = useStats(data)
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
  smokeFreeDays,
} = stats

const quit = useQuitPlan(data, byDay, dailyAvg)

// Cloud sync only initializes if Supabase env vars are present at build time;
// otherwise the app runs purely on localStorage and `sync` is null.
const sync = isSupabaseConfigured() ? useSync(data) : null

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
  void tick.value
  return timeAgo(lastSmoke.value)
})

const reminders = useReminders()

function reminderPayload(): { title: string; body: string } {
  return {
    title: t('reminders.notification_title'),
    body: t('reminders.notification_body', {
      minutes: reminders.settings.value.gapMinutes,
    }),
  }
}

function handleLog(count: number): void {
  addEntries(count)
  // Each new log resets the wait — schedule the next nudge from now.
  reminders.scheduleNext(reminderPayload())
}

function handleRemindersChanged(): void {
  if (reminders.settings.value.enabled) {
    reminders.scheduleNext(reminderPayload())
  } else {
    reminders.cancel()
  }
}

// Pick up a previously-enabled reminder cycle on app load.
onMounted(() => {
  if (
    reminders.settings.value.enabled &&
    reminders.permission.value === 'granted'
  ) {
    reminders.scheduleNext(reminderPayload())
  }
})

onUnmounted(() => {
  reminders.cancel()
})

// Notification clicks dispatch a CustomEvent — switch to that tab.
function onReminderClicked(e: Event): void {
  const detail = (e as CustomEvent<TabId>).detail
  if (
    detail === 'home' ||
    detail === 'history' ||
    detail === 'quit' ||
    detail === 'settings'
  ) {
    view.value = detail
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('reminder-clicked', onReminderClicked)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('reminder-clicked', onReminderClicked)
  }
})

function handleStartQuit(payload: {
  intensity: QuitIntensity
  baseline: number
}): void {
  startQuitPlan(payload.intensity, payload.baseline)
}

function handleReset(): void {
  resetAll()
  view.value = 'home'
}

const currentYear = new Date().getFullYear()
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
  gap: 8px;
}
.brand {
  font-size: 11px;
  color: var(--muted);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 500;
  flex-shrink: 0;
}
.tabs {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.tab {
  padding: 7px 10px;
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
.app-footer {
  border-top: 1px solid var(--border);
  margin-top: 2rem;
  padding: 1.25rem 0 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  flex-wrap: wrap;
}
.copyright {
  color: var(--muted);
}
.footer-links {
  display: flex;
  gap: 14px;
  align-items: center;
}
.footer-links a {
  color: var(--text);
  text-decoration: none;
  transition: color 0.15s;
}
.footer-links a:hover {
  color: var(--muted);
}
@media (max-width: 380px) {
  .app-footer {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
