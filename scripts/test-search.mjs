#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const elements = {
    'global-search-input': { value: '', addEventListener() {} },
    'search-results': { innerHTML: '', addEventListener() {} },
    'search-summary': { textContent: '' },
    'global-search-types': { addEventListener() {} }
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
const window = {
    cacheReadyPromise: Promise.resolve(),
    loadAllRecords: async () => records,
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

const renderedCards = (elements['search-results'].innerHTML.match(/class="search-result-card"/g) || []).length;
assert.equal(renderedCards, 125, 'every matching search result must be rendered');
assert.match(elements['search-summary'].textContent, /125/);
console.log('Passed 125-result search rendering check.');
