<template>
  <div class="fade-in">
    <div class="section-title">Settings</div>

    <div class="info-card">
      <div class="info-label">Tracking since</div>
      <div class="info-value">{{ startDate }}</div>
    </div>

    <div class="info-card">
      <div class="info-label">Total entries</div>
      <div class="info-value">
        {{ totalSmoked }} cigarettes over {{ totalDays }} day{{
          totalDays > 1 ? 's' : ''
        }}
      </div>
    </div>

    <div class="info-card">
      <div class="info-label">Average per day</div>
      <div class="info-value">{{ dailyAvg }} cigarettes</div>
    </div>

    <!-- Theme picker -->
    <div class="section-title" style="margin-top: 1.75rem">Appearance</div>
    <div class="segmented">
      <button
        v-for="opt in themeOptions"
        :key="opt.value"
        class="segmented-btn"
        :class="{ active: themeMode === opt.value }"
        @click="setTheme(opt.value)"
      >
        {{ opt.label }}
      </button>
    </div>

    <!-- Reset -->
    <button class="reset-btn" @click="handleReset">Reset all data</button>
    <div class="reset-warning">
      This will permanently delete all your tracked data, including any active
      quit plan.
    </div>

    <div class="pwa-info">
      <div class="info-label">Offline mode</div>
      <div class="info-value">
        This app works offline as a PWA. Add it to your home screen for the best
        experience.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTheme, type ThemeMode } from '../composables/useTheme'

interface Props {
  startDate: string
  totalSmoked: number
  totalDays: number
  dailyAvg: number
}

defineProps<Props>()

const emit = defineEmits<{
  reset: []
}>()

const { mode: themeMode, setTheme } = useTheme()

const themeOptions: ReadonlyArray<{ value: ThemeMode; label: string }> = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

function handleReset(): void {
  if (confirm('Delete all tracking data? This cannot be undone.')) {
    emit('reset')
  }
}
</script>

<style scoped>
.section-title {
  font-size: 11px;
  font-weight: 500;
  color: var(--muted);
  margin-bottom: 14px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.info-card {
  background: var(--card);
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 10px;
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
