<template>
  <div class="fade-in home">
    <!-- Status chips: smoke-free streak (after a finished plan) or quit target -->
    <button
      v-if="quitIsComplete && (smokeFreeDays ?? 0) > 0"
      class="status-chip chip-success"
      @click="emit('open-quit')"
    >
      <span class="status-icon">🌱</span>
      <span class="status-body">
        <span class="status-label">{{ t('quit.smoke_free_chip') }}</span>
        <span class="status-value tabular">
          {{ smokeFreeDays }}
          {{
            smokeFreeDays === 1
              ? t('quit.smoke_free_days_one')
              : t('quit.smoke_free_days_many')
          }}
        </span>
      </span>
    </button>
    <button
      v-else-if="quitTodayTarget != null"
      class="status-chip"
      :class="
        quitTodayStatus === 'on-track'
          ? 'chip-success'
          : quitTodayStatus === 'over'
            ? 'chip-danger'
            : ''
      "
      @click="emit('open-quit')"
    >
      <span class="status-icon">🎯</span>
      <span class="status-body">
        <span class="status-label">{{ t('home.quit_target_today') }}</span>
        <span class="status-value tabular">
          {{ todayCount }} / {{ quitTodayTarget }}
        </span>
      </span>
    </button>

    <!-- Hero counter ring -->
    <div class="hero">
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
          <div class="counter-number tabular">{{ animatedTodayCount }}</div>
          <div class="counter-label">{{ t('home.cigarettes_today') }}</div>
        </div>
      </div>
      <div v-if="lastSmokeText" class="last-smoke">
        {{ t('home.last_one', { ago: lastSmokeText }) }}
      </div>
    </div>

    <!-- Log composer -->
    <div class="log-card card">
      <div class="log-stepper">
        <button class="step-btn" @click="decrement" :aria-label="'minus'">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14"/></svg>
        </button>
        <div class="step-count tabular">{{ logCount }}</div>
        <button class="step-btn" @click="increment" :aria-label="'plus'">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14M12 5v14"/></svg>
        </button>
      </div>

      <button class="btn btn-primary log-btn" @click="handleLog">
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
          logCount === 1
            ? t('home.log_one')
            : t('home.log_many', { n: logCount })
        }}</span>
      </button>

      <button v-if="hasEntries" class="undo-btn" @click="emit('undo')">
        {{ t('home.undo_last') }}
      </button>
    </div>

    <!-- Last 7 days chart -->
    <div class="chart-section">
      <h3 class="h-section">{{ t('home.last_7_days') }}</h3>
      <div class="bar-chart">
        <div v-for="(d, i) in last7" :key="i" class="bar-col">
          <div
            class="bar-value tabular"
            :style="{ color: d.count > 0 ? 'var(--text)' : 'var(--subtle)' }"
          >
            {{ d.count || '·' }}
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
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon icon-peach">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
        </div>
        <div class="stat-label">{{ t('home.daily_avg') }}</div>
        <div class="stat-value tabular">{{ dailyAvg }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon icon-mint">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M3 12h18M3 18h12"/></svg>
        </div>
        <div class="stat-label">{{ t('home.total_logged') }}</div>
        <div class="stat-value tabular">{{ totalSmoked }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon icon-lavender">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>
        </div>
        <div class="stat-label">{{ t('home.days_tracked') }}</div>
        <div class="stat-value tabular">{{ totalDays }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon icon-sun">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15 9 22 10 17 14 18 22 12 18 6 22 7 14 2 10 9 9"/></svg>
        </div>
        <div class="stat-label">{{ t('home.best_day') }}</div>
        <div class="stat-value tabular">{{ bestDay }}</div>
      </div>
    </div>

    <!-- Generate report + Share -->
    <div v-if="hasEntries" class="bottom-actions">
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
import { ref, computed, watch, toRef } from 'vue'
import { useI18n, intlLocale } from '../i18n'
import { share } from '../composables/useShare'
import { getToday } from '../composables/useDate'
import { useCountUp } from '../composables/useCountUp'
import { useToast } from '../composables/useToast'
import Confetti from './Confetti.vue'
import type { DayBucket } from '../types'

const { t } = useI18n()

interface Props {
  todayCount: number
  lastSmokeText?: string
  last7: DayBucket[]
  maxLast7: number
  dailyAvg: number
  totalSmoked: number
  totalDays: number
  bestDay: number
  hasEntries: boolean
  quitTodayTarget?: number | null
  quitTodayStatus?: 'on-track' | 'over' | null
  quitIsComplete?: boolean
  smokeFreeDays?: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  log: [count: number]
  undo: []
  'open-report': []
  'open-quit': []
}>()

const logCount = ref(1)
const isPulsing = ref(false)
const showCheck = ref(false)
const confettiTrigger = ref(0)

const animatedTodayCount = useCountUp(toRef(props, 'todayCount'))

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
      showToast(
        n === 1
          ? t('home.milestone_one_day')
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
  if (props.quitIsComplete && (props.smokeFreeDays ?? 0) > 0) {
    return t('share.smoke_free', { n: props.smokeFreeDays! })
  }
  if (props.totalSmoked === 0) return t('share.nothing_yet')
  return t('share.summary', {
    total: props.totalSmoked,
    days: props.totalDays,
    avg: props.dailyAvg,
    longest: '—',
  })
}

async function onShare(): Promise<void> {
  const result = await share({ title: 'Smoke Tracker', text: shareText() })
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
  font-size: 64px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
  color: var(--text);
}
.counter-label {
  font-size: 12px;
  color: var(--muted);
  margin-top: 6px;
  font-weight: 500;
}
.last-smoke {
  font-size: 12px;
  color: var(--subtle);
  font-weight: 500;
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

/* Chart */
.chart-section {
  margin-top: 4px;
}
.bar-chart {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  height: 120px;
  padding: 12px;
  background: var(--card);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-sm);
}
.bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.bar-value {
  font-size: 11px;
  font-weight: 600;
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
