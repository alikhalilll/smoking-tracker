<template>
  <div class="fade-in home">
    <!-- Cigarette / vape mode switch. Lives above everything so it's
         the first thing the user touches when their day's behavior
         doesn't match yesterday's. Uses a plain blurred-pill style
         (no SVG refraction) so it stays cheap to render. -->
    <ModeToggle
      v-reveal
      data-onboard="home-mode"
      :model-value="activeMode"
      :options="modeOptions"
      :aria-label="t('home.mode_aria')"
      @update:model-value="(m: EntryType) => emit('set-mode', m)"
    />

    <!-- Status chips: smoke-free streak (after a finished plan) or quit target -->
    <button
      v-if="quitIsComplete && (smokeFreeDays ?? 0) > 0"
      v-reveal
      class="status-chip chip-success"
      data-onboard="home-status"
      @click="emit('open-quit')"
    >
      <span class="status-icon">🌱</span>
      <span class="status-body">
        <span class="status-label">{{
          activeMode === 'vape'
            ? t('quit.smoke_free_chip_vape')
            : t('quit.smoke_free_chip')
        }}</span>
        <span class="status-value tabular">
          {{ formatNumber(smokeFreeDays ?? 0) }}
          {{
            activeMode === 'vape'
              ? (smokeFreeDays === 1
                  ? t('quit.smoke_free_days_one_vape')
                  : t('quit.smoke_free_days_many_vape'))
              : (smokeFreeDays === 1
                  ? t('quit.smoke_free_days_one')
                  : t('quit.smoke_free_days_many'))
          }}
        </span>
      </span>
    </button>
    <button
      v-else-if="quitTodayTarget != null"
      v-reveal
      class="status-chip"
      :class="
        quitTodayStatus === 'on-track'
          ? 'chip-success'
          : quitTodayStatus === 'over'
            ? 'chip-danger'
            : ''
      "
      data-onboard="home-status"
      @click="emit('open-quit')"
    >
      <span class="status-icon">🎯</span>
      <span class="status-body">
        <span class="status-label">{{ t('home.quit_target_today') }}</span>
        <span class="status-value tabular">
          {{ formatNumber(todayCount) }} / {{ formatNumber(quitTodayTarget ?? 0) }}
        </span>
      </span>
    </button>

    <!-- Hero: vape = pod-life ring; cigarette = counter ring + stopwatch.
         Split because the vape user's mental model is "when does my pod
         die?" and a resetting "since last puff" clock is meaningless when
         a session drops 20 puffs in a minute. -->
    <div v-if="activeMode === 'vape'" v-reveal class="hero" data-onboard="home-hero">
      <ConsumableRing
        :kind="heroConsumable ?? 'pod'"
        :pct="podLifePct ?? 1"
        :puffs-remaining="puffsRemaining ?? 0"
        :puffs-this-unit="puffsThisPod ?? 0"
        :overflow="podOverflow ?? false"
        :has-active="hasActivePod ?? false"
        :today-count="todayCount"
        :sessions-today="sessionsToday ?? 0"
        @start-new="onStartNewPod"
      />
    </div>
    <div v-else v-reveal class="hero" data-onboard="home-hero">
      <div class="ring-wrap" :class="{ pulsing: isPulsing }">
        <Confetti :trigger="confettiTrigger" />
        <svg class="ring" viewBox="0 0 120 120">
          <defs>
            <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="var(--brand-grad-from)" />
              <stop offset="100%" stop-color="var(--brand-grad-to)" />
            </linearGradient>
          </defs>
          <circle
            class="ring-bg"
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke="var(--surface-tint)"
            stroke-width="10"
          />
          <circle
            class="ring-fg"
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke="url(#ringGrad)"
            stroke-width="10"
            stroke-linecap="round"
            transform="rotate(-90 60 60)"
            :stroke-dasharray="ringCircumference"
            :stroke-dashoffset="ringOffset"
          />
        </svg>
        <div class="ring-content">
          <div class="counter-number tabular">
            <Transition name="num-flip" mode="out-in">
              <span :key="todayCount">{{ formatNumber(todayCount) }}</span>
            </Transition>
          </div>
          <div class="counter-label">{{ labels.todayCounter }}</div>
        </div>
      </div>
      <div v-if="stopwatchParts" class="gap-stopwatch">
        <div class="stopwatch-time tabular" dir="ltr">
          <template v-if="stopwatchParts.days.length > 0">
            <span
              v-for="(digit, i) in stopwatchParts.days"
              :key="'d' + i"
              class="sw-cell"
            >
              <Transition name="tick-flip">
                <span :key="digit" class="sw-seg">{{ digit }}</span>
              </Transition>
            </span>
            <span class="sw-unit">{{ t('home.stopwatch_day_unit') }}</span>
          </template>

          <span class="sw-cell">
            <Transition name="tick-flip">
              <span :key="stopwatchParts.hh[0]" class="sw-seg">{{ stopwatchParts.hh[0] }}</span>
            </Transition>
          </span>
          <span class="sw-cell">
            <Transition name="tick-flip">
              <span :key="stopwatchParts.hh[1]" class="sw-seg">{{ stopwatchParts.hh[1] }}</span>
            </Transition>
          </span>
          <span class="sw-sep">:</span>
          <span class="sw-cell">
            <Transition name="tick-flip">
              <span :key="stopwatchParts.mm[0]" class="sw-seg">{{ stopwatchParts.mm[0] }}</span>
            </Transition>
          </span>
          <span class="sw-cell">
            <Transition name="tick-flip">
              <span :key="stopwatchParts.mm[1]" class="sw-seg">{{ stopwatchParts.mm[1] }}</span>
            </Transition>
          </span>
          <span class="sw-sep">:</span>
          <span class="sw-cell">
            <Transition name="tick-flip">
              <span :key="stopwatchParts.ss[0]" class="sw-seg">{{ stopwatchParts.ss[0] }}</span>
            </Transition>
          </span>
          <span class="sw-cell">
            <Transition name="tick-flip">
              <span :key="stopwatchParts.ss[1]" class="sw-seg">{{ stopwatchParts.ss[1] }}</span>
            </Transition>
          </span>
        </div>
        <div class="stopwatch-label">{{ labels.sinceLast }}</div>
        <div
          v-if="(longestGapMs ?? 0) > 0"
          class="stopwatch-best"
          :class="{ 'is-new-record': beatingBest }"
        >
          <span class="sw-best-icon" aria-hidden="true">{{ beatingBest ? '🏆' : '⏱' }}</span>
          <span class="sw-best-text">
            {{
              beatingBest
                ? t('home.new_record')
                : t('home.longest_gap_label', {
                    duration: formatDuration(longestGapMs),
                  })
            }}
          </span>
        </div>
      </div>
    </div>

    <!-- Log composer. Cigarette: keep the +/- stepper because each
         cigarette *is* a discrete unit. Vape: real vapers take sessions
         of many puffs at once — the +/- stepper misrepresents that as
         one discrete "puff" per tap. Chips let the user log a whole
         session in one tap; "Custom" opens a slider for edge cases. -->
    <div
      v-if="activeMode === 'vape'"
      v-reveal="{ delay: 80 }"
      class="log-card card"
      data-onboard="home-log"
    >
      <div class="log-chips">
        <button
          v-for="preset in vapePresets"
          :key="preset.value"
          type="button"
          class="chip"
          data-onboard="log-button"
          @click="onPresetTap(preset.value)"
        >
          <span class="chip-label">{{ preset.label }}</span>
          <em class="chip-approx">{{ t('home.preset_approx', { n: formatNumber(preset.value) }) }}</em>
        </button>
        <button type="button" class="chip chip-custom" @click="customSheetOpen = true">
          <span class="chip-label">{{ t('home.preset_custom_label') }}</span>
          <em class="chip-approx">{{
            lastCustom > 0 ? formatNumber(lastCustom) : '…'
          }}</em>
        </button>
      </div>

      <button v-if="hasEntries" class="undo-btn" @click="emit('undo')">
        {{ t('home.undo_last') }}
      </button>
    </div>

    <div
      v-else
      v-reveal="{ delay: 80 }"
      class="log-card card"
      data-onboard="home-log"
    >
      <div class="log-stepper">
        <button class="step-btn" @click="decrement" :aria-label="'minus'">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14"/></svg>
        </button>
        <div class="step-count tabular">{{ formatNumber(logCount) }}</div>
        <button class="step-btn" @click="increment" :aria-label="'plus'">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14M12 5v14"/></svg>
        </button>
      </div>

      <button
        class="btn btn-primary log-btn"
        data-onboard="log-button"
        @click="handleLog"
      >
        <svg
          v-if="showCheck"
          class="check-icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        ><path d="M5 13l4 4L19 7" /></svg>
        <span>{{
          logCount === 1 ? labels.logOne : labels.logMany(logCount)
        }}</span>
      </button>

      <button v-if="hasEntries" class="undo-btn" @click="emit('undo')">
        {{ t('home.undo_last') }}
      </button>
    </div>

    <!-- Custom-puffs sheet (vape only). Mounted whenever we're in vape
         mode so the drawer transition is smooth on repeat opens. -->
    <PuffCountSheet
      v-if="activeMode === 'vape'"
      v-model:open="customSheetOpen"
      :initial="lastCustom > 0 ? lastCustom : 15"
      @log="onCustomLog"
    />

    <!-- Last 7 days chart -->
    <div v-reveal class="chart-section" data-onboard="home-chart">
      <h3 class="h-section">{{ t('home.last_7_days') }}</h3>
      <div class="bar-chart">
        <div v-for="(d, i) in last7" :key="i" class="bar-col">
          <div
            class="bar-value tabular"
            :style="{ color: d.count > 0 ? 'var(--text)' : 'var(--subtle)' }"
          >
            {{ d.count > 0 ? formatNumber(d.count) : '·' }}
          </div>
          <div
            class="bar"
            :class="{ 'bar-today': isToday(d.date), 'bar-empty': d.count === 0 }"
            :style="{ height: barHeight(d.count) + 'px' }"
          />
          <div
            class="bar-label"
            :style="{
              fontWeight: isToday(d.date) ? 700 : 500,
              color: isToday(d.date) ? 'var(--brand)' : 'var(--subtle)',
            }"
          >
            {{ dayAbbr(d.date) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Stats grid: white cards with tinted icon bubbles -->
    <div v-reveal class="stats-grid" data-onboard="home-stats">
      <div class="stat-card">
        <div class="stat-icon icon-peach">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
        </div>
        <div class="stat-label">{{ labels.dailyAvg }}</div>
        <div class="stat-value tabular">{{
          formatNumber(activeMode === 'vape' ? (avgPuffsPerSession ?? 0) : dailyAvg)
        }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon icon-mint">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M3 12h18M3 18h12"/></svg>
        </div>
        <div class="stat-label">{{ labels.totalLogged }}</div>
        <div class="stat-value tabular">{{ formatNumber(totalSmoked) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon icon-lavender">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>
        </div>
        <div class="stat-label">{{ t('home.days_tracked') }}</div>
        <div class="stat-value tabular">{{ formatNumber(totalDays) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon icon-sun">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15 9 22 10 17 14 18 22 12 18 6 22 7 14 2 10 9 9"/></svg>
        </div>
        <div class="stat-label">{{ labels.bestDay }}</div>
        <div class="stat-value tabular">{{ formatNumber(bestDay) }}</div>
      </div>
      <div
        v-if="moneyMode != null"
        class="stat-card stat-money"
        :class="moneyMode === 'saved' ? 'stat-money-saved' : 'stat-money-spent'"
      >
        <div class="stat-icon icon-mint">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <div class="stat-label">{{ moneyLabel }}</div>
        <div class="stat-value tabular">{{ formatMoney(moneyAmount, currency) }}</div>
      </div>
    </div>

    <!-- Health milestones — only meaningful once at least one entry
         is logged. Shown in both modes; vape mode gets a caveat
         banner because the CDC/NHS milestones (cilia, lung capacity,
         etc.) are cigarette-cessation specific and don't translate
         cleanly to vape cessation. -->
    <section
      v-if="hasEntries"
      v-reveal
      class="health-section"
      data-onboard="home-health"
    >
      <div class="health-header">
        <h3 class="h-section" style="margin: 0">{{ t('home.health_section') }}</h3>
        <span v-if="nextMilestone" class="health-next">
          {{
            t('home.health_next', {
              label: t(`health.${nextMilestone.key}.label`),
              time: formatRemaining(nextMilestone.remainingMs),
            })
          }}
        </span>
      </div>
      <div class="milestones-grid">
        <div
          v-for="m in milestones"
          :key="m.key"
          class="milestone"
          :class="{ reached: m.reached }"
        >
          <div class="milestone-emoji">{{ m.emoji }}</div>
          <div class="milestone-text">
            <div class="milestone-label">{{ t(`health.${m.key}.label`) }}</div>
            <div class="milestone-progress-row">
              <div class="milestone-bar">
                <div
                  class="milestone-bar-fill"
                  :style="{ width: Math.round(m.progress * 100) + '%' }"
                />
              </div>
              <div class="milestone-pct tabular">
                {{ formatNumber(Math.round(m.progress * 100)) }}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Generate report + Share -->
    <div v-if="hasEntries" v-reveal class="bottom-actions" data-onboard="home-actions">
      <button class="btn btn-ghost" @click="emit('open-report')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 14l3-3 3 3 5-5"/></svg>
        {{ t('home.generate_report') }}
      </button>
      <button class="btn btn-ghost" @click="onShare">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>
        {{ t('share.btn') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, toRef, onMounted, onUnmounted } from 'vue'
import { useI18n, intlLocale, formatNumber } from '../i18n'
import { share } from '../composables/useShare'
import { getToday } from '../composables/useDate'
import { useToast } from '../composables/useToast'
import { useEconomy, formatMoney } from '../composables/useEconomy'
import { useHealthMilestones } from '../composables/useHealthMilestones'
import { formatDuration } from '../composables/useStats'
import Confetti from './Confetti.vue'
import ModeToggle from './ModeToggle.vue'
import ConsumableRing from './ConsumableRing.vue'
import PuffCountSheet from './PuffCountSheet.vue'
import { useConfirm } from '../composables/useConfirm'
import type { ConsumableKind, DayBucket, EntryType } from '../types'

const { t } = useI18n()

interface Props {
  activeMode: EntryType
  todayCount: number
  lastSmokeTime?: string
  last7: DayBucket[]
  maxLast7: number
  dailyAvg: number
  totalSmoked: number
  totalDays: number
  bestDay: number
  /** Longest awake gap recorded between two logs (ms). 0 if none. */
  longestGapMs?: number
  hasEntries: boolean
  quitTodayTarget?: number | null
  quitTodayStatus?: 'on-track' | 'over' | null
  quitIsComplete?: boolean
  smokeFreeDays?: number
  // Vape-mode hero-consumable life + session stats. Zero / default
  // values are safe in cigarette mode — the ring / session inline
  // never renders. Prop names still say "pod" for backward-compat but
  // now refer to whichever consumable is the hero.
  heroConsumable?: ConsumableKind
  puffsThisPod?: number
  puffsRemaining?: number
  podLifePct?: number
  podOverflow?: boolean
  hasActivePod?: boolean
  sessionsToday?: number
  avgPuffsPerSession?: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  log: [count: number]
  undo: []
  'open-report': []
  'open-quit': []
  'set-mode': [mode: EntryType]
  'start-new-pod': []
}>()

// Single source of truth for vape ↔ cigarette string swaps. Adding a
// new mode-aware label means adding one line here, not hunting
// through the template. `t(...)` is reactive so locale switches still
// re-render.
const labels = computed(() => {
  const vape = props.activeMode === 'vape'
  return {
    todayCounter: vape ? t('home.puffs_today') : t('home.cigarettes_today'),
    sinceLast: vape ? t('home.since_last_puff') : t('home.since_last'),
    logOne: vape ? t('home.log_one_puff') : t('home.log_one'),
    logMany: (n: number) =>
      vape ? t('home.log_many_puffs', { n }) : t('home.log_many', { n }),
    dailyAvg: vape ? t('home.daily_avg_puffs') : t('home.daily_avg'),
    totalLogged: vape ? t('home.total_logged_puffs') : t('home.total_logged'),
    bestDay: vape ? t('home.best_day_puffs') : t('home.best_day'),
  }
})

const modeOptions = computed(() => [
  { value: 'cigarette' as EntryType, label: t('home.mode_cigarette'), emoji: '🚬' },
  { value: 'vape' as EntryType, label: t('home.mode_vape'), emoji: '💨' },
])

const logCount = ref(1)
const isPulsing = ref(false)
const showCheck = ref(false)
const confettiTrigger = ref(0)

// Vape session presets. Sizes tuned to the three coarse ways people
// actually vape: a "just needed a hit" moment (~5), a normal sitting
// (~15), and the sustained watch-a-movie-with-a-vape session (~30).
// Labels come from i18n; values are the puff counts we log on tap.
const vapePresets = computed(() => [
  { value: 5, label: t('home.preset_quick_label') },
  { value: 15, label: t('home.preset_session_label') },
  { value: 30, label: t('home.preset_long_label') },
])
const customSheetOpen = ref(false)
const lastCustom = ref<number>(0)

function onPresetTap(count: number): void {
  emit('log', count)
  isPulsing.value = true
  showCheck.value = true
  setTimeout(() => (isPulsing.value = false), 500)
  setTimeout(() => (showCheck.value = false), 700)
}
function onCustomLog(count: number): void {
  lastCustom.value = count
  emit('log', count)
  isPulsing.value = true
  setTimeout(() => (isPulsing.value = false), 500)
}
async function onStartNewPod(): Promise<void> {
  // Confirm copy varies per consumable — "Start a new pod?" reads
  // wrong for coil / bottle / disposable users. Falls back to the
  // pod copy if the hero is somehow undefined.
  const kind = props.heroConsumable ?? 'pod'
  const ok = await useConfirm().confirm({
    title: t(`home.consumable_${kind}_new_confirm_title`),
    body: t(`home.consumable_${kind}_new_confirm_body`),
    confirmText: t(`home.consumable_${kind}_new_cta`),
    cancelText: t('home.pod_new_confirm_cancel'),
  })
  if (ok) emit('start-new-pod')
}

// Economy: when the user has a smoke-free streak, show "money saved
// during this streak". Otherwise (they're actively smoking), show
// "total spent" so the card never silently disappears on a relapse.
// Returns null only when no price is configured.
const economy = useEconomy()
const currency = computed(() => economy.settings.value.currency)
const moneyMode = computed<'saved' | 'spent' | null>(() => {
  if (economy.pricePerUnit.value <= 0) return null
  return (props.smokeFreeDays ?? 0) > 0 ? 'saved' : 'spent'
})
const moneyAmount = computed<number>(() => {
  const price = economy.pricePerUnit.value
  if (moneyMode.value === 'saved') {
    return price * props.dailyAvg * (props.smokeFreeDays ?? 0)
  }
  return price * props.totalSmoked
})
const moneyLabel = computed<string>(() =>
  moneyMode.value === 'saved' ? t('home.money_saved') : t('home.money_spent')
)

// Health milestones tick relative to the last log of the active
// mode. Cigarette mode uses CDC / NHS data; vape mode uses
// nicotine-cessation + vape-specific recovery research.
const lastSmokeRef = toRef(props, 'lastSmokeTime')
const lastSmokeOrNull = computed<string | null>(
  () => lastSmokeRef.value ?? null
)
const activeModeRef = toRef(props, 'activeMode')
const { all: milestones, next: nextMilestone } =
  useHealthMilestones(lastSmokeOrNull, activeModeRef)

function formatRemaining(ms: number): string {
  return formatDuration(ms)
}

// Live stopwatch since the last logged cigarette. Ticks every second
// while the component is mounted; the computed gates display so we
// render nothing before the first log.
const now = ref(Date.now())
let nowTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  nowTimer = setInterval(() => (now.value = Date.now()), 1000)
})
onUnmounted(() => {
  if (nowTimer) clearInterval(nowTimer)
})

interface StopwatchParts {
  /** One localized digit per place value. Empty when below 1 day. */
  days: string[]
  /** Two localized digits each — [tens, ones]. */
  hh: [string, string]
  mm: [string, string]
  ss: [string, string]
}

// True when the live "since last cigarette" timer has surpassed the
// historical longest gap — the user is mid-record. Compared in raw
// ms (not the rounded display value) so the celebration kicks in
// the instant they cross the threshold.
const beatingBest = computed<boolean>(() => {
  const best = props.longestGapMs ?? 0
  if (best <= 0 || !props.lastSmokeTime) return false
  const elapsed = now.value - new Date(props.lastSmokeTime).getTime()
  return elapsed > best
})

const stopwatchParts = computed<StopwatchParts | null>(() => {
  if (!props.lastSmokeTime) return null
  // Clamp to 0 — right after logging, `now.value` (1s ticks) can briefly
  // trail the freshly-stamped entry time. Without the clamp, elapsed goes
  // negative for a fraction of a second and the whole block disappears.
  const elapsed = Math.max(0, now.value - new Date(props.lastSmokeTime).getTime())
  const totalSec = Math.floor(elapsed / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60

  // Format each individual digit in the active locale so the template
  // can wrap every digit in its own <Transition>. On a typical tick
  // only the ones-place of seconds changes — every other digit stays
  // mounted and silent.
  const loc = intlLocale()
  const fmt = new Intl.NumberFormat(loc, { useGrouping: false })
  const split2 = (n: number): [string, string] => [
    fmt.format(Math.floor(n / 10)),
    fmt.format(n % 10),
  ]
  const splitN = (n: number): string[] => {
    if (n === 0) return [fmt.format(0)]
    const out: string[] = []
    let v = n
    while (v > 0) {
      out.unshift(fmt.format(v % 10))
      v = Math.floor(v / 10)
    }
    return out
  }
  return {
    days: days > 0 ? splitN(days) : [],
    hh: split2(hours),
    mm: split2(minutes),
    ss: split2(seconds),
  }
})

// Progress ring fills relative to either the quit-plan target (if any)
// or the daily average baseline. When today exceeds the target the ring
// is fully drawn — we don't over-fill, just lock at 100%.
const RING_R = 52
const ringCircumference = 2 * Math.PI * RING_R
const ringOffset = computed(() => {
  const baseline = props.quitTodayTarget ?? Math.max(props.dailyAvg, 1)
  const filled = Math.min(1, props.todayCount / Math.max(1, baseline))
  return ringCircumference * (1 - filled)
})

function increment(): void {
  if (logCount.value < 10) logCount.value++
}
function decrement(): void {
  if (logCount.value > 1) logCount.value--
}

function handleLog(): void {
  emit('log', logCount.value)
  isPulsing.value = true
  showCheck.value = true
  setTimeout(() => (isPulsing.value = false), 500)
  setTimeout(() => (showCheck.value = false), 700)
  logCount.value = 1
}

// Confetti on smoke-free milestones (1 / 7 / 14 / 30 / 100 days).
const MILESTONES = [1, 7, 14, 30, 100]
const lastCelebrated = ref<number | null>(null)
const { show: showToast } = useToast()
watch(
  () => props.smokeFreeDays ?? 0,
  (n) => {
    if (MILESTONES.includes(n) && lastCelebrated.value !== n) {
      lastCelebrated.value = n
      confettiTrigger.value++
      const vape = props.activeMode === 'vape'
      showToast(
        n === 1
          ? vape
            ? t('home.milestone_one_day_vape')
            : t('home.milestone_one_day')
          : vape
            ? t('home.milestone_n_days_vape', { n })
            : t('home.milestone_n_days', { n }),
        'success'
      )
    }
  }
)

function barHeight(count: number): number {
  if (count === 0) return 6
  return Math.max(14, (count / props.maxLast7) * 95)
}

function isToday(dateStr: string): boolean {
  return dateStr === getToday()
}

function dayAbbr(dateStr: string): string {
  const out = new Date(dateStr + 'T00:00:00').toLocaleDateString(
    intlLocale(),
    { weekday: 'short' }
  )
  return out.length > 3 ? out : out.slice(0, 2)
}

function shareText(): string {
  const vape = props.activeMode === 'vape'
  if (props.quitIsComplete && (props.smokeFreeDays ?? 0) > 0) {
    return vape
      ? t('share.smoke_free_vape', { n: props.smokeFreeDays! })
      : t('share.smoke_free', { n: props.smokeFreeDays! })
  }
  if (props.totalSmoked === 0) return t('share.nothing_yet')
  return vape
    ? t('share.summary_vape', {
        total: props.totalSmoked,
        days: props.totalDays,
        avg: props.dailyAvg,
        longest: '—',
      })
    : t('share.summary', {
        total: props.totalSmoked,
        days: props.totalDays,
        avg: props.dailyAvg,
        longest: '—',
      })
}

async function onShare(): Promise<void> {
  const result = await share({ title: 'Smoking Tracker', text: shareText() })
  if (result.via === 'clipboard' && result.ok) {
    showToast(t('share.copied'), 'success')
  }
}
</script>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* Status chip */
.status-chip {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: var(--radius-card);
  border: 1.5px solid var(--hairline);
  background: var(--card);
  font-family: inherit;
  cursor: pointer;
  text-align: start;
  transition: transform 0.1s ease, border-color 0.15s ease;
  width: 100%;
}
.status-chip:active {
  transform: scale(0.99);
}
.status-chip.chip-success {
  background: var(--success-soft);
  border-color: color-mix(in srgb, var(--success) 30%, transparent);
}
.status-chip.chip-danger {
  background: var(--danger-soft);
  border-color: color-mix(in srgb, var(--danger) 30%, transparent);
}
.status-icon {
  font-size: 22px;
}
.status-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}
.status-label {
  font-size: 11px;
  color: var(--muted);
  font-weight: 600;
}
.status-value {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}
.chip-success .status-value {
  color: var(--success);
}
.chip-danger .status-value {
  color: var(--danger);
}

/* Hero with progress ring */
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin: 6px 0;
}
.ring-wrap {
  position: relative;
  width: 220px;
  aspect-ratio: 1;
}
.ring-wrap.pulsing {
  animation: pop 0.45s ease;
}
.ring {
  width: 100%;
  height: 100%;
  display: block;
}
.ring-fg {
  transition: stroke-dashoffset 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
  filter: drop-shadow(0 0 6px rgba(255, 122, 61, 0.25));
}
.ring-content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.counter-number {
  /* Override the global .tabular mono font so the counter follows
     the app's language font (Inter for en, Cairo for ar) — the
     tabular-nums variant from .tabular still keeps digits aligned. */
  font-family: inherit;
  font-size: 64px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
  color: var(--text);
  /* Establish a positioning context so the in/out spans of the
     <Transition> can stack over each other without shifting layout
     during the cross-fade. */
  position: relative;
  display: inline-block;
  min-width: 1ch;
}
.counter-number > span {
  display: inline-block;
}
/* Counter flip — slide + fade when the today count actually changes. */
.num-flip-enter-active,
.num-flip-leave-active {
  transition: opacity 0.32s cubic-bezier(0.2, 0.8, 0.2, 1),
    transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1);
  will-change: opacity, transform;
}
.num-flip-enter-from {
  opacity: 0;
  transform: translateY(14px) scale(0.85);
}
.num-flip-leave-to {
  opacity: 0;
  transform: translateY(-14px) scale(0.92);
}
.counter-label {
  font-size: 12px;
  color: var(--muted);
  margin-top: 6px;
  font-weight: 500;
}
.gap-stopwatch {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.stopwatch-time {
  /* Same override as .counter-number — follow the app font. */
  font-family: inherit;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--text);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  /* Numeric clocks read left-to-right in both English and Arabic.
     Pinning ltr here keeps "00:01:23" in the right order even when
     the surrounding RTL container would otherwise flip it. */
  direction: ltr;
  unicode-bidi: isolate;
}
/* One cell per digit. Relative positioning lets the in/out spans of
   each digit's <Transition> stack without budging neighbors; the
   `1ch` width keeps the cell from reflowing while a digit fades. */
.sw-cell {
  position: relative;
  display: inline-block;
  width: 1ch;
  height: 1em;
  text-align: center;
}
.sw-seg {
  position: absolute;
  inset: 0;
  display: inline-block;
}
.sw-sep {
  padding: 0 1px;
  opacity: 0.7;
}
.sw-unit {
  margin-left: 2px;
  margin-right: 6px;
  font-weight: 600;
}
/* Stopwatch tick — concurrent crossfade (no mode="out-in" gap). */
.tick-flip-enter-active,
.tick-flip-leave-active {
  transition: opacity 0.28s ease, transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
  will-change: opacity, transform;
}
.tick-flip-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.tick-flip-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (prefers-reduced-motion: reduce) {
  .num-flip-enter-active,
  .num-flip-leave-active,
  .tick-flip-enter-active,
  .tick-flip-leave-active {
    transition: none !important;
  }
  .num-flip-enter-from,
  .num-flip-leave-to,
  .tick-flip-enter-from,
  .tick-flip-leave-to {
    transform: none !important;
  }
}
/* Personal-best line under the stopwatch. Subtle by default; flips
   to a brand-tinted chip with a trophy when the live elapsed time
   beats the historical best. */
.stopwatch-best {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  padding: 7px 14px;
  border-radius: 999px;
  background: var(--surface-tint);
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
  letter-spacing: 0.02em;
  transition: background 0.25s ease, color 0.25s ease, transform 0.25s ease;
}
.stopwatch-best.is-new-record {
  color: #fff;
  background: linear-gradient(
    135deg,
    var(--brand-grad-from),
    var(--brand-grad-to)
  );
  box-shadow: 0 4px 14px rgba(255, 122, 61, 0.32);
  animation: best-pop 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.sw-best-icon {
  font-size: 14px;
  line-height: 1;
}
@keyframes best-pop {
  0%   { transform: scale(0.92); }
  60%  { transform: scale(1.06); }
  100% { transform: scale(1); }
}
.stopwatch-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--subtle);
  letter-spacing: 0.02em;
}

/* Log card */
.log-card {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
}
.log-stepper {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 4px 0;
}
.step-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: var(--btn-ghost-bg);
  font-family: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text);
  transition: transform 0.1s ease, background 0.15s ease;
}
.step-btn:active {
  transform: scale(0.92);
  background: var(--surface-tint);
}
.step-count {
  font-size: 28px;
  font-weight: 700;
  min-width: 36px;
  text-align: center;
  color: var(--text);
}
.log-btn {
  font-size: 16px;
  padding: 16px;
}
.check-icon {
  animation: pop 0.4s ease;
}
.undo-btn {
  align-self: center;
  appearance: none;
  background: transparent;
  border: none;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  cursor: pointer;
  padding: 4px 12px;
}
.undo-btn:hover {
  color: var(--text);
}

/* Vape session-preset chip row. 2×2 grid of pill buttons; each chip is
   a one-tap logger (Quick hit / Session / Long session / Custom). The
   `~N` count is emphasized in italic so users learn what each preset
   stamps without a legend. */
.log-chips {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.chip {
  appearance: none;
  border: 1.5px solid var(--hairline);
  background: var(--card);
  font-family: inherit;
  cursor: pointer;
  padding: 12px 14px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 48px;
  color: var(--text);
  transition: transform 0.1s ease, border-color 0.15s ease, background 0.15s ease;
}
.chip:active {
  transform: scale(0.97);
  background: color-mix(in srgb, #14b8a6 12%, var(--card));
  border-color: color-mix(in srgb, #14b8a6 45%, var(--hairline));
}
.chip-label {
  font-size: 14px;
  font-weight: 600;
}
.chip-approx {
  font-style: normal;
  font-size: 13px;
  font-weight: 700;
  color: #14b8a6;
  font-variant-numeric: tabular-nums;
}
.chip-custom {
  background: color-mix(in srgb, #14b8a6 8%, var(--card));
  border-color: color-mix(in srgb, #14b8a6 30%, var(--hairline));
}
.chip-custom .chip-approx {
  color: var(--muted);
}

/* Chart */
.chart-section {
  margin-top: 4px;
}
/* Fixed-height columns so the bar can never push the value or
   label out of the card. Each column is a flex stack pinned to the
   bottom; the bar's pixel height is clamped to a hard ceiling. */
.bar-chart {
  display: flex;
  gap: 6px;
  padding: 14px;
  background: var(--card);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  align-items: flex-end;
  height: 144px;
}
.bar-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  height: 100%;
}
.bar-value {
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  line-height: 1;
}
.bar {
  width: 100%;
  border-radius: 6px 6px 2px 2px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--brand) 40%, transparent),
    var(--bar-default)
  );
  transition: height 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
  max-height: 90px;
}
.bar.bar-empty {
  background: var(--bar-empty);
  opacity: 0.6;
}
.bar.bar-today {
  background: linear-gradient(
    180deg,
    var(--brand-grad-from),
    var(--brand-grad-to)
  );
  box-shadow: 0 4px 12px rgba(255, 122, 61, 0.3);
  animation: pulse-glow 2.4s ease-in-out infinite;
}
.bar-label {
  font-size: 10px;
  letter-spacing: 0.04em;
  text-align: center;
  line-height: 1;
}

/* Stats grid — white cards with tinted icon bubbles (wellness vibe) */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.stat-card {
  position: relative;
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 16px;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: 8px;
  /* Allow flex children (the value text) to actually shrink below
     their intrinsic width — without this, long currency strings
     ("EGP 1,234.50") push the card past its grid cell. */
  min-width: 0;
}
.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 12px;
}
.stat-icon.icon-peach { background: var(--tint-peach-bg); color: var(--tint-peach-fg); }
.stat-icon.icon-mint { background: var(--tint-mint-bg); color: var(--tint-mint-fg); }
.stat-icon.icon-lavender { background: var(--tint-lavender-bg); color: var(--tint-lavender-fg); }
.stat-icon.icon-sun { background: var(--tint-sun-bg); color: var(--tint-sun-fg); }
.stat-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}
.stat-value {
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--text);
  line-height: 1;
  /* Cap intrinsic width and let long values wrap rather than overflow.
     The money card's value can be 12+ chars ("EGP 1,234.50") and
     wouldn't fit at 32px on a narrow phone. */
  overflow-wrap: anywhere;
  word-break: break-word;
}

/* Health milestones */
.health-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.health-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
}
.health-next {
  font-size: 11px;
  color: var(--muted);
  font-weight: 500;
}
.milestones-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 14px;
  box-shadow: var(--shadow-sm);
}
.milestone {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 4px;
  opacity: 0.55;
  transition: opacity 0.2s ease;
}
.milestone.reached {
  opacity: 1;
}
.milestone-emoji {
  font-size: 22px;
  width: 32px;
  text-align: center;
  flex-shrink: 0;
}
.milestone-text {
  flex: 1;
  min-width: 0;
}
.milestone-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 6px;
}
.milestone-progress-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.milestone-bar {
  flex: 1;
  height: 6px;
  background: var(--surface-tint);
  border-radius: 3px;
  overflow: hidden;
}
.milestone-bar-fill {
  height: 100%;
  background: linear-gradient(
    90deg,
    var(--brand-grad-from),
    var(--brand-grad-to)
  );
  transition: width 0.4s ease;
}
.milestone.reached .milestone-bar-fill {
  background: var(--success);
}
.milestone-pct {
  font-size: 10px;
  font-weight: 700;
  color: var(--muted);
  min-width: 28px;
  text-align: end;
  letter-spacing: 0.02em;
}

/* Money card: clamp keeps the currency string readable on narrow
   phones (~20px) and lets larger screens stretch back up to 28px,
   so "EGP 1,234.50" never crashes through the card edge. */
.stat-money .stat-value {
  font-size: clamp(20px, 6.5vw, 28px);
}
.stat-money-saved .stat-value {
  color: var(--success);
}

/* Bottom actions */
.bottom-actions {
  display: flex;
  gap: 8px;
}
.bottom-actions .btn {
  flex: 1;
  font-size: 13px;
  padding: 12px;
}
</style>
