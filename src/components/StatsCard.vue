<template>
  <div
    class="stats-card"
    :class="[
      `tint-${tint}`,
      { 'stats-card-wide': wide, 'stats-card-flourish': $slots.flourish },
    ]"
  >
    <span v-if="$slots.flourish" class="stats-flourish" aria-hidden="true">
      <slot name="flourish" />
    </span>
    <div class="stats-pill">
      <span class="stats-icon" aria-hidden="true">
        <slot name="icon" />
      </span>
      <span class="stats-label">{{ label }}</span>
      <slot name="badge" />
    </div>
    <div class="stats-body">
      <div class="stats-value tabular">
        <slot name="value">{{ value }}</slot>
      </div>
      <div v-if="$slots.default || sub" class="stats-sub">
        <slot>{{ sub }}</slot>
      </div>
    </div>
    <div v-if="$slots.footer" class="stats-footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Tinted metric tile — the single card style used across the app
 * (home insight grid, history overview, quit progress, report summary,
 * health milestones). One source of truth for the "pill header + big
 * number + subtitle" pattern that the reference screenshots pushed us
 * toward.
 *
 * Slots:
 * - icon    — small SVG glyph shown in the pill
 * - value   — optional override for the big number (else the `value` prop)
 * - default — subtitle body (else the `sub` prop)
 * - flourish — optional decorative SVG placed behind the content
 * - badge   — inline element after the label (e.g. a check icon)
 * - footer  — extra row beneath the body (e.g. a progress bar)
 */
export type StatsCardTint = 'peach' | 'lavender' | 'mint' | 'sun'

defineProps<{
  tint: StatsCardTint
  label: string
  value?: string | number
  sub?: string
  /** Card spans two grid columns (used for money / totals rows). */
  wide?: boolean
}>()
</script>

<style scoped>
.stats-card {
  position: relative;
  padding: 16px 18px 20px;
  border-radius: 22px;
  border: 1px solid var(--hairline);
  box-shadow: var(--shadow-sm);
  background: var(--card);
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  overflow: hidden;
  isolation: isolate;
  transition: transform 0.15s ease, box-shadow 0.2s ease;
}
.stats-card:active {
  transform: scale(0.98);
}
.stats-card-wide {
  grid-column: 1 / -1;
}

/* Decorative flourish sits behind the content. Owning cards pass the
   SVG via the `flourish` slot — this rule handles positioning and
   the muted tint pickup. */
.stats-flourish {
  position: absolute;
  right: -18px;
  bottom: -18px;
  width: 130px;
  height: 130px;
  color: var(--tile-fg, var(--brand));
  opacity: 0.14;
  z-index: 0;
  pointer-events: none;
}
.stats-flourish :deep(svg) {
  width: 100%;
  height: 100%;
}

.stats-pill {
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
.stats-icon {
  width: 26px;
  height: 26px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--tile-fg, var(--brand)) 18%, transparent);
  color: var(--tile-fg, var(--brand));
  flex-shrink: 0;
}
.stats-icon :deep(svg) {
  width: 15px;
  height: 15px;
}
.stats-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text);
  line-height: 1;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.stats-body {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.stats-value {
  font-size: 44px;
  font-weight: 800;
  letter-spacing: -0.04em;
  color: var(--text);
  line-height: 1;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.stats-card-wide .stats-value {
  font-size: 38px;
}
.stats-sub {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  line-height: 1.2;
  letter-spacing: 0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stats-footer {
  position: relative;
  z-index: 1;
}

/* Tint pairs from the design system. `--tile-fg` drives icon + flourish
   + focus color for consumers via slotted content. */
.stats-card.tint-peach {
  background: var(--tint-peach-bg);
  border-color: transparent;
  --tile-fg: var(--tint-peach-fg);
}
.stats-card.tint-lavender {
  background: var(--tint-lavender-bg);
  border-color: transparent;
  --tile-fg: var(--tint-lavender-fg);
}
.stats-card.tint-mint {
  background: var(--tint-mint-bg);
  border-color: transparent;
  --tile-fg: var(--tint-mint-fg);
}
.stats-card.tint-sun {
  background: var(--tint-sun-bg);
  border-color: transparent;
  --tile-fg: var(--tint-sun-fg);
}
</style>
