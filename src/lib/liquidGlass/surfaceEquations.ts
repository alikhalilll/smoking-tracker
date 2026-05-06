// Surface curves for the bezel of a Liquid Glass element.
// Ported from kube.io's article (lib/surfaceEquations.ts).
//
// Each surface is a 1D height function of x in [0, 1] returning a
// y in [0, 1] that describes the bezel cross-section. CONVEX gives a
// rounded-button feel, CONCAVE caves the surface inward, LIP combines
// both so the centre looks "zoomed out" while the edges refract — used
// by the Switch in the original article.

export type SurfaceFn = (x: number) => number

export const CONVEX_CIRCLE: SurfaceFn = (x) =>
  Math.sqrt(1 - (1 - x) ** 2)

export const CONVEX: SurfaceFn = (x) =>
  Math.pow(1 - Math.pow(1 - x, 4), 1 / 4)

export const CONCAVE: SurfaceFn = (x) => 1 - CONVEX_CIRCLE(x)

export const LIP: SurfaceFn = (x) => {
  const convex = CONVEX(x * 2)
  const concave = CONCAVE(x) + 0.1
  const smootherstep = 6 * x ** 5 - 15 * x ** 4 + 10 * x ** 3
  return convex * (1 - smootherstep) + concave * smootherstep
}

export const surfaces = {
  convex: CONVEX,
  'convex-circle': CONVEX_CIRCLE,
  concave: CONCAVE,
  lip: LIP,
} as const

export type SurfaceName = keyof typeof surfaces
