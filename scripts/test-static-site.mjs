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
}

const vercel = JSON.parse(await readFile(resolve(root, 'vercel.json'), 'utf8'));
assert.ok(Array.isArray(vercel.headers) && vercel.headers.length, 'vercel.json must configure security headers');
assert.ok(Array.isArray(vercel.rewrites) && vercel.rewrites.some((item) => item.source === '/data/(.*)'), 'local data must not be publicly served');

const stylesheet = await readFile(resolve(root, 'style.css'), 'utf8');
assert.match(stylesheet, /\.guide-page>\.top-right-actions\s*\{[^}]*position:\s*fixed/s, 'guide auxiliary actions must not enter the centered grid flow');
assert.match(stylesheet, /\.guide-page>\.guide-main\s*\{[^}]*justify-content:\s*center/s, 'guide main content must remain viewport-centered');

const recordScript = await readFile(resolve(root, 'js/script.js'), 'utf8');
const recordRenderer = await readFile(resolve(root, 'js/recordRenderer.js'), 'utf8');
const secureData = await readFile(resolve(root, 'js/secureData.js'), 'utf8');
assert.match(recordScript, /resolvedUrl:\s*loadedUrl\s*\|\|\s*getCachedWrittenImageSource/, 'written image viewer must reuse an already loaded or cached full-resolution URL');
assert.match(recordScript, /urlPromise:\s*\(\)\s*=>\s*preloadWrittenImage/, 'written image viewer must wait for the shared preload promise');
assert.match(recordRenderer, /openImageViewer\(sourcePath,\s*\{[^}]*resolvedUrl\s*=\s*""[^}]*urlPromise\s*=\s*null/s, 'shared image viewer must accept resolved and pending image sources');
assert.match(recordRenderer, /const originalUrl\s*=\s*await resolveOriginalImageUrl\(sourcePath\)/, 'shared image viewer must resolve the original asset before display fallbacks');
assert.match(recordRenderer, /ClassRecordData\?\.isEnabled\?\.\(\)[^}]*signAssetUrl\(direct,\s*\{\s*quiet:\s*true,\s*forceRefresh\s*\}/s, 'secure image viewer paths must use signed Storage URLs before local image paths');
assert.match(recordScript, /if \(window\.ClassRecordData\?\.isEnabled\?\.\(\)\) return "";[^}]*images\\\//s, 'written image preload must not probe private Storage paths as local images');
assert.match(secureData, /signAssetUrl\s*=\s*async \(path,\s*\{[^}]*forceRefresh\s*=\s*false/, 'Storage signer must support refreshing an expired signed URL');
assert.match(stylesheet, /\.image-viewer-frame\s*\{[^}]*border:\s*1px solid color-mix\([^}]*var\(--theme-accent-strong\)[^}]*background:[^}]*var\(--theme-surface\)/s, 'image viewer frame must use the active theme for its visual boundary');

const quizPage = await readFile(resolve(root, 'quiz.html'), 'utf8');
assert.ok(quizPage.indexOf('js/quizCore.js') < quizPage.indexOf('js/quizApp.js'), 'quiz core must load before the UI controller');

console.log(`Passed static checks for ${pages.length} pages.`);
