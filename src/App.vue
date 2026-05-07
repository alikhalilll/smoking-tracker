<template>
  <!-- Liquid Glass refraction filter (Chromium-only). Mounted once at
       app root so any .glass surface can opt into the displacement via
       the @supports query in components.css. Keep the filter off-canvas
       (zero size, absolute) so it never paints itself. -->
  <svg
    aria-hidden="true"
    width="0"
    height="0"
    style="position: absolute; width: 0; height: 0; pointer-events: none;"
  >
    <defs>
      <filter
        id="liquid-glass"
        x="0%"
        y="0%"
        width="100%"
        height="100%"
        color-interpolation-filters="sRGB"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.012 0.018"
          numOctaves="2"
          seed="3"
          result="turbulence"
        />
        <feGaussianBlur in="turbulence" stdDeviation="2" result="softNoise" />
        <feDisplacementMap
          in="SourceGraphic"
          in2="softNoise"
          scale="6"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </defs>
  </svg>

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
        data-onboard="header-signin"
        @click="openAuth"
      >
        {{ t('cloud.sign_in') }}
      </button>
    </header>

    <!-- Onboarding entry pill — shown until the user dismisses it
         or until the onboarding flow has been completed once. -->
    <button
      v-if="showOnboardingCta"
      class="onboard-cta"
      data-onboard="tour-cta"
      @click="startTour"
    >
      <span class="onboard-cta-emoji">✨</span>
      <span class="onboard-cta-body">
        <span class="onboard-cta-title">{{ t('onboarding.cta_title') }}</span>
        <span class="onboard-cta-sub">{{ t('onboarding.cta_sub') }}</span>
      </span>
      <svg class="onboard-cta-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline :points="isRtl ? '15 18 9 12 15 6' : '9 18 15 12 9 6'"/></svg>
    </button>

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
        :longest-gap-ms="gapStats.longest"
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
        :suggestion="quit.suggestion.value"
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

      <!-- Hidden admin route — reachable only via #/admin. The bottom
           nav is suppressed below so this fills the screen. -->
      <AdminView v-else-if="view === 'admin'" @exit="setView('home')" />
    </main>

    <!-- Floating Liquid Glass nav: icon-with-label tabs; active tab
         lights up brand-coral with a soft circular highlight around
         just the icon. No morphing indicator — labels are static so
         each tab keeps a fixed footprint. -->
    <!--
      "Stock" bottom navigation pattern (Dribbble shot 25832948):
      a floating dark pill containing N tabs. Inactive tabs are
      circular icon-only buttons; the active tab expands horizontally
      into a green pill that shows icon + label. The bar still uses
      liquid-glass refraction so the page content underneath warps.
    -->
    <nav
      v-if="view !== 'admin'"
      v-liquid-glass="navBarLg"
      class="nav-bar"
    >
      <button
        v-for="tab in navTabs"
        :key="tab.id"
        class="nav-tab"
        :class="{ 'is-active': view === tab.id }"
        :aria-current="view === tab.id ? 'page' : undefined"
        :aria-label="tab.label"
        @click="onTabClick(tab.id)"
      >
        <span class="nav-tab-icon" v-html="tab.icon" />
        <span class="nav-tab-label">{{ tab.label }}</span>
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

    <!-- Service-worker "new version available" banner -->
    <UpdatePrompt />

    <!-- In-page onboarding tour -->
    <OnboardingOverlay />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
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
import AdminView from './components/AdminView.vue'
import ReportView from './components/ReportView.vue'
import AuthModal from './components/AuthModal.vue'
import ConfirmDrawer from './components/ConfirmDrawer.vue'
import Toast from './components/Toast.vue'
import UpdatePrompt from './components/UpdatePrompt.vue'
import OnboardingOverlay from './components/OnboardingOverlay.vue'
import { useOnboarding, type OnboardingStep } from './composables/useOnboarding'
import type { QuitIntensity } from './types'

type TabId =
  | 'home'
  | 'history'
  | 'quit'
  | 'leaderboard'
  | 'settings'
  | 'admin'

const ICONS: Record<TabId, string> = {
  home: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></svg>`,
  history: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  quit: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></svg>`,
  leaderboard: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M17 4H7v6a5 5 0 0 0 10 0V4z"/><path d="M17 6h2a2 2 0 0 1 0 4h-2M7 6H5a2 2 0 0 0 0 4h2"/></svg>`,
  // Heroicons-style filled gear. Bolder than Lucide's stroke-only
  // version so the teeth are unambiguous at 22px — no rounding into
  // dots like the previous icons.
  settings: `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 0 0 0 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 0 0-.432 2.385l.922 1.597a1.875 1.875 0 0 0 2.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 0 0 2.28-.819l.923-1.597a1.875 1.875 0 0 0-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 0 0 0-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 0 0-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 0 0-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 0 0-1.85-1.567h-1.843ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z"/></svg>`,
  admin: '',
}

const { t, isRtl } = useI18n()
const supabaseConfigured = isSupabaseConfigured()

// Stock-pattern nav: a single flat row of 4 tabs. The active one
// expands to a labelled pill; the others stay as icon-only circles.
// `quit` is intentionally dropped from the bar — Home surfaces a CTA
// to it. When supabase isn't configured we swap the leaderboard slot
// for `quit` so users without cloud sync still have a route to the
// plan.
interface NavTab {
  id: TabId
  icon: string
  label: string
}

const navTabs = computed<NavTab[]>(() => {
  const list: NavTab[] = [
    { id: 'home', icon: ICONS.home, label: t('tabs.home') },
    { id: 'history', icon: ICONS.history, label: t('tabs.history') },
  ]
  if (supabaseConfigured) {
    list.push({
      id: 'leaderboard',
      icon: ICONS.leaderboard,
      label: t('tabs.leaderboard'),
    })
  } else {
    list.push({ id: 'quit', icon: ICONS.quit, label: t('tabs.quit') })
  }
  list.push({
    id: 'settings',
    icon: ICONS.settings,
    label: t('tabs.settings'),
  })
  return list
})

// Refraction filter applied to the whole nav-bar — not per-tab — so
// the entire pill warps the page content underneath through the bezel
// (matches the kube.io article's panel demo). `forceActive: true`
// keeps the warp at full strength continuously; the bar is meant to
// look like a lensed glass surface, not press-triggered.
//
// blur is higher than the article default (0.2) so the bar reads as a
// genuine frosted-glass surface — the SVG's own feGaussianBlur stage
// produces the frost while the subsequent feDisplacementMap still
// shows the lensed bezel warp on top. We deliberately keep `chain: ''`
// so the CSS doesn't pre-blur the source into mush before the SVG
// runs, which would kill the warp.
const navBarLg = computed(() => ({
  surface: 'convex' as const,
  bezel: 28,
  glassThickness: 80,
  refractiveIndex: 1.5,
  blur: 14,
  specularOpacity: 0.6,
  saturation: 8,
  chain: '',
  scaleStates: { idle: 1, hover: 1, active: 1 },
  forceActive: true,
}))


// Active tab is mirrored to the URL hash so a refresh stays on the
// same screen instead of snapping back to Home. We use the hash (not
// path) so this works on GitHub Pages without server rewrites.
function readHashView(): TabId {
  if (typeof window === 'undefined') return 'home'
  const raw = window.location.hash.replace(/^#\/?/, '')
  // The settings view embeds a sub-section as a second hash segment
  // (e.g. #/settings/app). Strip it off here — SettingsView reads
  // that segment for itself and we only care about the top-level tab.
  const main = raw.split('/')[0]
  if (
    main === 'home' ||
    main === 'history' ||
    main === 'quit' ||
    main === 'leaderboard' ||
    main === 'settings' ||
    main === 'admin'
  ) {
    return main as TabId
  }
  return 'home'
}

const view = ref<TabId>(readHashView())
const showReport = ref(false)
const haptics = useHaptics()

function setView(id: TabId): void {
  view.value = id
  if (typeof window !== 'undefined') {
    // Preserve any sub-route that's already encoded in the hash
    // (e.g. "#/settings/app") when this call is just navigating to
    // the same top-level tab — otherwise we'd clobber the settings
    // section the user was on.
    const currentMain = window.location.hash
      .replace(/^#\/?/, '')
      .split('/')[0]
    if (currentMain === id) return
    const next = `#/${id}`
    if (window.location.hash !== next) {
      // replaceState avoids stacking history entries every time the
      // user taps a tab — back-button still exits the app naturally.
      window.history.replaceState(null, '', next)
    }
  }
}

function onTabClick(id: TabId): void {
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

// === Onboarding tour ===
const onboarding = useOnboarding()

const showOnboardingCta = computed(() => {
  if (onboarding.active.value) return false
  if (onboarding.completed.value) return false
  return true
})

function buildTourSteps(): OnboardingStep[] {
  const hasEntries = (): boolean => data.value.entries.length > 0

  // Page-level main flow: six stops, one per top-level page. Each
  // page step has an optional `children` array — when present, the
  // tooltip surfaces an "Explore in detail" CTA the user can opt
  // into to drill through that page's sub-elements.
  const steps: OnboardingStep[] = [
    // 1. Welcome
    {
      id: 'welcome',
      view: 'home',
      selector: null,
      titleKey: 'onboarding.steps.welcome.title',
      bodyKey: 'onboarding.steps.welcome.body',
    },
    // 2. Home
    {
      id: 'home',
      view: 'home',
      selector: '[data-onboard="home-log"]',
      titleKey: 'onboarding.steps.home.title',
      bodyKey: 'onboarding.steps.home.body',
      children: [
        {
          id: 'home-hero',
          view: 'home',
          selector: '[data-onboard="home-hero"]',
          titleKey: 'onboarding.steps.home.children.hero.title',
          bodyKey: 'onboarding.steps.home.children.hero.body',
        },
        {
          id: 'home-log',
          view: 'home',
          selector: '[data-onboard="home-log"]',
          titleKey: 'onboarding.steps.home.children.log.title',
          bodyKey: 'onboarding.steps.home.children.log.body',
        },
        {
          id: 'home-chart',
          view: 'home',
          selector: '[data-onboard="home-chart"]',
          titleKey: 'onboarding.steps.home.children.chart.title',
          bodyKey: 'onboarding.steps.home.children.chart.body',
        },
        {
          id: 'home-stats',
          view: 'home',
          selector: '[data-onboard="home-stats"]',
          titleKey: 'onboarding.steps.home.children.stats.title',
          bodyKey: 'onboarding.steps.home.children.stats.body',
        },
        {
          id: 'home-health',
          view: 'home',
          selector: '[data-onboard="home-health"]',
          titleKey: 'onboarding.steps.home.children.health.title',
          bodyKey: 'onboarding.steps.home.children.health.body',
          condition: hasEntries,
        },
        {
          id: 'home-actions',
          view: 'home',
          selector: '[data-onboard="home-actions"]',
          titleKey: 'onboarding.steps.home.children.actions.title',
          bodyKey: 'onboarding.steps.home.children.actions.body',
          condition: hasEntries,
        },
      ],
    },
    // 3. History
    {
      id: 'history',
      view: 'history',
      selector: hasEntries()
        ? '[data-onboard="history-list"] .day-card:first-child'
        : '[data-onboard="history-empty"]',
      titleKey: 'onboarding.steps.history.title',
      bodyKey: 'onboarding.steps.history.body',
      children: [
        {
          id: 'history-gap',
          view: 'history',
          selector: '[data-onboard="history-gap"]',
          titleKey: 'onboarding.steps.history.children.gap.title',
          bodyKey: 'onboarding.steps.history.children.gap.body',
          condition: hasEntries,
        },
        {
          id: 'history-day',
          view: 'history',
          selector: '[data-onboard="history-list"] .day-card:first-child',
          titleKey: 'onboarding.steps.history.children.day.title',
          bodyKey: 'onboarding.steps.history.children.day.body',
          condition: hasEntries,
        },
        {
          id: 'history-entries',
          view: 'history',
          selector:
            '[data-onboard="history-list"] .day-card:first-child .entries-list',
          titleKey: 'onboarding.steps.history.children.entries.title',
          bodyKey: 'onboarding.steps.history.children.entries.body',
          condition: hasEntries,
        },
        {
          id: 'history-empty',
          view: 'history',
          selector: '[data-onboard="history-empty"]',
          titleKey: 'onboarding.steps.history.children.empty.title',
          bodyKey: 'onboarding.steps.history.children.empty.body',
          condition: () => !hasEntries(),
        },
      ],
    },
    // 4. Quit
    {
      id: 'quit',
      view: 'quit',
      selector: '[data-onboard="quit-intensity-list"]',
      titleKey: 'onboarding.steps.quit.title',
      bodyKey: 'onboarding.steps.quit.body',
      condition: () => !quit.isActive.value,
      children: [
        {
          id: 'quit-baseline',
          view: 'quit',
          selector: '[data-onboard="quit-baseline"]',
          titleKey: 'onboarding.steps.quit.children.baseline.title',
          bodyKey: 'onboarding.steps.quit.children.baseline.body',
          condition: () => !quit.isActive.value,
        },
        {
          id: 'quit-pace',
          view: 'quit',
          selector: '[data-onboard="quit-intensity-list"]',
          titleKey: 'onboarding.steps.quit.children.pace.title',
          bodyKey: 'onboarding.steps.quit.children.pace.body',
          condition: () => !quit.isActive.value,
        },
      ],
    },
    // 5. Leaderboard (only when Supabase is configured)
    {
      id: 'leaderboard',
      view: 'leaderboard',
      selector: '[data-onboard="leaderboard-head"]',
      titleKey: 'onboarding.steps.leaderboard.title',
      bodyKey: 'onboarding.steps.leaderboard.body',
      condition: () => supabaseConfigured,
    },
    // 6. Settings — page-level + drill-in to each sub-section card.
    //    Doubles as the closing step.
    {
      id: 'settings',
      view: 'settings',
      selector: '[data-onboard="settings-tabs"]',
      titleKey: 'onboarding.steps.settings.title',
      bodyKey: 'onboarding.steps.settings.body',
      children: [
        {
          id: 'settings-language',
          view: 'settings',
          settingsSection: 'app',
          selector: '[data-onboard="settings-language"]',
          titleKey: 'onboarding.steps.settings.children.language.title',
          bodyKey: 'onboarding.steps.settings.children.language.body',
        },
        {
          id: 'settings-theme',
          view: 'settings',
          settingsSection: 'app',
          selector: '[data-onboard="settings-theme"]',
          titleKey: 'onboarding.steps.settings.children.theme.title',
          bodyKey: 'onboarding.steps.settings.children.theme.body',
        },
        {
          id: 'settings-haptics',
          view: 'settings',
          settingsSection: 'app',
          selector: '[data-onboard="settings-haptics"]',
          titleKey: 'onboarding.steps.settings.children.haptics.title',
          bodyKey: 'onboarding.steps.settings.children.haptics.body',
        },
        {
          id: 'settings-hard-refresh',
          view: 'settings',
          settingsSection: 'app',
          selector: '[data-onboard="settings-hard-refresh"]',
          titleKey: 'onboarding.steps.settings.children.hard_refresh.title',
          bodyKey: 'onboarding.steps.settings.children.hard_refresh.body',
        },
        {
          id: 'settings-signin',
          view: 'settings',
          settingsSection: 'account',
          selector: '[data-onboard="settings-account"]',
          titleKey: 'onboarding.steps.settings.children.signin.title',
          bodyKey: 'onboarding.steps.settings.children.signin.body',
          condition: () => supabaseConfigured,
        },
        {
          id: 'settings-reminders',
          view: 'settings',
          settingsSection: 'reminders',
          selector: '[data-onboard="settings-reminders"]',
          titleKey: 'onboarding.steps.settings.children.reminders.title',
          bodyKey: 'onboarding.steps.settings.children.reminders.body',
        },
        {
          id: 'settings-bedtime',
          view: 'settings',
          settingsSection: 'reminders',
          selector: '[data-onboard="settings-bedtime"]',
          titleKey: 'onboarding.steps.settings.children.bedtime.title',
          bodyKey: 'onboarding.steps.settings.children.bedtime.body',
        },
        {
          id: 'settings-price',
          view: 'settings',
          settingsSection: 'data',
          selector: '[data-onboard="settings-economy"]',
          titleKey: 'onboarding.steps.settings.children.price.title',
          bodyKey: 'onboarding.steps.settings.children.price.body',
        },
        {
          id: 'settings-export',
          view: 'settings',
          settingsSection: 'data',
          selector: '[data-onboard="settings-export"]',
          titleKey: 'onboarding.steps.settings.children.export.title',
          bodyKey: 'onboarding.steps.settings.children.export.body',
        },
        {
          id: 'settings-reset',
          view: 'settings',
          settingsSection: 'data',
          selector: '[data-onboard="settings-reset"]',
          titleKey: 'onboarding.steps.settings.children.reset.title',
          bodyKey: 'onboarding.steps.settings.children.reset.body',
        },
      ],
    },
  ]
  return steps
}

function startTour(): void {
  onboarding.start(buildTourSteps())
}

// When the tour lands on the sign-in step, automatically open the
// auth modal so the user can complete sign-in inline. We don't
// auto-advance afterwards — the user closes the modal and chooses
// Next themselves, so the tour stays under their control. If they
// successfully sign in, downstream steps (display name, etc.) are
// re-evaluated and become visible thanks to runtime conditions.
watch(
  () => onboarding.step.value?.id,
  (id) => {
    if (id === 'signin' && supabaseConfigured && !auth.isAuthed.value) {
      openAuth()
    }
  }
)

// Listen for the "replay tour" trigger from Settings.
function onReplayTour(): void {
  startTour()
}
onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('onboarding-replay', onReplayTour)
  }
})
onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('onboarding-replay', onReplayTour)
  }
})
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

/* Onboarding entry pill — sits between the greet header and the
   first view, gently inviting the user to start a guided tour.
   Pulses softly and rotates the sparkle to feel alive without
   being noisy. The "breathing" halo runs as a sibling pseudo-element
   animated via transform + opacity so it composites instead of
   repainting a box-shadow every frame. */
.onboard-cta {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  appearance: none;
  border: 1.5px solid color-mix(in srgb, var(--brand) 30%, transparent);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--brand) 14%, var(--card)),
    color-mix(in srgb, var(--accent) 12%, var(--card))
  );
  color: var(--text);
  padding: 12px 14px;
  border-radius: var(--radius-card);
  cursor: pointer;
  margin-bottom: 12px;
  font-family: inherit;
  text-align: start;
  transition: transform 0.1s ease, border-color 0.2s ease;
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  isolation: isolate;
}
/* Breathing halo — scales + fades a colored layer behind everything,
   no per-frame box-shadow repaint. */
.onboard-cta::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: color-mix(in srgb, var(--brand) 18%, transparent);
  z-index: -1;
  animation: cta-breathe 3.6s ease-in-out infinite;
  will-change: transform, opacity;
  transform: translateZ(0);
}
.onboard-cta::after {
  /* A faint sweeping shine that traverses the pill on a loop. */
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    100deg,
    transparent 30%,
    color-mix(in srgb, #fff 18%, transparent) 50%,
    transparent 70%
  );
  transform: translateX(-130%);
  animation: cta-shine 4.2s ease-in-out infinite;
  will-change: transform;
  pointer-events: none;
}
.onboard-cta:hover {
  border-color: color-mix(in srgb, var(--brand) 50%, transparent);
}
.onboard-cta:active { transform: scale(0.99); }
.onboard-cta-emoji {
  font-size: 22px;
  line-height: 1;
  display: inline-block;
  animation: cta-spark 2.6s ease-in-out infinite;
  flex-shrink: 0;
}
.onboard-cta-body { display: flex; flex-direction: column; flex: 1; min-width: 0; position: relative; z-index: 1; }
.onboard-cta-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}
.onboard-cta-sub {
  font-size: 11px;
  color: var(--muted);
  margin-top: 2px;
}
.onboard-cta-chev {
  color: var(--brand);
  flex-shrink: 0;
  position: relative;
  z-index: 1;
  animation: cta-chev 1.8s ease-in-out infinite;
}
@keyframes cta-breathe {
  0%, 100% { transform: scale(1); opacity: 0; }
  50%      { transform: scale(1.06); opacity: 1; }
}
@keyframes cta-shine {
  0%   { transform: translateX(-130%); }
  60%  { transform: translateX(130%); }
  100% { transform: translateX(130%); }
}
@keyframes cta-spark {
  0%, 100% { transform: rotate(-8deg) scale(1); }
  50%      { transform: rotate(10deg) scale(1.12); }
}
@keyframes cta-chev {
  0%, 100% { transform: translateX(0); }
  50%      { transform: translateX(3px); }
}

@media (prefers-reduced-motion: reduce) {
  .onboard-cta,
  .onboard-cta::before,
  .onboard-cta::after,
  .onboard-cta-emoji,
  .onboard-cta-chev {
    animation: none !important;
  }
}

.view-host {
  /* Animated view transitions could go here later */
}

/* "Stock" bottom nav (Dribbble shot 25832948): a floating dark pill
   with circular icon-only tabs at rest. The active tab expands into
   a green pill that shows icon + label; other tabs stay compact and
   the row redistributes via flex. The whole bar still has liquid-
   glass refraction underneath (v-liquid-glass on the nav element)
   so the page content warps through.
*/
.nav-bar {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: max(14px, env(safe-area-inset-bottom));
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px;
  border-radius: var(--radius-pill);
  width: min(420px, calc(100vw - 24px));
  /* Translucent fill so the SVG backdrop-filter has something to
     refract through; the page underneath shows in the warp. */
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-highlight),
              0 22px 56px rgba(15, 23, 42, 0.20),
              0 6px 16px rgba(15, 23, 42, 0.12),
              0 1px 2px rgba(15, 23, 42, 0.08);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .nav-bar {
    box-shadow: var(--glass-highlight),
                0 22px 56px rgba(0, 0, 0, 0.65),
                0 6px 16px rgba(0, 0, 0, 0.40),
                0 1px 2px rgba(0, 0, 0, 0.30);
  }
}
[data-theme='dark'] .nav-bar {
  box-shadow: var(--glass-highlight),
              0 22px 56px rgba(0, 0, 0, 0.65),
              0 6px 16px rgba(0, 0, 0, 0.40),
              0 1px 2px rgba(0, 0, 0, 0.30);
}

/* Tab — circular at rest, pill when active. Width is animated via
   `flex` so all four tabs balance the row: inactive ones are
   `flex: 0 0 44px` (fixed circle) and the active one is
   `flex: 1 1 auto` (stretches to fill). The flex `gap` is 0 at rest
   (so the icon centers exactly in the circle) and grows to 8px on
   the active tab where the label is visible. */
.nav-tab {
  appearance: none;
  border: none;
  font-family: inherit;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  height: 44px;
  flex: 0 0 44px;
  padding: 0;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text) 8%, transparent);
  color: var(--muted);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  transition: flex-basis 0.32s cubic-bezier(0.2, 0.85, 0.2, 1),
              flex-grow 0.32s cubic-bezier(0.2, 0.85, 0.2, 1),
              padding 0.32s cubic-bezier(0.2, 0.85, 0.2, 1),
              gap 0.32s cubic-bezier(0.2, 0.85, 0.2, 1),
              background 0.22s ease,
              color 0.22s ease,
              box-shadow 0.22s ease;
}
.nav-tab:active { transform: scale(0.96); }

.nav-tab.is-active {
  flex: 1 1 auto;
  padding: 0 18px;
  gap: 8px;
  /* Brand-coral pill — uses the gradient tokens so light + dark
     pick up their respective brand stops. White text/icon reads on
     either coral. */
  background: linear-gradient(
    135deg,
    var(--brand-grad-from),
    var(--brand-grad-to)
  );
  color: #fff;
  box-shadow: var(--brand-shadow),
              inset 0 1px 0 rgba(255, 255, 255, 0.35);
}

.nav-tab-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}
.nav-tab-icon :deep(svg) { display: block; }

.nav-tab-label {
  /* Hidden when not active. Width animates via the parent's flex
     transition; the label fades in once the pill has opened. */
  max-width: 0;
  opacity: 0;
  transform: translateX(-4px);
  transition: max-width 0.32s cubic-bezier(0.2, 0.85, 0.2, 1),
              opacity 0.18s ease 0.10s,
              transform 0.32s cubic-bezier(0.2, 0.85, 0.2, 1);
}
.nav-tab.is-active .nav-tab-label {
  max-width: 200px;
  opacity: 1;
  transform: none;
}
</style>
