import { promises as fs } from 'node:fs'
import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'

const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'])
const videoExtensions = new Set(['.mp4', '.webm', '.ogg'])
const recordMediaPrefixes = [
  'data/attachments/',
  'hidden/data/attachments/',
  'images/record-pages/',
  'hidden/images/record-pages/',
]
const headerBytes = 64 * 1024
const run = promisify(execFile)

async function videoDimensions(file) {
  try {
    const { stdout } = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', file], { timeout: 5000 })
    const stream = JSON.parse(stdout).streams?.[0]
    return [Number(stream?.width), Number(stream?.height)]
  } catch {
    return null
  }
}

function imageDimensions(bytes, extension) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const starts = (...values) => values.every((value, index) => bytes[index] === value)
  if (bytes.length >= 24 && starts(137, 80, 78, 71, 13, 10, 26, 10))
    return [view.getUint32(16), view.getUint32(20)]
  if (bytes.length >= 10 && starts(71, 73, 70, 56))
    return [view.getUint16(6, true), view.getUint16(8, true)]
  if (bytes.length >= 30 && starts(82, 73, 70, 70)) {
    const chunk = String.fromCharCode(...bytes.slice(12, 16))
    if (chunk === 'VP8X' && bytes.length >= 30) {
      const value = (offset) => 1 + bytes[offset] + (bytes[offset + 1] << 8) + (bytes[offset + 2] << 16)
      return [value(24), value(27)]
    }
    if (chunk === 'VP8 ' && bytes[23] === 157 && bytes[24] === 1 && bytes[25] === 42)
      return [view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff]
    if (chunk === 'VP8L' && bytes[20] === 47)
      return [1 + bytes[21] + ((bytes[22] & 0x3f) << 8), 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0xf) << 10)]
  }
  if (bytes.length >= 12 && starts(255, 216)) {
    const frameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])
    for (let offset = 2; offset + 9 < bytes.length;) {
      if (bytes[offset] !== 255) { offset++; continue }
      while (bytes[offset] === 255) offset++
      const marker = bytes[offset]
      if (marker === 0xd8 || marker === 0xd9) { offset++; continue }
      if (offset + 2 >= bytes.length) break
      const length = view.getUint16(offset + 1)
      if (length < 2 || offset + 1 + length > bytes.length) break
      if (frameMarkers.has(marker)) return [view.getUint16(offset + 6), view.getUint16(offset + 4)]
      offset += 1 + length
    }
  }
  if (extension === '.svg') {
    const tag = /<svg\b[^>]*>/i.exec(new TextDecoder().decode(bytes))?.[0] || ''
    const width = Number.parseFloat(/\bwidth\s*=\s*["']\s*([\d.]+)/i.exec(tag)?.[1] || '')
    const height = Number.parseFloat(/\bheight\s*=\s*["']\s*([\d.]+)/i.exec(tag)?.[1] || '')
    if (width > 0 && height > 0) return [width, height]
    const box = /\bviewBox\s*=\s*["']\s*[-\d.]+[ ,]+[-\d.]+[ ,]+([\d.]+)[ ,]+([\d.]+)/i.exec(tag)
    if (box) return [Number(box[1]), Number(box[2])]
  }
  return null
}

export async function buildMediaDimensionManifests(root, assets) {
  const manifests = { public: {}, hidden: {} }
  for (const asset of assets.values()) {
    if (!recordMediaPrefixes.some((prefix) => asset.remotePath.startsWith(prefix))) continue
    const extension = path.extname(asset.remotePath).toLowerCase()
    if (!imageExtensions.has(extension) && !videoExtensions.has(extension)) continue
    const source = path.resolve(root, asset.localPath)
    let size = null
    if (videoExtensions.has(extension)) size = await videoDimensions(source)
    else {
      const file = await fs.open(source).catch(() => null)
      if (!file) continue
      try {
        const buffer = Buffer.alloc(headerBytes)
        const { bytesRead } = await file.read(buffer, 0, headerBytes, 0)
        size = imageDimensions(buffer.subarray(0, bytesRead), extension)
      } finally {
        await file.close()
      }
    }
    if (size?.every((number) => Number.isFinite(number) && number > 0))
      manifests[asset.remotePath.startsWith('hidden/') ? 'hidden' : 'public'][asset.remotePath] = size
  }
  return manifests
}
