#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const pending = new Promise(() => {});
const context = vm.createContext({
  console,
  URL,
  URLSearchParams,
  Promise,
  Map,
  Set,
  Image: class {},
  requestAnimationFrame() {},
  setTimeout,
  clearTimeout,
  location: { href: 'https://example.test/record.html', pathname: '/record.html', search: '', hash: '' },
  history: { replaceState() {} },
  sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  document: {
    documentElement: { style: {}, clientWidth: 1280, clientHeight: 720 },
    addEventListener() {},
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  },
  window: {
    cacheReadyPromise: pending,
    addEventListener() {},
    removeEventListener() {},
    PeopleStore: { people: [] }
  }
});
context.window.window = context.window;

const renderer = await readFile(new URL('../js/recordRenderer.js', import.meta.url), 'utf8');
const store = await readFile(new URL('../js/recordStore.js', import.meta.url), 'utf8');
const page = await readFile(new URL('../js/script.js', import.meta.url), 'utf8');
vm.runInContext(renderer, context);
vm.runInContext(store, context);
vm.runInContext(`${page}
this.runRecordViewTest = ({ records, pages, messages, supplements, view, criteria }) => {
  allRecords = records;
  recordPageConfig = pages;
  pageMessageMap = new Map(messages.map((item) => [String(item.page), item]));
  pageSupplementMap = new Map();
  supplements.forEach((item) => {
    const values = pageSupplementMap.get(String(item.page)) || [];
    values.push(item);
    pageSupplementMap.set(String(item.page), values);
  });
  currentView = view;
  currentCriteria = criteria;
  const sources = getCurrentViewFilterRecords();
  const filtered = getFilteredRecords();
  const writtenPages = view === 'written' ? getWrittenPages(filtered) : [];
  return {
    sourceTypes: sources.map((item) => item.recordType || 'record'),
    filteredIds: filtered.map((item) => item.id),
    filteredTypes: filtered.map((item) => item.recordType || 'record'),
    pages: writtenPages.map((item) => item.page)
  };
};`, context);

const records = [
  { id: 'r1', fileName: '2026-01-01-01.json', date: '2026-01-01', author: 'alice', importance: 'important', content: '普通一 [[person:p1|甲]] [[quote:q1|术语甲]]' },
  { id: 'r2', fileName: '2026-01-02-01.json', date: '2026-01-02', author: 'bob', importance: 'normal', content: '普通二' }
];
const pages = [
  { page: '01', start: '2026-01-01-01.json', end: '2026-01-01-01.json', imagePath: 'pages/01.jpeg' },
  { page: '02', start: '2026-01-02-01.json', end: '2026-01-02-01.json', imagePath: 'pages/02.jpeg' },
  { page: '03', start: '', end: '', imagePath: 'pages/03.jpeg' }
];
const messages = [{ page: '03', author: 'messageauthor', content: 'messageonly [[person:p3|丙]]' }];
const supplements = [{ page: '02', supplementIndex: 1, author: 'suppauthor', importance: 'important', content: 'supponly [[quote:q2|术语乙]]' }];
const empty = { year: '', month: '', day: '', important: false, excludeDaily: false, query: '' };
const run = (view, criteria) => context.runRecordViewTest({ records, pages, messages, supplements, view, criteria: { ...empty, ...criteria } });

let result = run('list', empty);
assert.deepEqual(Array.from(result.sourceTypes), ['record', 'record']);
assert.deepEqual(new Set(result.filteredIds), new Set(['r1', 'r2']));

result = run('written', empty);
assert.deepEqual(Array.from(result.sourceTypes), ['record', 'record', 'message', 'supplement']);
assert.equal(result.filteredIds.length, 4, 'written count must include ordinary, message, and supplement records');
assert.deepEqual(Array.from(result.pages), ['01', '02', '03'], 'no filter must keep pages without ordinary records');

result = run('list', { year: '2026', month: '01', day: '02' });
assert.deepEqual(Array.from(result.filteredIds), ['r2']);
result = run('written', { year: '2026', month: '01', day: '02' });
assert.deepEqual(new Set(result.filteredIds), new Set(['r2', 'supplement-02-1']));
assert.deepEqual(Array.from(result.pages), ['02']);

result = run('list', { query: 'supponly' });
assert.equal(result.filteredIds.length, 0);
result = run('written', { query: 'supponly' });
assert.deepEqual(Array.from(result.filteredTypes), ['supplement']);
assert.deepEqual(Array.from(result.pages), ['02']);

result = run('written', { query: 'messageonly' });
assert.deepEqual(Array.from(result.filteredTypes), ['message']);
assert.deepEqual(Array.from(result.pages), ['03'], 'a matching message must keep a page with no ordinary records');

result = run('list', { important: true });
assert.deepEqual(Array.from(result.filteredIds), ['r1']);
result = run('written', { important: true });
assert.deepEqual(new Set(result.filteredIds), new Set(['r1', 'supplement-02-1']));

result = run('written', { query: 'suppauthor' });
assert.deepEqual(Array.from(result.filteredTypes), ['supplement'], 'recorder metadata must participate in keyword filtering');
result = run('written', { query: '甲' });
assert.deepEqual(Array.from(result.filteredIds), ['r1'], 'person marker text must participate in filtering');
result = run('written', { query: '术语乙' });
assert.deepEqual(Array.from(result.filteredTypes), ['supplement'], 'quote marker text must participate in filtering');

console.log('Passed list/written source, count, page retention, date, keyword, person, quote, author, and importance filter checks.');
