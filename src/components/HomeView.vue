<template>
  <div class="fade-in">
    <!-- Big counter -->
    <div class="counter-display" :class="{ pulsing: isPulsing }">
      <div class="counter-number" :style="{ color: countColor }">
        {{ todayCount }}
      </div>
      <div class="counter-label">cigarettes today</div>
    </div>

    <!-- Last smoke -->
    <div v-if="lastSmokeText" class="last-smoke">
      last one {{ lastSmokeText }}
    </div>

    <!-- Counter selector -->
    <div class="log-controls">
      <button class="round-btn" @click="decrement">−</button>
      <div class="log-count">{{ logCount }}</div>
      <button class="round-btn" @click="increment">+</button>
    </div>

    <!-- Log button -->
    <button
      class="log-btn"
      @pointerdown="onPointerDown"
      @pointerup="onPointerUp"
      @pointerleave="onPointerUp"
      @click="handleLog"
    >
      Log {{ logCount }} cigarette{{ logCount > 1 ? 's' : '' }}
    </button>

    <!-- Undo -->
    <div v-if="hasEntries" class="undo-wrap">
      <button class="undo-btn" @click="$emit('undo')">Undo last</button>
    </div>

    <!-- 7-day chart -->
    <div class="chart-section">
      <div class="section-title">Last 7 days</div>
      <div class="bar-chart">
        <div v-for="(d, i) in last7" :key="i" class="bar-col">
          <div class="bar-value" :style="{ color: d.count > 0 ? 'var(--text)' : 'var(--subtle)' }">
            {{ d.count || '·' }}
          </div>
          <div
            class="bar"
            :style="{
              height: barHeight(d.count) + 'px',
              background: d.count === 0 ? 'var(--bar-empty)' : isToday(d.date) ? 'var(--bar-today)' : 'var(--bar-default)',
            }"
          />
          <div class="bar-label" :style="{ fontWeight: isToday(d.date) ? 600 : 400, color: isToday(d.date) ? 'var(--text)' : 'var(--subtle)' }">
            {{ dayAbbr(d.date) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Daily avg</div>
        <div class="stat-value">{{ dailyAvg }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total logged</div>
        <div class="stat-value">{{ totalSmoked }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Days tracked</div>
        <div class="stat-value">{{ totalDays }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Best day</div>
        <div class="stat-value">{{ bestDay }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { getColor } from '../composables/useStats'

const props = defineProps({
  todayCount: Number,
  lastSmokeText: String,
  last7: Array,
  maxLast7: Number,
  dailyAvg: Number,
  totalSmoked: Number,
  totalDays: Number,
  bestDay: Number,
  hasEntries: Boolean,
})

const emit = defineEmits(['log', 'undo'])

const logCount = ref(1)
const isPulsing = ref(false)
const btnEl = ref(null)

const countColor = computed(() => getColor(props.todayCount))

function increment() {
  if (logCount.value < 10) logCount.value++
}

function decrement() {
  if (logCount.value > 1) logCount.value--
}

function handleLog() {
  emit('log', logCount.value)
  isPulsing.value = true
  setTimeout(() => (isPulsing.value = false), 500)
  logCount.value = 1
}

function barHeight(count) {
  if (count === 0) return 4
  return Math.max(14, (count / props.maxLast7) * 95)
}

function isToday(dateStr) {
  return dateStr === new Date().toISOString().split('T')[0]
}

function dayAbbr(dateStr) {
  return new Date(dateStr + 'T00:00:00')
    .toLocaleDateString('en-US', { weekday: 'short' })
    .slice(0, 2)
}

function onPointerDown(e) {
  e.currentTarget.style.transform = 'scale(0.97)'
}
function onPointerUp(e) {
  e.currentTarget.style.transform = 'scale(1)'
}
</script>

<style scoped>
.counter-display {
  text-align: center;
  padding: 2.5rem 0 1.5rem;
}
.counter-display.pulsing {
  animation: pulse 0.4s ease;
}
.counter-number {
  font-size: 72px;
  font-weight: 600;
  line-height: 1;
  transition: color 0.3s;
}
.counter-label {
  font-size: 13px;
  color: var(--muted);
  margin-top: 8px;
}
.last-smoke {
  text-align: center;
  font-size: 12px;
  color: var(--subtle);
  margin-bottom: 2rem;
}
.log-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin-bottom: 1rem;
}
.round-btn {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 1.5px solid var(--faint);
  background: transparent;
  font-family: inherit;
  font-size: 20px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text);
  transition: all 0.1s;
}
.round-btn:active {
  background: var(--card);
  transform: scale(0.93);
}
.log-count {
  font-size: 26px;
  font-weight: 600;
  min-width: 32px;
  text-align: center;
}
.log-btn {
  width: 100%;
  padding: 18px;
  border: none;
  border-radius: 14px;
  font-family: inherit;
  font-size: 17px;
  font-weight: 600;
  cursor: pointer;
  background: var(--btn-bg);
  color: var(--btn-text);
  transition: transform 0.1s;
}
.undo-wrap {
  text-align: center;
  margin-top: 10px;
}
.undo-btn {
  padding: 6px 16px;
  border: 1.5px solid var(--faint);
  border-radius: 8px;
  background: transparent;
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  color: var(--muted);
}
.chart-section {
  margin-top: 2.5rem;
}
.section-title {
  font-size: 11px;
  font-weight: 500;
  color: var(--muted);
  margin-bottom: 14px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.bar-chart {
  display: flex;
  gap: 6px;
  align-items: flex-end;
  height: 110px;
}
.bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}
.bar-value {
  font-size: 11px;
  font-weight: 500;
}
.bar {
  width: 100%;
  border-radius: 4px;
  transition: height 0.3s ease;
}
.bar-label {
  font-size: 10px;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 1.75rem 0 2rem;
}
.stat-card {
  background: var(--card);
  border-radius: 10px;
  padding: 14px 16px;
}
.stat-label {
  font-size: 11px;
  color: var(--muted);
}
.stat-value {
  font-size: 22px;
  font-weight: 600;
  margin-top: 3px;
}
</style>
