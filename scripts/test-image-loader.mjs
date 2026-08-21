import assert from 'node:assert/strict'
import { readFrontend } from './test-react-helpers.mjs'

const markupComponent = await readFrontend('src/components/archive/markup-content.tsx')
const mapPage = await readFrontend('src/pages/meal-map-page.tsx')
const recordsPage = await readFrontend('src/pages/records-page.tsx')
const quizPage = await readFrontend('src/pages/quiz-page.tsx')
const data = await readFrontend('src/services/data.ts')
const signedAssetHook = await readFrontend('src/hooks/use-signed-asset.ts')
const imageViewer = await readFrontend('src/components/archive/image-viewer.tsx')
const boundedRetryHook = await readFrontend('src/hooks/use-bounded-image-retry.ts')
assert.match(markupComponent, /useSignedAsset\(requested \? path : ''/, 'record illustrations must be signed only on demand')
assert.match(markupComponent, /preview\.loading/, 'illustrations need an explicit loading state')
assert.match(
  signedAssetHook,
  /signAssetUrl\(path, \{ forceRefresh, variant, width, quality \}\)/,
  'the image hook must sign an explicit cached image variant',
)
assert.match(
  signedAssetHook,
  /getCachedAssetUrl\(path, \{ variant, width, quality \}\)/,
  'route re-entry must synchronously reuse a still-valid signed rendition',
)
assert.match(
  data,
  /getCachedAssetUrl[\s\S]*cached\.refreshAt <= Date\.now\(\)[\s\S]*return cached\.value/,
  'synchronous rendition reuse must reject expired signed URLs',
)
assert.doesNotMatch(
  signedAssetHook,
  /setInterval/,
  'decoded private images must not be re-signed and reloaded on a background timer',
)
assert.match(
  data,
  /addEventListener\('pagehide',[\s\S]*signedUrls\.clear\(\)/,
  'signed URL promises must leave memory when the page exits',
)
assert.match(
  signedAssetHook,
  /state\.key === assetKey/,
  'the image hook must never expose a signed URL left over from another path or rendition',
)
assert.match(boundedRetryHook, /automaticRetryUsed/, 'decode failures need a bounded automatic retry budget')
assert.match(boundedRetryHook, /setFailed\(true\)/, 'exhausted image retries must expose a stable error state')
assert.match(mapPage, /loadMealMapMetadata/, 'meal map must load its gated intrinsic metadata')
assert.match(
  mapPage,
  /useSignedAsset\(MAP_PATH, \{ variant: 'preview', width: 1600 \}\)/,
  'the map must use one transformed preview URL before opening the original',
)
assert.doesNotMatch(
  mapPage,
  /useImageDimensions\(MAP_PATH\)/,
  'database-backed map geometry must not start a second signed image probe',
)
assert.doesNotMatch(
  mapPage,
  /resource\.data\?\.url/,
  'meal-map metadata and signed URLs must not compete as two image sources',
)
assert.match(mapPage, /ImageViewer/, 'meal map must use the shared zoom and pan viewer')
assert.match(recordsPage, /SignedPageImage/, 'written record pages need a signed image component')
assert.match(
  recordsPage,
  /useSignedAsset\(path, \{ variant: 'preview', width: 1200 \}\)/,
  'written pages must render a transformed preview before opening the original',
)
assert.match(
  data,
  /transform: \{ width, quality, resize: 'contain' \}/,
  'preview URLs must use the storage image transformation endpoint',
)
assert.match(
  imageViewer,
  /useSignedAsset\(open \? path : ''\)/,
  'the original URL must only be requested while the shared viewer is open',
)
assert.match(
  imageViewer,
  /image\.fetchPriority = 'high'/,
  'an explicitly opened original must decode at high priority',
)
assert.match(
  imageViewer,
  /const src = originalSrc \|\| initialUrl/,
  'the viewer must retain its compressed source until the decoded original is ready',
)
assert.match(
  imageViewer,
  /MAX_SESSION_ORIGINAL_URLS[\s\S]*loadedOriginalUrls[\s\S]*rememberLoadedOriginal/,
  'decoded original URLs must use one bounded shared session cache',
)
assert.match(
  imageViewer,
  /rememberLoadedOriginal\(path, asset\.src\)[\s\S]*setLoadedOriginal\(\{ path, src: asset\.src \}\)/,
  'a decoded original must become immediately reusable across viewer re-entry',
)
assert.doesNotMatch(
  imageViewer,
  /if \(open\) return[\s\S]{0,400}setLoadedOriginal\([^)]*src: ''/,
  'closing the viewer must not discard a successfully decoded original',
)
assert.match(quizPage, /<ImageViewer[\s\S]*initialUrl=\{resource\.src\}/, 'quiz images must reuse the shared viewer')
assert.match(
  quizPage,
  /useSignedAsset\(path, \{ variant: 'preview', width: 960 \}\)/,
  'quiz images must first request a compressed rendition',
)
assert.doesNotMatch(
  quizPage,
  /preloadQuizImage|quizImagePreloadCache/,
  'unlocking the quiz must not preload hidden original images',
)
console.log('React image loading checks passed.')
