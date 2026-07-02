<template>
  <div class="pod-hero">
    <button
      type="button"
      class="ring-wrap"
      :class="[
        `kind-${kind}`,
        {
          'is-overflow': overflow,
          'is-empty': !hasActive,
          pulsing: isPulsing,
        },
      ]"
      :aria-label="startNewLabel"
      @click="emit('start-new')"
    >
      <svg class="ring" viewBox="0 0 240 240" aria-hidden="true">
        <defs>
          <linearGradient :id="gradId" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" :stop-color="palette.from" />
            <stop offset="100%" :stop-color="palette.to" />
          </linearGradient>
          <linearGradient :id="gradIdOver" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fb7185" />
            <stop offset="100%" stop-color="#ef4444" />
          </linearGradient>
          <linearGradient :id="haloId" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" :stop-color="palette.from" stop-opacity="0.55" />
            <stop offset="100%" :stop-color="palette.to" stop-opacity="0" />
          </linearGradient>
          <radialGradient :id="innerId" cx="50%" cy="50%" r="55%">
            <stop offset="60%" stop-color="var(--card)" stop-opacity="0" />
            <stop offset="100%" stop-color="rgba(0,0,0,0.06)" />
          </radialGradient>
        </defs>

        <!-- Soft halo. Breathes when a consumable is active; sits still
             (dim) when the ring is empty so the empty state doesn't feel
             fake-alive. -->
        <circle
          v-if="hasActive"
          class="ring-halo"
          cx="120" cy="120" r="116"
          fill="none"
          :stroke="`url(#${haloId})`"
          stroke-width="6"
        />

        <!-- Ticks — 12 short marks like a clock face for texture. -->
        <g class="ring-ticks">
          <line v-for="i in 12" :key="'tk'+i"
            x1="120" :y1="10"
            x2="120" :y2="14"
            stroke="var(--faint)"
            stroke-width="1.5"
            stroke-linecap="round"
            :transform="`rotate(${(i - 1) * 30} 120 120)`"
          />
        </g>

        <circle
          class="ring-bg"
          cx="120"
          cy="120"
          r="102"
          fill="none"
          stroke="var(--surface-tint)"
          stroke-width="16"
        />
        <circle
          v-if="hasActive"
          class="ring-fg"
          cx="120"
          cy="120"
          r="102"
          fill="none"
          :stroke="`url(#${overflow ? gradIdOver : gradId})`"
          stroke-width="16"
          stroke-linecap="round"
          transform="rotate(-90 120 120)"
          :stroke-dasharray="ringCircumference"
          :stroke-dashoffset="ringOffset"
        />

        <!-- Cursor dot at the end of the arc — matches the cigarette
             hero's leading indicator so the two rings feel like a pair. -->
        <g
          v-if="hasActive && !overflow && pct > 0.02"
          :transform="`rotate(${ringAngleDeg - 90} 120 120)`"
        >
          <circle class="ring-cursor" cx="222" cy="120" r="9" :style="`fill: ${palette.to};`" />
        </g>

        <!-- Inner vignette for depth. -->
        <circle cx="120" cy="120" r="94" :fill="`url(#${innerId})`" />
      </svg>
      <div class="ring-content">
        <template v-if="!hasActive">
          <div class="empty-icon" aria-hidden="true">{{ palette.emoji }}</div>
          <div class="empty-body">{{ noneLabel }}</div>
        </template>
        <template v-else-if="overflow">
          <div class="counter-number tabular over">
            <Transition name="num-flip" mode="out-in">
              <span :key="todayCount">{{ formatNumber(todayCount) }}</span>
            </Transition>
          </div>
          <div class="counter-label">{{ t('home.puffs_today') }}</div>
          <div class="counter-target counter-target-danger">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
            <span>{{ startNewLabel }}</span>
          </div>
        </template>
        <template v-else>
          <div class="counter-number tabular">
            <Transition name="num-flip" mode="out-in">
              <span :key="todayCount">{{ formatNumber(todayCount) }}</span>
            </Transition>
          </div>
          <div class="counter-label">{{ t('home.puffs_today') }}</div>
          <div class="counter-target">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 21c0-4 4-5 4-9 0-3-2-4-2-7"/><path d="M13 21c0-4 4-5 4-9 0-3-2-4-2-7"/></svg>
            <span class="tabular">{{ formatNumber(puffsRemaining) }} {{ t('home.consumable_chip_puffs_left') }}</span>
          </div>
        </template>
      </div>
    </button>

    <!-- Sessions today. Puffs count is already in the ring center
         (matching the cigarette hero's "count today" pattern), so this
         row only carries the session count as secondary context. -->
    <div v-if="hasActive && sessionsToday > 0" class="today-summary">
      <span class="today-label">
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
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
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

const RING_R = 102
const ringCircumference = 2 * Math.PI * RING_R
const ringFilled = computed(() => Math.max(0, Math.min(1, props.pct)))
const ringOffset = computed(() => ringCircumference * (1 - ringFilled.value))
const ringAngleDeg = computed(() => ringFilled.value * 360)

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
const haloId = computed(() => `consumableRingHalo_${props.kind}`)
const innerId = computed(() => `consumableRingInner_${props.kind}`)

const noneLabel = computed(() => t(`home.consumable_${props.kind}_none`))
const startNewLabel = computed(() => t(`home.consumable_${props.kind}_new_cta`))

// Self-triggered pulse animation on todayCount increase — matches the
// cigarette hero's log-tap feedback so both rings feel equally alive
// when the user logs. Watched here rather than passed as a prop so the
// parent HomeView doesn't need to plumb `isPulsing` through.
const isPulsing = ref(false)
let pulseTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => props.todayCount,
  (n, prev) => {
    if (n <= prev) return
    if (pulseTimer) clearTimeout(pulseTimer)
    isPulsing.value = true
    pulseTimer = setTimeout(() => {
      isPulsing.value = false
    }, 800)
  }
)

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
  if (pulseTimer) clearTimeout(pulseTimer)
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
  gap: 14px;
  margin: 8px 0;
}
.ring-wrap {
  position: relative;
  width: 260px;
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
.ring-wrap.pulsing {
  animation: ringPop 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
}
@keyframes ringPop {
  0% { transform: scale(1); }
  40% { transform: scale(1.03); }
  100% { transform: scale(1); }
}
.ring {
  width: 100%;
  height: 100%;
  display: block;
  overflow: visible;
}
.ring-halo {
  animation: ringHaloBreathe 4s ease-in-out infinite;
  transform-origin: 120px 120px;
}
@keyframes ringHaloBreathe {
  0%, 100% { transform: scale(1); opacity: 0.9; }
  50% { transform: scale(1.03); opacity: 1; }
}
.ring-ticks { opacity: 0.5; }
.ring-fg {
  transition: stroke-dashoffset 0.8s cubic-bezier(0.2, 0.8, 0.2, 1),
    stroke 0.4s ease;
}
.ring-wrap.kind-pod        .ring-fg { filter: drop-shadow(0 4px 12px rgba(20, 184, 166, 0.32)); }
.ring-wrap.kind-coil       .ring-fg { filter: drop-shadow(0 4px 12px rgba(245, 158, 11, 0.32)); }
.ring-wrap.kind-bottle     .ring-fg { filter: drop-shadow(0 4px 12px rgba(59, 130, 246, 0.30)); }
.ring-wrap.kind-disposable .ring-fg { filter: drop-shadow(0 4px 12px rgba(168, 85, 247, 0.30)); }
.ring-wrap.is-overflow .ring-fg {
  filter: drop-shadow(0 4px 12px rgba(239, 68, 68, 0.35));
}
.ring-cursor {
  stroke: var(--card);
  stroke-width: 3;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.18));
  transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.ring-wrap.pulsing .ring-cursor {
  animation: ringCursorPulse 0.8s ease-out;
}
@keyframes ringCursorPulse {
  0% { r: 9; }
  40% { r: 13; }
  100% { r: 9; }
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
  font-size: 76px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.045em;
  color: var(--text);
  /* Positioning context so the in/out spans of <Transition> stack over
     each other during the cross-fade instead of shifting the layout. */
  position: relative;
  display: inline-block;
  min-width: 1ch;
}
.counter-number > span { display: inline-block; }
.counter-number.over { color: var(--danger); }

/* Counter flip — slide + fade when todayCount changes. Mirrors the
   cigarette hero's num-flip so both rings feel the same on log tap. */
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
@media (prefers-reduced-motion: reduce) {
  .num-flip-enter-active,
  .num-flip-leave-active {
    transition: none;
  }
  .num-flip-enter-from,
  .num-flip-leave-to {
    opacity: 1;
    transform: none;
  }
  .ring-wrap.pulsing,
  .ring-halo,
  .ring-wrap.pulsing .ring-cursor {
    animation: none;
  }
}
.counter-label {
  font-size: 11px;
  color: var(--muted);
  font-weight: 700;
  text-align: center;
  margin-top: 4px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.counter-target {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 8px;
  padding: 4px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--card) 70%, transparent);
  border: 1px solid color-mix(in srgb, currentColor 24%, transparent);
  color: v-bind('palette.from');
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  white-space: nowrap;
  animation: chipFadeIn 0.3s ease-out both;
}
.counter-target-danger {
  color: var(--danger);
  border-color: color-mix(in srgb, var(--danger) 28%, transparent);
  background: color-mix(in srgb, var(--danger) 10%, var(--card));
}
@keyframes chipFadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
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
