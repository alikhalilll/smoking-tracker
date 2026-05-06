// Specular highlight bezel texture.
// Ported from kube.io's article (lib/specular.ts).
//
// Paints a soft white rim along the bezel of a rounded rectangle,
// where intensity peaks where the surface normal aligns with the
// incoming light direction (specularAngle). The result is fed to a
// separate <feImage> in the filter chain and overlaid on top of the
// refracted source.

export interface SpecularOptions {
  width: number
  height: number
  radius: number
  bezelWidth: number
  /** Direction of the simulated light source. Default π/3 ≈ upper-left. */
  specularAngle?: number
  dpr?: number
}

export function buildSpecularImage(opts: SpecularOptions): ImageData {
  const {
    width,
    height,
    radius,
    bezelWidth,
    specularAngle = Math.PI / 3,
  } = opts
  const dpr =
    opts.dpr ??
    (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)

  const bufferWidth = Math.max(1, Math.round(width * dpr))
  const bufferHeight = Math.max(1, Math.round(height * dpr))
  const imageData = new ImageData(bufferWidth, bufferHeight)
  // Transparent fill.
  new Uint32Array(imageData.data.buffer).fill(0)

  const radius_ = radius * dpr
  const bezel_ = bezelWidth * dpr
  const radiusSquared = radius_ ** 2
  const radiusPlusOneSquared = (radius_ + dpr) ** 2
  const radiusMinusBezelSquared = (radius_ - bezel_) ** 2
  const widthBetweenRadiuses = bufferWidth - radius_ * 2
  const heightBetweenRadiuses = bufferHeight - radius_ * 2

  const sx = Math.cos(specularAngle)
  const sy = Math.sin(specularAngle)

  for (let y1 = 0; y1 < bufferHeight; y1++) {
    for (let x1 = 0; x1 < bufferWidth; x1++) {
      const idx = (y1 * bufferWidth + x1) * 4
      const isOnLeftSide = x1 < radius_
      const isOnRightSide = x1 >= bufferWidth - radius_
      const isOnTopSide = y1 < radius_
      const isOnBottomSide = y1 >= bufferHeight - radius_

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
      if (
        distanceToCenterSquared > radiusPlusOneSquared ||
        distanceToCenterSquared < radiusMinusBezelSquared
      )
        continue

      const distanceFromCenter = Math.sqrt(distanceToCenterSquared)
      const distanceFromSide = radius_ - distanceFromCenter

      const opacity =
        distanceToCenterSquared < radiusSquared
          ? 1
          : 1 -
            (distanceFromCenter - Math.sqrt(radiusSquared)) /
              (Math.sqrt(radiusPlusOneSquared) - Math.sqrt(radiusSquared))

      const cos = x / distanceFromCenter
      const sin = -y / distanceFromCenter
      const dotProduct = Math.abs(cos * sx + sin * sy)

      const coefficient =
        dotProduct *
        Math.sqrt(1 - (1 - distanceFromSide / dpr) ** 2)

      const color = 255 * coefficient
      const finalOpacity = color * coefficient * opacity

      imageData.data[idx] = color
      imageData.data[idx + 1] = color
      imageData.data[idx + 2] = color
      imageData.data[idx + 3] = finalOpacity
    }
  }

  return imageData
}
