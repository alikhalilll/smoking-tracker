<template>
  <span
    class="avatar"
    :class="size === 'lg' ? 'avatar-lg' : size === 'sm' ? 'avatar-sm' : ''"
    :style="{ backgroundImage: gradient }"
    :aria-label="name"
  >
    {{ initials }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  /** Display name. Initials are derived from the first 1-2 words. */
  name: string
  /** Stable id used to pick a deterministic gradient. */
  seed?: string
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  seed: '',
})

// 8 hand-picked gradient pairs, warm-leaning to fit the brand.
const PALETTES: Array<[string, string]> = [
  ['#FF7A3D', '#FFB070'], // coral
  ['#7C5CFF', '#5B8DEF'], // indigo
  ['#22C55E', '#A8E6CF'], // mint
  ['#F59E0B', '#FBBF24'], // sun
  ['#EF4444', '#F87171'], // crimson
  ['#06B6D4', '#67E8F9'], // cyan
  ['#A855F7', '#D8B4FE'], // violet
  ['#EC4899', '#F9A8D4'], // pink
]

function hash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

const initials = computed(() => {
  const parts = props.name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
})

const gradient = computed(() => {
  const key = (props.seed || props.name) ?? '?'
  const [a, b] = PALETTES[hash(key) % PALETTES.length]
  return `linear-gradient(135deg, ${a}, ${b})`
})
</script>
