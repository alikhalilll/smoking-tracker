<template>
  <!-- Ambient floating dots — fixed behind every screen, dim by default,
       brighter on the leaderboard tab. -->
  <div
    class="ambient-dots"
    :class="{ 'amb-bright': view === 'leaderboard' }"
    aria-hidden="true"
  >
    <span class="adot ad1"></span>
    <span class="adot ad2"></span>
    <span class="adot ad3"></span>
    <span class="adot ad4"></span>
    <span class="adot ad5"></span>
    <span class="adot ad6"></span>
    <span class="adot ad7"></span>
    <span class="adot ad8"></span>
  </div>

  <div class="app-shell">
    <!-- Personalized greeting header -->
    <header class="greet">
      <button
        type="button"
        class="greet-id"
        :aria-label="t('app.go_home')"
        @click="goHome"
      >
        <span class="greet-eyebrow">{{ greeting }}</span>
        <span class="greet-name">{{ greetingName }}</span>
      </button>
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
        :last-smoke-time="lastSmoke ?? undefined"
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
        @open-quit="setView('quit')"
      />

      <HistoryView
        v-else-if="view === 'history'"
        :days="days"
        :by-day="byDay"
        :gap-stats="gapStats"
        :day-reports="dayReports"
        @open-report="showReport = true"
        @delete-day="handleDeleteDay"
        @edit-entry="handleEditEntry"
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
        @open-settings="setView('settings')"
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
        :entries="data.entries"
        @reset="handleReset"
        @reminders-changed="handleRemindersChanged"
        @open-auth="openAuth"
      />
    </main>

    <!-- Floating Liquid Glass nav: icon-with-label tabs; active tab
         lights up brand-coral with a soft circular highlight around
         just the icon. No morphing indicator — labels are static so
         each tab keeps a fixed footprint. -->
    <nav class="nav-bar glass">
      <button
        v-for="(tab, i) in tabs"
        :key="tab.id"
        class="nav-tab"
        :class="{ active: view === tab.id }"
        @click="onTabClick(tab.id, i)"
      >
        <span class="nav-icon-wrap">
          <span class="nav-icon" v-html="tab.icon"></span>
        </span>
        <span class="nav-label">{{ t(`tabs.${tab.id}`) }}</span>
      </button>
    </nav>

    <!-- Full report drawer -->
    <ReportView
      v-model:open="showReport"
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

    <!-- App-wide confirm drawer (replaces native confirm()) -->
    <ConfirmDrawer />

    <!-- Toast host -->
    <Toast />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useStorage } from './composables/useStorage'
import { useStats } from './composables/useStats'
import { useQuitPlan } from './composables/useQuitPlan'
import { useReminders, resolvedNotificationLocale } from './composables/useReminders'
import { useSync } from './composables/useSync'
import { useSettingsSync } from './composables/useSettingsSync'
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
import ConfirmDrawer from './components/ConfirmDrawer.vue'
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

const { t } = useI18n()
const supabaseConfigured = isSupabaseConfigured()

const tabs = computed<ReadonlyArray<{ id: TabId; icon: string }>>(() => {
  const ids: TabId[] = supabaseConfigured
    ? ['home', 'history', 'quit', 'leaderboard', 'settings']
    : ['home', 'history', 'quit', 'settings']
  return ids.map((id) => ({ id, icon: ICONS[id] }))
})

// Active tab is mirrored to the URL hash so a refresh stays on the
// same screen instead of snapping back to Home. We use the hash (not
// path) so this works on GitHub Pages without server rewrites.
function readHashView(): TabId {
  if (typeof window === 'undefined') return 'home'
  const raw = window.location.hash.replace(/^#\/?/, '')
  if (
    raw === 'home' ||
    raw === 'history' ||
    raw === 'quit' ||
    raw === 'leaderboard' ||
    raw === 'settings'
  ) {
    return raw
  }
  return 'home'
}

const view = ref<TabId>(readHashView())
const showReport = ref(false)
const haptics = useHaptics()

function setView(id: TabId): void {
  view.value = id
  if (typeof window !== 'undefined') {
    const next = `#/${id}`
    if (window.location.hash !== next) {
      // replaceState avoids stacking history entries every time the
      // user taps a tab — back-button still exits the app naturally.
      window.history.replaceState(null, '', next)
    }
  }
}

function onTabClick(id: TabId, _i: number): void {
  setView(id)
  haptics.fire('tap')
}

function onHashChange(): void {
  view.value = readHashView()
}
onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('hashchange', onHashChange)
    // Make sure the hash exists on first paint (e.g. when arriving
    // with no hash) so the URL reflects the active view.
    setView(view.value)
  }
})
onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('hashchange', onHashChange)
  }
})

const auth = useAuth()
const { open: openAuth } = useAuthModal()
const { show: showToast } = useToast()

const {
  data,
  addEntries,
  undoLast,
  deleteDay,
  editEntryTime,
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
// Cross-device settings (theme, language, reminder prefs). Side effects
// only — the composable wires its own watchers and pull triggers.
if (isSupabaseConfigured()) useSettingsSync()

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
    setView(detail)
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

function handleDeleteDay(date: string): void {
  // Local removal triggers useSync's debounced pushDiff, which mirrors
  // the deletion to Supabase via its server-only-id delete pass.
  deleteDay(date)
  haptics.fire('tap')
}

function handleEditEntry(payload: { id: string; iso: string }): void {
  // Marks entry as synced=false; pushDiff's UPSERT pass will UPDATE the
  // row on the next debounce tick.
  editEntryTime(payload.id, payload.iso)
  haptics.fire('tap')
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
  setView('home')
}

function goHome(): void {
  setView('home')
  haptics.fire('tap')
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
  position: relative;
  z-index: 1;
}

/* === Ambient dots (global background — visible on every screen) === */
.ambient-dots {
  position: fixed;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 0;
  opacity: 0.08;
  transition: opacity 0.4s ease;
}
.ambient-dots.amb-bright {
  opacity: 0.7;
}
.adot {
  position: absolute;
  border-radius: 50%;
}
.ad1 {
  width: 14px; height: 14px; background: var(--brand);
  top: 8%; left: 78%;
  animation: drift-1 9s ease-in-out infinite;
}
.ad2 {
  width: 10px; height: 10px; background: var(--accent);
  top: 18%; left: 8%;
  animation: drift-2 11s ease-in-out infinite;
}
.ad3 {
  width: 22px; height: 22px;
  background: color-mix(in srgb, var(--success) 80%, transparent);
  top: 36%; left: 88%;
  animation: drift-3 13s ease-in-out infinite;
}
.ad4 {
  width: 16px; height: 16px;
  background: color-mix(in srgb, var(--accent-warm) 80%, transparent);
  top: 56%; left: 4%;
  animation: drift-1 10s ease-in-out infinite reverse;
}
.ad5 {
  width: 8px; height: 8px; background: var(--brand);
  top: 70%; left: 70%;
  animation: drift-2 8s ease-in-out infinite;
}
.ad6 {
  width: 12px; height: 12px; background: var(--accent);
  top: 88%; left: 28%;
  animation: drift-3 12s ease-in-out infinite reverse;
}
.ad7 {
  width: 18px; height: 18px; background: var(--brand);
  top: 26%; left: 48%;
  animation: drift-2 14s ease-in-out infinite reverse;
}
.ad8 {
  width: 9px; height: 9px;
  background: color-mix(in srgb, var(--success) 70%, transparent);
  top: 80%; left: 90%;
  animation: drift-1 12s ease-in-out infinite;
}
@keyframes drift-1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%      { transform: translate(-18px, 28px) scale(1.2); }
}
@keyframes drift-2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%      { transform: translate(24px, -18px) scale(0.85); }
}
@keyframes drift-3 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%      { transform: translate(-12px, -28px) scale(1.15); }
}

/* Greeting header — bigger, bolder, "Hey, Michelle" energy */
.greet {
  padding: 24px 4px 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
/* The whole "Good morning / Name" block is a button — tap it to jump
   home regardless of the current view. Reset native button chrome so
   it looks identical to the original static label. */
.greet-id {
  appearance: none;
  border: none;
  background: transparent;
  padding: 0;
  margin: 0;
  font-family: inherit;
  text-align: start;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.greet-id:active { transform: scale(0.99); }
.greet-eyebrow {
  font-size: 14px;
  color: var(--muted);
  font-weight: 500;
  display: block;
}
.greet-name {
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--text);
  line-height: 1.1;
  margin-top: 2px;
  display: block;
}
.greet-action {
  flex-shrink: 0;
}

.view-host {
  /* Animated view transitions could go here later */
}

/* Liquid Glass floating nav: icon-with-label tabs, soft circle
   highlight around just the active icon. Centered with physical
   `left: 50%` so it stays put in both LTR and RTL. */
.nav-bar {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: max(14px, env(safe-area-inset-bottom));
  display: flex;
  gap: 2px;
  padding: 8px 10px;
  border-radius: var(--radius-pill);
  z-index: 100;
  max-width: calc(100vw - 24px);
}
.nav-tab {
  appearance: none;
  border: none;
  background: transparent;
  font-family: inherit;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 4px 6px;
  color: var(--muted);
  transition: color 0.2s ease, transform 0.12s ease;
  min-width: 48px;
  flex: 1 1 auto;
}
@media (max-width: 360px) {
  .nav-tab { min-width: 44px; padding: 4px 4px; }
  .nav-label { font-size: 10px; }
}
.nav-tab:active {
  transform: scale(0.94);
}
.nav-tab.active {
  color: var(--brand);
}
.nav-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  transition: background 0.2s ease;
}
.nav-tab.active .nav-icon-wrap {
  background: color-mix(in srgb, var(--brand) 18%, transparent);
}
.nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
}
.nav-icon :deep(svg) {
  display: block;
}
.nav-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.01em;
  line-height: 1;
}
</style>
