<template>
  <div class="pod-hero">
    <button
      type="button"
      class="ring-wrap"
      :class="[
        `kind-${kind}`,
        { 'is-overflow': overflow, 'is-empty': !hasActive },
      ]"
      :aria-label="startNewLabel"
      @click="emit('start-new')"
    >
      <svg class="ring" viewBox="0 0 120 120">
        <defs>
          <linearGradient :id="gradId" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" :stop-color="palette.from" />
            <stop offset="100%" :stop-color="palette.to" />
          </linearGradient>
          <linearGradient :id="gradIdOver" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fb7185" />
            <stop offset="100%" stop-color="#ef4444" />
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
          v-if="hasActive"
          class="ring-fg"
          cx="60"
          cy="60"
          r="52"
          fill="none"
          :stroke="`url(#${overflow ? gradIdOver : gradId})`"
          stroke-width="10"
          stroke-linecap="round"
          transform="rotate(-90 60 60)"
          :stroke-dasharray="ringCircumference"
          :stroke-dashoffset="ringOffset"
        />
      </svg>
      <div class="ring-content">
        <template v-if="!hasActive">
          <div class="empty-icon" aria-hidden="true">{{ palette.emoji }}</div>
          <div class="empty-body">{{ noneLabel }}</div>
        </template>
        <template v-else-if="overflow">
          <div class="counter-number tabular over">
            {{ formatNumber(Math.abs(puffsRemaining)) }}
          </div>
          <div class="counter-label">{{ overflowShort }}</div>
        </template>
        <template v-else>
          <div class="counter-number tabular">{{ formatNumber(pctLabel) }}%</div>
          <div class="counter-label">{{ leftLabel }}</div>
        </template>
      </div>
    </button>

    <!-- Today summary: puffs + session count. Sits where the stopwatch
         lives on the cigarette hero so the vertical rhythm stays intact. -->
    <div v-if="hasActive" class="today-summary">
      <span class="tabular">{{ formatNumber(todayCount) }}</span>
      <span class="today-label">{{ t('home.puffs_today') }}</span>
      <span v-if="sessionsToday > 0" class="sessions-suffix">
        {{
          sessionsToday === 1
            ? t('home.sessions_today_one')
            : t('home.sessions_today_many', { n: sessionsToday })
        }}
      </span>
    </div>

    <!-- Live "since last session" stopwatch. Ticks every second while
         the component is mounted. The gap resets on every logged puff,
         but consecutive puffs within a session all share a timestamp
         cluster so the clock effectively measures the space between
         sessions (which is what a vape user cares about). -->
    <div v-if="hasActive && stopwatchParts" class="session-stopwatch">
      <div class="stopwatch-time tabular" dir="ltr">
        <template v-if="stopwatchParts.days.length > 0">
          <span
            v-for="(digit, i) in stopwatchParts.days"
            :key="'d' + i"
            class="sw-cell"
          >{{ digit }}</span>
          <span class="sw-unit">{{ t('home.stopwatch_day_unit') }}</span>
        </template>
        <span class="sw-cell">{{ stopwatchParts.hh[0] }}</span>
        <span class="sw-cell">{{ stopwatchParts.hh[1] }}</span>
        <span class="sw-sep">:</span>
        <span class="sw-cell">{{ stopwatchParts.mm[0] }}</span>
        <span class="sw-cell">{{ stopwatchParts.mm[1] }}</span>
        <span class="sw-sep">:</span>
        <span class="sw-cell">{{ stopwatchParts.ss[0] }}</span>
        <span class="sw-cell">{{ stopwatchParts.ss[1] }}</span>
      </div>
      <div class="stopwatch-label">{{ t('home.since_last_puff') }}</div>
    </div>

    <button
      v-if="overflow"
      type="button"
      class="new-chip"
      @click="emit('start-new')"
    >
      {{ startNewLabel }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n, intlLocale, formatNumber } from '../i18n'
import type { ConsumableKind } from '../types'

interface Props {
  kind: ConsumableKind
  pct: number
  puffsRemaining: number
  puffsThisUnit: number
  overflow: boolean
  hasActive: boolean
  todayCount: number
  sessionsToday: number
  /** ISO timestamp of the most recent vape entry. Drives the
   *  "since last session" stopwatch beneath the ring. Sessions are
   *  timestamp-clusters so this is equivalent to "since last session". */
  lastSmokeTime?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'start-new': []
}>()

const { t } = useI18n()

const RING_R = 52
const ringCircumference = 2 * Math.PI * RING_R
const ringOffset = computed(() => {
  const filled = Math.max(0, Math.min(1, props.pct))
  return ringCircumference * (1 - filled)
})

const pctLabel = computed(() => Math.round(props.pct * 100))

// Per-kind visual palette. All are teal-adjacent except overflow so
// vape mode reads as one visual family; only the hue shifts per kind
// so users can eyeball which ring is on screen without reading the
// label.
const PALETTES: Record<
  ConsumableKind,
  { from: string; to: string; emoji: string }
> = {
  pod:        { from: '#22d3c5', to: '#14b8a6', emoji: '💨' },
  coil:       { from: '#fbbf24', to: '#f59e0b', emoji: '🌀' },
  bottle:     { from: '#60a5fa', to: '#3b82f6', emoji: '💧' },
  disposable: { from: '#c084fc', to: '#a855f7', emoji: '🪫' },
}
const palette = computed(() => PALETTES[props.kind])

// Unique SVG gradient IDs per kind so simultaneous mounts (e.g. two
// rings side-by-side later) don't collide on the same #ringGrad ID.
const gradId = computed(() => `consumableRingGrad_${props.kind}`)
const gradIdOver = computed(() => `consumableRingGradOver_${props.kind}`)

// i18n resolves labels per kind. Keys follow `home.consumable_{kind}_*`.
const leftLabel = computed(() =>
  t(`home.consumable_${props.kind}_left`, { n: formatNumber(props.puffsRemaining) })
)
const noneLabel = computed(() => t(`home.consumable_${props.kind}_none`))
const startNewLabel = computed(() => t(`home.consumable_${props.kind}_new_cta`))
const overflowShort = computed(() => t(`home.consumable_${props.kind}_overflow`))

// Live tick for the "since last session" clock. Same 1s cadence as
// the cigarette hero — cheap because only the seconds digit changes
// per tick and the ring stays static.
const now = ref(Date.now())
let nowTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  nowTimer = setInterval(() => (now.value = Date.now()), 1000)
})
onUnmounted(() => {
  if (nowTimer) clearInterval(nowTimer)
})

interface StopwatchParts {
  days: string[]
  hh: [string, string]
  mm: [string, string]
  ss: [string, string]
}

const stopwatchParts = computed<StopwatchParts | null>(() => {
  if (!props.lastSmokeTime) return null
  const elapsed = Math.max(0, now.value - new Date(props.lastSmokeTime).getTime())
  const totalSec = Math.floor(elapsed / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60

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
</script>

<style scoped>
.pod-hero {
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
  appearance: none;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  font-family: inherit;
  color: var(--text);
  transition: transform 0.15s ease;
}
.ring-wrap:active {
  transform: scale(0.985);
}
.ring {
  width: 100%;
  height: 100%;
  display: block;
}
.ring-fg {
  transition: stroke-dashoffset 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.ring-wrap.kind-pod        .ring-fg { filter: drop-shadow(0 0 6px rgba(20, 184, 166, 0.28)); }
.ring-wrap.kind-coil       .ring-fg { filter: drop-shadow(0 0 6px rgba(245, 158, 11, 0.32)); }
.ring-wrap.kind-bottle     .ring-fg { filter: drop-shadow(0 0 6px rgba(59, 130, 246, 0.30)); }
.ring-wrap.kind-disposable .ring-fg { filter: drop-shadow(0 0 6px rgba(168, 85, 247, 0.30)); }
.ring-wrap.is-overflow .ring-fg {
  filter: drop-shadow(0 0 6px rgba(239, 68, 68, 0.35));
}
.ring-content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 24px;
  gap: 4px;
}
.counter-number {
  font-family: inherit;
  font-size: 52px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
  color: var(--text);
}
.counter-number.over { color: var(--danger); }
.counter-label {
  font-size: 12px;
  color: var(--muted);
  font-weight: 500;
  text-align: center;
  margin-top: 4px;
}
.empty-icon {
  font-size: 40px;
  line-height: 1;
  margin-bottom: 4px;
  opacity: 0.75;
}
.empty-body {
  font-size: 13px;
  color: var(--muted);
  font-weight: 600;
  text-align: center;
  line-height: 1.35;
  max-width: 170px;
}
.today-summary {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  font-size: 14px;
  color: var(--muted);
  font-weight: 500;
}
.today-summary .tabular {
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
}
.today-label { color: var(--muted); }
.sessions-suffix { color: var(--subtle); }

.new-chip {
  appearance: none;
  border: none;
  padding: 8px 16px;
  border-radius: 999px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #fb7185, #ef4444);
  box-shadow: 0 4px 14px rgba(239, 68, 68, 0.32);
  cursor: pointer;
  transition: transform 0.1s ease;
}
.new-chip:active { transform: scale(0.97); }

/* Session stopwatch — mirrors the cigarette hero clock but sits under
   the consumable ring instead of replacing it. Kept slightly smaller
   than the cigarette version so the ring stays the visual anchor. */
.session-stopwatch {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  margin-top: 2px;
}
.stopwatch-time {
  font-family: inherit;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--text);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  direction: ltr;
  unicode-bidi: isolate;
}
.sw-cell {
  display: inline-block;
  width: 1ch;
  text-align: center;
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
.stopwatch-label {
  font-size: 10px;
  font-weight: 500;
  color: var(--subtle);
  letter-spacing: 0.02em;
}
</style>
