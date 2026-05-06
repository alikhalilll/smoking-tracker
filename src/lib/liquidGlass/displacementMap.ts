// Snell's-law refraction displacement map generator.
// Ported from kube.io's article (lib/displacementMap.ts).
//
// 1) `calculate1DDisplacement` precomputes how far an orthogonal ray is
//    laterally deviated as a function of distance into the bezel
//    (sampled along x in [0, 1]). This is independent of element size.
// 2) `buildDisplacementImage` paints a rounded-rectangle bezel into an
//    ImageData buffer where R encodes the X displacement and G encodes
//    the Y displacement (both 8-bit, 128 = no shift).
//
// The browser's HTMLCanvasElement.toDataURL() converts the ImageData
// into a `data:` URL we can feed to <feImage>.

import type { SurfaceFn } from './surfaceEquations'

export interface DisplacementResult {
  imageData: ImageData
  /** Maximum lateral deviation (in CSS pixels) — feed to feDisplacementMap.scale. */
  maxDisplacement: number
}

export interface DisplacementOptions {
  /** Element width in CSS pixels. */
  width: number
  /** Element height in CSS pixels. */
  height: number
  /** Corner radius in CSS pixels. The bezel curls inside this radius. */
  radius: number
  /** Bezel width in CSS pixels — the refractive lip thickness. */
  bezelWidth: number
  /** Glass thickness — exaggerates the displacement. */
  glassThickness?: number
  /** Refractive index of the glass. 1.5 ≈ window glass. */
  refractiveIndex?: number
  /** Surface curve along the bezel. */
  surface: SurfaceFn
  /** Sample count for the 1D refraction LUT. */
  samples?: number
  /** Override device pixel ratio (defaults to window.devicePixelRatio). */
  dpr?: number
}

function calculate1DDisplacement(
  glassThickness: number,
  bezelWidth: number,
  surface: SurfaceFn,
  refractiveIndex: number,
  samples: number
): number[] {
  const eta = 1 / refractiveIndex

  // Snell's law for an incident ray pointing straight down [0, 1].
  function refract(nx: number, ny: number): [number, number] | null {
    const dot = ny
    const k = 1 - eta * eta * (1 - dot * dot)
    if (k < 0) return null
    const kSqrt = Math.sqrt(k)
    return [
      -(eta * dot + kSqrt) * nx,
      eta - (eta * dot + kSqrt) * ny,
    ]
  }

  return Array.from({ length: samples }, (_, i) => {
    const x = i / samples
    const y = surface(x)
    const dx = x < 1 ? 0.0001 : -0.0001
    const y2 = surface(x + dx)
    const derivative = (y2 - y) / dx
    const magnitude = Math.sqrt(derivative * derivative + 1)
    const normal = [-derivative / magnitude, -1 / magnitude]
    const refracted = refract(normal[0], normal[1])
    if (!refracted) return 0
    const remainingHeight = y * bezelWidth + glassThickness
    return refracted[0] * (remainingHeight / refracted[1])
  })
}

export function buildDisplacementImage(
  opts: DisplacementOptions
): DisplacementResult {
  const {
    width,
    height,
    radius,
    bezelWidth,
    glassThickness = 200,
    refractiveIndex = 1.5,
    surface,
    samples = 128,
  } = opts
  const dpr =
    opts.dpr ??
    (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)

  const lutRaw = calculate1DDisplacement(
    glassThickness,
    bezelWidth,
    surface,
    refractiveIndex,
    samples
  )
  // Clamp non-finite values (numerical edge cases at the bezel corners
  // produce Infinity through 1/refracted[1]). Math.max([..., Infinity])
  // is Infinity, and `Infinity * 0` (which happens when a caller passes
  // refractionBase=0) is NaN — that NaN then poisons the SVG filter.
  const lut = lutRaw.map((v) => (Number.isFinite(v) ? v : 0))
  const maxDisplacement = lut.length
    ? lut.reduce((acc, v) => Math.max(acc, Math.abs(v)), 0)
    : 0

  const bufferWidth = Math.max(1, Math.round(width * dpr))
  const bufferHeight = Math.max(1, Math.round(height * dpr))
  const imageData = new ImageData(bufferWidth, bufferHeight)

  // Neutral fill — 128,128,0,255 packed into a Uint32 (little-endian:
  // bytes are R,G,B,A so the value is 0xFF008080).
  new Uint32Array(imageData.data.buffer).fill(0xff008080)

  const radius_ = radius * dpr
  const bezel_ = bezelWidth * dpr
  const objectWidth_ = bufferWidth
  const objectHeight_ = bufferHeight
  const widthBetweenRadiuses = objectWidth_ - radius_ * 2
  const heightBetweenRadiuses = objectHeight_ - radius_ * 2
  const radiusSquared = radius_ ** 2
  const radiusPlusOneSquared = (radius_ + 1) ** 2
  const radiusMinusBezelSquared = (radius_ - bezel_) ** 2

  for (let y1 = 0; y1 < objectHeight_; y1++) {
    for (let x1 = 0; x1 < objectWidth_; x1++) {
      const idx = (y1 * objectWidth_ + x1) * 4

      const isOnLeftSide = x1 < radius_
      const isOnRightSide = x1 >= objectWidth_ - radius_
      const isOnTopSide = y1 < radius_
      const isOnBottomSide = y1 >= objectHeight_ - radius_

      const x = isOnLeftSide
        ? x1 - radius_
        : isOnRightSide
        ? x1 - radius_ - widthBetweenRadiuses
        : 0
      const y = isOnTopSide
        ? y1 - radius_
        : isOnBottomSide
        ? y1 - radius_ - heightBetweenRadiuses
        : 0

      const distanceToCenterSquared = x * x + y * y
      const isInBezel =
        distanceToCenterSquared <= radiusPlusOneSquared &&
        distanceToCenterSquared >= radiusMinusBezelSquared

      if (!isInBezel) continue

      const opacity =
        distanceToCenterSquared < radiusSquared
          ? 1
          : 1 -
            (Math.sqrt(distanceToCenterSquared) - Math.sqrt(radiusSquared)) /
              (Math.sqrt(radiusPlusOneSquared) - Math.sqrt(radiusSquared))

      const distanceFromCenter = Math.sqrt(distanceToCenterSquared)
      const distanceFromSide = radius_ - distanceFromCenter

      const cos = x / distanceFromCenter
      const sin = y / distanceFromCenter

      const lutIdx = ((distanceFromSide / bezel_) * lut.length) | 0
      const distance = lut[lutIdx] ?? 0

      const dX = (-cos * distance) / maxDisplacement
      const dY = (-sin * distance) / maxDisplacement

      imageData.data[idx] = 128 + dX * 127 * opacity
      imageData.data[idx + 1] = 128 + dY * 127 * opacity
      imageData.data[idx + 2] = 0
      imageData.data[idx + 3] = 255
    }
  }

  return { imageData, maxDisplacement }
}
