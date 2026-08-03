import assert from 'node:assert/strict'
import { loadTypescriptModule, readFrontend } from './test-react-helpers.mjs'

const markup = await loadTypescriptModule('src/lib/markup.ts')
const imageMetadata = await loadTypescriptModule('src/lib/image-metadata.ts')
const component = await readFrontend('src/components/archive/markup-content.tsx')
const service = await readFrontend('src/services/image-metadata.ts')
const preloader = await readFrontend('src/features/archive/image-metadata-preloader.tsx')
const app = await readFrontend('src/app.tsx')
const recordsPage = await readFrontend('src/pages/records-page.tsx')
const mapPage = await readFrontend('src/pages/meal-map-page.tsx')
const valid = markup.extractMarkupReferences('查看 [[illu:photo.webp|这张图片]]。')
const invalid = markup.extractMarkupReferences('拒绝 [[illu:../secret.png|越界图片]]。')
assert.deepEqual(valid.illustrationPaths, ['data/attachments/photo.webp'])
assert.deepEqual(invalid.illustrationPaths, [])

const png = new Uint8Array(24)
png.set([137, 80, 78, 71, 13, 10, 26, 10])
new DataView(png.buffer).setUint32(16, 640)
new DataView(png.buffer).setUint32(20, 360)
assert.deepEqual(imageMetadata.parseImageDimensions(png, 'image/png'), {
  width: 640,
  height: 360,
})

const gif = new Uint8Array([71, 73, 70, 56, 57, 97, 0x20, 0x03, 0x58, 0x02])
assert.deepEqual(imageMetadata.parseImageDimensions(gif, 'image/gif'), {
  width: 800,
  height: 600,
})

const jpeg = new Uint8Array(22)
jpeg.set([0xff, 0xd8, 0xff, 0xc0])
const jpegView = new DataView(jpeg.buffer)
jpegView.setUint16(4, 17)
jpegView.setUint16(7, 720)
jpegView.setUint16(9, 1280)
assert.deepEqual(imageMetadata.parseImageDimensions(jpeg, 'image/jpeg'), {
  width: 1280,
  height: 720,
})

const webp = new Uint8Array(31)
webp.set(new TextEncoder().encode('RIFF'), 0)
webp.set(new TextEncoder().encode('WEBP'), 8)
webp.set(new TextEncoder().encode('VP8X'), 12)
webp.set([0x7f, 0x02, 0x00], 24)
webp.set([0xdf, 0x01, 0x00], 27)
assert.deepEqual(imageMetadata.parseImageDimensions(webp, 'image/webp'), {
  width: 640,
  height: 480,
})

const svg = new TextEncoder().encode('<svg viewBox="0 0 1024 768"></svg>')
assert.deepEqual(imageMetadata.parseImageDimensions(svg, 'image/svg+xml'), {
  width: 1024,
  height: 768,
})

assert.match(component, /IllustrationReference/, 'illustrations need an isolated interactive component')
assert.match(component, /ImageViewer/, 'illustrations must be opened with the shared image viewer')
assert.match(component, /requested \? path : ''/, 'illustration previews must load only after interaction')
assert.match(component, /onPointerEnter={requestPreview}/, 'pointer hover must start image loading early')
assert.match(component, /onFocus={requestPreview}/, 'keyboard focus must start image loading early')
assert.match(component, /useImageDimensions\(path\)/, 'decoded illustration geometry must be reused')
assert.match(component, /lockedDimensions/, 'an open tooltip must keep one immutable frame size')
assert.match(component, /preloadImageDimensions\(path\)/, 'metadata must be ready before opening')
assert.match(component, /<HoverCard open={open}/, 'metadata-gated hover cards must be controlled')
assert.doesNotMatch(
  component,
  /transition-\[width,height\]/,
  'loading and decoded tooltip frames must never animate between sizes',
)
assert.match(component, /Math\.min\(360, window\.innerWidth/, 'preview width must follow the baseline limit')
assert.match(component, /Math\.min\(280, window\.innerHeight/, 'preview height must follow the baseline limit')
assert.doesNotMatch(component, /<img[^>]+data-secure-src/, 'signed paths must not be persisted in markup')
assert.match(service, /Range: `bytes=0-\$\{METADATA_RANGE_BYTES - 1\}`/, 'metadata should use a bounded Range request')
assert.match(service, /image-dimensions:/, 'intrinsic geometry needs an access-scoped persistent cache')
assert.match(service, /30 \* 24 \* 60 \* 60 \* 1000/, 'dimension metadata should remain fresh for 30 days')
assert.match(preloader, /loadMaterials\(\)/, 'materials must participate in entry-time metadata discovery')
assert.match(preloader, /loadPageMessages\(\)/, 'page messages must participate in metadata discovery')
assert.match(preloader, /loadPageSupplements/, 'page supplements must participate in metadata discovery')
assert.match(preloader, /loadCredits\(\)/, 'credits must participate in metadata discovery')
assert.match(preloader, /loadRecordPages\(false\)/, 'written page geometry must be prefetched')
assert.match(preloader, /void archive\.ensure\(\)/, 'entry-time metadata warming must start archive loading')
assert.match(app, /<ImageMetadataPreloader \/>/, 'metadata discovery must start at protected-app entry')
assert.match(recordsPage, /useImageDimensions\(path\)/, 'written pages must reserve their real ratio')
assert.match(
  mapPage,
  /<figure className="[^"]*min-h-0 flex-1[^"]*overflow-hidden/,
  'the meal map must keep one stable viewport frame while loading',
)
assert.match(mapPage, /object-contain/, 'the meal map must remain fully visible in its stable frame')
console.log('React illustration checks passed.')
