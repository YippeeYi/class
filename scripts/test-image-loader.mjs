import assert from 'node:assert/strict'
import { readFrontend } from './test-react-helpers.mjs'

const markupComponent = await readFrontend('src/components/archive/markup-content.tsx')
const mapPage = await readFrontend('src/pages/meal-map-page.tsx')
const recordsPage = await readFrontend('src/pages/records-page.tsx')
assert.match(markupComponent, /signAssetUrl\(path\)/, 'record illustrations must be signed on demand')
assert.match(markupComponent, /loading: true/, 'illustrations need an explicit loading state')
assert.match(mapPage, /loadMealMap/, 'meal map must use the secure data loader')
assert.match(recordsPage, /SignedPageImage/, 'written record pages need a signed image component')
console.log('React image loading checks passed.')
