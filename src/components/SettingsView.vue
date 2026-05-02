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
    </div>

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
import { useI18n, type Locale } from '../i18n'
import { useTheme, type ThemeMode } from '../composables/useTheme'
import {
  useReminders,
  REMINDER_GAP_OPTIONS,
} from '../composables/useReminders'

interface Props {
  startDate: string
  totalSmoked: number
  totalDays: number
  dailyAvg: number
}

defineProps<Props>()

const emit = defineEmits<{
  reset: []
  'reminders-changed': []
}>()

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

async function sendTest(): Promise<void> {
  if (typeof Notification === 'undefined') {
    alert(t('reminders.test_unsupported'))
    return
  }
  const result = await reminders.sendTest({
    title: t('reminders.test_title'),
    body: t('reminders.test_body'),
  })
  if (result.ok) return

  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari standalone flag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true)

  const lines = [
    `Test notification could not be sent.`,
    ``,
    `Reason: ${result.reason ?? 'unknown'}`,
    `Permission: ${reminders.permission.value}`,
    `Standalone (PWA): ${isStandalone}`,
    `User agent: ${navigator.userAgent}`,
  ]
  if (result.via) lines.push(`Detail: ${result.via}`)

  if (
    /iPhone|iPad|iPod/.test(navigator.userAgent) &&
    !isStandalone
  ) {
    lines.push(
      ``,
      `On iPhone/iPad, notifications only work after you Add to Home Screen and open the app from that icon.`
    )
  }
  if (result.reason === 'PERMISSION_DENIED') {
    lines.push(
      ``,
      `Permission was denied. You'll need to re-enable notifications for this site in your browser settings, then try again.`
    )
  }
  alert(lines.join('\n'))
}

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
