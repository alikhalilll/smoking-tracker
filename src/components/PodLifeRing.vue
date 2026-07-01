<template>
  <div class="pod-hero">
    <button
      type="button"
      class="ring-wrap"
      :class="{
        'is-overflow': overflow,
        'is-empty': !hasPod,
      }"
      :aria-label="t('home.pod_new_cta')"
      @click="emit('start-new-pod')"
    >
      <svg class="ring" viewBox="0 0 120 120">
        <defs>
          <linearGradient id="podRingGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#22d3c5" />
            <stop offset="100%" stop-color="#14b8a6" />
          </linearGradient>
          <linearGradient id="podRingGradOver" x1="0" y1="0" x2="1" y2="1">
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
          v-if="hasPod"
          class="ring-fg"
          cx="60"
          cy="60"
          r="52"
          fill="none"
          :stroke="overflow ? 'url(#podRingGradOver)' : 'url(#podRingGrad)'"
          stroke-width="10"
          stroke-linecap="round"
          transform="rotate(-90 60 60)"
          :stroke-dasharray="ringCircumference"
          :stroke-dashoffset="ringOffset"
        />
      </svg>
      <div class="ring-content">
        <template v-if="!hasPod">
          <div class="empty-icon" aria-hidden="true">💨</div>
          <div class="empty-body">{{ t('home.pod_life_no_pod') }}</div>
        </template>
        <template v-else-if="overflow">
          <div class="counter-number tabular over">
            {{ formatNumber(Math.abs(puffsRemaining)) }}
          </div>
          <div class="counter-label">{{ t('home.pod_life_overflow', { n: '' }).replace(/\s+$/, '') }}</div>
        </template>
        <template v-else>
          <div class="counter-number tabular">{{ formatNumber(pctLabel) }}%</div>
          <div class="counter-label">
            {{ t('home.pod_life_puffs_left', { n: formatNumber(puffsRemaining) }) }}
          </div>
        </template>
      </div>
    </button>

    <!-- Today summary: puffs + session count. Sits where the stopwatch
         lives on the cigarette hero so the vertical rhythm stays intact. -->
    <div v-if="hasPod" class="today-summary">
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

    <!-- Overflow banner CTA — makes the "start new pod" action legible
         when the ring's red state alone might be missed. -->
    <button
      v-if="overflow"
      type="button"
      class="new-pod-chip"
      @click="emit('start-new-pod')"
    >
      {{ t('home.pod_new_cta') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n, formatNumber } from '../i18n'

interface Props {
  pct: number
  puffsRemaining: number
  puffsThisPod: number
  overflow: boolean
  hasPod: boolean
  todayCount: number
  sessionsToday: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'start-new-pod': []
}>()

const { t } = useI18n()

const RING_R = 52
const ringCircumference = 2 * Math.PI * RING_R
const ringOffset = computed(() => {
  const filled = Math.max(0, Math.min(1, props.pct))
  return ringCircumference * (1 - filled)
})

const pctLabel = computed(() => Math.round(props.pct * 100))
</script>

<style scoped>
.pod-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin: 6px 0;
}
/* Ring wrap doubles as the "start new pod" button. Native button styles
   are reset so the SVG and center label can drive the visual. */
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
.ring-wrap.is-empty {
  cursor: pointer;
}
.ring {
  width: 100%;
  height: 100%;
  display: block;
}
.ring-fg {
  transition: stroke-dashoffset 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
  filter: drop-shadow(0 0 6px rgba(20, 184, 166, 0.28));
}
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
.counter-number.over {
  color: var(--danger);
}
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
  max-width: 160px;
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
.today-label {
  color: var(--muted);
}
.sessions-suffix {
  color: var(--subtle);
}

.new-pod-chip {
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
.new-pod-chip:active {
  transform: scale(0.97);
}
</style>
