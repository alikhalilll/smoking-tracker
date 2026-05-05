import type { Directive } from 'vue'

/**
 * Lightweight scroll-reveal — fade + lift + de-blur an element when
 * it first crosses the viewport edge. Inspired by the editorial AI
 * landing pages where each section gently composes itself into place
 * as the user scrolls. One IntersectionObserver is shared across the
 * whole app, and each element is only revealed once.
 *
 * Usage:
 *   <section v-reveal>…</section>
 *   <section v-reveal:up>…</section>           // explicit direction
 *   <section v-reveal="{ delay: 120 }">…</section>
 *
 * Honors `prefers-reduced-motion` — the element is visible
 * immediately without any transform/blur.
 */

export interface RevealOptions {
  /** ms delay before the reveal transition kicks off. Default 0. */
  delay?: number
}

const REVEAL_CLASS = 'reveal'
const SHOWN_CLASS = 'is-revealed'

let observer: IntersectionObserver | null = null

function ensureObserver(): IntersectionObserver | null {
  if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
    return null
  }
  if (observer) return observer
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add(SHOWN_CLASS)
          observer?.unobserve(entry.target)
        }
      }
    },
    {
      threshold: 0.12,
      // Trigger slightly *before* the bottom edge so the section is
      // already mid-fade by the time it's fully on screen — feels
      // more anticipatory than reactive.
      rootMargin: '0px 0px -8% 0px',
    }
  )
  return observer
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export const vReveal: Directive<HTMLElement, RevealOptions | undefined> = {
  mounted(el, binding) {
    if (prefersReducedMotion()) {
      el.classList.add(REVEAL_CLASS, SHOWN_CLASS)
      return
    }
    const delay = binding.value?.delay ?? 0
    if (delay > 0) {
      el.style.transitionDelay = `${delay}ms`
    }
    el.classList.add(REVEAL_CLASS)
    const obs = ensureObserver()
    if (!obs) {
      // No IO support — show immediately rather than leaving the
      // element invisible.
      el.classList.add(SHOWN_CLASS)
      return
    }
    obs.observe(el)
  },
  unmounted(el) {
    observer?.unobserve(el)
  },
}
