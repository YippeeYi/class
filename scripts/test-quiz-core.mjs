#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceCode = await readFile(resolve(root, 'js/quizCore.js'), 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(sourceCode, sandbox, { filename: 'quizCore.js' });
const core = sandbox.window.ClassRecordQuizCore;

const question = (source, content, type) => ({ id: `${source}-${content}-${type}`, source, content, type });
const makeSource = (id, sourceType, specification) => ({
  id,
  sourceType,
  variants: Object.fromEntries(Object.entries(specification).map(([content, types]) => [
    content,
    Object.fromEntries(types.map((type) => [type, question(id, content, type)]))
  ]))
});
const sources = [
  makeSource('record-a', 'record', { person: ['choice', 'fill', 'judge'], quote: ['choice', 'fill', 'judge'], author: ['choice', 'fill', 'judge'], date: ['choice'] }),
  makeSource('record-b', 'record', { author: ['choice', 'fill', 'judge'], date: ['choice'] }),
  makeSource('message-a', 'message', { person: ['choice', 'fill', 'judge'] }),
  makeSource('supplement-a', 'supplement', { quote: ['choice', 'fill', 'judge'] }),
  makeSource('hidden-a', 'hidden', { lamian: ['fill'] })
];

assert.deepEqual(Array.from(core.TYPE_BY_CONTENT.person), ['choice', 'fill', 'judge']);
assert.deepEqual(Array.from(core.TYPE_BY_CONTENT.quote), ['choice', 'fill', 'judge']);
assert.deepEqual(Array.from(core.TYPE_BY_CONTENT.author), ['choice', 'fill', 'judge']);
assert.deepEqual(Array.from(core.TYPE_BY_CONTENT.date), ['choice']);
assert.deepEqual(Array.from(core.TYPE_BY_CONTENT.lamian), ['fill']);

const expectedCompatibility = {
  person: ['choice', 'fill', 'judge'],
  quote: ['choice', 'fill', 'judge'],
  author: ['choice', 'fill', 'judge'],
  date: ['choice'],
  lamian: ['fill']
};
for (const [content, expectedTypes] of Object.entries(expectedCompatibility)) {
  for (const type of ['choice', 'fill', 'judge']) {
    const filters = { types: new Set([type]), contents: new Set([content]) };
    assert.equal(
      core.hasGeneratableQuestion(sources, filters, content === 'lamian'),
      expectedTypes.includes(type),
      `${content} + ${type} compatibility must match the specification`
    );
  }
}

const allTypes = new Set(['choice', 'fill', 'judge']);
const allContents = new Set(['person', 'quote', 'author', 'date', 'lamian']);
const lockedCandidates = core.getCandidateSources(sources, { types: allTypes, contents: allContents }, false);
assert.equal(lockedCandidates.some((item) => item.sourceType === 'hidden'), false, 'hidden content must not participate before lamian unlock');
const unlockedCandidates = core.getCandidateSources(sources, { types: allTypes, contents: allContents }, true);
assert.equal(unlockedCandidates.some((item) => item.sourceType === 'hidden'), true, 'hidden content must participate after lamian unlock');

const hiddenOnly = { types: new Set(['fill']), contents: new Set(['lamian']) };
assert.deepEqual(core.getCandidateSources(sources, hiddenOnly, false).map((item) => item.id), []);
assert.deepEqual(core.getCandidateSources(sources, hiddenOnly, true).map((item) => item.id), ['hidden-a']);
assert.equal(core.pickQuestion(sources, hiddenOnly, { secretUnlocked: true, random: () => 0 }).question.type, 'fill');

const authorOnly = { types: allTypes, contents: new Set(['author']) };
assert.deepEqual(core.getCandidateSources(sources, authorOnly, true).map((item) => item.id), ['record-a', 'record-b']);
const dateOnly = { types: allTypes, contents: new Set(['date']) };
assert.deepEqual(core.getCandidateSources(sources, dateOnly, true).map((item) => item.id), ['record-a', 'record-b']);
assert.deepEqual(core.getCandidateSources(sources, { types: allTypes, contents: new Set(['person']) }, false).map((item) => item.id), ['record-a', 'message-a']);
assert.deepEqual(core.getCandidateSources(sources, { types: allTypes, contents: new Set(['quote']) }, false).map((item) => item.id), ['record-a', 'supplement-a']);

let filters = { types: new Set(['judge']), contents: new Set(['person']) };
let result = core.simulateToggle(sources, filters, 'types', 'judge', false);
assert.equal(result.changed, false, 'last necessary type must not be removed');
assert.deepEqual([...result.filters.types], ['judge']);
result = core.simulateToggle(sources, filters, 'types', 'choice', false);
assert.equal(result.changed, true, 'an unselected option must always be selectable');
assert.deepEqual([...result.filters.types], ['judge', 'choice']);
assert.deepEqual([...result.filters.contents], ['person'], 'selecting a type must not auto-change contents');

filters = { types: new Set(['fill']), contents: new Set(['lamian']) };
result = core.simulateToggle(sources, filters, 'types', 'choice', true);
assert.equal(result.changed, true, 'even an incompatible unselected type must remain selectable');
result = core.simulateToggle(sources, result.filters, 'types', 'fill', true);
assert.equal(result.changed, false, 'fill remains necessary when hidden content is the only source');
assert.deepEqual([...result.filters.types], ['fill', 'choice']);
result = core.simulateToggle(sources, result.filters, 'types', 'choice', true);
assert.equal(result.changed, true, 'a selected but unnecessary type may be removed');

filters = { types: new Set(['choice']), contents: new Set(['person']) };
result = core.simulateToggle(sources, filters, 'contents', 'person', false);
assert.equal(result.changed, false, 'last necessary content must not be removed');
result = core.simulateToggle(sources, filters, 'contents', 'date', false);
assert.equal(result.changed, true, 'adding content must never remove the existing content');
assert.deepEqual([...result.filters.contents], ['person', 'date']);

const unionFilters = { types: allTypes, contents: new Set(['person', 'quote']) };
const unionCandidates = core.getCandidateSources(sources, unionFilters, false);
assert.equal(unionCandidates.filter((item) => item.id === 'record-a').length, 1, 'a source matching multiple contents must appear once');

function sequenceRandom(values) {
  let index = 0;
  return () => values[index++ % values.length];
}

const sourceCounts = new Map();
const equalSourceFilters = { types: new Set(['fill']), contents: new Set(['person', 'quote', 'lamian']) };
const sourceRandom = sequenceRandom([
  0.01, 0.01, 0.01,
  0.26, 0.01, 0.01,
  0.51, 0.01, 0.01,
  0.76, 0.01, 0.01
]);
for (let index = 0; index < 4000; index += 1) {
  const picked = core.pickQuestion(sources, equalSourceFilters, { secretUnlocked: true, random: sourceRandom });
  sourceCounts.set(picked.source.id, (sourceCounts.get(picked.source.id) || 0) + 1);
}
assert.deepEqual([...sourceCounts.values()], [1000, 1000, 1000, 1000], 'each eligible source must have equal sampling weight');

const singleSource = [sources[0]];
const contentCounts = { person: 0, quote: 0 };
const contentRandom = sequenceRandom([0, 0.25, 0, 0, 0.75, 0]);
for (let index = 0; index < 2000; index += 1) {
  const picked = core.pickQuestion(singleSource, { types: new Set(['fill']), contents: new Set(['person', 'quote']) }, { random: contentRandom });
  contentCounts[picked.content] += 1;
}
assert.deepEqual(contentCounts, { person: 1000, quote: 1000 }, 'available contents within a source must be equally likely');

const typeCounts = { choice: 0, fill: 0, judge: 0 };
const typeRandom = sequenceRandom([0, 0, 0.1, 0, 0, 0.4, 0, 0, 0.8]);
for (let index = 0; index < 3000; index += 1) {
  const picked = core.pickQuestion(singleSource, { types: allTypes, contents: new Set(['person']) }, { random: typeRandom });
  typeCounts[picked.type] += 1;
}
assert.deepEqual(typeCounts, { choice: 1000, fill: 1000, judge: 1000 }, 'available types must be equally likely');

console.log('Passed quiz core compatibility, constraint, hidden-content, deduplication, and equal-weight sampling checks.');
