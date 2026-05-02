<template>
  <div class="app-shell">
    <!-- Personalized greeting header -->
    <header class="greet">
      <div>
        <div class="greet-eyebrow">{{ greeting }}</div>
        <div class="greet-name">{{ greetingName }}</div>
      </div>
      <button
        v-if="auth.isAuthed.value"
        class="btn btn-icon greet-action"
        :aria-label="t('cloud.sign_out')"
        @click="onSignOut"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
        </svg>
      </button>
      <button
        v-else
        class="btn btn-pill btn-ghost greet-action"
        @click="openAuth"
      >
        {{ t('cloud.sign_in') }}
      </button>
    </header>

    <!-- Views -->
    <main class="view-host">
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

      <LeaderboardView
        v-else-if="view === 'leaderboard'"
        :leaderboard="leaderboard"
        :is-authed="auth.isAuthed.value"
        @open-settings="view = 'settings'"
        @open-auth="openAuth"
      />

      <SettingsView
        v-else-if="view === 'settings'"
        :start-date="data.startDate"
        :total-smoked="totalSmoked"
        :total-days="totalDays"
        :daily-avg="dailyAvg"
        :sync="sync"
        :leaderboard="leaderboard"
        :is-authed="auth.isAuthed.value"
        @reset="handleReset"
        @reminders-changed="handleRemindersChanged"
        @open-auth="openAuth"
      />
    </main>

    <!-- Floating Liquid Glass nav (always at bottom) -->
    <nav class="nav-bar glass" :style="indicatorStyle">
      <div class="nav-indicator" />
      <button
        v-for="(tab, i) in tabs"
        :key="tab.id"
        ref="tabRefs"
        class="nav-tab"
        :class="{ active: view === tab.id }"
        @click="onTabClick(tab.id, i)"
      >
        <span class="nav-icon" v-html="tab.icon"></span>
        <span class="nav-label">{{ t(`tabs.${tab.id}`) }}</span>
      </button>
    </nav>

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

    <!-- Auth modal (opened on demand) -->
    <AuthModal />

    <!-- Toast host -->
    <Toast />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useStorage } from './composables/useStorage'
import { useStats, timeAgo } from './composables/useStats'
import { useQuitPlan } from './composables/useQuitPlan'
import { useReminders, resolvedNotificationLocale } from './composables/useReminders'
import { useSync } from './composables/useSync'
import { useLeaderboard } from './composables/useLeaderboard'
import { useAuth } from './composables/useAuth'
import { useAuthModal } from './composables/useAuthModal'
import { useToast } from './composables/useToast'
import { useHaptics } from './composables/useHaptics'
import { isSupabaseConfigured } from './supabase'
import { useI18n, tIn } from './i18n'
import HomeView from './components/HomeView.vue'
import HistoryView from './components/HistoryView.vue'
import QuitView from './components/QuitView.vue'
import LeaderboardView from './components/LeaderboardView.vue'
import SettingsView from './components/SettingsView.vue'
import ReportView from './components/ReportView.vue'
import AuthModal from './components/AuthModal.vue'
import Toast from './components/Toast.vue'
import type { QuitIntensity } from './types'

type TabId = 'home' | 'history' | 'quit' | 'leaderboard' | 'settings'

const ICONS: Record<TabId, string> = {
  home: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></svg>`,
  history: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  quit: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></svg>`,
  leaderboard: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M17 4H7v6a5 5 0 0 0 10 0V4z"/><path d="M17 6h2a2 2 0 0 1 0 4h-2M7 6H5a2 2 0 0 0 0 4h2"/></svg>`,
  settings: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
}

const { t, locale } = useI18n()
const supabaseConfigured = isSupabaseConfigured()

const tabs = computed<ReadonlyArray<{ id: TabId; icon: string }>>(() => {
  const ids: TabId[] = supabaseConfigured
    ? ['home', 'history', 'quit', 'leaderboard', 'settings']
    : ['home', 'history', 'quit', 'settings']
  return ids.map((id) => ({ id, icon: ICONS[id] }))
})

const view = ref<TabId>('home')
const showReport = ref(false)
const tabRefs = ref<HTMLButtonElement[]>([])
const indicator = ref({ x: 0, w: 0 })
const haptics = useHaptics()

const indicatorStyle = computed(() => ({
  '--ind-x': `${indicator.value.x}px`,
  '--ind-w': `${indicator.value.w}px`,
}))

function recalcIndicator(): void {
  const idx = tabs.value.findIndex((t) => t.id === view.value)
  const el = tabRefs.value[idx]
  if (!el) return
  const parent = el.parentElement
  if (!parent) return
  const parentRect = parent.getBoundingClientRect()
  const rect = el.getBoundingClientRect()
  indicator.value = {
    x: rect.left - parentRect.left,
    w: rect.width,
  }
}

function onTabClick(id: TabId, _i: number): void {
  view.value = id
  haptics.fire('tap')
  nextTick(recalcIndicator)
}

watch(view, () => nextTick(recalcIndicator))
watch(locale, () => nextTick(recalcIndicator))

onMounted(() => {
  nextTick(recalcIndicator)
  window.addEventListener('resize', recalcIndicator)
})
onUnmounted(() => {
  window.removeEventListener('resize', recalcIndicator)
})

const auth = useAuth()
const { open: openAuth } = useAuthModal()
const { show: showToast } = useToast()

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

const sync = isSupabaseConfigured() ? useSync(data) : null
const leaderboard = isSupabaseConfigured() ? useLeaderboard(data) : null

// Personalized greeting (e-learning vibe)
const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return t('app.greet_morning')
  if (h < 18) return t('app.greet_afternoon')
  return t('app.greet_evening')
})
const greetingName = computed(() => {
  const email = auth.user.value?.email
  const ldrName = leaderboard?.prefs.value.displayName?.trim()
  if (ldrName) return ldrName
  if (email) return email.split('@')[0]
  return t('app.greet_friend')
})

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
  const loc = resolvedNotificationLocale()
  return {
    title: tIn(loc, 'reminders.notification_title'),
    body: tIn(loc, 'reminders.notification_body', {
      minutes: reminders.settings.value.gapMinutes,
    }),
  }
}

function handleLog(count: number): void {
  addEntries(count)
  haptics.fire('success')
  reminders.scheduleNext(reminderPayload())
}

function handleRemindersChanged(): void {
  if (reminders.settings.value.enabled) {
    reminders.scheduleNext(reminderPayload())
  } else {
    reminders.cancel()
  }
}

onMounted(() => {
  if (
    reminders.settings.value.enabled &&
    reminders.permission.value === 'granted'
  ) {
    reminders.scheduleNext(reminderPayload())
  }
})
onUnmounted(() => reminders.cancel())

function onReminderClicked(e: Event): void {
  const detail = (e as CustomEvent<TabId>).detail
  if (
    detail === 'home' ||
    detail === 'history' ||
    detail === 'quit' ||
    detail === 'leaderboard' ||
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

async function handleReset(): Promise<void> {
  if (sync) {
    try {
      await sync.clearServer()
    } catch (err) {
      console.error('[reset] clearServer failed:', err)
    }
  }
  resetAll()
  view.value = 'home'
}

async function onSignOut(): Promise<void> {
  await auth.signOut()
  showToast(t('cloud.signed_out_toast'))
}
</script>

<style scoped>
.app-shell {
  max-width: 480px;
  margin: 0 auto;
  padding: 0 16px;
  /* Reserve room at the bottom for the floating nav. */
  padding-bottom: calc(112px + env(safe-area-inset-bottom));
  min-height: 100dvh;
}

/* Greeting header */
.greet {
  padding: 28px 4px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.greet-eyebrow {
  font-size: 13px;
  color: var(--muted);
  font-weight: 500;
}
.greet-name {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text);
  line-height: 1.15;
  margin-top: 2px;
}
.greet-action {
  flex-shrink: 0;
}

.view-host {
  /* Animated view transitions could go here later */
}

/* Floating glass nav */
.nav-bar {
  position: fixed;
  inset-inline-start: 50%;
  transform: translateX(-50%);
  bottom: max(14px, env(safe-area-inset-bottom));
  display: flex;
  gap: 0;
  padding: 8px;
  border-radius: var(--radius-pill);
  z-index: 100;
  max-width: calc(100vw - 24px);
  overflow: hidden;
}
.nav-indicator {
  position: absolute;
  top: 8px;
  bottom: 8px;
  inset-inline-start: var(--ind-x, 0);
  width: var(--ind-w, 0);
  background: var(--card);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-sm);
  transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1),
              width 0.28s cubic-bezier(0.2, 0.8, 0.2, 1),
              inset-inline-start 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
  pointer-events: none;
  z-index: 0;
}
.nav-tab {
  position: relative;
  z-index: 1;
  appearance: none;
  border: none;
  background: transparent;
  font-family: inherit;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 12px;
  border-radius: var(--radius-pill);
  color: var(--muted);
  transition: color 0.2s ease;
  min-width: 56px;
}
.nav-tab.active {
  color: var(--brand);
}
.nav-icon {
  display: flex;
}
.nav-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

/* RTL: indicator uses inset-inline-start, but transition still works */
[dir='rtl'] .nav-indicator {
  /* keep default */
}
</style>
