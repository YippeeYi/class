#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const context = vm.createContext({
    console,
    URL,
    performance,
    requestAnimationFrame: () => {},
    setTimeout,
    clearTimeout,
    location: { href: 'https://example.test/record.html' },
    sessionStorage: { setItem() {} },
    document: {
        addEventListener() {},
        getElementById() { return null; }
    },
    window: {
        addEventListener() {},
        PeopleStore: { people: [] }
    }
});

const source = await readFile(new URL('../js/recordRenderer.js', import.meta.url), 'utf8');
vm.runInContext(`${source}\nthis.renderMarkupForTest = parseContent;`, context);
const render = context.renderMarkupForTest;
const extractPeople = context.window.extractMentionedPersonIds;
const timelineSource = await readFile(new URL('../js/timeline.js', import.meta.url), 'utf8');
vm.runInContext(timelineSource, context);
const fixedScale = context.window.ClassRecordFixedChartScale;

const cases = [
    ['[[del:[[record:file-name|显示文字]]]]', ['inline-delete', 'record-jump-link']],
    ['[[anno:注解中包含 [[person:personId|显示名]]|被注释文字]]', ['annotation', '被注释文字']],
    ['[[illu:example.png|带有 [[red:红色文字]] 的文字]]', ['data-image-src="data/attachments/example.png"', 'inline-illustration', 'inline-red']],
    ['[[frac:[[del:上方文字]]|[[under:下方文字]]]]', ['inline-fraction', 'inline-delete', 'inline-underline']],
    ['[[red:包含 [[term:termId|术语]] 的文字]]', ['inline-red', 'term-tag']]
];

for (const [markup, expectedParts] of cases) {
    const html = render(markup);
    for (const part of expectedParts) assert.ok(html.includes(part), `${markup} should render ${part}`);
}

assert.match(render('[[hide:秘密]]'), /class="redacted"/);
assert.match(render('[[sup:2]]'), /<sup>2<\/sup>/);
assert.match(render('[[sub:6]]'), /<sub>6<\/sub>/);
assert.match(render('[[arrow:上方|下方]]'), /record-arrow-note/);
assert.match(render('[[center:标题]]'), /record-center-line/);
assert.match(render('[[right:署名]]'), /record-align-right/);
assert.match(render('[[anno:A\\|B|标签]]'), /data-note-source="A\\\|B"/);
assert.ok(render('普通 \\[[ 文本').includes('普通 [[ 文本'));

// The compatibility layer remains available for remote data not migrated yet.
assert.match(render('[[legacy-id|旧人物]]'), /person-tag/);
assert.match(render('{{legacy-term|旧术语}}'), /term-tag/);
assert.match(render('((旧黑幕))'), /redacted/);

assert.equal(render('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
assert.doesNotMatch(render('[[illu:../bad.svg|安全标签]]'), /inline-illustration/);
assert.match(render('[[illu:data/attachments/legacy.png|旧路径]]'), /data-image-src="data\/attachments\/legacy.png"/);

assert.equal([...extractPeople('[[person:alice|甲]][[person:alice|再次提及]][[bob|乙]]')].sort().join(','), 'alice,bob');
assert.equal([...extractPeople('[[del:[[person:a|甲]]]][[anno:注解提到 [[b|乙]]|[[red:[[person:c|丙]]]]]][[frac:[[d|丁]]|下方]]')].sort().join(','), 'a,b,c,d');
assert.equal(extractPeople('作者 alice；[[record:file|alice]][[illu:image.png|alice]][[red:alice]]').length, 0);
assert.equal([...fixedScale(8, 12, 3)].join(','), '12,9,6,3,0');
assert.equal([...fixedScale(72, 100, 25)].join(','), '100,75,50,25,0');
assert.equal([...fixedScale(13, 12, 3)].join(','), '15,12,9,6,3,0');
assert.equal([...fixedScale(101, 100, 25)].join(','), '125,100,75,50,25,0');

console.log(`Passed ${cases.length + 21} markup and timeline checks.`);
