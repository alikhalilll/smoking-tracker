<template>
  <div class="fade-in">
    <!-- Setup screen: no plan yet -->
    <template v-if="!isActive">
      <div class="section-title">{{ t('quit.title') }}</div>
      <div class="intro">{{ t('quit.intro') }}</div>

      <div class="baseline-card">
        <div class="baseline-label">{{ t('quit.suggested_baseline') }}</div>
        <div class="baseline-row">
          <button class="round-btn" @click="decBaseline">−</button>
          <div class="baseline-value">{{ baselineInput }}</div>
          <button class="round-btn" @click="incBaseline">+</button>
        </div>
        <div class="baseline-hint">{{ t('quit.baseline_hint') }}</div>
      </div>

      <div class="section-title" style="margin-top: 1.75rem">
        {{ t('quit.pick_pace') }}
      </div>
      <div class="intensity-list">
        <button
          v-for="intensity in intensities"
          :key="intensity"
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

      <div v-if="suggestedBaseline < 3" class="muted-line">
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
      <div v-if="!isComplete && todayTarget != null" class="today-card">
        <div class="today-target-row">
          <div class="today-actual" :style="{ color: actualColor }">
            {{ todayActual }}
          </div>
          <div class="today-divider">/</div>
          <div class="today-target">{{ todayTarget }}</div>
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

      <div v-else-if="isComplete" class="today-card complete-card">
        <div class="smoke-free-hero">
          <div class="smoke-free-number">{{ smokeFreeDays }}</div>
          <div class="smoke-free-label">
            {{
              smokeFreeDays === 1
                ? t('quit.smoke_free_days_one')
                : t('quit.smoke_free_days_many', { n: smokeFreeDays })
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

      <!-- Progress stats -->
      <div v-if="progress" class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">{{ t('quit.day') }}</div>
          <div class="stat-value">
            {{ Math.min(progress.daysElapsed + 1, plan.durationDays) }} /
            {{ plan.durationDays }}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">{{ t('quit.streak') }}</div>
          <div class="stat-value">{{ progress.currentStreak }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">{{ t('quit.on_track_count') }}</div>
          <div class="stat-value">{{ progress.daysOnTrack }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">{{ t('quit.over_count') }}</div>
          <div class="stat-value">{{ progress.daysOver }}</div>
        </div>
      </div>

      <!-- Plan timeline grouped by week -->
      <div class="section-title" style="margin-top: 1.5rem">
        {{ t('quit.plan_label') }}
      </div>
      <div class="week-list">
        <div v-for="week in planWeeks" :key="week.index" class="week-group">
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
              <div class="plan-day-num">D{{ d.dayIndex + 1 }}</div>
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
                  {{ d.actual }}
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
} from '../composables/useQuitPlan'
import { useI18n, intlLocale, tArray } from '../i18n'
import type {
  QuitDay,
  QuitIntensity,
  QuitPlan,
  QuitProgress,
} from '../types'

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
  smokeFreeDays: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  start: [{ intensity: QuitIntensity; baseline: number }]
  abandon: []
}>()

const { t } = useI18n()

const intensities = ALL_INTENSITIES

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

function confirmAbandon(): void {
  if (props.isComplete) {
    emit('abandon')
    return
  }
  if (confirm(t('quit.abandon_confirm'))) {
    emit('abandon')
  }
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
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.stat-card {
  background: var(--card);
  border-radius: 10px;
  padding: 10px 8px;
  text-align: center;
}
.stat-label {
  font-size: 10px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.stat-value {
  font-size: 18px;
  font-weight: 600;
  margin-top: 2px;
  font-variant-numeric: tabular-nums;
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
