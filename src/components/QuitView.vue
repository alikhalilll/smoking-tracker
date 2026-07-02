<template>
  <div class="fade-in">
    <!-- Setup screen: no plan yet -->
    <template v-if="!isActive">
      <div class="section-title">{{ t('quit.title') }}</div>
      <div class="intro">{{ quitIntroText }}</div>

      <!-- Suggestion hero. When we have ≥3 days of history we offer a
           one-tap plan; otherwise we show a soft empty state. The
           "Customize" button reveals the manual baseline + intensity
           controls below. -->
      <div v-if="!customizing" v-reveal class="suggestion-card">
        <div class="suggestion-glyph">✨</div>
        <div class="suggestion-title">
          {{ suggestion.ready ? t('quit.suggestion.title') : t('quit.suggestion.empty_title') }}
        </div>
        <div class="suggestion-body">
          <template v-if="suggestion.ready">
            {{ t('quit.suggestion.body', {
              history: suggestion.daysOfHistory,
              intensity: t(`quit.intensities.${suggestion.intensity}.label`),
              baseline: formatNumber(suggestion.baseline),
              days: suggestion.durationDays,
            }) }}
          </template>
          <template v-else>{{ t('quit.suggestion.empty_body') }}</template>
        </div>
        <div class="suggestion-actions">
          <button
            v-if="suggestion.ready"
            class="btn btn-primary"
            @click="emit('start', { intensity: suggestion.intensity, baseline: suggestion.baseline })"
          >
            {{ t('quit.suggestion.cta') }}
          </button>
          <button class="btn btn-ghost" @click="customizing = true">
            {{ t('quit.suggestion.customize') }}
          </button>
        </div>
      </div>

      <div v-if="customizing" v-reveal class="baseline-card" data-onboard="quit-baseline">
        <div class="baseline-label">{{ t('quit.suggested_baseline') }}</div>
        <div class="baseline-row">
          <button class="round-btn" @click="decBaseline">−</button>
          <div class="baseline-value">{{ formatNumber(baselineInput) }}</div>
          <button class="round-btn" @click="incBaseline">+</button>
        </div>
        <div class="baseline-hint">{{ baselineHintText }}</div>
      </div>

      <div v-if="customizing" class="section-title" style="margin-top: 1.75rem">
        {{ t('quit.pick_pace') }}
      </div>
      <div v-if="customizing" class="intensity-list" data-onboard="quit-intensity-list">
        <button
          v-for="intensity in intensities"
          :key="intensity"
          v-reveal
          class="intensity-card"
          @click="emit('start', { intensity, baseline: baselineInput })"
        >
          <div class="intensity-label">
            {{ t(`quit.intensities.${intensity}.label`) }}
          </div>
          <div class="intensity-blurb">
            {{ t(`quit.intensities.${intensity}.blurb`) }}
          </div>
          <div class="intensity-preview">
            {{
              t('quit.preview', {
                first: previewTarget(intensity, 0),
                n: INTENSITY_DURATIONS[intensity],
              })
            }}
          </div>
        </button>
      </div>

      <div v-if="customizing && suggestedBaseline < 3" class="muted-line">
        {{ t('quit.not_enough_logs') }}
      </div>
    </template>

    <!-- Active or completed plan -->
    <template v-else-if="plan">
      <div class="plan-header">
        <div>
          <div class="section-title" style="margin-bottom: 4px">
            {{ isComplete ? t('quit.plan_complete') : t('quit.today') }}
          </div>
          <div class="plan-sub">
            {{ t(`quit.intensities.${plan.intensity}.label`) }} ·
            {{ t('quit.started_on', { date: formatDate(plan.startDate) }) }}
          </div>
        </div>
        <button class="abandon-btn" @click="confirmAbandon">
          {{ isComplete ? t('quit.close_plan') : t('quit.abandon') }}
        </button>
      </div>

      <!-- Today's target hero -->
      <div v-if="!isComplete && todayTarget != null" v-reveal class="today-card">
        <div class="today-target-row">
          <div class="today-actual" :style="{ color: actualColor }">
            {{ formatNumber(todayActual) }}
          </div>
          <div class="today-divider">/</div>
          <div class="today-target">{{ formatNumber(todayTarget ?? 0) }}</div>
        </div>
        <div class="today-meta">
          <span v-if="todayStatus === 'on-track'" class="status-ok">
            {{
              t('quit.on_track_remaining', { remaining: remainingTodayLabel })
            }}
          </span>
          <span v-else-if="todayStatus === 'over'" class="status-over">
            {{ t('quit.over_by', { n: todayActual - todayTarget }) }}
          </span>
        </div>
        <div class="today-bar-track">
          <div
            class="today-bar-fill"
            :style="{
              width: progressPct + '%',
              background: actualColor,
            }"
          />
        </div>
        <div v-if="incentiveMessage" class="incentive">
          {{ incentiveMessage }}
        </div>
      </div>

      <div v-else-if="isComplete" v-reveal class="today-card complete-card">
        <div class="smoke-free-hero">
          <div class="smoke-free-number">{{ formatNumber(smokeFreeDays) }}</div>
          <div class="smoke-free-label">
            {{
              smokeFreeDays === 1 ? smokeFreeOneText : smokeFreeManyText
            }}
          </div>
          <div class="smoke-free-sub">{{ t('quit.smoke_free_since') }}</div>
        </div>

        <div class="complete-headline" style="margin-top: 1rem">
          {{
            (progress?.successRate ?? 0) >= 0.7
              ? t('quit.complete_strong')
              : t('quit.complete_finished')
          }}
        </div>
        <div class="complete-sub">
          {{
            t('quit.completed_summary', {
              onTrack: progress?.daysOnTrack ?? 0,
              total: plan.durationDays,
            })
          }}
        </div>
        <div v-if="incentiveMessage" class="incentive" style="margin-top: 12px">
          {{ incentiveMessage }}
        </div>
      </div>

      <!-- Progress stats. Same <StatsCard> as the home insight grid so
           the quit screen feels like part of the same dashboard family. -->
      <div v-if="progress" v-reveal class="stat-grid">
        <StatsCard tint="peach" :label="t('quit.day')">
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M8 3v4M16 3v4"/></svg>
          </template>
          <template #value>
            {{ formatNumber(Math.min(progress.daysElapsed + 1, plan.durationDays)) }}<span class="stat-value-suffix">/ {{ formatNumber(plan.durationDays) }}</span>
          </template>
          <template #flourish>
            <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="66" y="30" width="34" height="34" rx="4"/>
              <path d="M66 42 L100 42"/>
              <path d="M74 30 V26 M92 30 V26"/>
              <path d="M76 52 h4 M88 52 h4 M76 60 h4 M88 60 h4"/>
            </svg>
          </template>
        </StatsCard>
        <StatsCard tint="lavender" :label="t('quit.streak')" :value="formatNumber(progress.currentStreak)">
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>
          </template>
          <template #flourish>
            <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M84 18 c-6 12 -18 18 -18 34 c0 12 8 22 18 22 s18 -10 18 -22 c0 -10 -6 -14 -10 -22 c-2 -6 -4 -10 -8 -12 z"/>
              <path d="M84 44 c-2 6 -8 8 -8 18 c0 6 4 10 8 10 s8 -4 8 -10"/>
            </svg>
          </template>
        </StatsCard>
        <StatsCard tint="mint" :label="t('quit.on_track_count')" :value="formatNumber(progress.daysOnTrack)">
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
          </template>
          <template #flourish>
            <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="86" cy="48" r="26"/>
              <path d="M74 48 l8 8 l16 -18"/>
            </svg>
          </template>
        </StatsCard>
        <StatsCard tint="sun" :label="t('quit.over_count')" :value="formatNumber(progress.daysOver)">
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
          </template>
          <template #flourish>
            <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M86 20 L60 70 h52 z"/>
              <path d="M86 40 v18"/>
              <circle cx="86" cy="64" r="1.5" fill="currentColor" stroke="none"/>
            </svg>
          </template>
        </StatsCard>
      </div>

      <!-- Plan timeline grouped by week -->
      <div class="section-title" style="margin-top: 1.5rem">
        {{ t('quit.plan_label') }}
      </div>
      <div class="week-list">
        <div v-for="week in planWeeks" :key="week.index" v-reveal class="week-group">
          <button
            class="week-header"
            :class="{ open: openWeeks[week.index] }"
            @click="toggleWeek(week.index)"
          >
            <div class="week-title">
              <span class="caret" :class="{ open: openWeeks[week.index] }">›</span>
              {{ t('quit.week_label', { n: week.index + 1 }) }}
              <span
                v-if="week.containsToday"
                class="week-today-pill"
              >{{ t('quit.today') }}</span>
            </div>
            <div class="week-meta">
              {{ t('quit.week_summary', {
                first: week.days[0].target,
                last: week.days[week.days.length - 1].target
              }) }}
            </div>
          </button>

          <div v-if="openWeeks[week.index]" class="plan-list">
            <div
              v-for="d in week.days"
              :key="d.date"
              class="plan-row"
              :class="{ today: d.when === 'today' }"
            >
              <div class="plan-day-num">{{ t('quit.day_short', { n: d.dayIndex + 1 }) }}</div>
              <div class="plan-date">{{ shortDate(d.date) }}</div>
              <div class="plan-target">
                {{ t('quit.target_short', { n: d.target }) }}
              </div>
              <div class="plan-actual">
                <span v-if="d.when === 'future'" class="plan-future">—</span>
                <span
                  v-else
                  :class="{
                    'plan-on': d.status === 'on-track',
                    'plan-off': d.status === 'over',
                  }"
                >
                  {{ formatNumber(d.actual) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style="height: 2rem" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  INTENSITY_DURATIONS,
  generateTargets,
  ALL_INTENSITIES,
  type QuitSuggestion,
} from '../composables/useQuitPlan'
import { useI18n, intlLocale, tArray, formatNumber } from '../i18n'
import { useConfirm } from '../composables/useConfirm'
import { useActiveMode } from '../composables/useActiveMode'
import type {
  QuitDay,
  QuitIntensity,
  QuitPlan,
  QuitProgress,
} from '../types'
import StatsCard from './StatsCard.vue'

interface Props {
  plan: QuitPlan | null
  isActive: boolean
  isComplete: boolean
  todayTarget: number | null
  todayActual: number
  todayStatus: 'on-track' | 'over' | null
  planDays: QuitDay[]
  progress: QuitProgress | null
  suggestedBaseline: number
  suggestion: QuitSuggestion
  smokeFreeDays: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  start: [{ intensity: QuitIntensity; baseline: number }]
  abandon: []
}>()

const { t } = useI18n()
const activeMode = useActiveMode()

// QuitView reads the active mode to swap cigarette/vape copy. New
// plans inherit the active mode at creation time (App.vue passes it
// into startQuitPlan), so the setup screen reflects whatever the
// user currently picked on Home.
const isVape = computed(() => activeMode.mode.value === 'vape')
const quitIntroText = computed(() =>
  isVape.value ? t('quit.intro_vape') : t('quit.intro')
)
const baselineHintText = computed(() =>
  isVape.value ? t('quit.baseline_hint_vape') : t('quit.baseline_hint')
)
const smokeFreeOneText = computed(() =>
  isVape.value ? t('quit.smoke_free_days_one_vape') : t('quit.smoke_free_days_one')
)
const smokeFreeManyText = computed(() =>
  isVape.value
    ? t('quit.smoke_free_days_many_vape', { n: props.smokeFreeDays })
    : t('quit.smoke_free_days_many', { n: props.smokeFreeDays })
)

const intensities = ALL_INTENSITIES

// Hidden until the user taps "Customize" on the suggestion card. While
// the plan is still inactive and the suggestion is shown, we hold back
// the manual setup form so the screen has a single primary CTA.
const customizing = ref(false)

const baselineInput = ref(props.suggestedBaseline)

watch(
  () => props.suggestedBaseline,
  (v) => {
    baselineInput.value = v
  }
)

function incBaseline(): void {
  if (baselineInput.value < 60) baselineInput.value++
}

function decBaseline(): void {
  if (baselineInput.value > 1) baselineInput.value--
}

function previewTarget(intensity: QuitIntensity, dayIdx: number): number {
  const targets = generateTargets(
    baselineInput.value,
    INTENSITY_DURATIONS[intensity],
    '2000-01-01'
  )
  const keys = Object.keys(targets).sort()
  return targets[keys[dayIdx]]
}

const actualColor = computed(() => {
  if (props.todayStatus === 'over') return 'var(--red)'
  if (props.todayStatus === 'on-track') return 'var(--green)'
  return 'var(--text)'
})

const progressPct = computed(() => {
  if (!props.todayTarget) return 0
  const safe = Math.max(props.todayTarget, 1)
  return Math.min(100, Math.round((props.todayActual / safe) * 100))
})

const remainingTodayLabel = computed(() => {
  if (props.todayTarget == null) return ''
  const remaining = props.todayTarget - props.todayActual
  if (remaining <= 0) return t('quit.at_limit')
  return t('quit.n_left', { n: remaining })
})

interface PlanWeek {
  index: number
  days: QuitDay[]
  containsToday: boolean
}

const planWeeks = computed<PlanWeek[]>(() => {
  const weeks: PlanWeek[] = []
  for (let i = 0; i < props.planDays.length; i += 7) {
    const days = props.planDays.slice(i, i + 7)
    weeks.push({
      index: weeks.length,
      days,
      containsToday: days.some((d) => d.when === 'today'),
    })
  }
  return weeks
})

const openWeeks = ref<Record<number, boolean>>({})

// Auto-open the week containing today (or the last week if the plan is done)
// once on mount; users can toggle from there.
watch(
  planWeeks,
  (weeks) => {
    if (Object.keys(openWeeks.value).length > 0) return
    const todayWeek = weeks.find((w) => w.containsToday)
    const target = todayWeek ?? weeks[weeks.length - 1]
    if (target) openWeeks.value[target.index] = true
  },
  { immediate: true }
)

function toggleWeek(index: number): void {
  openWeeks.value[index] = !openWeeks.value[index]
}

const incentiveMessage = computed(() => {
  if (!props.plan) return ''
  if (props.isComplete) {
    return (props.progress?.successRate ?? 0) >= 0.7
      ? t('quit.incentives.complete_strong')
      : t('quit.incentives.complete_partial')
  }
  const dayIdx = props.progress?.daysElapsed ?? 0
  const remaining = props.progress?.daysRemaining ?? 0
  const streak = props.progress?.currentStreak ?? 0

  if (dayIdx === 0) return t('quit.incentives.day_1')
  if (remaining === 1) return t('quit.incentives.final_day')
  if (streak >= 14) return t('quit.incentives.streak_14', { n: streak })
  if (streak >= 7) return t('quit.incentives.streak_7', { n: streak })
  if (streak >= 3) return t('quit.incentives.streak_3', { n: streak })

  if (props.todayStatus === 'on-track') {
    const arr = tArray('quit.incentives.on_track')
    return arr.length > 0 ? arr[dayIdx % arr.length] : ''
  }
  if (props.todayStatus === 'over') {
    const arr = tArray('quit.incentives.over')
    return arr.length > 0 ? arr[dayIdx % arr.length] : ''
  }
  return ''
})

const { confirm: confirmDrawer } = useConfirm()

async function confirmAbandon(): Promise<void> {
  if (props.isComplete) {
    emit('abandon')
    return
  }
  const ok = await confirmDrawer({
    title: t('quit.abandon'),
    body: t('quit.abandon_confirm'),
    confirmText: t('quit.abandon'),
    variant: 'danger',
  })
  if (ok) emit('abandon')
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(intlLocale(), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function shortDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(intlLocale(), {
    month: 'short',
    day: 'numeric',
  })
}
</script>

<style scoped>
.section-title {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text);
  margin-bottom: 12px;
}
.intro {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.55;
  margin-bottom: 1.5rem;
}
.suggestion-card {
  background: linear-gradient(135deg, var(--brand-soft), var(--accent-soft));
  border-radius: var(--radius-card);
  padding: 22px 18px;
  margin-bottom: 1.25rem;
  text-align: start;
}
.suggestion-glyph {
  font-size: 24px;
  line-height: 1;
  margin-bottom: 10px;
}
.suggestion-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 6px;
}
.suggestion-body {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.5;
  margin-bottom: 14px;
}
.suggestion-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.baseline-card {
  background: linear-gradient(135deg, var(--brand-soft), var(--accent-soft));
  border-radius: var(--radius-card);
  padding: 22px 16px;
  text-align: center;
}
.baseline-label {
  font-size: 12px;
  color: var(--muted);
  font-weight: 600;
  margin-bottom: 12px;
}
.baseline-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 24px;
}
.round-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1.5px solid var(--faint);
  background: transparent;
  font-family: inherit;
  font-size: 18px;
  font-weight: 500;
  cursor: pointer;
  color: var(--text);
}
.round-btn:active {
  background: var(--bg);
  transform: scale(0.93);
}
.baseline-value {
  font-size: 38px;
  font-weight: 600;
  min-width: 60px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.baseline-hint {
  font-size: 11px;
  color: var(--subtle);
  margin-top: 10px;
}
.intensity-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.intensity-card {
  display: block;
  width: 100%;
  text-align: start;
  background: var(--card);
  border: 1.5px solid var(--hairline);
  border-radius: var(--radius-card);
  padding: 16px 18px;
  font-family: inherit;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: border-color 0.15s, transform 0.1s, box-shadow 0.15s;
}
.intensity-card:hover {
  border-color: color-mix(in srgb, var(--brand) 30%, transparent);
  box-shadow: var(--shadow-md);
}
.intensity-card:active {
  transform: scale(0.99);
}
.intensity-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
.intensity-blurb {
  font-size: 12px;
  color: var(--muted);
  margin-top: 4px;
  line-height: 1.4;
}
.intensity-preview {
  font-size: 11px;
  color: var(--subtle);
  margin-top: 8px;
  font-variant-numeric: tabular-nums;
}
.muted-line {
  font-size: 11px;
  color: var(--subtle);
  margin-top: 12px;
  text-align: center;
}

/* Active plan */
.plan-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  gap: 12px;
}
.plan-sub {
  font-size: 12px;
  color: var(--subtle);
}
.abandon-btn {
  padding: 6px 12px;
  border: 1.5px solid var(--faint);
  border-radius: 8px;
  background: transparent;
  font-family: inherit;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  color: var(--muted);
  flex-shrink: 0;
}
.today-card {
  background: linear-gradient(135deg, var(--brand-soft), var(--accent-soft));
  border-radius: var(--radius-card);
  padding: 24px 20px 20px;
  margin-bottom: 1.25rem;
}
.today-target-row {
  display: flex;
  justify-content: center;
  align-items: baseline;
  gap: 8px;
  font-variant-numeric: tabular-nums;
}
.today-actual {
  font-size: 56px;
  font-weight: 600;
  line-height: 1;
  transition: color 0.3s;
}
.today-divider {
  font-size: 30px;
  color: var(--subtle);
}
.today-target {
  font-size: 30px;
  font-weight: 500;
  color: var(--muted);
}
.today-meta {
  text-align: center;
  margin-top: 8px;
  font-size: 12px;
}
.status-ok {
  color: var(--green);
}
.status-over {
  color: var(--red);
}
.today-bar-track {
  height: 6px;
  background: var(--bar-empty);
  border-radius: 3px;
  margin-top: 14px;
  overflow: hidden;
}
.today-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease, background 0.3s;
}
.incentive {
  margin-top: 14px;
  padding: 10px 12px;
  background: var(--bg);
  border-radius: 8px;
  font-size: 12px;
  color: var(--text);
  line-height: 1.5;
  text-align: center;
}
.complete-card {
  text-align: center;
  padding: 28px 18px;
}
.smoke-free-hero {
  padding: 12px 0 6px;
}
.smoke-free-number {
  font-size: 64px;
  font-weight: 600;
  line-height: 1;
  color: var(--green);
  font-variant-numeric: tabular-nums;
}
.smoke-free-label {
  font-size: 13px;
  color: var(--text);
  margin-top: 6px;
  font-weight: 500;
}
.smoke-free-sub {
  font-size: 11px;
  color: var(--subtle);
  margin-top: 2px;
}
.complete-headline {
  font-size: 18px;
  font-weight: 600;
}
.complete-sub {
  font-size: 13px;
  color: var(--muted);
  margin-top: 6px;
}
/* Progress grid — 2 cols narrow, 4 cols with room. Tile styling
   comes from <StatsCard>. */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
@media (min-width: 520px) {
  .stat-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
/* Suffix inside a StatsCard value slot (e.g. "14 / 30"). */
.stat-grid :deep(.stat-value-suffix) {
  font-size: 18px;
  font-weight: 600;
  color: var(--muted);
  letter-spacing: 0;
  margin-inline-start: 4px;
}

/* Week-by-week plan list */
.week-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.week-group {
  border-bottom: 1px solid var(--border);
}
.week-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 12px 4px;
  border: none;
  background: transparent;
  font-family: inherit;
  cursor: pointer;
  text-align: start;
}
.week-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}
.week-today-pill {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: var(--text);
  color: var(--bg);
  padding: 2px 7px;
  border-radius: 10px;
}
.week-meta {
  font-size: 11px;
  color: var(--subtle);
  font-variant-numeric: tabular-nums;
}
.caret {
  color: var(--subtle);
  font-size: 16px;
  transition: transform 0.2s;
  display: inline-block;
}
.caret.open {
  transform: rotate(90deg);
}
.plan-list {
  display: flex;
  flex-direction: column;
  padding: 4px 0 10px;
}
.plan-row {
  display: grid;
  grid-template-columns: 38px 1fr 80px 50px;
  align-items: center;
  gap: 8px;
  padding: 9px 4px;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.plan-row.today {
  background: var(--card);
  border-radius: 8px;
  padding: 9px 8px;
  margin: 2px 0;
}
.plan-day-num {
  font-size: 11px;
  color: var(--subtle);
  font-weight: 500;
}
.plan-date {
  color: var(--text);
}
.plan-target {
  font-size: 12px;
  color: var(--muted);
  text-align: end;
}
.plan-actual {
  text-align: end;
  font-weight: 600;
}
.plan-on {
  color: var(--green);
}
.plan-off {
  color: var(--red);
}
.plan-future {
  color: var(--subtle);
}
</style>
