<template>
  <div class="fade-in">
    <div class="section-title">{{ t('settings.title') }}</div>

    <div class="info-card">
      <div class="info-label">{{ t('settings.tracking_since') }}</div>
      <div class="info-value">{{ startDate }}</div>
    </div>

    <div class="info-card">
      <div class="info-label">{{ t('settings.total_entries') }}</div>
      <div class="info-value">
        {{
          t('settings.entries_summary', {
            smoked: totalSmoked,
            days: totalDays,
            s: totalDays > 1 ? 's' : '',
          })
        }}
      </div>
    </div>

    <div class="info-card">
      <div class="info-label">{{ t('settings.avg_per_day') }}</div>
      <div class="info-value">
        {{ t('settings.avg_value', { avg: dailyAvg }) }}
      </div>
    </div>

    <!-- Language -->
    <div class="section-title" style="margin-top: 1.75rem">
      {{ t('settings.language') }}
    </div>
    <div class="segmented">
      <button
        v-for="opt in localeOptions"
        :key="opt.value"
        class="segmented-btn"
        :class="{ active: locale === opt.value }"
        @click="setLocale(opt.value)"
      >
        {{ opt.label }}
      </button>
    </div>

    <!-- Theme -->
    <div class="section-title" style="margin-top: 1.5rem">
      {{ t('settings.appearance') }}
    </div>
    <div class="segmented">
      <button
        v-for="opt in themeOptions"
        :key="opt.value"
        class="segmented-btn"
        :class="{ active: themeMode === opt.value }"
        @click="setTheme(opt.value)"
      >
        {{ t(`settings.theme_${opt.value}`) }}
      </button>
    </div>

    <!-- Reminders -->
    <div class="section-title" style="margin-top: 1.5rem">
      {{ t('reminders.section_title') }}
    </div>
    <div class="info-card">
      <div class="reminder-row">
        <div>
          <div class="info-label">{{ t('reminders.enable_label') }}</div>
          <div class="info-value">{{ t('reminders.enable_help') }}</div>
        </div>
        <button
          class="toggle-btn"
          :class="{ on: reminders.settings.value.enabled }"
          @click="onToggleReminders"
        >
          {{
            reminders.settings.value.enabled
              ? t('reminders.on')
              : t('reminders.off')
          }}
        </button>
      </div>

      <div
        v-if="reminders.settings.value.enabled"
        style="margin-top: 14px"
      >
        <div class="info-label" style="margin-bottom: 8px">
          {{ t('reminders.gap_label') }}
        </div>
        <div class="segmented">
          <button
            v-for="opt in REMINDER_GAP_OPTIONS"
            :key="opt.minutes"
            class="segmented-btn"
            :class="{
              active: reminders.settings.value.gapMinutes === opt.minutes,
            }"
            @click="onGapChange(opt.minutes)"
          >
            {{ opt.label }}
          </button>
        </div>

        <div class="info-label" style="margin: 14px 0 8px">
          {{ t('reminders.language_label') }}
        </div>
        <div class="segmented">
          <button
            v-for="opt in NOTIFICATION_LOCALE_OPTIONS"
            :key="opt.value"
            class="segmented-btn"
            :class="{
              active:
                reminders.settings.value.notificationLocale === opt.value,
            }"
            @click="onNotificationLocaleChange(opt.value)"
          >
            {{ t(`reminders.lang_${opt.value}`) }}
          </button>
        </div>

        <div
          v-if="reminders.permission.value !== 'granted'"
          class="permission-warning"
        >
          {{ t('reminders.permission_required') }}
          <button
            v-if="reminders.permission.value === 'default'"
            class="link-btn"
            @click="reminders.requestPermission()"
          >
            {{ t('reminders.allow_btn') }}
          </button>
          <span
            v-else-if="reminders.permission.value === 'denied'"
            class="muted-line"
            style="margin-top: 4px"
          >
            {{ t('reminders.permission_denied') }}
          </span>
        </div>
      </div>

      <button class="test-btn" @click="sendTest">
        {{ t('reminders.test_btn') }}
      </button>

      <!-- Persistent diagnostic panel -->
      <div class="diag-panel" v-if="diag">
        <div class="diag-header">
          <span
            class="diag-pill"
            :class="{
              'diag-ok': diag.lastTest?.ok,
              'diag-err': diag.lastTest && !diag.lastTest.ok,
            }"
          >
            {{
              diag.lastTest?.ok
                ? `OK · ${diag.lastTest.via ?? ''}`
                : diag.lastTest?.reason ?? 'Idle'
            }}
          </span>
          <button class="diag-copy" @click="copyDiag">Copy</button>
        </div>

        <div v-if="diag.primarySuspect" class="diag-suspect">
          {{ diag.primarySuspect }}
        </div>

        <pre class="diag-pre">{{ diagText }}</pre>
      </div>
    </div>

    <!-- Cloud sync -->
    <div class="section-title" style="margin-top: 1.75rem">
      {{ t('cloud.section') }}
    </div>
    <div class="info-card">
      <div v-if="!supabaseConfigured" class="info-value">
        {{ t('cloud.not_configured') }}
      </div>

      <!-- Not signed in: gated state -->
      <template v-else-if="!isAuthed">
        <div class="info-value" style="margin-bottom: 12px">
          {{ t('cloud.description') }}
        </div>
        <button class="btn btn-primary block" @click="emit('open-auth')">
          {{ t('cloud.needs_signin_cta') }}
        </button>
      </template>

      <!-- Signed in -->
      <template v-else>
        <div class="signed-in-row">
          <div class="info-value">
            {{
              t('cloud.signed_in_as', {
                email: auth.user.value?.email ?? '',
              })
            }}
          </div>
          <button class="link-btn" @click="auth.signOut">
            {{ t('cloud.sign_out') }}
          </button>
        </div>
        <div class="sync-row">
          <span
            v-if="visibleSyncStatus"
            class="sync-pill"
            :class="`sync-${visibleSyncStatus}`"
          >
            {{ t(`cloud.status_${visibleSyncStatus}`) }}
          </span>
          <span v-else class="muted-line">
            {{ t('cloud.background_sync') }}
          </span>
          <button class="link-btn" @click="onSyncNow">
            {{ t('cloud.sync_now') }}
          </button>
        </div>
        <div v-if="sync?.lastError.value" class="link-sent-msg" style="color: var(--red)">
          {{ sync.lastError.value }}
        </div>
      </template>
    </div>

    <!-- Leaderboard (only shown when signed in) -->
    <template v-if="leaderboard && isAuthed">
      <div class="section-title" style="margin-top: 1.5rem">
        {{ t('leaderboard_settings.section') }}
      </div>
      <div class="info-card">
        <div class="info-value" style="margin-bottom: 12px">
          {{ t('leaderboard_settings.description') }}
        </div>
        <input
          v-model="leaderboardName"
          type="text"
          class="email-input"
          :placeholder="t('leaderboard_settings.display_name_placeholder')"
          @blur="onDisplayNameBlur"
        />
        <div class="reminder-row" style="margin-top: 14px">
          <div class="info-label">
            {{ t('leaderboard_settings.enable') }}
          </div>
          <button
            class="toggle-btn"
            :class="{ on: leaderboard.prefs.value.optedIn }"
            :disabled="!leaderboardName.trim() && !leaderboard.prefs.value.optedIn"
            @click="onLeaderboardToggle"
          >
            {{
              leaderboard.prefs.value.optedIn
                ? t('reminders.on')
                : t('reminders.off')
            }}
          </button>
        </div>
        <div
          v-if="!leaderboardName.trim() && !leaderboard.prefs.value.optedIn"
          class="muted-line"
          style="margin-top: 8px"
        >
          {{ t('leaderboard_settings.enable_first') }}
        </div>
      </div>
    </template>

    <!-- Reset -->
    <button class="reset-btn" @click="handleReset">
      {{ t('settings.reset_btn') }}
    </button>
    <div class="reset-warning">{{ t('settings.reset_warning') }}</div>

    <div class="pwa-info">
      <div class="info-label">{{ t('settings.offline_label') }}</div>
      <div class="info-value">{{ t('settings.offline_value') }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n, tIn, type Locale } from '../i18n'
import { useTheme, type ThemeMode } from '../composables/useTheme'
import {
  useReminders,
  REMINDER_GAP_OPTIONS,
  resolvedNotificationLocale,
  type NotificationLocale,
} from '../composables/useReminders'
import { useAuth } from '../composables/useAuth'
import { isSupabaseConfigured } from '../supabase'
import type { UseSync } from '../composables/useSync'
import type { UseLeaderboard } from '../composables/useLeaderboard'

const NOTIFICATION_LOCALE_OPTIONS: ReadonlyArray<{
  value: NotificationLocale
}> = [{ value: 'auto' }, { value: 'en' }, { value: 'ar' }]

interface Props {
  startDate: string
  totalSmoked: number
  totalDays: number
  dailyAvg: number
  sync?: UseSync | null
  leaderboard?: UseLeaderboard | null
  isAuthed?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  reset: []
  'reminders-changed': []
  'open-auth': []
}>()

// Treat undefined as `false` so the gated state is the safe default
// when this prop isn't passed.
const isAuthed = computed(() => props.isAuthed ?? false)

const { t, locale, setLocale } = useI18n()
const { mode: themeMode, setTheme } = useTheme()
const reminders = useReminders()

const localeOptions: ReadonlyArray<{ value: Locale; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
]

const themeOptions: ReadonlyArray<{ value: ThemeMode; label: string }> = [
  { value: 'system', label: '' },
  { value: 'light', label: '' },
  { value: 'dark', label: '' },
]

async function onToggleReminders(): Promise<void> {
  const next = !reminders.settings.value.enabled
  if (next && reminders.permission.value !== 'granted') {
    await reminders.requestPermission()
  }
  reminders.setEnabled(next)
  emit('reminders-changed')
}

function onGapChange(minutes: number): void {
  reminders.setGap(minutes)
  emit('reminders-changed')
}

function onNotificationLocaleChange(loc: NotificationLocale): void {
  reminders.setNotificationLocale(loc)
  emit('reminders-changed')
}

interface DiagSnapshot {
  buildId: string
  url: string
  notificationApi: boolean
  permission: NotificationPermission | 'unsupported'
  isStandalone: boolean
  hasServiceWorker: boolean
  swController: string | null
  swActive: string | null
  userAgent: string
  primarySuspect: string | null
  lastTest: { ok: boolean; reason?: string; via?: string } | null
}

const diag = ref<DiagSnapshot | null>(null)

const diagText = computed(() => {
  if (!diag.value) return ''
  const d = diag.value
  return [
    `build:           ${d.buildId}`,
    `url:             ${d.url}`,
    `notificationApi: ${d.notificationApi}`,
    `permission:      ${d.permission}`,
    `standalone:      ${d.isStandalone}`,
    `serviceWorker:   ${d.hasServiceWorker}`,
    `sw.controller:   ${d.swController ?? '(none)'}`,
    `sw.active:       ${d.swActive ?? '(none)'}`,
    `lastTest:        ${
      d.lastTest
        ? d.lastTest.ok
          ? `ok via ${d.lastTest.via}`
          : `failed: ${d.lastTest.reason}${d.lastTest.via ? ` (${d.lastTest.via})` : ''}`
        : '(none)'
    }`,
    `userAgent:       ${d.userAgent}`,
    d.primarySuspect ? `\nsuspect:\n  ${d.primarySuspect}` : '',
  ]
    .filter(Boolean)
    .join('\n')
})

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  // iOS Safari exposes navigator.standalone for home-screen apps.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window.navigator as any).standalone === true
}

function pickSuspect(snap: Omit<DiagSnapshot, 'primarySuspect'>): string | null {
  if (!snap.notificationApi) {
    return 'This browser/device doesn’t support web notifications at all.'
  }
  const ua = snap.userAgent
  const isIos = /iPhone|iPad|iPod/.test(ua)
  if (isIos && !snap.isStandalone) {
    return 'iPhone/iPad: notifications only work in the installed PWA. Tap Share → Add to Home Screen, then open the app from that icon and try again.'
  }
  if (snap.permission === 'denied') {
    return 'You previously blocked notifications for this site. Re-enable them in your browser site settings, reload, and try again — the page can’t re-prompt by itself.'
  }
  if (snap.permission === 'default') {
    return 'Permission hasn’t been granted yet. Tap the test button — when the prompt appears, choose Allow.'
  }
  if (
    snap.lastTest &&
    !snap.lastTest.ok &&
    snap.lastTest.reason === 'SW_FAILED'
  ) {
    return 'The page tried both notification paths and the service worker rejected the request. Try a hard refresh (close all tabs / reopen the PWA).'
  }
  if (
    snap.permission === 'granted' &&
    snap.lastTest?.ok
  ) {
    const isMac = /Mac OS X/.test(ua)
    if (isMac) {
      return 'The notification was sent (the browser accepted it). If nothing appeared on screen, the OS is dropping it. Check: System Settings → Notifications → your browser is on AND set to "Alerts" (not "None"); Focus / Do Not Disturb is off; the menu-bar Notification Center has it.'
    }
    return 'Sent successfully. If you didn’t see it, check your OS notification settings for this browser.'
  }
  return null
}

async function refreshDiag(
  lastTest: DiagSnapshot['lastTest'] = null
): Promise<void> {
  let swController: string | null = null
  let swActive: string | null = null
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    swController = navigator.serviceWorker.controller?.scriptURL ?? null
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      swActive = reg?.active?.scriptURL ?? null
    } catch {
      // ignore
    }
  }
  const snap: Omit<DiagSnapshot, 'primarySuspect'> = {
    buildId: __BUILD_ID__,
    url: typeof location !== 'undefined' ? location.href : '',
    notificationApi: typeof Notification !== 'undefined',
    permission:
      typeof Notification !== 'undefined'
        ? Notification.permission
        : 'unsupported',
    isStandalone: detectStandalone(),
    hasServiceWorker:
      typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    swController,
    swActive,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    lastTest,
  }
  diag.value = { ...snap, primarySuspect: pickSuspect(snap) }
}

async function sendTest(): Promise<void> {
  await refreshDiag()
  if (typeof Notification === 'undefined') {
    await refreshDiag({ ok: false, reason: 'API_UNAVAILABLE' })
    return
  }
  // Use the notification-language preference (Auto / EN / AR), not the
  // app locale, so the test mirrors what real reminders will look like.
  const loc = resolvedNotificationLocale()
  const result = await reminders.sendTest({
    title: tIn(loc, 'reminders.test_title'),
    body: tIn(loc, 'reminders.test_body'),
  })
  await refreshDiag(result)
}

async function copyDiag(): Promise<void> {
  if (!diagText.value) return
  try {
    await navigator.clipboard.writeText(diagText.value)
  } catch {
    // best-effort
  }
}

// Populate the panel once on mount so the user sees status before clicking.
onMounted(() => {
  void refreshDiag()
})

// --- Cloud sync ---
// Auth UI lives in <AuthModal> now; this view only shows the
// signed-in summary + sync status, or a "Continue" button that
// opens the modal via the parent's @open-auth handler.
const auth = useAuth()
const supabaseConfigured = isSupabaseConfigured()

async function onSyncNow(): Promise<void> {
  await props.sync?.syncNow()
}

// --- Leaderboard ---
const leaderboardName = ref(
  props.leaderboard?.prefs.value.displayName ?? ''
)

function onDisplayNameBlur(): void {
  if (!props.leaderboard) return
  const trimmed = leaderboardName.value.trim()
  if (trimmed !== props.leaderboard.prefs.value.displayName) {
    props.leaderboard.setDisplayName(trimmed)
  }
}

async function onLeaderboardToggle(): Promise<void> {
  if (!props.leaderboard) return
  const next = !props.leaderboard.prefs.value.optedIn
  if (next && !leaderboardName.value.trim()) return
  // Make sure the latest typed name is saved before opting in.
  if (next) props.leaderboard.setDisplayName(leaderboardName.value.trim())
  await props.leaderboard.setOptIn(next)
}

// Hide the noisy "synced" pill — the background loop ticks every minute
// so "synced" would be the steady state. Only surface things the user
// can act on: an error, an offline state, or an active sync in progress.
const visibleSyncStatus = computed(() => {
  const s = props.sync?.status.value
  if (s === 'error' || s === 'offline' || s === 'syncing') return s
  return null
})

function handleReset(): void {
  if (confirm(t('settings.reset_confirm'))) {
    emit('reset')
  }
}
</script>

<style scoped>
.section-title {
  font-size: 11px;
  font-weight: 500;
  color: var(--muted);
  margin-bottom: 14px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.info-card {
  background: var(--card);
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 10px;
}
.info-label {
  font-size: 13px;
  font-weight: 500;
}
.info-value {
  font-size: 12px;
  color: var(--muted);
  margin-top: 3px;
}
.segmented {
  display: flex;
  gap: 4px;
  background: var(--card);
  border-radius: 10px;
  padding: 4px;
}
.segmented-btn {
  flex: 1;
  padding: 9px 12px;
  border: none;
  border-radius: 7px;
  background: transparent;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  color: var(--muted);
  transition: background 0.15s, color 0.15s;
}
.segmented-btn.active {
  background: var(--bg);
  color: var(--text);
  font-weight: 600;
}
.reminder-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}
.toggle-btn {
  padding: 7px 14px;
  border: 1.5px solid var(--faint);
  border-radius: 8px;
  background: transparent;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  color: var(--muted);
  flex-shrink: 0;
}
.toggle-btn.on {
  background: var(--btn-bg);
  color: var(--btn-text);
  border-color: var(--btn-bg);
}
.test-btn {
  width: 100%;
  margin-top: 14px;
  padding: 10px 14px;
  border: 1.5px solid var(--faint);
  border-radius: 8px;
  background: transparent;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  color: var(--text);
}
.test-btn:active {
  background: var(--bg);
}
.diag-panel {
  margin-top: 12px;
  padding: 10px 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 11px;
  color: var(--muted);
}
.diag-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.diag-pill {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 4px;
  background: var(--card);
  font-weight: 600;
  font-size: 10px;
  color: var(--muted);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.diag-pill.diag-ok {
  background: color-mix(in srgb, var(--green) 20%, var(--card));
  color: var(--green);
}
.diag-pill.diag-err {
  background: color-mix(in srgb, var(--red) 20%, var(--card));
  color: var(--red);
}
.diag-copy {
  padding: 3px 8px;
  border: 1px solid var(--faint);
  border-radius: 5px;
  background: transparent;
  font-family: inherit;
  font-size: 10px;
  font-weight: 600;
  color: var(--muted);
  cursor: pointer;
}
.diag-suspect {
  padding: 8px 10px;
  background: var(--card);
  border-radius: 6px;
  color: var(--text);
  margin-bottom: 8px;
  font-weight: 500;
  line-height: 1.45;
}
.diag-pre {
  margin: 0;
  font-family: inherit;
  font-size: 10px;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--subtle);
  line-height: 1.6;
}

/* Cloud sync */
.password-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.password-toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}
.cloud-form {
  display: flex;
  gap: 8px;
  align-items: center;
}
.email-input {
  flex: 1;
  min-width: 0;
  padding: 9px 12px;
  border: 1.5px solid var(--faint);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font-family: inherit;
  font-size: 13px;
}
.email-input:focus {
  outline: none;
  border-color: var(--text);
}
.primary-btn {
  padding: 9px 14px;
  border: none;
  border-radius: 8px;
  background: var(--btn-bg);
  color: var(--btn-text);
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
}
.primary-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.link-sent-msg {
  margin-top: 10px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.5;
}
.signed-in-row,
.sync-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}
.sync-row {
  margin-top: 12px;
}
.sync-pill {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 5px;
  background: var(--bg);
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.sync-pill.sync-syncing {
  color: var(--amber);
}
.sync-pill.sync-synced {
  color: var(--green);
}
.sync-pill.sync-error {
  color: var(--red);
}
.sync-pill.sync-offline {
  color: var(--subtle);
}
.permission-warning {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--bg);
  font-size: 12px;
  color: var(--muted);
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
}
.link-btn {
  padding: 5px 10px;
  border: 1.5px solid var(--faint);
  border-radius: 6px;
  background: transparent;
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  color: var(--text);
}
.muted-line {
  font-size: 11px;
  color: var(--subtle);
}
.reset-btn {
  width: 100%;
  margin-top: 28px;
  padding: 12px 18px;
  border: 1.5px solid var(--red-border);
  border-radius: 10px;
  background: transparent;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  color: var(--red);
}
.reset-warning {
  font-size: 11px;
  color: var(--subtle);
  text-align: center;
  margin-top: 8px;
}
.pwa-info {
  background: var(--card);
  border-radius: 10px;
  padding: 14px 16px;
  margin-top: 24px;
}
</style>
