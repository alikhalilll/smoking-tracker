// Liquid Glass design tokens — single source of truth for every
// parameter named in src/lib/liquidGlass/SPEC.md. Components must
// import from this file rather than redefining their own constants
// so the system stays internally consistent.
//
// All four article-exposed parameters (Blur Level, Specular Opacity,
// Specular Saturation, Refraction Level) are surfaced here with the
// article's defaults. Components accept matching props with these
// defaults so per-instance overrides remain possible.

import type { SurfaceName } from './surfaceEquations'

export interface LiquidFilterParams {
  /** Gaussian blur stdDeviation fed to feGaussianBlur. Article: 0.2. */
  blur: number
  /** Specular highlight opacity. Article: 0.5. */
  specularOpacity: number
  /** Specular saturation, used by feColorMatrix saturate. Article: 6. */
  specularSaturation: number
  /** Refraction multiplier on the displacement scale. Article: 1. */
  refractionBase: number
}

export interface LiquidGeometryParams {
  surface: SurfaceName
  bezelWidth: number
  glassThickness: number
  refractiveIndex: number
  thumbRestScale: number
  thumbActiveScale: number
}

export interface SpringConfig {
  stiffness: number
  damping: number
  mass?: number
}

export interface LiquidSpringSet {
  /** Thumb x-axis position. */
  xRatio: SpringConfig
  /** Thumb CSS transform: scale(). */
  thumbScale: SpringConfig
  /** Thumb backgroundColor opacity (white fade-out on press). */
  thumbBgOpacity: SpringConfig
  /** considerChecked → track color crossfade. */
  considerChecked: SpringConfig
  /** SVG `<feDisplacementMap>` scale attribute. */
  filterScale: SpringConfig
}

/**
 * Article-faithful defaults. Toggle.vue / LiquidSegmented.vue /
 * LiquidPress.vue all use these unless an explicit prop overrides.
 */
// bezel: 28,
//     glassThickness: 80,
//     refractiveIndex: 1.5,
//     blur: 0.2,
//     specularOpacity: 0.5,
    // saturation: 6,
export const LIQUID_INPUT_TOKENS = {
  filter: {
    blur: 0.2,
    specularOpacity: 0.5,
    specularSaturation: 6,
    refractionBase: 1.5,
  } as LiquidFilterParams,

  geometry: {
    surface: 'lip',
    bezelWidth: 19,
    glassThickness: 47,
    refractiveIndex: 1.5,
    thumbRestScale: 0.65,
    thumbActiveScale: 0.9,
  } as LiquidGeometryParams,

  /**
   * Spring stiffness/damping per animated value, copied verbatim from
   * Switch.tsx's useSpring calls. See SPEC.md §3.
   */
  springs: {
    xRatio: { stiffness: 1000, damping: 80 },
    thumbScale: { stiffness: 2000, damping: 80 },
    thumbBgOpacity: { stiffness: 2000, damping: 80 },
    considerChecked: { stiffness: 1000, damping: 80 },
    filterScale: { stiffness: 1000, damping: 80 },
  } as LiquidSpringSet,

  /**
   * Drag math constants. Same dx threshold and overflow damping as
   * the article — see SPEC.md §5.3.
   */
  drag: {
    /** px below which a release is treated as a tap, not a drag. */
    tapThreshold: 4,
    /** Divisor for dampedOverflow at the rubber-band ends. */
    overflowDamping: 22,
  },

  /**
   * Track colour CSS variable references for the binary switch. The
   * actual hex values live in src/styles/main.css and differ per
   * theme so the switch reads correctly in light + dark mode;
   * Toggle.vue crossfades them with `color-mix()` driven by the
   * considerChecked spring. Don't inline a hex value here — it would
   * defeat theming.
   */
  switchTrack: {
    off: 'var(--switch-track-off)',
    on: 'var(--switch-track-on)',
  },
} as const

/**
 * Build the full options object for v-liquid-glass from the tokens,
 * with optional per-component overrides. Used by all three components.
 */
export function liquidFilterOptions(
  overrides: Partial<LiquidFilterParams & LiquidGeometryParams> & {
    forceActive?: boolean
    /**
     * Continuous filter scale ratio (e.g. spring-driven) — when
     * provided, multiplies into scaleStates so the
     * (0.4 + 0.5·active)·refractionBase formula holds.
     */
    refractionRatio?: number
  } = {}
) {
  const f = { ...LIQUID_INPUT_TOKENS.filter, ...overrides }
  const g = { ...LIQUID_INPUT_TOKENS.geometry, ...overrides }
  const base = f.refractionBase

  return {
    surface: g.surface,
    bezel: g.bezelWidth,
    glassThickness: g.glassThickness,
    refractiveIndex: g.refractiveIndex,
    blur: f.blur,
    specularOpacity: f.specularOpacity,
    saturation: f.specularSaturation,
    chain: '',
    // The article's continuous formula is `(0.4 + 0.5·active)·base`.
    // We feed the directive the idle/active endpoints (multiplied by
    // refractionBase) and let it spring between them via forceActive.
    scaleStates: {
      idle: 0.4 * base,
      hover: 0.4 * base,
      active: 0.9 * base,
    },
    forceActive: overrides.forceActive ?? false,
  }
}
