#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pages = [
    '404.html', 'auth.html', 'credits.html', 'index.html', 'materials.html',
    'people.html', 'person.html', 'quiz.html', 'quotes.html', 'record.html',
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
    assert.doesNotMatch(html, /rel=["']preload["'][^>]+GoogleSansFlex|GoogleSansFlex[^>]+rel=["']preload["']/i, `${page} must not block first paint on the optional variable font`);
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
const materialsPage = await readFile(resolve(root, 'materials.html'), 'utf8');
const personPage = await readFile(resolve(root, 'person.html'), 'utf8');
const personScript = await readFile(resolve(root, 'js/person.js'), 'utf8');
const timelinePage = await readFile(resolve(root, 'timeline.html'), 'utf8');
const timelineScript = await readFile(resolve(root, 'js/timeline.js'), 'utf8');
const bootstrap = await readFile(resolve(root, 'js/bootstrap.js'), 'utf8');
const vendoredSdk = await readFile(resolve(root, 'vendor/supabase-js-2.45.0.js'));
assert.doesNotMatch(recordScript, /ClassRecordImageViewer\.open\(imagePath,[\s\S]{0,240}resolvedUrl:/, 'written image viewer must not pass its display-sized URL as the original');
assert.match(recordRenderer, /openImageViewer\(sourcePath,\s*\{[^}]*resolvedUrl\s*=\s*""[^}]*urlPromise\s*=\s*null/s, 'shared image viewer must retain guarded fallback support');
assert.match(recordRenderer, /const originalUrl\s*=\s*await resolveOriginalImageUrl\(sourcePath\)/, 'shared image viewer must resolve the original asset before display fallbacks');
assert.match(recordRenderer, /ClassRecordData\?\.isEnabled\?\.\(\)[^}]*signAssetUrl\(direct,\s*\{\s*quiet:\s*true,\s*forceRefresh\s*\}/s, 'secure image viewer paths must use signed Storage URLs before local image paths');
assert.match(recordScript, /if \(window\.ClassRecordData\?\.isEnabled\?\.\(\)\) return "";[^}]*images\\\//s, 'written image preload must not probe private Storage paths as local images');
assert.match(secureData, /signAssetUrl\s*=\s*async \(path,\s*\{[^}]*forceRefresh\s*=\s*false/, 'Storage signer must support refreshing an expired signed URL');
assert.doesNotMatch(recordRenderer, /ClassRecordIllustrationDimensions|bundledIllustrationDimensions|getIllustrationResourceId/, 'inline illustration sizing must not depend on a generated hard-coded table');
assert.match(recordRenderer, /function loadIllustrationMetadata\(path,[\s\S]*Range: `bytes=0-\$\{ILLUSTRATION_METADATA_RANGE_BYTES - 1\}`/, 'illustration startup must request bounded source metadata instead of preloading preview images');
assert.match(recordRenderer, /function warmIllustrationAsset\(path,[\s\S]*loadIllustrationMetadata\(sourcePath, \{ priority, signedUrl \}\)[\s\S]*loadIllustrationMetadataWithImage\(sourcePath, \{ priority, signedUrl \}\)/, 'illustration startup must cache intrinsic dimensions before any hover');
assert.match(recordRenderer, /async function signIllustrationPaths\(paths\)[\s\S]*signAssetUrls\(batch, \{ quiet: true \}\)[\s\S]*warmIllustrationAsset\(path, \{ priority, signedUrl:/, 'all-content metadata warming must batch-sign image paths before reading dimensions');
assert.doesNotMatch(recordRenderer.match(/function warmIllustrationAsset\(path,[\s\S]*?\n}\n\nfunction warmIllustrationPaths/)?.[0] || '', /warmIllustrationPreview/, 'startup metadata warming must not preload display images');
assert.match(recordRenderer, /function preloadIllustrationDimensionsFromData\(\)[\s\S]*loadRecords\?\.\(\{ hidden: false \}\)[\s\S]*loadAllQuotes\?\.\([\s\S]*loadPageMessages\?\.\([\s\S]*loadPageSupplements\?\.\(\{ hidden: false \}\)[\s\S]*loadMaterials\?\.\([\s\S]*loadCreditsPage\?\.\(/, 'renderer startup must collect illustration markers from every public content source');
assert.match(recordRenderer, /if \(sourceFailures\.length \|\| result\.failedPaths\.length\)\s*\{\s*throw new Error\(`Illustration dimensions incomplete:/, 'pages must not render marker content when any public source or image dimension is incomplete');
assert.match(recordRenderer, /startIllustrationDimensionPreload\(\);/, 'renderer startup must begin the all-content metadata pass');
assert.match(recordRenderer, /cacheReadyPromise\s*=\s*Promise\.all\(\[pageReady, metadataPromise\]\)/, 'renderer must gate markup rendering when it loads after bootstrap');
assert.match(recordRenderer, /container\.replaceChildren\(fragment\);[\s\S]*preloadIllustrationsFromContent\?\.\(records\.map\(/, 'record lists must warm only their visible illustration content after render');
assert.match(recordRenderer, /tooltip\.replaceChildren\(image, loading\);[\s\S]*reveal\(\);[\s\S]*await Promise\.all\(/, 'a hovered illustration must reveal its tooltip before image work completes');
assert.match(stylesheet, /\.illustration-tooltip\s*\{[^}]*overflow:\s*visible\s*;/s, 'illustration tooltip must never crop a viewport-fitted image frame');
const illustrationTooltipPopulate = recordRenderer.match(/illustrationTooltipController\s*=\s*createInlineTooltipController\([\s\S]*?\n}\);\n\ndocument\.addEventListener\("click"/)?.[0] || '';
assert.doesNotMatch(illustrationTooltipPopulate.slice(illustrationTooltipPopulate.indexOf('image.src = readyImage.url')), /setIllustrationFrameSize|rememberIllustrationDimensions/, 'an image decode must only fill the reserved tooltip frame and must never trigger a second size calculation');
assert.doesNotMatch(recordRenderer, /inline-illustration-thumbnail/, 'marker text must not render images before the user hovers it');
assert.match(recordRenderer, /window\.preloadIllustrationsFromContent[\s\S]*warmIllustrationPaths\(extractIllustrationPaths\(value\)/, 'illustration paths must be parsed from data and passed to the shared runtime warmer');
assert.match(materialsScript, /preloadIllustrationsFromContent\?\.\(item\.content \|\| ""\)/, 'material rendering must warm its active illustration content through the shared cache');
assert.equal((materialsPage.match(/class="page-loading" role="status"/g) || []).length, 1, 'materials pages must provide exactly one centered loading placeholder');
assert.match(personPage, /id="person-loading"[^>]*role="status"/, 'person pages must provide a neutral loading state before profile data is available');
assert.match(personPage, /id="person-info"[^>]*hidden/, 'person aliases and introductions must remain hidden until data is available');
assert.match(stylesheet, /\[hidden\]\s*\{\s*display:\s*none !important;/, 'native hidden state must not be overridden by component layout styles');
assert.match(stylesheet, /\.page-loading\s*\{[^}]*min-height:\s*clamp\(220px, 48vh, 460px\)[^}]*justify-items:\s*center/s, 'initial data loading must be centered without a card frame');
assert.doesNotMatch(stylesheet.match(/\.page-loading\s*\{[^}]*}/s)?.[0] || '', /border:|background:|box-shadow:/, 'initial data loading must not show a box');
assert.match(stylesheet, /\.quiz-card\.is-loading\s*\{[^}]*background:\s*transparent[^}]*box-shadow:\s*none/s, 'quiz initialization must not show a card frame');
assert.match(personScript, /const people = await loadAllPeople\(\);[\s\S]*personInfo\?\.removeAttribute\("hidden"\);[\s\S]*ClassRecordIllustrationMetadataPromise[\s\S]*const records = await loadAllRecords\(\)/, 'person profiles must wait for all illustration dimensions before rendering records');
assert.match(bootstrap, /Promise\.all\(\[[\s\S]*ClassRecordIllustrationMetadataPromise/, 'bootstrap must wait for all illustration dimensions before markup-capable pages render');
assert.match(timelinePage, /id="timeline-actions"[^>]*hidden/, 'timeline controls must remain hidden until statistics are ready');
assert.match(timelineScript, /if \(summary\)[\s\S]*renderAll\(\);\s*timelineActions\?\.removeAttribute\('hidden'\);[\s\S]*detail\.setAttribute\('aria-busy', 'false'\)/, 'timeline controls must only appear after successful statistic rendering');
assert.doesNotMatch(personPage, /quoteStore\.js/, 'person pages must not load the unused quote store');
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
assert.match(recordRenderer, /function warmIllustrationPreview\(path,[\s\S]*displayTransforms\?\.written \|\| ILLUSTRATION_DISPLAY_TRANSFORM[\s\S]*preloadAsset\(sourcePath, \{ priority, transform \}\)[\s\S]*getPreloadedAsset\(sourcePath, \{ transform \}\)/, 'inline illustrations must request the same transformed thumbnail variant as written record pages');
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
console.log(`Passed static checks for ${pages.length} pages.`);
