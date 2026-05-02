<template>
  <div class="fade-in">
    <!-- Setup screen: no plan yet -->
    <template v-if="!isActive">
      <div class="section-title">Quit plan</div>
      <div class="intro">
        Build a personalized taper from your logs. Each day gets a target
        cigarette count that steps down to zero on your quit day.
      </div>

      <div class="baseline-card">
        <div class="baseline-label">Suggested starting point</div>
        <div class="baseline-row">
          <button class="round-btn" @click="decBaseline">−</button>
          <div class="baseline-value">{{ baselineInput }}</div>
          <button class="round-btn" @click="incBaseline">+</button>
        </div>
        <div class="baseline-hint">
          cigarettes per day, based on your recent average
        </div>
      </div>

      <div class="section-title" style="margin-top: 1.75rem">
        Pick your pace
      </div>
      <div class="intensity-list">
        <button
          v-for="intensity in intensities"
          :key="intensity"
          class="intensity-card"
          @click="emit('start', { intensity, baseline: baselineInput })"
        >
          <div class="intensity-label">{{ INTENSITY_LABELS[intensity] }}</div>
          <div class="intensity-blurb">{{ INTENSITY_BLURBS[intensity] }}</div>
          <div class="intensity-preview">
            Day 1: {{ previewTarget(intensity, 0) }} →
            Day {{ INTENSITY_DURATIONS[intensity] }}: 0
          </div>
        </button>
      </div>

      <div v-if="suggestedBaseline < 3" class="muted-line">
        Tip: log a few more days first so the plan can match your real pattern.
      </div>
    </template>

    <!-- Active or completed plan -->
    <template v-else-if="plan">
      <div class="plan-header">
        <div>
          <div class="section-title" style="margin-bottom: 4px">
            {{ isComplete ? 'Plan complete' : 'Today' }}
          </div>
          <div class="plan-sub">
            {{ INTENSITY_LABELS[plan.intensity] }} · started
            {{ formatDate(plan.startDate) }}
          </div>
        </div>
        <button class="abandon-btn" @click="confirmAbandon">
          {{ isComplete ? 'Close plan' : 'Abandon' }}
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
            On track — {{ remainingTodayLabel }}
          </span>
          <span v-else-if="todayStatus === 'over'" class="status-over">
            Over by {{ todayActual - todayTarget }} — try to hold here
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
      </div>

      <div v-else-if="isComplete" class="today-card complete-card">
        <div class="complete-headline">
          {{ progress?.successRate ?? 0 >= 0.7 ? 'Strong finish.' : 'Plan finished.' }}
        </div>
        <div class="complete-sub">
          {{ progress?.daysOnTrack ?? 0 }} of {{ plan.durationDays }} days on
          target.
        </div>
      </div>

      <!-- Progress stats -->
      <div v-if="progress" class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Day</div>
          <div class="stat-value">
            {{ Math.min(progress.daysElapsed + 1, plan.durationDays) }} /
            {{ plan.durationDays }}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Streak</div>
          <div class="stat-value">{{ progress.currentStreak }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">On track</div>
          <div class="stat-value">{{ progress.daysOnTrack }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Over</div>
          <div class="stat-value">{{ progress.daysOver }}</div>
        </div>
      </div>

      <!-- Plan timeline -->
      <div class="section-title" style="margin-top: 1.5rem">Plan</div>
      <div class="plan-list">
        <div
          v-for="d in planDays"
          :key="d.date"
          class="plan-row"
          :class="{ today: d.when === 'today' }"
        >
          <div class="plan-day-num">D{{ d.dayIndex + 1 }}</div>
          <div class="plan-date">{{ shortDate(d.date) }}</div>
          <div class="plan-target">target {{ d.target }}</div>
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

      <div style="height: 2rem" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  INTENSITY_DURATIONS,
  INTENSITY_LABELS,
  INTENSITY_BLURBS,
  generateTargets,
} from '../composables/useQuitPlan'
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
}

const props = defineProps<Props>()

const emit = defineEmits<{
  start: [{ intensity: QuitIntensity; baseline: number }]
  abandon: []
}>()

const intensities: QuitIntensity[] = [
  'quick',
  'standard',
  'gradual',
  'extended',
]

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
  if (remaining <= 0) return 'at limit'
  return `${remaining} left`
})

function confirmAbandon(): void {
  if (props.isComplete) {
    emit('abandon')
    return
  }
  if (
    confirm(
      'Abandon this quit plan? Your logs will stay, but the plan and targets will be removed.'
    )
  ) {
    emit('abandon')
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function shortDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}
</script>

<style scoped>
.section-title {
  font-size: 11px;
  font-weight: 500;
  color: var(--muted);
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.intro {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.55;
  margin-bottom: 1.5rem;
}
.baseline-card {
  background: var(--card);
  border-radius: 12px;
  padding: 18px 16px;
  text-align: center;
}
.baseline-label {
  font-size: 11px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
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
  text-align: left;
  background: var(--card);
  border: 1.5px solid transparent;
  border-radius: 12px;
  padding: 14px 16px;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.1s;
}
.intensity-card:active {
  transform: scale(0.99);
  border-color: var(--faint);
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
}
.today-card {
  background: var(--card);
  border-radius: 14px;
  padding: 22px 18px 18px;
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
.complete-card {
  text-align: center;
  padding: 28px 18px;
}
.complete-headline {
  font-size: 22px;
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
.plan-list {
  display: flex;
  flex-direction: column;
}
.plan-row {
  display: grid;
  grid-template-columns: 38px 1fr 80px 50px;
  align-items: center;
  gap: 8px;
  padding: 10px 4px;
  font-size: 13px;
  border-bottom: 1px solid var(--border);
  font-variant-numeric: tabular-nums;
}
.plan-row.today {
  background: var(--card);
  border-radius: 8px;
  padding: 10px 8px;
  border-bottom-color: transparent;
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
  text-align: right;
}
.plan-actual {
  text-align: right;
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
