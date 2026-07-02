<template>
  <div class="fade-in home">
    <!-- Header row: cigarette/vape mode switch on the left, quick-
         action icons (report + share) on the right. Merging the
         actions row into the header cuts a whole scroll page below
         the fold and makes both buttons reachable without scrolling. -->
    <div v-reveal class="home-header">
      <ModeToggle
        data-onboard="home-mode"
        :model-value="activeMode"
        :options="modeOptions"
        :aria-label="t('home.mode_aria')"
        @update:model-value="(m: EntryType) => emit('set-mode', m)"
      />
      <div v-if="hasEntries" class="header-actions" data-onboard="home-actions">
        <button
          type="button"
          class="icon-btn"
          :aria-label="t('home.generate_report')"
          :title="t('home.generate_report')"
          @click="emit('open-report')"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 14l3-3 3 3 5-5"/></svg>
        </button>
        <button
          type="button"
          class="icon-btn"
          :aria-label="t('share.btn')"
          :title="t('share.btn')"
          @click="onShare"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>
        </button>
      </div>
    </div>

    <!-- Status chips: smoke-free streak (after a finished plan) or quit target -->
    <button
      v-if="quitIsComplete && (smokeFreeDays ?? 0) > 0"
      v-reveal
      class="status-chip chip-success"
      data-onboard="home-status"
      @click="emit('open-quit')"
    >
      <span class="status-icon">🌱</span>
      <span class="status-body">
        <span class="status-label">{{
          activeMode === 'vape'
            ? t('quit.smoke_free_chip_vape')
            : t('quit.smoke_free_chip')
        }}</span>
        <span class="status-value tabular">
          {{ formatNumber(smokeFreeDays ?? 0) }}
          {{
            activeMode === 'vape'
              ? (smokeFreeDays === 1
                  ? t('quit.smoke_free_days_one_vape')
                  : t('quit.smoke_free_days_many_vape'))
              : (smokeFreeDays === 1
                  ? t('quit.smoke_free_days_one')
                  : t('quit.smoke_free_days_many'))
          }}
        </span>
      </span>
    </button>
    <button
      v-else-if="quitTodayTarget != null"
      v-reveal
      class="status-chip"
      :class="
        quitTodayStatus === 'on-track'
          ? 'chip-success'
          : quitTodayStatus === 'over'
            ? 'chip-danger'
            : ''
      "
      data-onboard="home-status"
      @click="emit('open-quit')"
    >
      <span class="status-icon">🎯</span>
      <span class="status-body">
        <span class="status-label">{{ t('home.quit_target_today') }}</span>
        <span class="status-value tabular">
          {{ formatNumber(todayCount) }} / {{ formatNumber(quitTodayTarget ?? 0) }}
        </span>
      </span>
    </button>

    <!-- Hero: vape = pod-life ring; cigarette = counter ring + stopwatch.
         Split because the vape user's mental model is "when does my pod
         die?" and a resetting "since last puff" clock is meaningless when
         a session drops 20 puffs in a minute. -->
    <div v-if="activeMode === 'vape'" v-reveal class="hero" data-onboard="home-hero">
      <ConsumableRing
        :kind="heroConsumable ?? 'pod'"
        :pct="podLifePct ?? 1"
        :puffs-remaining="puffsRemaining ?? 0"
        :puffs-this-unit="puffsThisPod ?? 0"
        :overflow="podOverflow ?? false"
        :has-active="hasActivePod ?? false"
        :today-count="todayCount"
        :sessions-today="sessionsToday ?? 0"
        :last-smoke-time="lastSmokeTime"
        @start-new="onStartNewPod"
      />
    </div>
    <div v-else v-reveal class="hero" data-onboard="home-hero">
      <div
        class="ring-wrap"
        :class="[
          { pulsing: isPulsing },
          ringStatus === 'over' ? 'ring-over' : ringStatus === 'warning' ? 'ring-warning' : 'ring-ok',
        ]"
      >
        <Confetti :trigger="confettiTrigger" />
        <svg class="ring" viewBox="0 0 240 240" aria-hidden="true">
          <defs>
            <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="var(--ring-grad-from)" />
              <stop offset="100%" stop-color="var(--ring-grad-to)" />
            </linearGradient>
            <linearGradient id="ringHalo" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="var(--ring-grad-from)" stop-opacity="0.55" />
              <stop offset="100%" stop-color="var(--ring-grad-to)" stop-opacity="0" />
            </linearGradient>
            <radialGradient id="ringInner" cx="50%" cy="50%" r="55%">
              <stop offset="60%" stop-color="var(--card)" stop-opacity="0" />
              <stop offset="100%" stop-color="rgba(0,0,0,0.06)" />
            </radialGradient>
          </defs>

          <!-- Soft outer halo — the pulsing class scales this on log tap. -->
          <circle class="ring-halo" cx="120" cy="120" r="116" fill="none" stroke="url(#ringHalo)" stroke-width="6" />

          <!-- Ticks — 12 short marks around the ring for a subtle
               "clock face" texture. Sits behind the track. -->
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

          <!-- Background track. -->
          <circle
            class="ring-bg"
            cx="120"
            cy="120"
            r="102"
            fill="none"
            stroke="var(--surface-tint)"
            stroke-width="16"
          />

          <!-- Progress arc. The stroke-dashoffset transition creates the
               smooth arc-fill effect when the count changes. -->
          <circle
            class="ring-fg"
            cx="120"
            cy="120"
            r="102"
            fill="none"
            stroke="url(#ringGrad)"
            stroke-width="16"
            stroke-linecap="round"
            transform="rotate(-90 120 120)"
            :stroke-dasharray="ringCircumference"
            :stroke-dashoffset="ringOffset"
          />

          <!-- Cursor dot at the end of the progress arc. Follows the
               arc via the same rotation as the progress angle. -->
          <g v-if="todayCount > 0" :transform="`rotate(${ringAngleDeg - 90} 120 120)`">
            <circle class="ring-cursor" cx="222" cy="120" r="9" />
          </g>

          <!-- Inner vignette for depth. -->
          <circle cx="120" cy="120" r="94" fill="url(#ringInner)" />
        </svg>

        <div class="ring-content">
          <div class="counter-number tabular">
            <Transition name="num-flip" mode="out-in">
              <span :key="todayCount">{{ formatNumber(todayCount) }}</span>
            </Transition>
          </div>
          <div class="counter-label">{{ labels.todayCounter }}</div>
          <div v-if="ringTargetLabel" class="counter-target">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></svg>
            <span class="tabular">{{ ringTargetLabel }}</span>
          </div>
        </div>
      </div>
      <div v-if="stopwatchParts" class="gap-stopwatch">
        <div class="stopwatch-time tabular" dir="ltr">
          <template v-if="stopwatchParts.days.length > 0">
            <span
              v-for="(digit, i) in stopwatchParts.days"
              :key="'d' + i"
              class="sw-cell"
            >
              <Transition name="tick-flip">
                <span :key="digit" class="sw-seg">{{ digit }}</span>
              </Transition>
            </span>
            <span class="sw-unit">{{ t('home.stopwatch_day_unit') }}</span>
          </template>

          <span class="sw-cell">
            <Transition name="tick-flip">
              <span :key="stopwatchParts.hh[0]" class="sw-seg">{{ stopwatchParts.hh[0] }}</span>
            </Transition>
          </span>
          <span class="sw-cell">
            <Transition name="tick-flip">
              <span :key="stopwatchParts.hh[1]" class="sw-seg">{{ stopwatchParts.hh[1] }}</span>
            </Transition>
          </span>
          <span class="sw-sep">:</span>
          <span class="sw-cell">
            <Transition name="tick-flip">
              <span :key="stopwatchParts.mm[0]" class="sw-seg">{{ stopwatchParts.mm[0] }}</span>
            </Transition>
          </span>
          <span class="sw-cell">
            <Transition name="tick-flip">
              <span :key="stopwatchParts.mm[1]" class="sw-seg">{{ stopwatchParts.mm[1] }}</span>
            </Transition>
          </span>
          <span class="sw-sep">:</span>
          <span class="sw-cell">
            <Transition name="tick-flip">
              <span :key="stopwatchParts.ss[0]" class="sw-seg">{{ stopwatchParts.ss[0] }}</span>
            </Transition>
          </span>
          <span class="sw-cell">
            <Transition name="tick-flip">
              <span :key="stopwatchParts.ss[1]" class="sw-seg">{{ stopwatchParts.ss[1] }}</span>
            </Transition>
          </span>
        </div>
        <div class="stopwatch-label">{{ labels.sinceLast }}</div>
        <div
          v-if="(longestGapMs ?? 0) > 0"
          class="stopwatch-best"
          :class="{ 'is-new-record': beatingBest }"
        >
          <span class="sw-best-icon" aria-hidden="true">{{ beatingBest ? '🏆' : '⏱' }}</span>
          <span class="sw-best-text">
            {{
              beatingBest
                ? t('home.new_record')
                : t('home.longest_gap_label', {
                    duration: formatDuration(longestGapMs),
                  })
            }}
          </span>
        </div>
      </div>
    </div>

    <!-- Log composer. Stripped-back container so the log button is
         the unambiguous hero: no tint, no flourish, no border — just
         the CTA on top, a compact adjust-count strip beneath, and a
         tiny undo footer. The card only exists to group them. -->
    <div
      v-reveal="{ delay: 80 }"
      class="log-card"
      :class="{ 'log-card-vape': activeMode === 'vape' }"
      data-onboard="home-log"
    >
      <!-- Primary CTA — text-only pill with a faded mode icon in the
           background as texture. On successful log the whole label
           swaps to "✓ Logged" for a moment. -->
      <button
        class="log-btn"
        :class="{ 'log-btn-vape': activeMode === 'vape', 'is-check': showCheck }"
        data-onboard="log-button"
        @click="handleLog"
      >
        <span class="log-btn-texture" aria-hidden="true">
          <svg v-if="activeMode === 'vape'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 21c0-4 4-5 4-9 0-3-2-4-2-7"/><path d="M13 21c0-4 4-5 4-9 0-3-2-4-2-7"/><path d="M3 21c0-2 2-3 2-5"/></svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="4" rx="1"/><path d="M17 11V9M20 11V9"/><path d="M6 7c1-1 1-2 0-3M10 7c1-1 1-2 0-3"/></svg>
        </span>
        <Transition name="log-icon-swap" mode="out-in">
          <span v-if="showCheck" key="check" class="log-btn-content">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
            ><path d="M5 13l4 4L19 7"/></svg>
            <span>{{ t('home.log_done') }}</span>
          </span>
          <span v-else key="label" class="log-btn-content">{{
            logCount === 1 ? labels.logOne : labels.logMany(logCount)
          }}</span>
        </Transition>
      </button>

      <!-- Secondary stepper — "adjust the count". Compact so it stays
           subordinate to the CTA. -->
      <div class="log-stepper">
        <button
          class="step-btn"
          :aria-label="'minus'"
          @click="decrement"
          @pointerdown="onStepHoldStart('down', $event)"
          @pointerup="onStepHoldEnd"
          @pointerleave="onStepHoldEnd"
          @pointercancel="onStepHoldEnd"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14"/></svg>
        </button>
        <div class="step-count-wrap">
          <div class="step-count tabular">
            <Transition name="num-flip" mode="out-in">
              <span :key="logCount">{{ formatNumber(logCount) }}</span>
            </Transition>
          </div>
          <div class="step-count-unit">{{
            activeMode === 'vape'
              ? (logCount === 1 ? t('home.step_unit_puff_one') : t('home.step_unit_puff_many'))
              : (logCount === 1 ? t('home.step_unit_cig_one') : t('home.step_unit_cig_many'))
          }}</div>
        </div>
        <button
          class="step-btn"
          :aria-label="'plus'"
          @click="increment"
          @pointerdown="onStepHoldStart('up', $event)"
          @pointerup="onStepHoldEnd"
          @pointerleave="onStepHoldEnd"
          @pointercancel="onStepHoldEnd"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14M12 5v14"/></svg>
        </button>
      </div>

      <button v-if="hasEntries" class="undo-btn" @click="emit('undo')">
        {{ t('home.undo_last') }}
      </button>
    </div>

    <!-- 7-day sparkline. Dropped the section header + card chrome —
         the tiny caption below the strip identifies it, and losing
         the boxed background lets the bars read as ambient data
         rather than a heavyweight "section". -->
    <div v-reveal class="chart-section" data-onboard="home-chart">
      <div class="bar-chart">
        <div v-for="(d, i) in last7" :key="i" class="bar-col">
          <div
            class="bar-value tabular"
            :style="{ color: d.count > 0 ? 'var(--text)' : 'var(--subtle)' }"
          >
            {{ d.count > 0 ? formatNumber(d.count) : '·' }}
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
      <div class="chart-caption">{{ t('home.last_7_days') }}</div>
    </div>

    <!-- Insight grid: colorful 2-column tile grid built from the shared
         <StatsCard> component so every stats surface across the app
         has the same DNA. Money tile spans full width when present. -->
    <div v-reveal class="insight-grid" data-onboard="home-stats">
      <StatsCard
        tint="peach"
        :label="labels.dailyAvg"
        :value="formatNumber(activeMode === 'vape' ? (avgPuffsPerSession ?? 0) : dailyAvg)"
        :sub="activeMode === 'vape' ? t('home.stat_sub_avg_puffs') : t('home.stat_sub_avg_cigs')"
      >
        <template #icon>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M7 15l3.5-3.5 3 3L21 6"/><path d="M17 6h4v4"/></svg>
        </template>
        <template #flourish>
          <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 82 Q30 62 48 74 T96 56"/>
            <circle cx="96" cy="56" r="3" fill="currentColor" stroke="none"/>
          </svg>
        </template>
      </StatsCard>

      <StatsCard
        tint="lavender"
        :label="labels.totalLogged"
        :value="formatNumber(totalSmoked)"
        :sub="t('home.stat_sub_since_start')"
      >
        <template #icon>
          <template v-if="activeMode === 'vape'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 21c0-4 4-5 4-9 0-3-2-4-2-7"/><path d="M13 21c0-4 4-5 4-9 0-3-2-4-2-7"/><path d="M3 21c0-2 2-3 2-5"/></svg>
          </template>
          <template v-else>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="4" rx="1"/><path d="M17 11V9M20 11V9"/><path d="M6 7c1-1 1-2 0-3M10 7c1-1 1-2 0-3"/></svg>
          </template>
        </template>
        <template #flourish>
          <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="86" cy="46" r="20"/>
            <circle cx="86" cy="46" r="10"/>
          </svg>
        </template>
      </StatsCard>

      <StatsCard
        tint="mint"
        :label="t('home.days_tracked')"
        :value="formatNumber(totalDays)"
        :sub="t('home.stat_sub_days')"
      >
        <template #icon>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M8 3v4M16 3v4"/></svg>
        </template>
        <template #flourish>
          <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="66" y="30" width="34" height="34" rx="4"/>
            <path d="M66 42 L100 42"/>
            <path d="M74 30 V26 M92 30 V26"/>
          </svg>
        </template>
      </StatsCard>

      <StatsCard
        tint="sun"
        :label="labels.bestDay"
        :value="formatNumber(bestDay)"
        :sub="t('home.stat_sub_best_day')"
      >
        <template #icon>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M17 4h3v3a5 5 0 0 1-5 5"/><path d="M7 4H4v3a5 5 0 0 0 5 5"/><path d="M7 4h10v4a5 5 0 0 1-10 0V4z"/></svg>
        </template>
        <template #flourish>
          <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M74 24 l6 12 12 2 -8 8 2 12 -12 -6 -12 6 2 -12 -8 -8 12 -2 z"/>
          </svg>
        </template>
      </StatsCard>

      <StatsCard
        v-if="moneyMode != null"
        tint="mint"
        wide
        :label="moneyLabel"
        :value="formatMoney(moneyAmount, currency)"
        :sub="moneyMode === 'saved' ? t('home.stat_sub_money_saved') : t('home.stat_sub_money_spent')"
        :class="moneyMode === 'saved' ? 'is-saved' : ''"
      >
        <template #icon>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z"/><path d="M4 10h16"/><circle cx="16" cy="14" r="1.5"/></svg>
        </template>
        <template #flourish>
          <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="86" cy="50" r="22"/>
            <path d="M86 40 v20 M80 46 h12 M80 54 h12"/>
          </svg>
        </template>
      </StatsCard>
    </div>

    <!-- Body-recovery milestones. Same tinted stats-card language as
         the insight grid so the "how is my body doing?" view sits
         visually alongside the daily numbers. Each milestone tile
         carries the emoji + label + big % + animated fill; the fill
         animation stagger-drops in when the section opens. -->
    <section
      v-if="hasEntries"
      v-reveal
      class="health-section"
      :class="{ 'is-expanded': healthOpen }"
      data-onboard="home-health"
    >
      <button
        type="button"
        class="health-toggle"
        :aria-expanded="healthOpen"
        @click="healthOpen = !healthOpen"
      >
        <span class="health-toggle-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 21s-7-4.5-7-11a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 6.5-7 11-7 11z"/>
            <path d="M9 12h2l1-2 1 4 1-2h2"/>
          </svg>
        </span>
        <span class="health-toggle-body">
          <span class="health-toggle-label">{{ t('home.health_section') }}</span>
          <span v-if="nextMilestone" class="health-toggle-next">
            {{
              t('home.health_next', {
                label: t(`health.${nextMilestone.key}.label`),
                time: formatRemaining(nextMilestone.remainingMs),
              })
            }}
          </span>
        </span>
        <svg
          class="health-chev"
          :class="{ 'is-open': healthOpen }"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        ><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div v-if="healthOpen" class="milestone-grid">
        <div
          v-for="(m, i) in milestones"
          :key="m.key"
          class="milestone-card"
          :class="[milestoneTint(i), { reached: m.reached }]"
          :style="{ '--i': i } as any"
        >
          <span class="milestone-flourish" aria-hidden="true">
            <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="88" cy="42" r="24"/>
              <circle cx="88" cy="42" r="12"/>
            </svg>
          </span>
          <div class="milestone-pill">
            <span
              class="milestone-emoji"
              :class="milestoneAnim(m.key, m.reached)"
              aria-hidden="true"
            >{{ m.emoji }}</span>
            <span class="milestone-label">{{ t(`health.${m.key}.label`) }}</span>
            <svg
              v-if="m.reached"
              class="milestone-check"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
            ><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div class="milestone-body">
            <div class="milestone-value tabular">
              {{ formatNumber(Math.round(m.progress * 100)) }}<span class="milestone-pct-sign">%</span>
            </div>
            <div class="milestone-progress" :aria-valuenow="Math.round(m.progress * 100)" aria-valuemin="0" aria-valuemax="100" role="progressbar">
              <div
                class="milestone-progress-fill"
                :style="{ '--fill': Math.round(m.progress * 100) + '%' } as any"
              />
            </div>
            <div class="milestone-sub">
              {{
                m.reached
                  ? t('home.milestone_reached')
                  : t('home.milestone_in', { time: formatRemaining(m.remainingMs) })
              }}
            </div>
          </div>
        </div>
      </div>
    </section>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, toRef, onMounted, onUnmounted } from 'vue'
import { useI18n, intlLocale, formatNumber } from '../i18n'
import { share } from '../composables/useShare'
import { getToday } from '../composables/useDate'
import { useToast } from '../composables/useToast'
import { useEconomy, formatMoney } from '../composables/useEconomy'
import { useHealthMilestones } from '../composables/useHealthMilestones'
import { formatDuration } from '../composables/useStats'
import Confetti from './Confetti.vue'
import ModeToggle from './ModeToggle.vue'
import ConsumableRing from './ConsumableRing.vue'
import StatsCard from './StatsCard.vue'
import { useConfirm } from '../composables/useConfirm'
import type { ConsumableKind, DayBucket, EntryType } from '../types'

const { t } = useI18n()

interface Props {
  activeMode: EntryType
  todayCount: number
  lastSmokeTime?: string
  last7: DayBucket[]
  maxLast7: number
  dailyAvg: number
  totalSmoked: number
  totalDays: number
  bestDay: number
  /** Longest awake gap recorded between two logs (ms). 0 if none. */
  longestGapMs?: number
  hasEntries: boolean
  quitTodayTarget?: number | null
  quitTodayStatus?: 'on-track' | 'over' | null
  quitIsComplete?: boolean
  smokeFreeDays?: number
  // Vape-mode hero-consumable life + session stats. Zero / default
  // values are safe in cigarette mode — the ring / session inline
  // never renders. Prop names still say "pod" for backward-compat but
  // now refer to whichever consumable is the hero.
  heroConsumable?: ConsumableKind
  puffsThisPod?: number
  puffsRemaining?: number
  podLifePct?: number
  podOverflow?: boolean
  hasActivePod?: boolean
  sessionsToday?: number
  avgPuffsPerSession?: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  log: [count: number]
  undo: []
  'open-report': []
  'open-quit': []
  'set-mode': [mode: EntryType]
  'start-new-pod': []
}>()

// Single source of truth for vape ↔ cigarette string swaps. Adding a
// new mode-aware label means adding one line here, not hunting
// through the template. `t(...)` is reactive so locale switches still
// re-render.
const labels = computed(() => {
  const vape = props.activeMode === 'vape'
  return {
    todayCounter: vape ? t('home.puffs_today') : t('home.cigarettes_today'),
    sinceLast: vape ? t('home.since_last_puff') : t('home.since_last'),
    // Vape button is always "Log session" — the stepper carries the
    // puff count, and one tap = one session regardless of how many
    // puffs were in it. Cigarette keeps the count-in-label pattern
    // because each stick is discrete.
    logOne: vape ? t('home.log_session') : t('home.log_one'),
    logMany: (n: number) =>
      vape ? t('home.log_session') : t('home.log_many', { n }),
    dailyAvg: vape ? t('home.daily_avg_puffs') : t('home.daily_avg'),
    totalLogged: vape ? t('home.total_logged_puffs') : t('home.total_logged'),
    bestDay: vape ? t('home.best_day_puffs') : t('home.best_day'),
  }
})

const modeOptions = computed(() => [
  { value: 'cigarette' as EntryType, label: t('home.mode_cigarette'), emoji: '🚬' },
  { value: 'vape' as EntryType, label: t('home.mode_vape'), emoji: '💨' },
])

// A "quick log" default per mode: cigarette = 1 (each stick is
// discrete), vape = 5 puffs (a typical short session — user can bump
// the count up for a longer sitting). The stepper starts at this
// value on load and after each log, so tapping Log twice in a row
// logs 5 + 5 in vape mode.
const DEFAULT_LOG_COUNT: Record<EntryType, number> = {
  cigarette: 1,
  vape: 5,
}
const logCount = ref(DEFAULT_LOG_COUNT[props.activeMode])
watch(
  () => props.activeMode,
  (m) => {
    logCount.value = DEFAULT_LOG_COUNT[m]
  }
)
const isPulsing = ref(false)
const showCheck = ref(false)
const confettiTrigger = ref(0)
// Health section is collapsed by default so the ring + log + strip
// stay the fold. The user opens it deliberately when they want to
// see progress.
const healthOpen = ref(false)

async function onStartNewPod(): Promise<void> {
  // Confirm copy varies per consumable — "Start a new pod?" reads
  // wrong for coil / bottle / disposable users. Falls back to the
  // pod copy if the hero is somehow undefined.
  const kind = props.heroConsumable ?? 'pod'
  const ok = await useConfirm().confirm({
    title: t(`home.consumable_${kind}_new_confirm_title`),
    body: t(`home.consumable_${kind}_new_confirm_body`),
    confirmText: t(`home.consumable_${kind}_new_cta`),
    cancelText: t('home.pod_new_confirm_cancel'),
  })
  if (ok) emit('start-new-pod')
}

// Economy: when the user has a smoke-free streak, show "money saved
// during this streak". Otherwise (they're actively smoking), show
// "total spent" so the card never silently disappears on a relapse.
// Returns null only when no price is configured.
const economy = useEconomy()
const currency = computed(() => economy.settings.value.currency)
const moneyMode = computed<'saved' | 'spent' | null>(() => {
  if (economy.pricePerUnit.value <= 0) return null
  return (props.smokeFreeDays ?? 0) > 0 ? 'saved' : 'spent'
})
const moneyAmount = computed<number>(() => {
  const price = economy.pricePerUnit.value
  if (moneyMode.value === 'saved') {
    return price * props.dailyAvg * (props.smokeFreeDays ?? 0)
  }
  return price * props.totalSmoked
})
const moneyLabel = computed<string>(() =>
  moneyMode.value === 'saved' ? t('home.money_saved') : t('home.money_spent')
)

// Health milestones tick relative to the last log of the active
// mode. Cigarette mode uses CDC / NHS data; vape mode uses
// nicotine-cessation + vape-specific recovery research.
const lastSmokeRef = toRef(props, 'lastSmokeTime')
const lastSmokeOrNull = computed<string | null>(
  () => lastSmokeRef.value ?? null
)
const activeModeRef = toRef(props, 'activeMode')
const { all: milestones, next: nextMilestone } =
  useHealthMilestones(lastSmokeOrNull, activeModeRef)

function formatRemaining(ms: number): string {
  return formatDuration(ms)
}

// Cycle through the four card tints so the milestone grid reads as a
// "collection" like the insight grid above. Order matches the visual
// warmth ramp we use elsewhere (peach → lavender → mint → sun).
const MILESTONE_TINTS = ['tint-peach', 'tint-lavender', 'tint-mint', 'tint-sun'] as const
function milestoneTint(i: number): string {
  return MILESTONE_TINTS[i % MILESTONE_TINTS.length]
}

// Contextual micro-animation per milestone. Each key maps to a themed
// keyframe (heartbeat for pulse/heart, breathing for lungs, sparkle for
// nicotine clear, etc.) so the icon chip feels alive with the meaning
// of the milestone. Reached milestones drop to a still `anim-still`
// state — the animation implies "still working on this", so an already-
// achieved milestone shouldn't keep pulsing.
const MILESTONE_ANIMS: Record<string, string> = {
  // cigarette
  pulse: 'anim-beat',
  co: 'anim-breathe',
  taste_smell: 'anim-bob',
  circulation: 'anim-beat',
  lungs: 'anim-breathe',
  heart: 'anim-beat',
  stroke: 'anim-shimmer',
  // vape
  vape_pulse: 'anim-beat',
  vape_nicotine_half: 'anim-flip',
  vape_cravings_peak: 'anim-spin',
  vape_nicotine_clear: 'anim-sparkle',
  vape_taste_throat: 'anim-bob',
  vape_oral: 'anim-shine',
  vape_lung: 'anim-breathe',
}
function milestoneAnim(key: string, reached: boolean): string {
  if (reached) return 'anim-still'
  return MILESTONE_ANIMS[key] ?? 'anim-breathe'
}

// Live stopwatch since the last logged cigarette. Ticks every second
// while the component is mounted; the computed gates display so we
// render nothing before the first log.
const now = ref(Date.now())
let nowTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  nowTimer = setInterval(() => (now.value = Date.now()), 1000)
})
onUnmounted(() => {
  if (nowTimer) clearInterval(nowTimer)
  onStepHoldEnd()
})

interface StopwatchParts {
  /** One localized digit per place value. Empty when below 1 day. */
  days: string[]
  /** Two localized digits each — [tens, ones]. */
  hh: [string, string]
  mm: [string, string]
  ss: [string, string]
}

// True when the live "since last cigarette" timer has surpassed the
// historical longest gap — the user is mid-record. Compared in raw
// ms (not the rounded display value) so the celebration kicks in
// the instant they cross the threshold.
const beatingBest = computed<boolean>(() => {
  const best = props.longestGapMs ?? 0
  if (best <= 0 || !props.lastSmokeTime) return false
  const elapsed = now.value - new Date(props.lastSmokeTime).getTime()
  return elapsed > best
})

const stopwatchParts = computed<StopwatchParts | null>(() => {
  if (!props.lastSmokeTime) return null
  // Clamp to 0 — right after logging, `now.value` (1s ticks) can briefly
  // trail the freshly-stamped entry time. Without the clamp, elapsed goes
  // negative for a fraction of a second and the whole block disappears.
  const elapsed = Math.max(0, now.value - new Date(props.lastSmokeTime).getTime())
  const totalSec = Math.floor(elapsed / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60

  // Format each individual digit in the active locale so the template
  // can wrap every digit in its own <Transition>. On a typical tick
  // only the ones-place of seconds changes — every other digit stays
  // mounted and silent.
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

// Progress ring fills relative to either the quit-plan target (if any)
// or the daily average baseline. When today exceeds the target the ring
// is fully drawn — we don't over-fill, just lock at 100%.
const RING_R = 102
const ringCircumference = 2 * Math.PI * RING_R
const ringFilled = computed(() => {
  const baseline = props.quitTodayTarget ?? Math.max(props.dailyAvg, 1)
  return Math.min(1, props.todayCount / Math.max(1, baseline))
})
const ringOffset = computed(() => ringCircumference * (1 - ringFilled.value))
const ringAngleDeg = computed(() => ringFilled.value * 360)
// Status drives which gradient the ring wears: green when comfortably
// under baseline, warm when approaching, warning red when exceeding.
// Reads at a glance without asking the user to parse a number.
const ringStatus = computed<'ok' | 'warning' | 'over'>(() => {
  const baseline = props.quitTodayTarget ?? Math.max(props.dailyAvg, 1)
  if (props.todayCount > baseline) return 'over'
  if (props.todayCount >= baseline * 0.8) return 'warning'
  return 'ok'
})
// Small chip under the counter — either "8 / 15 target" from an active
// quit plan or "vs 12 avg" against the daily average, depending on
// what the user has configured.
const ringTargetLabel = computed<string | null>(() => {
  if (props.quitTodayTarget != null) {
    return t('home.ring_target_chip', {
      count: formatNumber(props.todayCount),
      target: formatNumber(props.quitTodayTarget),
    })
  }
  if (props.dailyAvg > 0) {
    return t('home.ring_avg_chip', { avg: formatNumber(props.dailyAvg) })
  }
  return null
})

const LOG_COUNT_MAX = 99

function increment(): void {
  if (logCount.value < LOG_COUNT_MAX) logCount.value++
}
function decrement(): void {
  if (logCount.value > 1) logCount.value--
}

// Long-press acceleration on the +/− buttons. Same behaviour in both
// modes (unified UX), but the fast path matters most for vape mode
// where a session can be 30+ puffs — tap-and-hold instead of 30 taps.
// Tiers: after 400ms hold, step by 1 every 70ms. After 1.4s total,
// step by 5. Cancelled on pointerup / leave / cancel.
let holdTimer: ReturnType<typeof setTimeout> | null = null
let repeatTimer: ReturnType<typeof setInterval> | null = null
let boostTimer: ReturnType<typeof setTimeout> | null = null

function stepBy(direction: 'up' | 'down', n: number): void {
  const next =
    direction === 'up' ? logCount.value + n : logCount.value - n
  logCount.value = Math.max(1, Math.min(LOG_COUNT_MAX, next))
}

function onStepHoldStart(direction: 'up' | 'down', ev: PointerEvent): void {
  // Only respond to the primary pointer — right-click / two-finger
  // shouldn't kick off a repeat.
  if (ev.button !== 0 && ev.pointerType === 'mouse') return
  onStepHoldEnd()
  holdTimer = setTimeout(() => {
    let step = 1
    repeatTimer = setInterval(() => stepBy(direction, step), 70)
    boostTimer = setTimeout(() => {
      step = 5
    }, 1000)
  }, 400)
}

function onStepHoldEnd(): void {
  if (holdTimer) {
    clearTimeout(holdTimer)
    holdTimer = null
  }
  if (repeatTimer) {
    clearInterval(repeatTimer)
    repeatTimer = null
  }
  if (boostTimer) {
    clearTimeout(boostTimer)
    boostTimer = null
  }
}

function handleLog(): void {
  emit('log', logCount.value)
  isPulsing.value = true
  showCheck.value = true
  setTimeout(() => (isPulsing.value = false), 500)
  setTimeout(() => (showCheck.value = false), 700)
  logCount.value = DEFAULT_LOG_COUNT[props.activeMode]
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
      const vape = props.activeMode === 'vape'
      showToast(
        n === 1
          ? vape
            ? t('home.milestone_one_day_vape')
            : t('home.milestone_one_day')
          : vape
            ? t('home.milestone_n_days_vape', { n })
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
  const vape = props.activeMode === 'vape'
  if (props.quitIsComplete && (props.smokeFreeDays ?? 0) > 0) {
    return vape
      ? t('share.smoke_free_vape', { n: props.smokeFreeDays! })
      : t('share.smoke_free', { n: props.smokeFreeDays! })
  }
  if (props.totalSmoked === 0) return t('share.nothing_yet')
  return vape
    ? t('share.summary_vape', {
        total: props.totalSmoked,
        days: props.totalDays,
        avg: props.dailyAvg,
        longest: '—',
      })
    : t('share.summary', {
        total: props.totalSmoked,
        days: props.totalDays,
        avg: props.dailyAvg,
        longest: '—',
      })
}

async function onShare(): Promise<void> {
  const result = await share({ title: 'Smoking Tracker', text: shareText() })
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
  gap: 14px;
  margin: 8px 0;
}
.ring-wrap {
  position: relative;
  width: 260px;
  aspect-ratio: 1;
  /* Ring color tokens — swap via .ring-ok/.ring-warning/.ring-over
     so the fill hue matches whether the user is under, near, or over
     their baseline / quit target. */
  --ring-grad-from: var(--brand-grad-from);
  --ring-grad-to: var(--brand-grad-to);
  --ring-glow: rgba(255, 122, 61, 0.32);
}
.ring-wrap.ring-ok {
  --ring-grad-from: #22c55e;
  --ring-grad-to: #4ade80;
  --ring-glow: rgba(34, 197, 94, 0.28);
}
.ring-wrap.ring-warning {
  --ring-grad-from: var(--brand-grad-from);
  --ring-grad-to: var(--brand-grad-to);
  --ring-glow: rgba(255, 122, 61, 0.32);
}
.ring-wrap.ring-over {
  --ring-grad-from: #ef4444;
  --ring-grad-to: #fb7185;
  --ring-glow: rgba(239, 68, 68, 0.32);
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
.ring-ticks {
  opacity: 0.5;
}
.ring-fg {
  transition: stroke-dashoffset 0.8s cubic-bezier(0.2, 0.8, 0.2, 1),
    stroke 0.4s ease;
  filter: drop-shadow(0 4px 12px var(--ring-glow));
}
.ring-cursor {
  fill: var(--ring-grad-to);
  stroke: var(--card);
  stroke-width: 3;
  filter: drop-shadow(0 2px 6px var(--ring-glow));
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
  gap: 4px;
  padding: 0 24px;
}
.counter-number {
  /* Override the global .tabular mono font so the counter follows
     the app's language font (Inter for en, Cairo for ar) — the
     tabular-nums variant from .tabular still keeps digits aligned. */
  font-family: inherit;
  font-size: 76px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.045em;
  color: var(--text);
  /* Establish a positioning context so the in/out spans of the
     <Transition> can stack over each other without shifting layout
     during the cross-fade. */
  position: relative;
  display: inline-block;
  min-width: 1ch;
}
.counter-number > span {
  display: inline-block;
}
.ring-wrap.ring-over .counter-number {
  color: var(--danger);
}
/* Counter flip — slide + fade when the today count actually changes. */
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
.counter-label {
  font-size: 11px;
  color: var(--muted);
  margin-top: 2px;
  font-weight: 700;
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
  background: color-mix(in srgb, var(--ring-grad-to) 12%, var(--card));
  border: 1px solid color-mix(in srgb, var(--ring-grad-to) 28%, transparent);
  color: var(--ring-grad-from);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  white-space: nowrap;
  animation: chipFadeIn 0.3s ease-out both;
}
@keyframes chipFadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
.gap-stopwatch {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.stopwatch-time {
  /* Same override as .counter-number — follow the app font. */
  font-family: inherit;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--text);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  /* Numeric clocks read left-to-right in both English and Arabic.
     Pinning ltr here keeps "00:01:23" in the right order even when
     the surrounding RTL container would otherwise flip it. */
  direction: ltr;
  unicode-bidi: isolate;
}
/* One cell per digit. Relative positioning lets the in/out spans of
   each digit's <Transition> stack without budging neighbors; the
   `1ch` width keeps the cell from reflowing while a digit fades. */
.sw-cell {
  position: relative;
  display: inline-block;
  width: 1ch;
  height: 1em;
  text-align: center;
}
.sw-seg {
  position: absolute;
  inset: 0;
  display: inline-block;
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
/* Stopwatch tick — concurrent crossfade (no mode="out-in" gap). */
.tick-flip-enter-active,
.tick-flip-leave-active {
  transition: opacity 0.28s ease, transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
  will-change: opacity, transform;
}
.tick-flip-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.tick-flip-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (prefers-reduced-motion: reduce) {
  .num-flip-enter-active,
  .num-flip-leave-active,
  .tick-flip-enter-active,
  .tick-flip-leave-active {
    transition: none !important;
  }
  .num-flip-enter-from,
  .num-flip-leave-to,
  .tick-flip-enter-from,
  .tick-flip-leave-to {
    transform: none !important;
  }
}
/* Personal-best line under the stopwatch. Subtle by default; flips
   to a brand-tinted chip with a trophy when the live elapsed time
   beats the historical best. */
.stopwatch-best {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  padding: 7px 14px;
  border-radius: 999px;
  background: var(--surface-tint);
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
  letter-spacing: 0.02em;
  transition: background 0.25s ease, color 0.25s ease, transform 0.25s ease;
}
.stopwatch-best.is-new-record {
  color: #fff;
  background: linear-gradient(
    135deg,
    var(--brand-grad-from),
    var(--brand-grad-to)
  );
  box-shadow: 0 4px 14px rgba(255, 122, 61, 0.32);
  animation: best-pop 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.sw-best-icon {
  font-size: 14px;
  line-height: 1;
}
@keyframes best-pop {
  0%   { transform: scale(0.92); }
  60%  { transform: scale(1.06); }
  100% { transform: scale(1); }
}
.stopwatch-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--subtle);
  letter-spacing: 0.02em;
}

/* Log card */
/* Log card — bare container. No tint, no border, no flourish. Only
   padding and a vertical gap to group the CTA, the adjust strip, and
   the undo footer. This forces the log button to carry the fold's
   visual weight; the card recedes. */
.log-card {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  padding: 0;
  --tile-fg: var(--brand);
}
.log-card.log-card-vape {
  --tile-fg: #14b8a6;
}

/* Adjust strip — a single compact horizontal pill: [−] [count · unit] [+].
   Lives on a soft neutral surface (not the card's tint) so it whispers
   "you can tweak this" without competing with the primary CTA above.
   Wraps the entire row in one bordered pill for a tight, tidy look. */
.log-stepper {
  display: inline-flex;
  align-items: center;
  align-self: center;
  gap: 4px;
  padding: 4px;
  border-radius: 999px;
  background: var(--surface-tint);
  border: 1px solid var(--hairline);
}
.step-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--tile-fg);
  font-family: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    transform 0.1s ease,
    background 0.15s ease;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  user-select: none;
}
.step-btn:hover {
  background: color-mix(in srgb, var(--tile-fg) 14%, var(--card));
}
.step-btn:active {
  transform: scale(0.9);
  background: color-mix(in srgb, var(--tile-fg) 22%, var(--card));
}
.step-count-wrap {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  padding: 0 10px;
  min-width: 74px;
  justify-content: center;
}
.step-count {
  font-size: 18px;
  font-weight: 800;
  text-align: center;
  color: var(--text);
  letter-spacing: -0.01em;
  line-height: 1;
  position: relative;
  display: inline-block;
  min-width: 1ch;
}
.step-count > span { display: inline-block; }
.step-count-unit {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--muted);
  line-height: 1;
}
/* Log button — the simplest thing that works. Solid mode color,
   centered label, one soft shadow. On log the whole label swaps to
   "✓ Logged" for a moment, so the button carries its own
   confirmation without needing a decorative icon slot. */
.log-btn {
  position: relative;
  z-index: 1;
  --lb-bg: var(--brand);
  --lb-glow: rgba(255, 122, 61, 0.22);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px 24px;
  min-height: 60px;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  font-family: inherit;
  color: #fff;
  background: var(--lb-bg);
  box-shadow: 0 6px 16px var(--lb-glow);
  transition:
    transform 0.12s ease,
    box-shadow 0.18s ease,
    filter 0.18s ease;
  overflow: hidden;
  isolation: isolate;
  -webkit-tap-highlight-color: transparent;
}

/* Mode-aware icon sitting in the background at low opacity — reads
   as a subtle brand texture rather than a UI element. Sized big and
   tilted so it feels like a bold watermark; extends past the pill's
   edges (clipped by overflow:hidden). */
.log-btn-texture {
  position: absolute;
  right: -32px;
  top: 50%;
  transform: translateY(-50%) rotate(-14deg);
  width: 160px;
  height: 160px;
  color: #fff;
  opacity: 0.14;
  pointer-events: none;
  z-index: 0;
}
.log-btn-texture svg {
  width: 100%;
  height: 100%;
  display: block;
}
.log-btn > :not(.log-btn-texture) {
  position: relative;
  z-index: 1;
}
.log-btn.log-btn-vape {
  --lb-bg: #14b8a6;
  --lb-glow: rgba(20, 184, 166, 0.22);
}
.log-btn:hover {
  filter: brightness(1.05);
  box-shadow: 0 8px 20px var(--lb-glow);
}
.log-btn:active {
  transform: scale(0.985);
  box-shadow: 0 4px 10px var(--lb-glow);
}
.log-btn-content {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.01em;
  line-height: 1;
}
.log-btn-content svg { display: block; }

/* Confirm pulse — a small, quick scale bump on log. Signals success
   without wiggling the whole button around. */
.log-btn.is-check {
  animation: logBtnConfirm 0.32s ease-out;
}
@keyframes logBtnConfirm {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.02); }
  100% { transform: scale(1); }
}

/* Icon/arrow cross-fade during the log confirmation. */
.log-icon-swap-enter-active,
.log-icon-swap-leave-active {
  transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.log-icon-swap-enter-from,
.log-icon-swap-leave-to {
  opacity: 0;
  transform: scale(0.7);
}

/* Undo lives inside the tinted card too — subtle text link so it
   doesn't compete with the primary CTA. */
.undo-btn {
  position: relative;
  z-index: 1;
}

/* Number flip on the stepper count — same class name reused by the
   ring counter. Slides + fades so the count feels alive when you
   long-press the ± buttons. */
.num-flip-enter-active,
.num-flip-leave-active {
  transition: opacity 0.28s cubic-bezier(0.2, 0.8, 0.2, 1),
    transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
  will-change: opacity, transform;
}
.num-flip-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.85);
}
.num-flip-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.92);
}

@media (prefers-reduced-motion: reduce) {
  .log-btn,
  .log-btn.is-check { animation: none; }
  .num-flip-enter-active,
  .num-flip-leave-active { transition: none; }
  .num-flip-enter-from,
  .num-flip-leave-to { opacity: 1; transform: none; }
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

/* Chart — stripped of card chrome so it reads as ambient data next
   to the hero rather than a discrete "section". Kept the fixed
   height so the bars can't push into the strip below. */
.chart-section {
  margin-top: 2px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.chart-caption {
  font-size: 10px;
  font-weight: 600;
  color: var(--subtle);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-align: center;
}
.bar-chart {
  display: flex;
  gap: 6px;
  padding: 4px 2px 0;
  overflow: hidden;
  align-items: flex-end;
  height: 116px;
}
.bar-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  height: 100%;
}
.bar-value {
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  line-height: 1;
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
  max-height: 90px;
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
  text-align: center;
  line-height: 1;
}

/* Insight grid layout only — the tile styling now lives in
   <StatsCard>. Two columns; the money tile passes `wide` so it spans
   both columns via .stats-card-wide. */
.insight-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.insight-grid :deep(.stats-card.is-saved .stats-value) {
  color: var(--success);
}

/* Body-recovery section. Header collapses into a compact "next
   milestone" pill; expanding reveals a grid of tinted milestone
   tiles that share the DNA of the home insight grid — same border
   radius, same tint tokens, same pill header — with an animated
   progress fill that stagger-drops in on open. */
.health-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.health-toggle {
  appearance: none;
  border: 1px solid var(--hairline);
  background: var(--card);
  font-family: inherit;
  cursor: pointer;
  padding: 12px 14px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: start;
  color: var(--text);
  transition: background 0.15s ease, border-color 0.15s ease;
}
.health-toggle:active {
  background: var(--surface-tint);
}
.health-toggle-icon {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--danger);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.health-toggle-icon svg {
  width: 18px;
  height: 18px;
}
.health-toggle-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  gap: 2px;
}
.health-toggle-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: 0.005em;
}
.health-toggle-next {
  font-size: 11px;
  color: var(--muted);
  font-weight: 500;
}
.health-chev {
  color: var(--muted);
  flex-shrink: 0;
  transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.health-chev.is-open {
  transform: rotate(180deg);
}

/* Milestone grid — 2-column, matches insight-grid gap. */
.milestone-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.milestone-card {
  position: relative;
  overflow: hidden;
  isolation: isolate;
  padding: 14px 16px 16px;
  border-radius: 20px;
  border: 1px solid var(--hairline);
  background: var(--card);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: transform 0.15s ease, opacity 0.25s ease;
  opacity: 0.7;
  animation: milestoneRise 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(var(--i, 0) * 60ms);
}
.milestone-card.reached {
  opacity: 1;
}
.milestone-card:active {
  transform: scale(0.98);
}
@keyframes milestoneRise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 0.7;
    transform: translateY(0);
  }
}
.milestone-card.reached { animation-name: milestoneRiseReached; }
@keyframes milestoneRiseReached {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Tint palette — reuses the design-system tokens so dark mode swaps
   variants automatically. */
.milestone-card.tint-peach {
  background: var(--tint-peach-bg);
  border-color: transparent;
  --tile-fg: var(--tint-peach-fg);
}
.milestone-card.tint-lavender {
  background: var(--tint-lavender-bg);
  border-color: transparent;
  --tile-fg: var(--tint-lavender-fg);
}
.milestone-card.tint-mint {
  background: var(--tint-mint-bg);
  border-color: transparent;
  --tile-fg: var(--tint-mint-fg);
}
.milestone-card.tint-sun {
  background: var(--tint-sun-bg);
  border-color: transparent;
  --tile-fg: var(--tint-sun-fg);
}

.milestone-flourish {
  position: absolute;
  right: -22px;
  bottom: -22px;
  width: 120px;
  height: 120px;
  color: var(--tile-fg, var(--brand));
  opacity: 0.14;
  z-index: 0;
  pointer-events: none;
}
.milestone-flourish svg {
  width: 100%;
  height: 100%;
}

.milestone-pill {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px 5px 5px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--card) 72%, transparent);
  align-self: flex-start;
  max-width: 100%;
  backdrop-filter: blur(6px);
}
.milestone-emoji {
  width: 26px;
  height: 26px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--tile-fg, var(--brand)) 16%, transparent);
  flex-shrink: 0;
  font-size: 14px;
  line-height: 1;
  transform-origin: center;
  will-change: transform, opacity;
}

/* Contextual micro-animations. Each keyframe lasts long enough (2–4s)
   to be ambient rather than distracting — a subtle "this system is
   still working on it" signal. Reached tiles get `.anim-still` and
   stop moving. */
.milestone-emoji.anim-beat {
  animation: mAnimBeat 1.4s ease-in-out infinite;
}
@keyframes mAnimBeat {
  0%, 100% { transform: scale(1); }
  20% { transform: scale(1.16); }
  40% { transform: scale(1); }
  60% { transform: scale(1.12); }
  80% { transform: scale(1); }
}
.milestone-emoji.anim-breathe {
  animation: mAnimBreathe 4s ease-in-out infinite;
}
@keyframes mAnimBreathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.14); }
}
.milestone-emoji.anim-bob {
  animation: mAnimBob 2.4s ease-in-out infinite;
}
@keyframes mAnimBob {
  0%, 100% { transform: rotate(-6deg); }
  50% { transform: rotate(6deg); }
}
.milestone-emoji.anim-spin {
  animation: mAnimSpin 3.6s linear infinite;
}
@keyframes mAnimSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.milestone-emoji.anim-flip {
  animation: mAnimFlip 4s cubic-bezier(0.6, 0.05, 0.4, 0.95) infinite;
}
@keyframes mAnimFlip {
  0% { transform: rotate(0deg); }
  45%, 55% { transform: rotate(180deg); }
  100% { transform: rotate(360deg); }
}
.milestone-emoji.anim-sparkle {
  animation: mAnimSparkle 2.2s ease-in-out infinite;
}
@keyframes mAnimSparkle {
  0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; }
  25% { transform: scale(1.2) rotate(10deg); opacity: 0.75; }
  50% { transform: scale(1) rotate(0deg); opacity: 1; }
  75% { transform: scale(1.15) rotate(-10deg); opacity: 0.75; }
}
.milestone-emoji.anim-shine {
  animation: mAnimShine 3s ease-in-out infinite;
}
@keyframes mAnimShine {
  0%, 100% { opacity: 1; filter: brightness(1); }
  50% { opacity: 0.7; filter: brightness(1.35); }
}
.milestone-emoji.anim-shimmer {
  animation: mAnimShimmer 3s ease-in-out infinite;
}
@keyframes mAnimShimmer {
  0%, 100% { transform: scale(1); filter: brightness(1) hue-rotate(0deg); }
  50% { transform: scale(1.08); filter: brightness(1.25) hue-rotate(15deg); }
}
.milestone-emoji.anim-still {
  animation: none;
  transform: scale(1);
}
/* Respect prefers-reduced-motion — stop all ambient animations. */
@media (prefers-reduced-motion: reduce) {
  .milestone-emoji {
    animation: none !important;
    transform: scale(1) !important;
  }
}
.milestone-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text);
  line-height: 1;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.milestone-check {
  color: var(--success);
  flex-shrink: 0;
  animation: milestonePop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
@keyframes milestonePop {
  from { transform: scale(0.3); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.milestone-body {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.milestone-value {
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--text);
  line-height: 1;
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
}
.milestone-pct-sign {
  font-size: 18px;
  font-weight: 700;
  color: var(--muted);
  letter-spacing: 0;
  margin-inline-start: 2px;
}
.milestone-card.reached .milestone-value {
  color: var(--success);
}

.milestone-progress {
  position: relative;
  height: 8px;
  background: color-mix(in srgb, var(--tile-fg, var(--brand)) 14%, transparent);
  border-radius: 999px;
  overflow: hidden;
}
.milestone-progress-fill {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--tile-fg, var(--brand)) 100%, transparent),
    color-mix(in srgb, var(--tile-fg, var(--brand)) 65%, transparent)
  );
  width: 0;
  animation: milestoneFill 1.1s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(var(--i, 0) * 60ms + 120ms);
}
@keyframes milestoneFill {
  from { width: 0; }
  to { width: var(--fill, 0%); }
}
.milestone-card.reached .milestone-progress-fill {
  background: linear-gradient(
    90deg,
    var(--success),
    color-mix(in srgb, var(--success) 65%, transparent)
  );
}
/* Subtle shimmer on active (not-yet-reached) progress. Fires once per
   render so it draws the eye when the section first opens. */
.milestone-progress-fill::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.4),
    transparent
  );
  transform: translateX(-100%);
  animation: milestoneShimmer 1.6s ease-out 0.9s both;
}
.milestone-card.reached .milestone-progress-fill::after {
  animation: none;
  display: none;
}
@keyframes milestoneShimmer {
  from { transform: translateX(-100%); }
  to { transform: translateX(200%); }
}

.milestone-sub {
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.milestone-card.reached .milestone-sub {
  color: var(--success);
}

/* Header row — mode toggle stretches, action icons cluster on the
   right. Same-line placement means the two most common non-log
   actions (open full report, share) are always one tap away and
   the old "bottom actions" scroll target is gone. */
.home-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.home-header > :first-child {
  flex: 1;
  min-width: 0;
}
.header-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.icon-btn {
  appearance: none;
  border: none;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--surface-tint);
  color: var(--muted);
  font-family: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.1s ease, background 0.15s ease, color 0.15s ease;
}
.icon-btn:hover {
  color: var(--text);
}
.icon-btn:active {
  transform: scale(0.94);
  background: color-mix(in srgb, var(--text) 8%, var(--surface-tint));
}
</style>
