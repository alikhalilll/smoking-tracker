<template>
  <div ref="host" class="confetti-host" aria-hidden="true"></div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

interface Props {
  /** Bump this to fire a new burst. */
  trigger: number | string
  /** Number of particles. Default 16. */
  count?: number
}

const props = defineProps<Props>()
const host = ref<HTMLDivElement | null>(null)

const COLORS = [
  '#FF7A3D',
  '#FFB070',
  '#7C5CFF',
  '#22C55E',
  '#FBBF24',
  '#5B8DEF',
]

watch(
  () => props.trigger,
  () => {
    if (!host.value) return
    const root = host.value
    const count = props.count ?? 16
    for (let i = 0; i < count; i++) {
      const el = document.createElement('span')
      el.className = 'confetti-particle'
      const x0 = (Math.random() - 0.5) * 40
      const x1 = (Math.random() - 0.5) * 240
      el.style.setProperty('--x0', `${x0}px`)
      el.style.setProperty('--x1', `${x1}px`)
      el.style.background = COLORS[i % COLORS.length]
      el.style.animationDelay = `${Math.random() * 80}ms`
      el.style.left = `${50 + (Math.random() - 0.5) * 20}%`
      el.style.width = `${6 + Math.random() * 6}px`
      el.style.height = `${10 + Math.random() * 8}px`
      el.style.borderRadius = `${Math.random() > 0.5 ? '2px' : '50%'}`
      root.appendChild(el)
      setTimeout(() => el.remove(), 1400)
    }
  }
)
</script>

<style scoped>
.confetti-host {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: visible;
}
:deep(.confetti-particle) {
  position: absolute;
  top: 50%;
  display: block;
  animation: confetti-fall 1.2s ease-out forwards;
  will-change: transform, opacity;
}
</style>
