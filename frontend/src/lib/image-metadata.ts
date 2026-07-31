export type ImageDimensions = { width: number; height: number }

export function validImageDimensions(
  dimensions: ImageDimensions | null | undefined,
): dimensions is ImageDimensions {
  return Boolean(
    dimensions &&
      Number.isFinite(dimensions.width) &&
      Number.isFinite(dimensions.height) &&
      dimensions.width > 0 &&
      dimensions.height > 0,
  )
}

export function parseImageDimensions(bytes: Uint8Array, contentType = ''): ImageDimensions | null {
  if (bytes.byteLength < 10) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const has = (offset: number, values: number[]) =>
    values.every((value, index) => bytes[offset + index] === value)
  const readUint24LittleEndian = (offset: number) =>
    (bytes[offset] || 0) | ((bytes[offset + 1] || 0) << 8) | ((bytes[offset + 2] || 0) << 16)

  if (bytes.length >= 24 && has(0, [137, 80, 78, 71, 13, 10, 26, 10])) {
    return { width: view.getUint32(16), height: view.getUint32(20) }
  }
  if (
    bytes.length >= 10 &&
    (has(0, [71, 73, 70, 56, 55, 97]) || has(0, [71, 73, 70, 56, 57, 97]))
  ) {
    return { width: view.getUint16(6, true), height: view.getUint16(8, true) }
  }
  if (bytes.length >= 12 && has(0, [82, 73, 70, 70]) && has(8, [87, 69, 66, 80])) {
    const chunk = String.fromCharCode(...bytes.slice(12, 16))
    if (chunk === 'VP8X' && bytes.length >= 31) {
      return {
        width: readUint24LittleEndian(24) + 1,
        height: readUint24LittleEndian(27) + 1,
      }
    }
    if (chunk === 'VP8 ' && bytes.length >= 30 && has(23, [157, 1, 42])) {
      return {
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
      }
    }
    if (chunk === 'VP8L' && bytes.length >= 25 && bytes[20] === 0x2f) {
      return {
        width: 1 + ((bytes[21] || 0) | (((bytes[22] || 0) & 0x3f) << 8)),
        height:
          1 +
          (((bytes[22] || 0) >> 6) | ((bytes[23] || 0) << 2) | (((bytes[24] || 0) & 0x0f) << 10)),
      }
    }
  }
  if (has(0, [255, 216])) {
    const startOfFrameMarkers = new Set([
      0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
    ])
    for (let offset = 2; offset + 9 < bytes.length; ) {
      if (bytes[offset] !== 0xff) {
        offset += 1
        continue
      }
      while (offset < bytes.length && bytes[offset] === 0xff) offset += 1
      const marker = bytes[offset]
      if (marker === undefined) break
      if (marker === 0xd8 || marker === 0xd9) {
        offset += 1
        continue
      }
      if (offset + 2 >= bytes.length) break
      const segmentLength = view.getUint16(offset + 1)
      if (segmentLength < 2 || offset + 1 + segmentLength > bytes.length) break
      if (startOfFrameMarkers.has(marker)) {
        return { width: view.getUint16(offset + 6), height: view.getUint16(offset + 4) }
      }
      offset += 1 + segmentLength
    }
  }
  const prefix = new TextDecoder().decode(bytes.slice(0, Math.min(bytes.length, 512)))
  if (/svg/i.test(contentType) || /<svg\b/i.test(prefix)) {
    const source = new TextDecoder().decode(bytes)
    const tag = /<svg\b[^>]*>/i.exec(source)?.[0] || ''
    const width = Number.parseFloat(/\bwidth\s*=\s*["']\s*([\d.]+)/i.exec(tag)?.[1] || '')
    const height = Number.parseFloat(/\bheight\s*=\s*["']\s*([\d.]+)/i.exec(tag)?.[1] || '')
    if (validImageDimensions({ width, height })) return { width, height }
    const viewBox = /\bviewBox\s*=\s*["']\s*[-\d.]+[ ,]+[-\d.]+[ ,]+([\d.]+)[ ,]+([\d.]+)/i.exec(
      tag,
    )
    if (viewBox) {
      const dimensions = { width: Number(viewBox[1]), height: Number(viewBox[2]) }
      return validImageDimensions(dimensions) ? dimensions : null
    }
  }
  return null
}
