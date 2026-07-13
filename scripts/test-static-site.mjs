#!/usr/bin/env node

import assert from 'node:assert/strict';
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
    assert.match(html, /<link[^>]+href=["']style\.css["']/i, `${page} must load the shared stylesheet`);
    for (const reference of localReferences(html)) {
        await access(resolve(root, reference));
    }
    if (protectedPages.includes(page)) {
        const cacheIndex = html.indexOf('js/siteCache.js');
        const gateIndex = html.indexOf('js/authGate.js');
        assert.ok(cacheIndex >= 0 && gateIndex > cacheIndex, `${page} must initialize cache clearing before the auth gate`);
    }
    if (html.includes('js/recordRenderer.js')) {
        assert.ok(html.indexOf('js/illustrationDimensions.js') < html.indexOf('js/recordRenderer.js'), `${page} must load illustration dimensions before the markup renderer`);
    }
}

const vercel = JSON.parse(await readFile(resolve(root, 'vercel.json'), 'utf8'));
assert.ok(Array.isArray(vercel.headers) && vercel.headers.length, 'vercel.json must configure security headers');
assert.ok(Array.isArray(vercel.rewrites) && vercel.rewrites.some((item) => item.source === '/data/(.*)'), 'local data must not be publicly served');
assert.ok(vercel.rewrites.some((item) => item.source === '/images/quiz/(.*)'), 'local quiz images must not be publicly served');

const stylesheet = await readFile(resolve(root, 'style.css'), 'utf8');
assert.match(stylesheet, /\.guide-page>\.top-right-actions\s*\{[^}]*position:\s*fixed/s, 'guide auxiliary actions must not enter the centered grid flow');
assert.match(stylesheet, /\.guide-page>\.guide-main\s*\{[^}]*justify-content:\s*center/s, 'guide main content must remain viewport-centered');

const recordScript = await readFile(resolve(root, 'js/script.js'), 'utf8');
const recordRenderer = await readFile(resolve(root, 'js/recordRenderer.js'), 'utf8');
const secureData = await readFile(resolve(root, 'js/secureData.js'), 'utf8');
assert.doesNotMatch(recordScript, /ClassRecordImageViewer\.open\(imagePath,[\s\S]{0,240}resolvedUrl:/, 'written image viewer must not pass its display-sized URL as the original');
assert.match(recordRenderer, /openImageViewer\(sourcePath,\s*\{[^}]*resolvedUrl\s*=\s*""[^}]*urlPromise\s*=\s*null/s, 'shared image viewer must retain guarded fallback support');
assert.match(recordRenderer, /const originalUrl\s*=\s*await resolveOriginalImageUrl\(sourcePath\)/, 'shared image viewer must resolve the original asset before display fallbacks');
assert.match(recordRenderer, /ClassRecordData\?\.isEnabled\?\.\(\)[^}]*signAssetUrl\(direct,\s*\{\s*quiet:\s*true,\s*forceRefresh\s*\}/s, 'secure image viewer paths must use signed Storage URLs before local image paths');
assert.match(recordScript, /if \(window\.ClassRecordData\?\.isEnabled\?\.\(\)\) return "";[^}]*images\\\//s, 'written image preload must not probe private Storage paths as local images');
assert.match(secureData, /signAssetUrl\s*=\s*async \(path,\s*\{[^}]*forceRefresh\s*=\s*false/, 'Storage signer must support refreshing an expired signed URL');
assert.match(secureData, /getAssetCacheKey\(safePath,\s*imageTransform\)/, 'original and transformed Storage URLs must use variant-aware cache keys');
assert.match(recordScript, /preloadAsset\(sourcePath,\s*\{[^}]*transform:\s*getWrittenImageDisplayTransform\(\)/s, 'written page images must request a display-sized transform');
assert.match(recordRenderer, /preloadAsset\(sourcePath,\s*\{[^}]*transform:\s*getIllustrationDisplayTransform\(\)/s, 'inline illustrations must request a display-sized transform');
assert.doesNotMatch(recordRenderer, /ClassRecordImageViewer\.open\(tooltipImage\.dataset\.previewSrc,[\s\S]{0,180}resolvedUrl:/, 'illustration viewer must not pass its display-sized URL as the original');
assert.match(recordRenderer, /image\.style\.width\s*=\s*`\$\{rendered\.width\}px`[^}]*image\.style\.height\s*=\s*`\$\{rendered\.height\}px`/s, 'image viewer zoom must increase the real render size');
assert.doesNotMatch(recordRenderer, /image\.style\.transform\s*=\s*`[^`]*scale\(\$\{scale\}\)/, 'image viewer must not upscale a low-resolution composited layer');
assert.match(recordRenderer, /translate3d\(calc\(-50% \+ \$\{panX\}px\),\s*calc\(-50% \+ \$\{panY\}px\),\s*0\)/, 'image viewer pan coordinates must share the same centered origin as its bounds');
assert.match(stylesheet, /\.image-viewer-frame\s*\{[^}]*border:\s*1px solid color-mix\([^}]*var\(--theme-accent-strong\)[^}]*background:[^}]*var\(--theme-surface\)/s, 'image viewer frame must use the active theme for its visual boundary');
assert.match(stylesheet, /\.image-viewer-frame img\s*\{[^}]*position:\s*absolute[^}]*top:\s*50%[^}]*left:\s*50%/s, 'image viewer images must use an explicit centered coordinate system');

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
