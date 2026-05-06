// Converts an ImageData buffer into a `data:image/png;base64,...` URL
// the browser can hand to <feImage>. Uses a one-shot canvas; the
// resulting URL is small enough (a few KB at typical control sizes)
// to embed inline without affecting parsing perf.

export function imageDataToUrl(imageData: ImageData): string {
  const canvas = document.createElement('canvas')
  canvas.width = imageData.width
  canvas.height = imageData.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')
  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL()
}
