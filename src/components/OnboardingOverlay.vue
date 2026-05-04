<template>
  <Teleport to="body">
    <Transition name="onb-fade">
      <div
        v-if="onboarding.active.value"
        class="onb-root"
        role="dialog"
        aria-modal="true"
      >
        <!-- Four dim rects forming a hole around the spotlight. The
             dimmed area blocks stray taps; the spotlight gap lets the
             user actually interact with the highlighted control if
             they want to (soft nudge — no forcing). -->
        <template v-if="rect">
          <div class="onb-mask" :style="topStyle" />
          <div class="onb-mask" :style="bottomStyle" />
          <div class="onb-mask" :style="leftStyle" />
          <div class="onb-mask" :style="rightStyle" />
          <div class="onb-ring" :style="ringStyle" aria-hidden="true" />
        </template>
        <div v-else class="onb-mask onb-mask-full" />

        <!-- Tooltip card. Confetti fires on every step transition;
             the inner content swaps via a keyed transition for a
             fresh slide-in feel; the outer card transitions between
             positions for smooth motion. -->
        <div
          ref="tipRef"
          class="onb-tip"
          :class="{ 'onb-tip-hero': !rect }"
          :style="tipStyle"
        >
          <Confetti :trigger="onboarding.confettiTick.value" :count="!rect ? 36 : 22" />

          <button
            class="onb-tip-close"
            :aria-label="t('onboarding.close')"
            @click="onboarding.exit()"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>

          <!-- Progress bar — fills as the user advances. -->
          <div class="onb-progress" :aria-label="t('onboarding.close')">
            <div
              class="onb-progress-fill"
              :style="{ width: progressPct + '%' }"
            />
          </div>

          <Transition name="onb-step" mode="out-in">
            <div
              v-if="step"
              :key="onboarding.stepIndex.value"
              class="onb-tip-content"
            >
              <div class="onb-tip-eyebrow">
                <span class="onb-eyebrow-dot" />
                <span class="onb-eyebrow-text">
                  {{ t('onboarding.step_of', {
                    n: onboarding.stepIndex.value + 1,
                    total: onboarding.steps.value.length,
                  }) }}
                </span>
              </div>
              <h2 class="onb-tip-title">{{ t(step.titleKey) }}</h2>
              <p class="onb-tip-body">{{ t(step.bodyKey) }}</p>
              <button
                v-if="onboarding.hasChildren.value"
                class="onb-explore-btn"
                @click="onboarding.exploreChildren()"
              >
                <span>{{ t('onboarding.explore_more') }}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline :points="isRtl ? '15 18 9 12 15 6' : '9 18 15 12 9 6'"/>
                </svg>
              </button>
            </div>
          </Transition>

          <div class="onb-tip-actions">
            <button
              v-if="!onboarding.isFirst.value"
              class="onb-icon-btn"
              :aria-label="t('onboarding.back')"
              @click="onboarding.prev()"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline :points="isRtl ? '9 18 15 12 9 6' : '15 18 9 12 15 6'"/>
              </svg>
            </button>
            <div class="onb-actions-spacer" />
            <button
              v-if="!onboarding.isLast.value"
              class="onb-skip-btn"
              @click="onboarding.next()"
            >
              {{ t('onboarding.skip') }}
            </button>
            <button class="onb-next-btn" @click="onboarding.next()">
              <span>{{
                onboarding.isLast.value
                  ? t('onboarding.done')
                  : t('onboarding.next')
              }}</span>
              <svg
                v-if="!onboarding.isLast.value"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.4"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline :points="isRtl ? '15 18 9 12 15 6' : '9 18 15 12 9 6'"/>
              </svg>
              <span v-else class="onb-done-spark" aria-hidden="true">🎉</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import { useI18n } from '../i18n'
import { useOnboarding } from '../composables/useOnboarding'
import Confetti from './Confetti.vue'

const { t, isRtl } = useI18n()
const onboarding = useOnboarding()
const step = computed(() => onboarding.step.value)

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

const rect = ref<Rect | null>(null)
const viewport = ref({ w: 0, h: 0 })
const RING_PAD = 8
const TIP_GAP = 16
const VP_MARGIN = 12

const tipRef = ref<HTMLDivElement | null>(null)
// Real tooltip dimensions, populated by a ResizeObserver. Falling
// back to a conservative estimate before the first measurement so
// the very first paint isn't completely off.
const tipSize = ref({ w: 320, h: 220 })

let raf = 0
let pollTimer: ReturnType<typeof setInterval> | null = null
let tipObserver: ResizeObserver | null = null

function readViewport(): void {
  if (typeof window === 'undefined') return
  viewport.value = { w: window.innerWidth, h: window.innerHeight }
}

function ensureVisible(el: HTMLElement, r: DOMRect): void {
  if (typeof window === 'undefined') return
  const vh = window.innerHeight
  // Margin so the spotlight ring + the tooltip have breathing room.
  const margin = 110
  if (r.top < margin || r.bottom > vh - margin) {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }
}

function measure(opts: { scroll?: boolean } = {}): void {
  const s = step.value
  if (!s || !s.selector) {
    rect.value = null
    return
  }
  const el = document.querySelector(s.selector) as HTMLElement | null
  if (!el) {
    rect.value = null
    return
  }
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) {
    rect.value = null
    return
  }
  if (opts.scroll) ensureVisible(el, r)
  rect.value = {
    top: r.top,
    left: r.left,
    width: r.width,
    height: r.height,
  }
}

function scheduleMeasure(): void {
  if (raf) cancelAnimationFrame(raf)
  raf = requestAnimationFrame(() => {
    measure()
  })
}

function onScrollOrResize(): void {
  readViewport()
  scheduleMeasure()
}

function chaseTarget(): void {
  if (pollTimer) clearInterval(pollTimer)
  measure({ scroll: true })
  if (rect.value) return
  let tries = 0
  pollTimer = setInterval(() => {
    tries++
    measure({ scroll: true })
    if (rect.value || tries >= 20) {
      if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
      }
    }
  }, 50)
}

watch(
  () => onboarding.stepIndex.value,
  () => {
    nextTick(chaseTarget)
  }
)
watch(
  () => onboarding.active.value,
  (v) => {
    if (v) nextTick(chaseTarget)
    else rect.value = null
  }
)

onMounted(() => {
  if (typeof window === 'undefined') return
  readViewport()
  window.addEventListener('scroll', onScrollOrResize, true)
  window.addEventListener('resize', onScrollOrResize)
  if (onboarding.active.value) nextTick(chaseTarget)
})
onUnmounted(() => {
  if (typeof window === 'undefined') return
  window.removeEventListener('scroll', onScrollOrResize, true)
  window.removeEventListener('resize', onScrollOrResize)
  if (raf) cancelAnimationFrame(raf)
  if (pollTimer) clearInterval(pollTimer)
  tipObserver?.disconnect()
  tipObserver = null
})

// Track the tooltip's real dimensions so the placement math uses
// the actual rendered height — long bodies wrap on narrow phones and
// our old 230px estimate routinely under-counted, putting the
// tooltip's bottom edge off-screen.
watch(tipRef, (el) => {
  tipObserver?.disconnect()
  tipObserver = null
  if (!el || typeof ResizeObserver === 'undefined') return
  tipObserver = new ResizeObserver(() => {
    if (!tipRef.value) return
    const w = tipRef.value.offsetWidth
    const h = tipRef.value.offsetHeight
    if (w !== tipSize.value.w || h !== tipSize.value.h) {
      tipSize.value = { w, h }
    }
  })
  tipObserver.observe(el)
})

const progressPct = computed(() => {
  const total = Math.max(1, onboarding.steps.value.length)
  return ((onboarding.stepIndex.value + 1) / total) * 100
})

// === Mask rect styles ===
const topStyle = computed(() => {
  const r = rect.value
  if (!r) return {}
  return {
    top: '0px',
    left: '0px',
    width: '100%',
    height: `${Math.max(0, r.top - RING_PAD)}px`,
  }
})
const bottomStyle = computed(() => {
  const r = rect.value
  if (!r) return {}
  const top = r.top + r.height + RING_PAD
  return {
    top: `${top}px`,
    left: '0px',
    width: '100%',
    height: `${Math.max(0, viewport.value.h - top)}px`,
  }
})
const leftStyle = computed(() => {
  const r = rect.value
  if (!r) return {}
  return {
    top: `${Math.max(0, r.top - RING_PAD)}px`,
    left: '0px',
    width: `${Math.max(0, r.left - RING_PAD)}px`,
    height: `${r.height + RING_PAD * 2}px`,
  }
})
const rightStyle = computed(() => {
  const r = rect.value
  if (!r) return {}
  const left = r.left + r.width + RING_PAD
  return {
    top: `${Math.max(0, r.top - RING_PAD)}px`,
    left: `${left}px`,
    width: `${Math.max(0, viewport.value.w - left)}px`,
    height: `${r.height + RING_PAD * 2}px`,
  }
})
const ringStyle = computed(() => {
  const r = rect.value
  if (!r) return {}
  return {
    top: `${r.top - RING_PAD}px`,
    left: `${r.left - RING_PAD}px`,
    width: `${r.width + RING_PAD * 2}px`,
    height: `${r.height + RING_PAD * 2}px`,
  }
})

// Tooltip placement uses the measured tooltip height (tipSize) so the
// math reflects what's actually rendered. Final `top` is hard-clamped
// to [VP_MARGIN, vh - tipH - VP_MARGIN] — and a max-height + scroll
// fallback in CSS ensures even an oversized tooltip never extends past
// the viewport.
const TIP_W = 340
const tipStyle = computed(() => {
  const vw = viewport.value.w
  const vh = viewport.value.h
  const r = rect.value
  const tipW = Math.min(TIP_W, vw - 16)
  const tipH = Math.min(tipSize.value.h, vh - VP_MARGIN * 2)

  if (!r) {
    return {
      left: `${Math.max(8, (vw - tipW) / 2)}px`,
      top: `${Math.max(VP_MARGIN, (vh - tipH) / 2)}px`,
      width: `${tipW}px`,
    }
  }

  const spaceBelow = vh - (r.top + r.height + RING_PAD) - VP_MARGIN
  const spaceAbove = r.top - RING_PAD - VP_MARGIN
  const fitsBelow = spaceBelow >= tipH + TIP_GAP
  const fitsAbove = spaceAbove >= tipH + TIP_GAP

  let top: number
  if (fitsBelow) {
    top = r.top + r.height + RING_PAD + TIP_GAP
  } else if (fitsAbove) {
    top = r.top - RING_PAD - TIP_GAP - tipH
  } else {
    // Neither side has natural room — pick the side with more space
    // and let the final clamp + CSS max-height handle overflow. The
    // tooltip will overlap the spotlight slightly rather than spill
    // off-screen.
    top =
      spaceBelow >= spaceAbove
        ? r.top + r.height + RING_PAD + TIP_GAP
        : r.top - RING_PAD - TIP_GAP - tipH
  }

  // Hard clamp into viewport so the tooltip is always fully on-screen.
  const maxTop = Math.max(VP_MARGIN, vh - tipH - VP_MARGIN)
  top = Math.max(VP_MARGIN, Math.min(maxTop, top))

  const centerX = r.left + r.width / 2
  const left = Math.max(8, Math.min(vw - tipW - 8, centerX - tipW / 2))
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${tipW}px`,
  }
})
</script>

<style scoped>
.onb-root {
  position: fixed;
  inset: 0;
  /* Above the floating nav (z:100), below the sheet drawer (z:200) so
     the AuthModal renders on top during the sign-in step. */
  z-index: 150;
  pointer-events: none;
}

/* === Dim mask ===
   Lowered to a soft veil (~38%) so the spotlight pops but the rest of
   the page stays clearly visible — the tour reads as an accent over
   the UI rather than a curtain blocking it out. */
.onb-mask {
  position: fixed;
  background: rgba(14, 12, 22, 0.38);
  pointer-events: auto;
  transition:
    top 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    left 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    width 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.onb-mask-full {
  inset: 0;
}

/* === Spotlight ring (brand→accent gradient pulse) === */
.onb-ring {
  position: fixed;
  border-radius: 18px;
  pointer-events: none;
  background: transparent;
  /* The glow lives entirely in box-shadow so it radiates OUTWARD
     from the ring perimeter — never covering the highlighted
     element's content. A heartbeat pulse rolls through the shadow
     so the highlight gently breathes without obscuring anything. */
  border: 2px solid var(--brand);
  animation:
    onb-ring-arrive 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.4) both,
    onb-ring-pulse 1.8s ease-in-out infinite;
  transition:
    top 0.45s cubic-bezier(0.4, 0, 0.2, 1),
    left 0.45s cubic-bezier(0.4, 0, 0.2, 1),
    width 0.45s cubic-bezier(0.4, 0, 0.2, 1),
    height 0.45s cubic-bezier(0.4, 0, 0.2, 1);
}

/* === Tooltip card === */
.onb-tip {
  position: fixed;
  pointer-events: auto;
  background: var(--card);
  color: var(--text);
  border-radius: 22px;
  padding: 18px 20px 16px;
  box-shadow:
    0 24px 60px rgba(20, 14, 36, 0.32),
    0 4px 14px rgba(20, 14, 36, 0.14);
  display: flex;
  flex-direction: column;
  gap: 10px;
  /* Last-resort guarantee that the tooltip never extends past the
     viewport. The placement math already fits it inside the screen
     using the measured height; this caps overlong content so the
     user can scroll within the card on small phones. */
  max-height: calc(100dvh - 24px);
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  transition:
    top 0.45s cubic-bezier(0.4, 0, 0.2, 1),
    left 0.45s cubic-bezier(0.4, 0, 0.2, 1);
}
/* Decorative gradient band along the top edge — gives the card a
   warm, friendly identity instead of a flat neutral panel. */
.onb-tip::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 4px;
  background: linear-gradient(
    90deg,
    var(--brand-grad-from),
    var(--accent-warm),
    var(--accent)
  );
  opacity: 0.95;
}

.onb-tip-hero {
  padding: 28px 24px 20px;
  background: linear-gradient(
    160deg,
    var(--card) 0%,
    color-mix(in srgb, var(--brand) 6%, var(--card)) 60%,
    color-mix(in srgb, var(--accent) 8%, var(--card)) 100%
  );
}
.onb-tip-hero .onb-tip-title { font-size: 22px; }
.onb-tip-hero .onb-tip-body { font-size: 14px; }

/* Close × — small, subtle, top-right. */
.onb-tip-close {
  position: absolute;
  top: 10px;
  inset-inline-end: 10px;
  appearance: none;
  border: none;
  background: var(--surface-tint);
  color: var(--muted);
  width: 26px;
  height: 26px;
  border-radius: 50%;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  z-index: 2;
  transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
}
.onb-tip-close:hover { color: var(--text); }
.onb-tip-close:active {
  background: var(--hairline);
  color: var(--text);
  transform: scale(0.92);
}

/* Progress bar — ticks along as you advance. */
.onb-progress {
  position: relative;
  height: 6px;
  border-radius: 999px;
  background: var(--surface-tint);
  overflow: hidden;
  margin-top: 4px;
  margin-inline-end: 36px; /* leave room for the close × */
}
.onb-progress-fill {
  position: absolute;
  inset-inline-start: 0;
  top: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    var(--brand-grad-from),
    var(--brand-grad-to)
  );
  border-radius: 999px;
  transition: width 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
  box-shadow: 0 0 12px color-mix(in srgb, var(--brand) 60%, transparent);
}

/* Step content (everything that swaps when stepIndex changes). */
.onb-tip-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.onb-tip-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--brand);
  text-transform: uppercase;
}
.onb-eyebrow-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--brand);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--brand) 22%, transparent);
  animation: onb-eyebrow-pulse 1.6s ease-in-out infinite;
}
.onb-tip-title {
  font-size: 19px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.22;
  color: var(--text);
  margin: 0;
}
.onb-tip-body {
  font-size: 13.5px;
  color: var(--muted);
  line-height: 1.55;
  margin: 0;
}
/* "Explore <page>" CTA — only renders when the parent step has
   children. Inviting brand-coral link with a chevron that nudges. */
.onb-explore-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  appearance: none;
  border: 1.5px solid color-mix(in srgb, var(--brand) 32%, transparent);
  background: color-mix(in srgb, var(--brand) 8%, transparent);
  color: var(--brand);
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 700;
  padding: 7px 12px;
  border-radius: 999px;
  cursor: pointer;
  margin-top: 6px;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.12s ease;
}
.onb-explore-btn:hover {
  background: color-mix(in srgb, var(--brand) 14%, transparent);
  border-color: color-mix(in srgb, var(--brand) 50%, transparent);
}
.onb-explore-btn:active { transform: scale(0.97); }
.onb-explore-btn svg {
  animation: onb-explore-nudge 1.6s ease-in-out infinite;
}
@keyframes onb-explore-nudge {
  0%, 100% { transform: translateX(0); }
  50%      { transform: translateX(3px); }
}

/* Actions row */
.onb-tip-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}
.onb-actions-spacer {
  flex: 1;
}
.onb-icon-btn {
  appearance: none;
  border: none;
  background: var(--surface-tint);
  color: var(--muted);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
}
.onb-icon-btn:hover { color: var(--text); }
.onb-icon-btn:active {
  background: var(--hairline);
  color: var(--text);
  transform: scale(0.92);
}
.onb-skip-btn {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--muted);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 12px;
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.onb-skip-btn:hover {
  background: var(--surface-tint);
  color: var(--text);
}
.onb-next-btn {
  appearance: none;
  border: none;
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 700;
  padding: 10px 16px;
  border-radius: 999px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #fff;
  background: linear-gradient(
    135deg,
    var(--brand-grad-from),
    var(--brand-grad-to)
  );
  box-shadow:
    0 6px 18px rgba(255, 122, 61, 0.42),
    inset 0 1px 0 rgba(255, 255, 255, 0.18);
  transition: transform 0.12s ease, box-shadow 0.15s ease;
}
.onb-next-btn:hover {
  transform: translateY(-1px);
  box-shadow:
    0 10px 24px rgba(255, 122, 61, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.22);
}
.onb-next-btn:active { transform: scale(0.97); }
.onb-done-spark {
  font-size: 14px;
  line-height: 1;
  display: inline-block;
  animation: onb-spark 1s ease-in-out infinite;
}

/* === Outer overlay enter/leave (Vue Transition "onb-fade") === */
.onb-fade-enter-active,
.onb-fade-leave-active {
  transition: opacity 0.25s ease;
}
.onb-fade-enter-active .onb-tip,
.onb-fade-enter-active .onb-mask,
.onb-fade-enter-active .onb-ring {
  animation: none;
}
.onb-fade-enter-from,
.onb-fade-leave-to {
  opacity: 0;
}

/* === Step content swap (Vue Transition "onb-step") === */
.onb-step-enter-active,
.onb-step-leave-active {
  transition: opacity 0.28s ease, transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.onb-step-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.onb-step-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

@keyframes onb-ring-arrive {
  0% {
    transform: scale(0.86);
    opacity: 0;
  }
  60% {
    transform: scale(1.06);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
@keyframes onb-ring-pulse {
  0%, 100% {
    box-shadow:
      0 0 0 4px color-mix(in srgb, var(--brand) 12%, transparent),
      0 0 22px 2px color-mix(in srgb, var(--brand) 18%, transparent);
  }
  50% {
    box-shadow:
      0 0 0 9px color-mix(in srgb, var(--brand) 8%, transparent),
      0 0 38px 6px color-mix(in srgb, var(--brand) 32%, transparent);
  }
}
@keyframes onb-eyebrow-pulse {
  0%, 100% {
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--brand) 22%, transparent);
  }
  50% {
    box-shadow: 0 0 0 7px color-mix(in srgb, var(--brand) 12%, transparent);
  }
}
@keyframes onb-spark {
  0%, 100% { transform: rotate(-6deg) scale(1); }
  50%      { transform: rotate(8deg) scale(1.15); }
}

@media (max-width: 360px) {
  .onb-tip { padding: 16px 16px 14px; border-radius: 18px; }
  .onb-tip-title { font-size: 17px; }
  .onb-tip-hero .onb-tip-title { font-size: 20px; }
}
</style>
