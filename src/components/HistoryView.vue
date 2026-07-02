<template>
  <div class="fade-in history-view">
    <div v-if="days.length === 0" v-reveal class="empty-state" data-onboard="history-empty">
      <div class="empty-icon" aria-hidden="true">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <rect x="8" y="10" width="32" height="30" rx="4"/>
          <path d="M8 18h32"/>
          <path d="M16 6v6M32 6v6"/>
          <path d="M16 26h4M28 26h4M16 32h4M28 32h4"/>
        </svg>
      </div>
      <p class="empty-title">{{ isVape ? t('history.empty_vape') : t('history.empty') }}</p>
      <p class="empty-sub">{{ isVape ? t('history.empty_sub_vape') : t('history.empty_sub') }}</p>
    </div>

    <template v-else>
      <!-- Overview: gap-stat tiles built with the same visual language as
           the home stats grid (tinted card, big number, subtitle) so
           moving between tabs feels coherent. In vape mode these are
           inter-session gaps, which is what the user actually cares
           about — cigarette mode reads them as inter-cigarette gaps. -->
      <div v-reveal class="history-section-head">
        <div>
          <h2 class="h-section" style="margin-bottom: 2px">
            {{ isVape ? t('history.session_report') : t('history.gap_report') }}
          </h2>
          <div class="section-sub">{{
            isVape ? t('history.section_sub_vape') : t('history.section_sub_cig')
          }}</div>
        </div>
        <button class="btn btn-ghost report-cta" @click="emit('open-report')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 14l3-3 3 3 5-5"/></svg>
          {{ t('home.generate_report') }}
        </button>
      </div>

      <div v-reveal class="stat-grid" data-onboard="history-gap">
        <StatsCard
          tint="peach"
          :label="t('history.avg_gap')"
          :value="formatDuration(gapStats.avg)"
        >
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          </template>
          <template #flourish>
            <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="88" cy="46" r="26"/>
              <path d="M88 30 v16 l10 6"/>
            </svg>
          </template>
        </StatsCard>
        <StatsCard
          tint="mint"
          :label="t('history.median_gap')"
          :value="formatDuration(gapStats.median)"
        >
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h4l2-6 4 12 2-6h4"/></svg>
          </template>
          <template #flourish>
            <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 58 L26 58 L34 34 L48 82 L56 46 L72 66 L110 50"/>
            </svg>
          </template>
        </StatsCard>
        <StatsCard
          tint="lavender"
          :label="t('history.longest_gap')"
          :value="formatDuration(gapStats.longest)"
        >
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 8v5l3 2"/><path d="M19 4l2 2"/><path d="M8 3l-3 3"/></svg>
          </template>
          <template #flourish>
            <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M74 20 h28 v10 l-14 20 14 20 v10 h-28 v-10 l14 -20 -14 -20 z"/>
            </svg>
          </template>
        </StatsCard>
        <StatsCard
          tint="sun"
          :label="t('history.shortest_gap')"
          :value="formatDuration(gapStats.shortest)"
        >
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3L4 14h7l-1 7 9-11h-7l1-7z"/></svg>
          </template>
          <template #flourish>
            <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M92 14 L64 60 h20 l-8 46 L104 60 h-20 l8 -46 z"/>
            </svg>
          </template>
        </StatsCard>
      </div>

      <!-- Per-day breakdown. Cigarette mode surfaces "N cigarettes"; vape
           mode surfaces "N puffs / M sessions" so a heavy-vape day with
           few long sessions reads different from a chain-hit day with
           many short ones. -->
      <div v-reveal class="history-section-head history-section-head-tight">
        <h2 class="h-section" style="margin-bottom: 0">
          {{ t('history.daily_breakdown') }}
        </h2>
      </div>

      <div class="day-list" data-onboard="history-list">
        <div
          v-for="(d, i) in days"
          :key="d"
          v-reveal
          class="day-card"
          :class="{ 'is-open': expanded[d] }"
          :style="{ animationDelay: i * 0.03 + 's' }"
        >
          <button
            class="day-header"
            :aria-expanded="!!expanded[d]"
            @click="toggle(d)"
          >
            <div class="day-title">
              <div class="day-label">{{ getDayLabel(d) }}</div>
              <div class="day-date tabular">{{ formatIsoDate(d) }}</div>
            </div>
            <div class="day-primary">
              <div class="day-count tabular" :style="{ color: getColor(byDay[d]) }">
                {{ formatNumber(byDay[d]) }}
              </div>
              <div class="day-count-unit">{{
                isVape ? t('history.unit_puffs') : t('history.unit_cigarettes')
              }}</div>
            </div>
            <span class="caret" :class="{ open: expanded[d] }" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </span>
          </button>

          <div class="day-meta">
            <div class="day-meta-chip">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
              <span>{{ formatTime(dayReports[d].first) }} → {{ formatTime(dayReports[d].last) }}</span>
            </div>
            <div v-if="isVape" class="day-meta-chip">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 21c0-4 4-5 4-9 0-3-2-4-2-7"/><path d="M13 21c0-4 4-5 4-9 0-3-2-4-2-7"/></svg>
              <span class="tabular">{{
                dayReports[d].entries.length === 1
                  ? t('history.sessions_one')
                  : t('history.sessions_many', { n: dayReports[d].entries.length })
              }}</span>
            </div>
            <div v-if="dayReports[d].avgGap != null" class="day-meta-chip">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h4M11 6v12M15 12h4"/></svg>
              <span>{{ t('history.avg_gap_inline', { duration: formatDuration(dayReports[d].avgGap) }) }}</span>
            </div>
          </div>

          <div v-if="expanded[d]" class="entries-list">
            <div
              v-for="e in dayReports[d].entries"
              :key="e.id"
              class="entry-row"
              :class="{ 'entry-row-session': (e.puffCount ?? 1) > 1 }"
            >
              <div class="entry-marker" aria-hidden="true">
                <span class="entry-dot" :style="{ background: getColor(byDay[d]) }"></span>
              </div>
              <div class="entry-body">
                <div class="entry-headline">
                  <div class="entry-time tabular">{{ formatTime(e.time) }}</div>
                  <span
                    v-if="(e.puffCount ?? 1) > 1"
                    class="entry-count-chip tabular"
                    :aria-label="t('history.session_puffs_aria', { n: e.puffCount ?? 1 })"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 21c0-4 4-5 4-9 0-3-2-4-2-7"/></svg>
                    <span>×{{ formatNumber(e.puffCount ?? 1) }} {{ t('history.unit_puffs') }}</span>
                  </span>
                </div>
                <div class="entry-gap tabular">
                  <span v-if="e.gapMs == null" class="gap-muted">
                    {{ t('history.first_ever') }}
                  </span>
                  <template v-else>
                    <span>+{{ formatDuration(e.gapMs) }}</span>
                    <span
                      v-if="(e.sleepMs ?? 0) > 0"
                      class="entry-sleep-tag"
                      :title="t('history.gap_includes_sleep', { duration: formatDuration(e.sleepMs!) })"
                      :aria-label="t('history.gap_includes_sleep', { duration: formatDuration(e.sleepMs!) })"
                    >
                      <span class="entry-sleep-icon" aria-hidden="true">🌙</span>
                      <span>{{ t('history.gap_includes_sleep_short', { duration: formatDuration(e.sleepMs!) }) }}</span>
                    </span>
                  </template>
                </div>
              </div>
              <button
                class="entry-edit-btn"
                :aria-label="t('history.edit_entry_aria')"
                @click="onEditEntry(e.id, e.time)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
            </div>
            <button class="delete-day-btn" @click="onDeleteDay(d)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
              {{ t('history.delete_day_btn') }}
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- Edit-entry picker. Day is locked to the original entry's date
         and time can't drift past "now" — both constraints are enforced
         inside the picker and on save. -->
    <DateTimePicker
      v-model:open="editorOpen"
      :model-value="editValue"
      :lock-date="true"
      :max-date="editorMax"
      @update:model-value="onEntryEdited"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  getDayLabel,
  getColor,
  formatDuration,
  formatTime,
} from '../composables/useStats'
import { useI18n, intlLocale, formatNumber } from '../i18n'
import { useConfirm } from '../composables/useConfirm'
import type { DayReport, EntryType, GapStats } from '../types'
import DateTimePicker from './DateTimePicker.vue'
import StatsCard from './StatsCard.vue'

const { t } = useI18n()

interface Props {
  activeMode: EntryType
  days: string[]
  byDay: Record<string, number>
  gapStats: GapStats
  dayReports: Record<string, DayReport>
}

const props = defineProps<Props>()

const isVape = computed(() => props.activeMode === 'vape')

const emit = defineEmits<{
  'open-report': []
  'delete-day': [date: string]
  'edit-entry': [payload: { id: string; iso: string }]
}>()

// Most-recent day expanded by default. The `days` array is sorted
// descending in useStats, so days[0] is the latest day with entries.
// We only auto-open on the first time a day key appears so the user's
// manual collapses stick across re-renders.
const expanded = ref<Record<string, boolean>>({})
const autoOpened = ref<string | null>(null)
watch(
  () => props.days,
  (days) => {
    const top = days[0]
    if (top && autoOpened.value !== top) {
      expanded.value[top] = true
      autoOpened.value = top
    }
  },
  { immediate: true }
)

function toggle(d: string): void {
  expanded.value[d] = !expanded.value[d]
}

// Render an internal YYYY-MM-DD bucket key in the active locale so
// Arabic users see Arabic-Indic numerals and a localized format
// instead of the raw ISO string.
function formatIsoDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString(intlLocale(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

const { confirm } = useConfirm()

async function onDeleteDay(d: string): Promise<void> {
  const count = props.byDay[d] ?? 0
  const ok = await confirm({
    title: t('history.delete_day_btn'),
    body: t('history.delete_day_confirm', { count, date: d }),
    confirmText: t('confirm.delete'),
    variant: 'danger',
  })
  if (!ok) return
  emit('delete-day', d)
}

// Edit-entry state. The DateTimePicker takes a Date and emits the
// chosen Date when the user saves.
const editingId = ref<string | null>(null)
const editValue = ref<Date | null>(null)
const editorOpen = ref(false)
// Snapshotted at the moment the editor opens so the upper bound
// doesn't drift while the sheet is on screen. If the user edits an
// entry from a past day, the original time is in the past anyway, so
// the bound only really binds when editing today's entry.
const editorMax = ref<Date | null>(null)

function onEditEntry(id: string, currentIso: string): void {
  editingId.value = id
  editValue.value = new Date(currentIso)
  editorMax.value = new Date()
  editorOpen.value = true
}

function onEntryEdited(picked: Date | null): void {
  if (editingId.value && picked) {
    emit('edit-entry', { id: editingId.value, iso: picked.toISOString() })
  }
  editingId.value = null
  editValue.value = null
  editorMax.value = null
  editorOpen.value = false
}

</script>

<style scoped>
.history-view {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* Empty state — the first thing a fresh user sees on this tab, so it
   gets a spacious card with a friendly icon and mode-aware copy. */
.empty-state {
  text-align: center;
  padding: 44px 22px;
  background: var(--card);
  border-radius: 22px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--hairline);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.empty-icon {
  width: 60px;
  height: 60px;
  border-radius: 18px;
  background: var(--tint-peach-bg);
  color: var(--tint-peach-fg);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
}
.empty-icon svg {
  width: 32px;
  height: 32px;
}
.empty-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  margin: 0;
}
.empty-sub {
  font-size: 12px;
  color: var(--muted);
  margin: 0;
  max-width: 260px;
}

/* Section head — page-scope title with an optional CTA on the right.
   The tight variant is used for follow-on sections that don't need
   the descriptive subtitle. */
.history-section-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
  margin-top: 4px;
}
.history-section-head-tight {
  margin-top: 8px;
}
.section-sub {
  font-size: 11px;
  color: var(--muted);
  font-weight: 500;
  letter-spacing: 0.01em;
}
.report-cta {
  font-size: 12px;
  padding: 8px 12px;
  flex-shrink: 0;
}

/* Overview grid — 2 columns, matches the home insight grid gap. Tile
   styling lives in <StatsCard>. */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

/* Day list — one card per day with entries a click away. Rounded,
   soft shadow, no more coloured left-border strip (the count colour
   now carries the "how bad was today" signal). */
.day-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.day-card {
  padding: 16px 18px;
  background: var(--card);
  border: 1px solid var(--hairline);
  border-radius: 20px;
  box-shadow: var(--shadow-sm);
  animation: slideUp 0.3s ease-out both;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}
.day-card.is-open {
  box-shadow: var(--shadow-md);
  border-color: color-mix(in srgb, var(--brand) 12%, var(--hairline));
}
.day-header {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 14px;
  cursor: pointer;
  width: 100%;
  background: transparent;
  border: none;
  padding: 0;
  font-family: inherit;
  text-align: start;
  color: var(--text);
}
.day-title {
  min-width: 0;
}
.day-label {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.2;
}
.day-date {
  font-size: 11px;
  color: var(--subtle);
  margin-top: 2px;
  font-weight: 500;
}
.day-primary {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  line-height: 1;
}
.day-count {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1;
}
.day-count-unit {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}
.caret {
  color: var(--subtle);
  display: flex;
  align-items: center;
  transition: transform 0.2s;
}
.caret.open {
  transform: rotate(180deg);
  color: var(--text);
}

/* Meta row — small chips showing first/last time, session count (vape
   only), and average gap. Each chip has a tiny icon so the row scans
   at a glance without reading. */
.day-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}
.day-meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  background: var(--surface-tint);
  padding: 4px 9px;
  border-radius: 999px;
  line-height: 1.2;
}
.day-meta-chip svg {
  opacity: 0.85;
  flex-shrink: 0;
}

/* Expanded entries list. Vertical timeline vibe: each row has a small
   dot on the left and the time/gap laid out cleanly. Vape sessions
   are visually distinct via the "×N puffs" chip. */
.entries-list {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px dashed var(--hairline);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.entry-row {
  display: grid;
  grid-template-columns: 20px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  font-size: 13px;
  border-bottom: 1px solid var(--hairline);
}
.entry-row:last-of-type {
  border-bottom: none;
}
.entry-marker {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
.entry-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--brand);
  box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 12%, transparent);
}
.entry-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.entry-headline {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.entry-time {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  line-height: 1;
}
.entry-gap {
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 11px;
}
.gap-muted {
  color: var(--subtle);
  font-style: italic;
}

/* Sleep tag on gap — indicates the gap absorbed a bedtime window. */
.entry-sleep-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent);
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
}
.entry-sleep-icon {
  font-size: 11px;
  line-height: 1;
}

/* Vape session chip on multi-puff entries. Uses the mint tint token
   to echo the "session was a big one" signal from the home stats. */
.entry-count-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--tint-mint-fg);
  background: var(--tint-mint-bg);
  border: 1px solid color-mix(in srgb, var(--tint-mint-fg) 24%, transparent);
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
  line-height: 1.4;
}
.entry-count-chip svg {
  color: var(--tint-mint-fg);
}
.entry-row-session .entry-dot {
  background: var(--tint-mint-fg);
}

.entry-edit-btn {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--subtle);
  cursor: pointer;
  padding: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  transition: background 0.15s ease, color 0.15s ease;
}
.entry-edit-btn:hover {
  background: var(--surface-tint);
  color: var(--text);
}
.entry-edit-btn:active {
  background: var(--surface-tint);
  color: var(--text);
  transform: scale(0.94);
}

.delete-day-btn {
  margin-top: 12px;
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--danger) 22%, transparent);
  border-radius: 12px;
  background: transparent;
  color: var(--danger);
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: background 0.15s ease;
}
.delete-day-btn:hover {
  background: color-mix(in srgb, var(--danger) 8%, transparent);
}
.delete-day-btn:active {
  background: var(--danger-soft);
  transform: scale(0.99);
}
</style>
