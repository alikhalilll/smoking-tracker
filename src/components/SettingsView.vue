<template>
  <div class="fade-in settings">
    <h1 class="settings-title">{{ t('settings.title') }}</h1>

    <!-- Section tabs — segmented control (cleaner than the loud
         gradient pills; the indicator slides between tabs). -->
    <div class="seg-tabs" role="tablist">
      <div
        class="seg-tab-indicator"
        :style="{
          width: `calc((100% - 8px) / ${sections.length})`,
          transform: `translateX(${
            sections.findIndex((s) => s.id === section) *
            (isRtl ? -100 : 100)
          }%)`,
        }"
      />
      <button
        v-for="s in sections"
        :key="s.id"
        class="seg-tab"
        :class="{ active: section === s.id }"
        role="tab"
        @click="section = s.id"
      >
        {{ t(`settings.section_${s.id}`) }}
      </button>
    </div>

    <!-- ===== Account ===== -->
    <section v-if="section === 'account'" :key="section" class="sec sec-anim">
      <div class="card" data-onboard="settings-account">
        <div v-if="!supabaseConfigured" class="info-value">
          {{ t('cloud.not_configured') }}
        </div>

        <template v-else-if="!isAuthed">
          <div class="acc-hero">
            <div class="acc-hero-icon icon-lavender">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div class="acc-hero-text">
              <div class="acc-hero-title">{{ t('cloud.needs_signin_headline') }}</div>
              <div class="acc-hero-sub">{{ t('cloud.description') }}</div>
            </div>
          </div>
          <button class="btn btn-primary block" @click="emit('open-auth')">
            {{ t('cloud.needs_signin_cta') }}
          </button>
        </template>

        <template v-else>
          <div class="acc-hero">
            <div class="acc-hero-icon icon-mint">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div class="acc-hero-text">
              <div class="acc-hero-title">{{ greetingName }}</div>
              <div class="acc-hero-sub">{{ auth.user.value?.email }}</div>
            </div>
            <button class="btn btn-icon" @click="auth.signOut" :aria-label="t('cloud.sign_out')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
            </button>
          </div>

          <div class="hairline" style="margin: 14px 0"></div>

          <div class="row-between">
            <span
              v-if="visibleSyncStatus"
              class="chip"
              :class="{
                'chip-warn': visibleSyncStatus === 'syncing',
                'chip-danger': visibleSyncStatus === 'error',
              }"
            >
              {{ t(`cloud.status_${visibleSyncStatus}`) }}
            </span>
            <span v-else class="muted-line">{{ t('cloud.background_sync') }}</span>
            <button class="btn btn-ghost small-btn" @click="onSyncNow">
              {{ t('cloud.sync_now') }}
            </button>
          </div>
          <div v-if="sync?.lastError.value" class="error-chip">
            {{ sync.lastError.value }}
          </div>
        </template>
      </div>

      <!-- Leaderboard prefs (only when signed in + supabase configured) -->
      <div
        v-if="leaderboard && isAuthed"
        class="card"
        data-onboard="settings-display-name"
      >
        <div class="card-header">
          <div class="card-icon icon-sun">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M17 4H7v6a5 5 0 0 0 10 0V4z"/><path d="M17 6h2a2 2 0 0 1 0 4h-2M7 6H5a2 2 0 0 0 0 4h2"/></svg>
          </div>
          <div>
            <div class="card-title">{{ t('leaderboard_settings.section') }}</div>
            <div class="card-sub">{{ t('leaderboard_settings.description') }}</div>
          </div>
        </div>

        <input
          v-model="leaderboardName"
          type="text"
          class="field-input"
          :placeholder="t('leaderboard_settings.display_name_placeholder')"
          @blur="onDisplayNameBlur"
        />
        <div class="row-between" style="margin-top: 14px">
          <span class="info-label">{{ t('leaderboard_settings.enable') }}</span>
          <Toggle
            :model-value="leaderboard.prefs.value.optedIn"
            :disabled="!leaderboardName.trim() && !leaderboard.prefs.value.optedIn"
            @update:model-value="onLeaderboardToggle"
          />
        </div>
        <div
          v-if="!leaderboardName.trim() && !leaderboard.prefs.value.optedIn"
          class="muted-line"
          style="margin-top: 8px"
        >
          {{ t('leaderboard_settings.enable_first') }}
        </div>
      </div>

      <!-- Delete account (only meaningful for signed-in users) -->
      <div v-if="isAuthed" class="card danger-card">
        <div class="card-header">
          <div class="card-icon" style="color: var(--danger); background: var(--danger-soft);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <div>
            <div class="card-title">{{ t('settings.delete_account_title') }}</div>
            <div class="card-sub">{{ t('settings.delete_account_help') }}</div>
          </div>
        </div>
        <button
          class="btn danger-btn block"
          :disabled="deleting"
          @click="onDeleteAccount"
        >
          {{
            deleting
              ? t('settings.delete_account_in_progress')
              : t('settings.delete_account_btn')
          }}
        </button>
      </div>
    </section>

    <!-- ===== App (language + theme) ===== -->
    <section v-else-if="section === 'app'" :key="section" class="sec sec-anim">
      <div class="card" data-onboard="settings-language">
        <div class="card-header">
          <div class="card-icon icon-lavender">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          </div>
          <div>
            <div class="card-title">{{ t('settings.language') }}</div>
            <div class="card-sub">{{ t('settings.language_help') }}</div>
          </div>
        </div>
        <div class="segmented-row">
          <button
            v-for="opt in localeOptions"
            :key="opt.value"
            class="seg-btn"
            :class="{ active: locale === opt.value }"
            @click="setLocale(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <div class="card" data-onboard="settings-theme">
        <div class="card-header">
          <div class="card-icon icon-peach">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
          </div>
          <div>
            <div class="card-title">{{ t('settings.appearance') }}</div>
            <div class="card-sub">{{ t('settings.appearance_help') }}</div>
          </div>
        </div>
        <div class="segmented-row">
          <button
            v-for="opt in themeOptions"
            :key="opt.value"
            class="seg-btn"
            :class="{ active: themeMode === opt.value }"
            @click="setTheme(opt.value)"
          >
            {{ t(`settings.theme_${opt.value}`) }}
          </button>
        </div>
      </div>

      <!-- Replay onboarding tour -->
      <div class="card">
        <div class="card-header">
          <div class="card-icon icon-sun">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 2"/></svg>
          </div>
          <div>
            <div class="card-title">{{ t('onboarding.replay_title') }}</div>
            <div class="card-sub">{{ t('onboarding.replay_help') }}</div>
          </div>
        </div>
        <button class="btn btn-ghost block" @click="replayTour">
          {{ t('onboarding.replay_btn') }}
        </button>
      </div>

      <!-- Haptic feedback (Android only — iOS Safari has no web haptics) -->
      <div class="card" data-onboard="settings-haptics">
        <div class="card-header">
          <div class="card-icon icon-mint">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h2M17 12h2M12 5v2M12 17v2"/><circle cx="12" cy="12" r="3"/></svg>
          </div>
          <div>
            <div class="card-title">{{ t('settings.haptics_label') }}</div>
            <div class="card-sub">
              {{
                haptics.supported
                  ? t('settings.haptics_help')
                  : t('settings.haptics_unsupported')
              }}
            </div>
          </div>
          <Toggle
            :model-value="haptics.enabled.value"
            :disabled="!haptics.supported"
            @update:model-value="onHapticsToggle"
          />
        </div>
      </div>
    </section>

    <!-- ===== Reminders ===== -->
    <section v-else-if="section === 'reminders'" :key="section" class="sec sec-anim">
      <div class="card" data-onboard="settings-reminders">
        <div class="card-header">
          <div class="card-icon icon-mint">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </div>
          <div>
            <div class="card-title">{{ t('reminders.enable_label') }}</div>
            <div class="card-sub">{{ t('reminders.enable_help') }}</div>
          </div>
          <Toggle
            :model-value="reminders.settings.value.enabled"
            @update:model-value="onToggleReminders"
          />
        </div>

        <div v-if="reminders.settings.value.enabled" class="reminder-detail">
          <div class="info-label">{{ t('reminders.gap_label') }}</div>
          <div class="segmented-row">
            <button
              v-for="opt in REMINDER_GAP_OPTIONS"
              :key="opt.minutes"
              class="seg-btn"
              :class="{
                active: reminders.settings.value.gapMinutes === opt.minutes,
              }"
              @click="onGapChange(opt.minutes)"
            >
              {{ opt.label }}
            </button>
          </div>

          <div class="info-label" style="margin-top: 14px">
            {{ t('reminders.language_label') }}
          </div>
          <div class="segmented-row">
            <button
              v-for="opt in NOTIFICATION_LOCALE_OPTIONS"
              :key="opt.value"
              class="seg-btn"
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
              class="btn btn-ghost small-btn"
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

        <button class="btn btn-ghost block" style="margin-top: 14px" @click="sendTest">
          {{ t('reminders.test_btn') }}
        </button>

        <!-- Persistent diagnostic panel -->
        <details class="diag-details" v-if="diag">
          <summary class="diag-summary">
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
            <span class="diag-summary-label">{{ t('settings.show_details') }}</span>
          </summary>
          <div class="diag-panel">
            <div v-if="diag.primarySuspect" class="diag-suspect">
              {{ diag.primarySuspect }}
            </div>
            <pre class="diag-pre">{{ diagText }}</pre>
            <button class="btn btn-ghost small-btn" style="margin-top: 8px" @click="copyDiag">
              Copy
            </button>
          </div>
        </details>
      </div>

      <!-- Bedtime — required. Notifications pause inside this window AND
           gap analytics subtract any sleep overlap so an overnight gap
           doesn't get counted as awake time. -->
      <div class="card" data-onboard="settings-bedtime">
        <div class="card-header">
          <div class="card-icon icon-lavender">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          </div>
          <div>
            <div class="card-title">{{ t('reminders.bedtime_label') }}</div>
            <div class="card-sub">{{ t('reminders.bedtime_help') }}</div>
          </div>
        </div>
        <div class="bedtime-times">
          <div class="time-field">
            <span class="time-label">{{ t('reminders.bedtime_start') }}</span>
            <TimePicker
              :model-value="reminders.settings.value.bedtimeStart"
              @update:model-value="onBedtimeStartHm"
            />
          </div>
          <div class="time-field">
            <span class="time-label">{{ t('reminders.bedtime_end') }}</span>
            <TimePicker
              :model-value="reminders.settings.value.bedtimeEnd"
              @update:model-value="onBedtimeEndHm"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- ===== Data ===== -->
    <section v-else-if="section === 'data'" :key="section" class="sec sec-anim">
      <div class="card" data-onboard="settings-data-stats">
        <div class="card-header">
          <div class="card-icon icon-lavender">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>
          </div>
          <div>
            <div class="card-title">{{ t('settings.tracking_since') }}</div>
            <div class="card-sub tabular">{{ startDate }}</div>
          </div>
        </div>

        <div class="data-grid">
          <div class="data-cell">
            <div class="data-label">{{ t('settings.total_entries') }}</div>
            <div class="data-value tabular">{{ totalSmoked }}</div>
          </div>
          <div class="data-cell">
            <div class="data-label">{{ t('home.days_tracked') }}</div>
            <div class="data-value tabular">{{ totalDays }}</div>
          </div>
          <div class="data-cell">
            <div class="data-label">{{ t('settings.avg_per_day') }}</div>
            <div class="data-value tabular">{{ dailyAvg }}</div>
          </div>
        </div>
      </div>

      <!-- Cigarette price (drives the "money saved" widget on Home) -->
      <div class="card" data-onboard="settings-economy">
        <div class="card-header">
          <div class="card-icon icon-mint">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div>
            <div class="card-title">{{ t('settings.economy_title') }}</div>
            <div class="card-sub">{{ t('settings.economy_help') }}</div>
          </div>
        </div>
        <div class="economy-row">
          <label class="economy-field">
            <span class="economy-label">{{ t('settings.economy_pack_price_label') }}</span>
            <input
              type="number"
              min="0"
              step="0.01"
              inputmode="decimal"
              class="field-input"
              :value="economy.settings.value.pricePerPack"
              @input="onPackPriceInput"
            />
          </label>
          <label class="economy-field economy-field-cigs">
            <span class="economy-label">{{ t('settings.economy_cigs_per_pack_label') }}</span>
            <input
              type="number"
              min="1"
              step="1"
              inputmode="numeric"
              class="field-input"
              :value="economy.settings.value.cigsPerPack"
              @input="onCigsPerPackInput"
            />
          </label>
        </div>

        <div class="economy-field" style="margin-top: 12px">
          <span class="economy-label">{{ t('settings.economy_currency_label') }}</span>
          <Select
            :model-value="economy.settings.value.currency"
            :options="currencyOptions"
            @update:model-value="economy.setCurrency"
          />
        </div>

        <div
          v-if="economy.settings.value.pricePerPack > 0"
          class="economy-derived"
        >
          {{
            t('settings.economy_derived', {
              price: formatMoney(
                economy.pricePerCigarette.value,
                economy.settings.value.currency
              ),
            })
          }}
        </div>
      </div>

      <!-- CSV export -->
      <div class="card" data-onboard="settings-export">
        <div class="card-header">
          <div class="card-icon icon-lavender">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </div>
          <div>
            <div class="card-title">{{ t('settings.export_title') }}</div>
            <div class="card-sub">{{ t('settings.export_help') }}</div>
          </div>
        </div>
        <button class="btn btn-ghost block" @click="onExportCsv">
          {{ t('settings.export_btn') }}
        </button>
      </div>

      <div class="card danger-card" data-onboard="settings-reset">
        <div class="card-header">
          <div class="card-icon icon-peach" style="color: var(--danger); background: var(--danger-soft);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          </div>
          <div>
            <div class="card-title">{{ t('settings.reset_btn') }}</div>
            <div class="card-sub">{{ t('settings.reset_warning') }}</div>
          </div>
        </div>
        <button class="btn danger-btn block" @click="handleReset">
          {{ t('settings.reset_btn') }}
        </button>
      </div>

      <div class="card pwa-card" data-onboard="settings-pwa">
        <div class="card-header">
          <div class="card-icon icon-mint">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg>
          </div>
          <div>
            <div class="card-title">{{ t('settings.offline_label') }}</div>
            <div class="card-sub">{{ t('settings.offline_value') }}</div>
          </div>
        </div>
      </div>

      <!-- Hard refresh — clears the SW caches, unregisters the worker,
           and reloads. Use this when the PWA is stuck on an old version. -->
      <div class="card" data-onboard="settings-hard-refresh">
        <div class="card-header">
          <div class="card-icon icon-lavender">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          </div>
          <div>
            <div class="card-title">{{ t('settings.hard_refresh_title') }}</div>
            <div class="card-sub">{{ t('settings.hard_refresh_help') }}</div>
          </div>
        </div>
        <button class="btn btn-ghost block" :disabled="refreshing" @click="onHardRefresh">
          {{ refreshing ? t('settings.hard_refresh_in_progress') : t('settings.hard_refresh_btn') }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n, tIn, type Locale } from '../i18n'
import { useTheme, type ThemeMode } from '../composables/useTheme'
import {
  useReminders,
  REMINDER_GAP_OPTIONS,
  resolvedNotificationLocale,
  type NotificationLocale,
} from '../composables/useReminders'
import { useAuth } from '../composables/useAuth'
import { useEconomy, formatMoney } from '../composables/useEconomy'
import { useHaptics } from '../composables/useHaptics'
import { useConfirm } from '../composables/useConfirm'
import { useToast } from '../composables/useToast'
import { useOnboarding } from '../composables/useOnboarding'
import { isSupabaseConfigured } from '../supabase'
import Toggle from './Toggle.vue'
import Select from './Select.vue'
import TimePicker from './TimePicker.vue'
import type { UseSync } from '../composables/useSync'
import type { UseLeaderboard } from '../composables/useLeaderboard'

// Onboarding state is read up front so the section ref can be
// initialized from a tour-requested section before any watcher fires.
const onboarding = useOnboarding()

type SectionId = 'account' | 'app' | 'reminders' | 'data'
const sections: ReadonlyArray<{ id: SectionId }> = [
  { id: 'account' },
  { id: 'app' },
  { id: 'reminders' },
  { id: 'data' },
]

const SECTION_STORAGE_KEY = 'st-settings-section'

function isSection(s: string | null | undefined): s is SectionId {
  return (
    s === 'account' || s === 'app' || s === 'reminders' || s === 'data'
  )
}

// The active sub-section is mirrored into the URL hash (so a
// refresh / shared link lands on the same section) and into
// localStorage (so coming back to Settings via the nav restores
// where you were last). The hash takes precedence on first read.
function readHashSection(): SectionId | null {
  if (typeof window === 'undefined') return null
  const raw = window.location.hash.replace(/^#\/?/, '')
  const parts = raw.split('/')
  if (parts[0] !== 'settings') return null
  return isSection(parts[1]) ? parts[1] : null
}

function readRememberedSection(): SectionId {
  if (typeof window === 'undefined') return 'account'
  try {
    const raw = localStorage.getItem(SECTION_STORAGE_KEY)
    if (isSection(raw)) return raw
  } catch {
    // ignore — privacy mode or storage disabled
  }
  return 'account'
}

// If the onboarding tour is mid-flight when SettingsView mounts (e.g.
// the user just clicked Next on the welcome step and the view is now
// switching to Settings for the language step), respect the tour's
// requested section as the highest-priority initial value — beating
// both the hash and the remembered section. Without this, the
// onboarding watcher below wouldn't fire on mount (no `immediate`
// + value already set), and the user would land on the wrong tab.
const initialSection: SectionId =
  onboarding.desiredSettingsSection.value ??
  readHashSection() ??
  readRememberedSection()

const section = ref<SectionId>(initialSection)

watch(section, (s) => {
  try {
    localStorage.setItem(SECTION_STORAGE_KEY, s)
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined') {
    const next = `#/settings/${s}`
    if (window.location.hash !== next) {
      window.history.replaceState(null, '', next)
    }
  }
})

function onSettingsHashChange(): void {
  const s = readHashSection()
  if (s && s !== section.value) section.value = s
}

// Onboarding can request a specific Settings section so the tour
// spotlight lands on the right card. We watch the composable's
// desired-section ref and switch when it's set.
watch(
  () => onboarding.desiredSettingsSection.value,
  (s) => {
    if (s) section.value = s
  }
)
function replayTour(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('onboarding-replay'))
  }
}

const NOTIFICATION_LOCALE_OPTIONS: ReadonlyArray<{
  value: NotificationLocale
}> = [{ value: 'auto' }, { value: 'en' }, { value: 'ar' }]

interface ExportEntry {
  id: string
  time: string
  date: string
}

interface Props {
  startDate: string
  totalSmoked: number
  totalDays: number
  dailyAvg: number
  sync?: UseSync | null
  leaderboard?: UseLeaderboard | null
  isAuthed?: boolean
  /** All entries — used by the CSV export. */
  entries?: ReadonlyArray<ExportEntry>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  reset: []
  'reminders-changed': []
  'open-auth': []
}>()

const economy = useEconomy()
const haptics = useHaptics()

// Delete-account flow. Confirmation goes through the vaul-driven
// confirm drawer; errors surface as a toast. Local data is wiped via
// emit('reset') so the parent's resetAll runs.
const { confirm: confirmDrawer } = useConfirm()
const { show: showToast } = useToast()
const deleting = ref(false)
async function onDeleteAccount(): Promise<void> {
  if (deleting.value) return
  const ok = await confirmDrawer({
    title: t('settings.delete_account_btn'),
    body: t('settings.delete_account_confirm'),
    confirmText: t('settings.delete_account_btn'),
    variant: 'danger',
  })
  if (!ok) return
  deleting.value = true
  try {
    const res = await auth.deleteAccount()
    if (!res.ok) {
      showToast(res.error ?? t('settings.delete_account_failed'), 'danger')
      return
    }
    // Wipe local data — the user is now signed out, but their
    // localStorage still has stale entries we don't want lingering.
    emit('reset')
  } finally {
    deleting.value = false
  }
}

function onHapticsToggle(): void {
  const next = !haptics.enabled.value
  haptics.setEnabled(next)
  // Fire a quick tap on enable so the user feels confirmation that
  // it's working (and a no-op on iOS, which is the honest behavior).
  if (next) haptics.fire('tap')
}
const CURRENCIES: ReadonlyArray<string> = [
  'USD', 'EUR', 'GBP', 'EGP', 'SAR', 'AED', 'JOD', 'TRY', 'CAD', 'AUD', 'INR', 'PKR',
]
const currencyOptions = computed(() =>
  CURRENCIES.map((c) => ({ value: c, label: c }))
)

function onPackPriceInput(e: Event): void {
  const v = parseFloat((e.target as HTMLInputElement).value)
  economy.setPackPrice(Number.isFinite(v) && v >= 0 ? v : 0)
}
function onCigsPerPackInput(e: Event): void {
  const v = parseInt((e.target as HTMLInputElement).value, 10)
  economy.setCigsPerPack(Number.isFinite(v) && v >= 1 ? v : 20)
}

function csvEscape(v: string): string {
  // Quote if it contains a comma, quote, or newline; double inner quotes.
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

function onExportCsv(): void {
  const rows = props.entries ?? []
  const header = 'id,time,date'
  const body = rows
    .map((e) => `${csvEscape(e.id)},${csvEscape(e.time)},${csvEscape(e.date)}`)
    .join('\n')
  const blob = new Blob([`${header}\n${body}\n`], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `smoke-tracker-${stamp}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Defer revocation so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Treat undefined as `false` so the gated state is the safe default
// when this prop isn't passed.
const isAuthed = computed(() => props.isAuthed ?? false)

const { t, locale, setLocale, isRtl } = useI18n()
const { mode: themeMode, setTheme } = useTheme()
const reminders = useReminders()

const greetingName = computed(() => {
  const ldr = props.leaderboard?.prefs.value.displayName?.trim()
  if (ldr) return ldr
  const e = auth.user.value?.email ?? ''
  return e.split('@')[0] || 'You'
})

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

function onBedtimeStartHm(hm: string): void {
  reminders.setBedtime({ start: hm })
  emit('reminders-changed')
}
function onBedtimeEndHm(hm: string): void {
  reminders.setBedtime({ end: hm })
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
  if (typeof window !== 'undefined') {
    window.addEventListener('hashchange', onSettingsHashChange)
    // Mirror the initial section to the URL only if the user landed
    // on the bare "#/settings" without a sub-route.
    const cur = window.location.hash
    const next = `#/settings/${section.value}`
    if (cur !== next && cur.startsWith('#/settings')) {
      window.history.replaceState(null, '', next)
    }
  }
})
onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('hashchange', onSettingsHashChange)
  }
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

// Hard refresh — drops every SW cache, unregisters the active worker,
// then reloads. This mirrors what Chrome's "Empty Cache and Hard Reload"
// does for SW-controlled pages: the next request actually hits the
// network instead of the cached app shell.
const refreshing = ref(false)
async function onHardRefresh(): Promise<void> {
  if (refreshing.value) return
  refreshing.value = true
  try {
    if (typeof caches !== 'undefined') {
      const names = await caches.keys()
      await Promise.all(names.map((n) => caches.delete(n)))
    }
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
  } catch {
    // best-effort — fall through to the reload either way
  }
  // Cache-busting query so even a stale HTTP cache layer is bypassed.
  const url = new URL(window.location.href)
  url.searchParams.set('_r', Date.now().toString(36))
  window.location.replace(url.toString())
}

async function handleReset(): Promise<void> {
  const ok = await confirmDrawer({
    title: t('settings.reset_btn'),
    body: t('settings.reset_confirm'),
    confirmText: t('settings.reset_btn'),
    variant: 'danger',
  })
  if (ok) emit('reset')
}
</script>

<style scoped>
/* === Settings layout === */
.settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.settings-title {
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--text);
  margin: 4px 0 0;
}

/* Section tabs — segmented control with a sliding indicator */
.seg-tabs {
  position: relative;
  display: flex;
  gap: 0;
  background: var(--btn-ghost-bg);
  border-radius: var(--radius-pill);
  padding: 4px;
  margin-top: 4px;
}
.seg-tab-indicator {
  position: absolute;
  top: 4px;
  bottom: 4px;
  inset-inline-start: 4px;
  background: var(--card);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-sm);
  transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.seg-tab {
  position: relative;
  z-index: 1;
  flex: 1;
  appearance: none;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 9px 6px;
  border-radius: var(--radius-pill);
  color: var(--muted);
  transition: color 0.2s ease;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.seg-tab.active {
  color: var(--text);
}

.sec {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
/* Animate the section swap so jumping between Account/App/Reminders/
   Data — including during the onboarding tour — feels like a deck of
   cards being shuffled rather than an instant content swap. */
.sec-anim {
  animation: sec-slide 0.32s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
@keyframes sec-slide {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Cards */
.card {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 18px;
  box-shadow: var(--shadow-sm);
  position: relative;
  overflow: hidden;
}
/* A faint colored top-stripe gives each card a tinted personality
   without making the whole surface tinted (which read muddy in dark). */
.card::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 3px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--brand) 40%, transparent),
    color-mix(in srgb, var(--accent) 40%, transparent)
  );
  opacity: 0.7;
}
.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}
.card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  flex-shrink: 0;
}
.card-icon.icon-peach { background: var(--tint-peach-bg); color: var(--tint-peach-fg); }
.card-icon.icon-mint { background: var(--tint-mint-bg); color: var(--tint-mint-fg); }
.card-icon.icon-lavender { background: var(--tint-lavender-bg); color: var(--tint-lavender-fg); }
.card-icon.icon-sun { background: var(--tint-sun-bg); color: var(--tint-sun-fg); }
.card-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}
.card-sub {
  font-size: 12px;
  color: var(--muted);
  margin-top: 2px;
  line-height: 1.45;
}

.danger-card::before {
  background: linear-gradient(90deg, var(--danger), var(--warning));
  opacity: 0.6;
}
.pwa-card::before {
  background: linear-gradient(90deg, var(--success), var(--accent));
  opacity: 0.6;
}

/* Account hero */
.acc-hero {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 4px;
}
.acc-hero-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  flex-shrink: 0;
}
.acc-hero-text {
  flex: 1;
  min-width: 0;
}
.acc-hero-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.acc-hero-sub {
  font-size: 12px;
  color: var(--muted);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Segmented control inside a card */
.segmented-row {
  display: flex;
  gap: 6px;
  background: var(--btn-ghost-bg);
  border-radius: 12px;
  padding: 4px;
}
.seg-btn {
  flex: 1;
  appearance: none;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 10px 12px;
  border-radius: 9px;
  color: var(--muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.seg-btn.active {
  background: var(--card);
  color: var(--text);
  box-shadow: var(--shadow-sm);
}

/* Helpers */
.row-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}
.block { width: 100%; }
.small-btn {
  font-size: 12px;
  padding: 8px 14px;
}
.error-chip {
  margin-top: 10px;
  padding: 10px 12px;
  background: var(--danger-soft);
  color: var(--danger);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

/* Reminder detail */
.reminder-detail {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--hairline);
}

/* Bedtime — TimePicker (vaul-vue Drawer) sits inside each card */
.bedtime-times {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 14px;
}
.time-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  background: var(--surface-tint);
  border-radius: 16px;
  border: 1.5px solid transparent;
  transition: border-color 0.15s ease, background 0.15s ease;
  cursor: pointer;
}
.time-field:focus-within {
  border-color: var(--brand);
}
.time-label {
  font-size: 10px;
  color: var(--muted);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.info-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}

/* Diagnostic details (collapsible) */
.diag-details {
  margin-top: 14px;
  padding: 10px 12px;
  background: var(--surface-tint);
  border-radius: 12px;
}
.diag-summary {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--muted);
  list-style: none;
}
.diag-summary::-webkit-details-marker { display: none; }
.diag-summary-label {
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* Data grid */
.data-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 6px;
}
.data-cell {
  background: var(--surface-tint);
  border-radius: 14px;
  padding: 12px;
  text-align: center;
}
.data-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  font-weight: 600;
}
.data-value {
  font-size: 22px;
  font-weight: 800;
  color: var(--text);
  margin-top: 4px;
}

/* Cigarette price card. align-items: end keeps the inputs flush along
   the bottom of the row even when one label wraps to two lines (e.g.
   "Cigarettes per pack"). The label itself flexes to take whatever
   vertical space it needs without dragging its input up. */
.economy-row {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 12px;
  align-items: end;
}
.economy-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.economy-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  /* Reserve two lines so a single-line label still aligns its input
     with a wrapping neighbor — keeps both inputs at the same height
     even on narrower screens. */
  min-height: 2.4em;
  display: flex;
  align-items: flex-end;
}
.economy-derived {
  margin-top: 12px;
  padding: 10px 12px;
  background: var(--surface-tint);
  border-radius: 12px;
  font-size: 12px;
  color: var(--muted);
  font-weight: 500;
  text-align: center;
}


/* Danger button */
.danger-btn {
  background: var(--danger);
  color: #fff;
  font-size: 13px;
  padding: 12px 18px;
  margin-top: 8px;
}

/* === Legacy class names kept so the script-only references still
   compile if needed. Most are unused after the rewrite. === */
.section-title {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text);
  margin-bottom: 14px;
}
.info-card {
  background: var(--card);
  border-radius: 18px;
  padding: 16px;
  margin-bottom: 10px;
  box-shadow: var(--shadow-sm);
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
