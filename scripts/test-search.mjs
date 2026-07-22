#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const elements = {
    'global-search-input': { value: '', addEventListener() {}, focus() {} },
    'search-results': { innerHTML: '', hidden: true, addEventListener() {}, removeAttribute(name) { if (name === 'hidden') this.hidden = false; } },
    'search-summary': { textContent: '' },
    'global-search-types': { addEventListener() {} },
    'search-panel': { hidden: true, removeAttribute(name) { if (name === 'hidden') this.hidden = false; } },
    'search-loading': { hidden: false, setAttribute(name) { if (name === 'hidden') this.hidden = true; } }
};
const records = Array.from({ length: 125 }, (_, index) => ({
    id: `record-${String(index + 1).padStart(3, '0')}`,
    fileName: `record-${index + 1}.json`,
    date: '2026-01-01',
    author: 'tester',
    content: `needle result ${index + 1}`,
    attachments: []
}));
const location = { pathname: '/search.html', search: '?q=needle', href: 'https://example.test/search.html?q=needle' };
let resolveIndex;
const indexGate = new Promise((resolve) => { resolveIndex = resolve; });
const window = {
    cacheReadyPromise: Promise.resolve(),
    loadAllRecords: async () => { await indexGate; return records; },
    loadAllPeople: async () => [],
    loadAllQuotes: async () => []
};
const context = vm.createContext({
    console,
    document: { getElementById: (id) => elements[id] || null },
    window,
    location,
    history: { replaceState() {} },
    sessionStorage: { setItem() {} },
    URL,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    stripRecordMarkup: (value) => String(value || ''),
    parseContent: (value) => String(value || ''),
    formatContent: (value) => String(value || ''),
    extractMentionedQuoteIds: () => [],
    getRecordAnchorId: (record) => record.id
});

const source = await readFile(new URL('../js/search.js', import.meta.url), 'utf8');
vm.runInContext(source, context);
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(elements['search-loading'].hidden, false, 'search loader must remain visible while index data is pending');
assert.equal(elements['search-panel'].hidden, true, 'search controls must remain hidden while index data is pending');
assert.equal(elements['search-results'].hidden, true, 'search results must remain hidden while index data is pending');
resolveIndex();
await new Promise((resolve) => setTimeout(resolve, 0));

const renderedCards = (elements['search-results'].innerHTML.match(/class="search-result-card"/g) || []).length;
assert.equal(renderedCards, 125, 'every matching search result must be rendered');
assert.match(elements['search-summary'].textContent, /125/);
assert.equal(elements['search-loading'].hidden, true, 'search loader must hide after the index is ready');
assert.equal(elements['search-panel'].hidden, false, 'search controls must show after the index is ready');
assert.equal(elements['search-results'].hidden, false, 'search results must show after the index is ready');
console.log('Passed 125-result search rendering check.');
