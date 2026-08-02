import assert from 'node:assert/strict'
import { readFrontend } from './test-react-helpers.mjs'

const markupComponent = await readFrontend('src/components/archive/markup-content.tsx')
const mapPage = await readFrontend('src/pages/meal-map-page.tsx')
const recordsPage = await readFrontend('src/pages/records-page.tsx')
const signedAssetHook = await readFrontend('src/hooks/use-signed-asset.ts')
const boundedRetryHook = await readFrontend('src/hooks/use-bounded-image-retry.ts')
assert.match(markupComponent, /useSignedAsset\(requested \? path : ''/, 'record illustrations must be signed only on demand')
assert.match(markupComponent, /preview\.loading/, 'illustrations need an explicit loading state')
assert.match(signedAssetHook, /signAssetUrl\(path, \{ forceRefresh \}\)/, 'the image hook must use the secure signer')
assert.match(boundedRetryHook, /automaticRetryUsed/, 'decode failures need a bounded automatic retry budget')
assert.match(boundedRetryHook, /setFailed\(true\)/, 'exhausted image retries must expose a stable error state')
assert.match(mapPage, /loadMealMap/, 'meal map must use the secure data loader')
assert.match(mapPage, /ImageViewer/, 'meal map must use the shared zoom and pan viewer')
assert.match(recordsPage, /SignedPageImage/, 'written record pages need a signed image component')
console.log('React image loading checks passed.')
