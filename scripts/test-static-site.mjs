#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pages = [
    '404.html', 'auth.html', 'credits.html', 'index.html', 'materials.html',
    'people.html', 'person.html', 'quiz.html', 'quotes.html', 'record.html', 'admissions.html',
    'search.html', 'shop.html', 'timeline.html'
];
const protectedPages = pages.filter((page) => !['404.html', 'auth.html'].includes(page));

const localReferences = (html) => [...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)]
    .map((match) => match[1].split(/[?#]/, 1)[0])
    .filter((value) => value && !/^(?:https?:|data:|blob:|#)/i.test(value));

for (const page of pages) {
    const file = resolve(root, page);
    const html = await readFile(file, 'utf8');
    assert.match(html, /<!DOCTYPE html>/i, `${page} must declare HTML5`);
    assert.match(html, /<meta\s+charset=["']UTF-8["']/i, `${page} must declare UTF-8`);
    assert.match(html, /Content-Security-Policy/i, `${page} must include a CSP fallback`);
    assert.match(html, /script-src 'self'/, `${page} must allow scripts only from this deployment`);
    assert.doesNotMatch(html, /cdn\.jsdelivr\.net|https:\/\/\*\.supabase\.co/, `${page} must not trust third-party scripts or wildcard Supabase projects`);
    assert.match(html, /base-uri 'none'/, `${page} must prohibit base URL injection`);
    assert.doesNotMatch(html, /<script[^>]+src=["']https?:\/\//i, `${page} must not load third-party runtime scripts`);
    assert.match(html, /<link[^>]+href=["']style\.css["']/i, `${page} must load the shared stylesheet`);
    for (const reference of localReferences(html)) {
        await access(resolve(root, reference));
    }
    if (protectedPages.includes(page)) {
        const cacheIndex = html.indexOf('js/siteCache.js');
        const gateIndex = html.indexOf('js/authGate.js');
        assert.ok(cacheIndex >= 0 && gateIndex > cacheIndex, `${page} must initialize cache clearing before the auth gate`);
    }
    assert.doesNotMatch(html, /illustrationDimensions\.js/, `${page} must not load a manually maintained illustration size table`);
}

const vercel = JSON.parse(await readFile(resolve(root, 'vercel.json'), 'utf8'));
assert.ok(Array.isArray(vercel.headers) && vercel.headers.length, 'vercel.json must configure security headers');
const csp = vercel.headers.flatMap((item) => item.headers || []).find((item) => item.key === 'Content-Security-Policy')?.value || '';
assert.match(csp, /script-src 'self'/, 'production CSP must permit only same-origin scripts');
assert.doesNotMatch(csp, /cdn\.jsdelivr\.net|https:\/\/\*\.supabase\.co/, 'production CSP must not trust a CDN or wildcard Supabase projects');
assert.match(csp, /frame-ancestors 'none'/, 'production CSP must prevent framing');
assert.ok(Array.isArray(vercel.rewrites) && vercel.rewrites.some((item) => item.source === '/data/(.*)'), 'local data must not be publicly served');
assert.ok(vercel.rewrites.some((item) => item.source === '/ADMISSIONS_DATA_DIR/(.*)'), 'admissions import data must not be publicly served');
assert.ok(vercel.rewrites.some((item) => item.source === '/images/quiz/(.*)'), 'local quiz images must not be publicly served');

const stylesheet = await readFile(resolve(root, 'style.css'), 'utf8');
assert.match(stylesheet, /\.guide-page>\.top-right-actions\s*\{[^}]*position:\s*fixed/s, 'guide auxiliary actions must not enter the centered grid flow');
assert.match(stylesheet, /\.guide-page>\.guide-main\s*\{[^}]*justify-content:\s*center/s, 'guide main content must remain viewport-centered');

const recordScript = await readFile(resolve(root, 'js/script.js'), 'utf8');
const recordRenderer = await readFile(resolve(root, 'js/recordRenderer.js'), 'utf8');
const secureData = await readFile(resolve(root, 'js/secureData.js'), 'utf8');
const supabaseClient = await readFile(resolve(root, 'js/supabaseClient.js'), 'utf8');
const authGate = await readFile(resolve(root, 'js/authGate.js'), 'utf8');
const backgroundSwitcher = await readFile(resolve(root, 'js/backgroundSwitcher.js'), 'utf8');
const themeBootstrap = await readFile(resolve(root, 'js/themeBootstrap.js'), 'utf8');
const materialsScript = await readFile(resolve(root, 'js/materials.js'), 'utf8');
const vendoredSdk = await readFile(resolve(root, 'vendor/supabase-js-2.45.0.js'));
assert.doesNotMatch(recordScript, /ClassRecordImageViewer\.open\(imagePath,[\s\S]{0,240}resolvedUrl:/, 'written image viewer must not pass its display-sized URL as the original');
assert.match(recordRenderer, /openImageViewer\(sourcePath,\s*\{[^}]*resolvedUrl\s*=\s*""[^}]*urlPromise\s*=\s*null/s, 'shared image viewer must retain guarded fallback support');
assert.match(recordRenderer, /const originalUrl\s*=\s*await resolveOriginalImageUrl\(sourcePath\)/, 'shared image viewer must resolve the original asset before display fallbacks');
assert.match(recordRenderer, /ClassRecordData\?\.isEnabled\?\.\(\)[^}]*signAssetUrl\(direct,\s*\{\s*quiet:\s*true,\s*forceRefresh\s*\}/s, 'secure image viewer paths must use signed Storage URLs before local image paths');
assert.match(recordScript, /if \(window\.ClassRecordData\?\.isEnabled\?\.\(\)\) return "";[^}]*images\\\//s, 'written image preload must not probe private Storage paths as local images');
assert.match(secureData, /signAssetUrl\s*=\s*async \(path,\s*\{[^}]*forceRefresh\s*=\s*false/, 'Storage signer must support refreshing an expired signed URL');
assert.doesNotMatch(recordRenderer, /ClassRecordIllustrationDimensions|bundledIllustrationDimensions|getIllustrationResourceId/, 'inline illustration sizing must not depend on a generated hard-coded table');
assert.match(recordRenderer, /loadRecords\?\.\(\{ hidden: false \}\)[\s\S]*loadRecords\?\.\(\{ hidden: true \}\)[\s\S]*loadPageMessages\?\.\(\)[\s\S]*loadPageSupplements\?\.\(\{ hidden: false \}\)[\s\S]*loadPageSupplements\?\.\(\{ hidden: true \}\)[\s\S]*loadMaterials\?\.\(\)/, 'illustration metadata preload must scan every record, quote, visible/hidden supplement, and material source');
assert.match(recordRenderer, /function warmIllustrationAsset\(path,[\s\S]*preloadAsset\(sourcePath, \{ priority, transform: null \}\)[\s\S]*warmIllustrationPreview\(sourcePath, \{ priority \}\)/, 'original dimensions and display thumbnails must warm through coordinated runtime caches');
assert.match(recordRenderer, /const sourceDimensions = getIllustrationSourceDimensions\(sourcePath\);[\s\S]*setIllustrationFrameSize\(tooltip, image, sourceDimensions\.width, sourceDimensions\.height\);[\s\S]*warmIllustrationPreview\(sourcePath, \{ priority: "high" \}\)/, 'illustration hover must set its cached source frame before waiting for an image URL');
assert.doesNotMatch(recordRenderer, /inline-illustration-thumbnail/, 'marker text must not render images before the user hovers it');
assert.match(recordRenderer, /window\.preloadIllustrationsFromContent[\s\S]*warmIllustrationPaths\(extractIllustrationPaths\(value\)/, 'illustration paths must be parsed from data and passed to the shared runtime warmer');
assert.match(materialsScript, /preloadIllustrationsFromContent\?\.\(item\.content \|\| ""\)/, 'material rendering must warm its active illustration content through the shared cache');
assert.match(recordRenderer, /1 - Math\.pow\(1 - progress, 4\)/, 'record jumps must use the shared long-tail ease-out curve');
assert.doesNotMatch(recordScript, /window\.scrollTo\(\{[^}]*behavior:\s*["']smooth["']/, 'record navigation must not fall back to a different browser-native smooth curve');
assert.doesNotMatch(recordRenderer, /classRecord:imageSizes|localStorage\.setItem\(IMAGE_SIZE_STORAGE_KEY/, 'real illustration paths must not persist in localStorage');
assert.match(supabaseClient, /vendor\/supabase-js-2\.45\.0\.js/, 'runtime Supabase SDK must be self-hosted at an exact version');
assert.doesNotMatch(supabaseClient + secureData, /cdn\.jsdelivr\.net/, 'runtime code must not load third-party scripts that could read the bearer token');
assert.match(supabaseClient, /script\.integrity = SDK_INTEGRITY/, 'runtime Supabase SDK loading must enforce SRI');
assert.match(secureData, /script\.integrity = SUPABASE_SDK_INTEGRITY/, 'fallback Supabase SDK loading must enforce the same SRI');
assert.equal(
    `sha384-${createHash('sha384').update(vendoredSdk).digest('base64')}`,
    'sha384-NNePyabYRaJyedI6EQAY7SV5Z8/0sQkuQ5WVfhKm0H+j0KSugkI2ZMNzw/QtzAWz',
    'vendored Supabase SDK bytes must match the reviewed 2.45.0 release'
);
assert.match(secureData, /getAssetCacheKey\(safePath,\s*imageTransform\)/, 'original and transformed Storage URLs must use variant-aware cache keys');
assert.match(secureData, /preloadAdminQuizImages[\s\S]*hasAdminAccess[\s\S]*loadAllQuizQuestions[\s\S]*preloadAsset\(path, \{ priority: 'low' \}\)/, 'administrator initialization must asynchronously preload every hidden quiz image');
assert.match(secureData, /addEventListener\('pageshow',[\s\S]*event\.persisted[\s\S]*removeAttribute\('data-secure-bound'\)[\s\S]*resolveAssetElements\(document\)/, 'bfcache restores must re-sign previously bound private images');
assert.match(authGate, /addEventListener\("pageshow",[\s\S]*event\.persisted[\s\S]*handleGate\(\)/, 'bfcache restores must revalidate invite access before restored content continues');
assert.match(recordScript, /preloadAsset\(sourcePath,\s*\{[^}]*transform:\s*getWrittenImageDisplayTransform\(\)/s, 'written page images must request a display-sized transform');
assert.match(recordRenderer, /function warmIllustrationPreview\(path,[\s\S]*const transform = getIllustrationDisplayTransform\(\);[\s\S]*preloadAsset\(sourcePath, \{ priority, transform \}\)/, 'inline illustrations must request a display-sized transform after original metadata is cached');
assert.doesNotMatch(recordRenderer, /ClassRecordImageViewer\.open\(tooltipImage\.dataset\.previewSrc,[\s\S]{0,180}resolvedUrl:/, 'illustration viewer must not pass its display-sized URL as the original');
assert.match(recordRenderer, /image\.style\.width\s*=\s*`\$\{rendered\.width\}px`[^}]*image\.style\.height\s*=\s*`\$\{rendered\.height\}px`/s, 'image viewer zoom must increase the real render size');
assert.doesNotMatch(recordRenderer, /image\.style\.transform\s*=\s*`[^`]*scale\(\$\{scale\}\)/, 'image viewer must not upscale a low-resolution composited layer');
assert.match(recordRenderer, /translate3d\(calc\(-50% \+ \$\{panX\}px\),\s*calc\(-50% \+ \$\{panY\}px\),\s*0\)/, 'image viewer pan coordinates must share the same centered origin as its bounds');
assert.match(stylesheet, /\.image-viewer-frame\s*\{[^}]*border:\s*1px solid color-mix\([^}]*var\(--theme-accent-strong\)[^}]*background:[^}]*var\(--theme-surface\)/s, 'image viewer frame must use the active theme for its visual boundary');
assert.match(stylesheet, /\.image-viewer-frame img\s*\{[^}]*position:\s*absolute[^}]*top:\s*50%[^}]*left:\s*50%/s, 'image viewer images must use an explicit centered coordinate system');
assert.match(stylesheet, /--control-border:\s*color-mix\(in srgb, var\(--theme-accent-strong\) 22%, #d8d0c6\)/, 'button strokes must have one opaque shared default variable');
assert.match(stylesheet, /\.material-list-item\.is-active\s*\{[^}]*border-color:\s*var\(--control-border-active\)/s, 'active material choices must use the shared active button stroke');
assert.match(stylesheet, /\.timeline-chip:hover\s*\{[^}]*border-color:\s*var\(--control-border-hover\)/s, 'timeline selection hover must use the shared button hover stroke');
assert.match(stylesheet, /\.timeline-page \.archive-tool-actions\s*\{[^}]*display:\s*grid[^}]*justify-items:\s*end/s, 'timeline metrics and page action must be separated into stacked controls');
assert.match(stylesheet, /\.timeline-author-legend li i\s*\{[^}]*border-radius:\s*50%/s, 'timeline author legend markers must be circular');
assert.doesNotMatch(backgroundSwitcher, /"--control-border"\s*:/, 'background palettes must not override the shared button stroke');
assert.doesNotMatch(themeBootstrap, /"--control-border"\s*:/, 'theme bootstrap palettes must not override the shared button stroke');
assert.match(backgroundSwitcher + themeBootstrap, /legacyControlBorderVariables/, 'legacy cached stroke variables must be cleared before palette application');

const searchScript = await readFile(resolve(root, 'js/search.js'), 'utf8');
assert.doesNotMatch(searchScript, /\.slice\(0,\s*80\)/, 'search results must not be truncated');

const quizPage = await readFile(resolve(root, 'quiz.html'), 'utf8');
assert.ok(quizPage.indexOf('js/quizCore.js') < quizPage.indexOf('js/quizApp.js'), 'quiz core must load before the UI controller');
const quizScript = await readFile(resolve(root, 'js/quizApp.js'), 'utf8');
assert.match(quizScript, /data-secure-src/, 'quiz images must use private Storage references');
assert.match(quizScript, /resolveAssetElements/, 'quiz images must be signed before display');
assert.match(quizScript, /if \(!secretAdminAccess\)/, 'lamian unlock must be disabled without administrator access');
assert.match(quizScript, /hasAdminAccess/, 'lamian unlock must verify administrator access with Supabase');
const admissionsApp = await readFile(resolve(root, 'js/admissions/app.mjs'), 'utf8');
const admissionsData = await readFile(resolve(root, 'js/admissions/data.mjs'), 'utf8');
assert.match(admissionsData, /rpc\('get_class_admission_map'\)/, 'admissions must use its protected RPC instead of table reads');
assert.doesNotMatch(admissionsApp, /person_id|SUPABASE_SERVICE_ROLE_KEY/, 'admissions UI must not expose person IDs or service-role credentials');

console.log(`Passed static checks for ${pages.length} pages.`);
