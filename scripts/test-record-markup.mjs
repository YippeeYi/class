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
vm.runInContext(`${source}\nthis.renderMarkupForTest = parseContent; this.buildRecordBodyForTest = buildRecordBody; this.calculateImageViewerBoundsForTest = calculateImageViewerBounds; this.calculateImageViewerZoomForTest = calculateImageViewerZoom; this.calculateImageViewerFitForTest = calculateImageViewerFit; this.calculateImageViewerRenderSizeForTest = calculateImageViewerRenderSize; this.calculateImageViewerPanBoundsForTest = calculateImageViewerPanBounds; this.resolveImageViewerUrlForTest = resolveImageViewerUrl; this.resolveImageViewerFallbackUrlForTest = resolveImageViewerFallbackUrl;`, context);
const render = context.renderMarkupForTest;
const buildRecordBody = context.buildRecordBodyForTest;
const extractPeople = context.window.extractMentionedPersonIds;
const extractAuthors = context.window.extractExtraAuthorIds;
const extractQuotes = context.window.extractMentionedQuoteIds;
const getAuthors = context.window.getRecordAuthorIds;
const countTextCharacters = context.window.countRecordTextCharacters;
const calculateTooltipPosition = context.window.calculateInlineTooltipPosition;
const calculateImageViewerBounds = context.calculateImageViewerBoundsForTest;
const calculateImageViewerZoom = context.calculateImageViewerZoomForTest;
const calculateImageViewerFit = context.calculateImageViewerFitForTest;
const calculateImageViewerRenderSize = context.calculateImageViewerRenderSizeForTest;
const calculateImageViewerPanBounds = context.calculateImageViewerPanBoundsForTest;
const resolveImageViewerUrl = context.resolveImageViewerUrlForTest;
const resolveImageViewerFallbackUrl = context.resolveImageViewerFallbackUrlForTest;
const extractIllustrations = context.window.extractIllustrationPaths;
const extractTokens = context.window.extractRecordMarkupTokens;
const timelineSource = await readFile(new URL('../js/timeline.js', import.meta.url), 'utf8');
vm.runInContext(timelineSource, context);
const fixedScale = context.window.ClassRecordFixedChartScale;
const peopleContainer = { innerHTML: '', addEventListener() {} };
const peopleContext = vm.createContext({
    console,
    location: { href: '' },
    document: {
        getElementById() { return peopleContainer; },
        querySelectorAll() { return []; }
    },
    window: { cacheReadyPromise: new Promise(() => {}) }
});
const peopleSource = await readFile(new URL('../js/people.js', import.meta.url), 'utf8');
vm.runInContext(`${peopleSource}\nthis.sortPeopleForTest = sortPeople; this.getPeopleColumnsForTest = getPeopleTableColumns;`, peopleContext);

const cases = [
    ['[[del:[[record:file-name|显示文字]]]]', ['inline-delete', 'record-jump-link']],
    ['[[anno:注解中包含 [[person:personId|显示名]]|被注释文字]]', ['annotation', '被注释文字']],
    ['[[illu:example.png|带有 [[red:红色文字]] 的文字]]', ['data-image-src="data/attachments/example.png"', 'inline-illustration', 'inline-red']],
    ['[[illu:hidden/example.png|隐藏插图]]', ['data-image-src="hidden/data/attachments/example.png"', 'inline-illustration']],
    ['[[material:basketball-rule|篮球规则]]', ['material-jump-link', 'data-material-jump="basketball-rule"', '篮球规则']],
    ['[[table:2x3|姓名|项目|结果|张三|跳远|2.1m]]', ['record-inline-table', '<td>姓名</td>', '<td>2.1m</td>']],
    ['[[table:2x3|A||C|D|E|]]', ['record-inline-table', '<td></td>', '<td>C</td>']],
    ['[[table:1x2|[[person:a|甲]]|[[material:m|资料]]]]', ['record-inline-table', '--record-table-width:', '<colgroup>', 'style="width:', 'em"', 'person-tag', 'material-jump-link']],
    ['[[table:1x2|短项|这是一段明显更长并且可能需要换行的表格内容，用来验证表格会尽量占满可用宽度]]', ['record-inline-table is-expanded', '--record-table-width:', '<colgroup>', '%"']],
    ['[[frac:[[del:上方文字]]|[[under:下方文字]]]]', ['inline-fraction', 'inline-delete', 'inline-underline']],
    ['[[red:包含 [[quote:quoteId|名言]] 的文字]]', ['inline-red', 'quote-tag']],
    ['[[del:[[red:红色删除文字]]]]', ['inline-delete', 'inline-red']],
    ['[[red:[[del:删除红色文字]]]]', ['inline-red', 'inline-delete']],
    ['[[author:writer|记录人]]', ['person-tag', 'data-id="writer"']]
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

assert.equal(render('[[legacy-id|旧人物]]'), '[[legacy-id|旧人物]]');
assert.equal(render('{{legacy-quote|旧名言}}'), '{{legacy-quote|旧名言}}');
assert.equal(render('((旧黑幕))'), '((旧黑幕))');
assert.equal(render('[[unknown:值|标签]]'), '[[unknown:值|标签]]');

assert.equal(render('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
const quizStemMarkup = render('[[person:alice|Alice]][[quote:q1|Quote]][[record:2024-01|Record]][[material:m1|Material]][[red:kept]]', {
    plainReferenceTypes: new Set(['person', 'author', 'quote', 'record', 'material'])
});
assert.equal(quizStemMarkup, 'AliceQuoteRecordMaterial<span class="inline-red">kept</span>');

const escapedRecord = buildRecordBody({
    id: '<img src=x onerror=alert(1)>',
    date: '<script>alert(1)</script>',
    author: 'bad]]<svg/onload=alert(1)>',
    content: '<b>unsafe</b>',
    attachments: [{ file: 'x" onmouseover="alert(1)', name: '<img src=x onerror=alert(1)>' }]
});
assert.doesNotMatch(escapedRecord, /<script>|<svg|<img src=x/i);
assert.match(escapedRecord, /&lt;script&gt;|&lt;img/);
assert.doesNotMatch(render('[[illu:../bad.svg|安全标签]]'), /inline-illustration/);
assert.doesNotMatch(render('[[illu:data/attachments/legacy.png|旧路径]]'), /inline-illustration/);

assert.equal([...extractPeople('[[person:alice|甲]][[person:alice|再次提及]][[person:bob|乙]]')].sort().join(','), 'alice,bob');
assert.equal([...extractPeople('[[del:[[person:a|甲]]]][[anno:注解提到 [[person:b|乙]]|[[red:[[person:c|丙]]]]]][[frac:[[person:d|丁]]|下方]]')].sort().join(','), 'a,b,c,d');
assert.equal(extractPeople('作者 alice；[[record:file|alice]][[illu:image.png|alice]][[red:alice]]').length, 0);
assert.equal(extractPeople('[[author:alice|甲]][[red:[[author:bob|乙]]]]').length, 0);
assert.equal([...extractAuthors('[[author:alice|甲]][[red:[[author:bob|乙]]]][[author:alice|重复]]')].sort().join(','), 'alice,bob');
assert.equal([...getAuthors({ author: 'alice', content: '[[author:alice|重复]][[author:bob|乙]]' })].sort().join(','), 'alice,bob');
assert.equal([...extractQuotes('[[quote:t1|名言]][[del:[[quote:t2|另一名言]]]][[anno:提到 [[quote:t3|名言]]|[[quote:t1|重复]]]]')].sort().join(','), 't1,t2,t3');
assert.equal(extractTokens('[[red:[[person:a|甲]]]][[quote:q1|名言]]', 'person')[0].label, '甲');
assert.equal(extractTokens('[[red:[[person:a|甲]]]][[quote:q1|名言]]', 'quote')[0].label, '名言');
assert.equal(extractQuotes('普通文本 t1；[[person:t2|不是名言]][[record:t3|不是名言]]').length, 0);
assert.equal(countTextCharacters('甲[[person:a|乙]][[red:丙]]'), 3);
assert.equal(countTextCharacters('[[material:m|资料]][[table:1x2|甲|乙]]'), 4);
assert.equal(countTextCharacters('\u7532\uff0cA 1\u2460\u2461\u3002!'), 5);
assert.equal(countTextCharacters('[[illu:example.png|\u56feA-1!]]'), 3);
assert.equal(countTextCharacters('[[illu:example.png]]'), 0);
assert.equal(countTextCharacters('[[table:1x2|\u7532\uff0cA|\u2460-9!]]'), 4);
assert.equal(extractIllustrations('[[illu:example.jpeg|插图]]').join(','), 'data/attachments/example.jpeg');
assert.equal(calculateTooltipPosition({ tagRect: { left: 20, top: 40, right: 120, bottom: 80, width: 100 }, tooltipRect: { width: 100, height: 40 }, viewportWidth: 300, viewportHeight: 200, pointer: { x: 150, y: 60 } }).top, 88);
assert.equal(calculateTooltipPosition({ tagRect: { left: 20, top: 120, right: 120, bottom: 140, width: 100 }, tooltipRect: { width: 100, height: 40 }, viewportWidth: 300, viewportHeight: 200, pointer: { x: 150, y: 130 } }).top, 72);
assert.equal(calculateTooltipPosition({ tagRect: { left: 0, top: 40, right: 100, bottom: 80, width: 100 }, tooltipRect: { width: 100, height: 40 }, viewportWidth: 300, viewportHeight: 200, pointer: { x: 5, y: 60 } }).left, 12);
assert.equal(calculateTooltipPosition({ tagRect: { left: 200, top: 40, right: 300, bottom: 80, width: 100 }, tooltipRect: { width: 100, height: 40 }, viewportWidth: 300, viewportHeight: 200, pointer: { x: 295, y: 60 } }).left, 188);
assert.equal(calculateTooltipPosition({ tagRects: [{ left: 20, right: 180, top: 40, bottom: 60 }, { left: 20, right: 90, top: 64, bottom: 84 }], tooltipRect: { width: 100, height: 40 }, viewportWidth: 300, viewportHeight: 200, pointer: { x: 65, y: 72 } }).top, 92);
assert.equal(calculateTooltipPosition({ tagRects: [{ left: 20, right: 180, top: 20, bottom: 40 }, { left: 20, right: 90, top: 120, bottom: 140 }], tooltipRect: { width: 100, height: 40 }, viewportWidth: 300, viewportHeight: 220, pointer: { x: 65, y: 130 } }).top, 72);
assert.deepEqual({ ...calculateImageViewerBounds(1366, 768) }, { width: 1280, height: 712 });
assert.deepEqual({ ...calculateImageViewerBounds(390, 844) }, { width: 362, height: 816 });
assert.deepEqual({ ...calculateImageViewerBounds(900, 500) }, { width: 846, height: 446 });
const tallImageFit = calculateImageViewerFit(1200, 5000, 818, 418);
assert.ok(Math.abs(tallImageFit.width - 100.32) < 0.0001 && Math.abs(tallImageFit.height - 418) < 0.0001);
assert.deepEqual({ ...calculateImageViewerFit(200, 100, 818, 418) }, { width: 200, height: 100 });
assert.deepEqual({ ...calculateImageViewerRenderSize(400, 600, 4) }, { width: 1600, height: 2400 });
assert.deepEqual({ ...calculateImageViewerPanBounds(1600, 2400, 800, 600) }, { x: 400, y: 900 });
assert.deepEqual({ ...calculateImageViewerPanBounds(400, 300, 800, 600) }, { x: 0, y: 0 });
const zoomedAroundPointer = { ...calculateImageViewerZoom({ scale: 1, panX: 0, panY: 0, pointX: 100, pointY: -50, deltaY: -1000 }) };
assert.ok(zoomedAroundPointer.scale > 1);
assert.ok(Math.abs((100 - zoomedAroundPointer.panX) / zoomedAroundPointer.scale - 100) < 0.0001);
assert.ok(Math.abs((-50 - zoomedAroundPointer.panY) / zoomedAroundPointer.scale + 50) < 0.0001);
assert.deepEqual({ ...calculateImageViewerZoom({ scale: 2, panX: 40, panY: 20, pointX: 10, pointY: 10, deltaY: 10000 }) }, { scale: 0.25, panX: 0, panY: 0 });
let resolvePendingViewerUrl;
let pendingViewerState = 'loading';
const pendingViewerUrl = new Promise((resolve) => { resolvePendingViewerUrl = resolve; });
const pendingViewerResult = resolveImageViewerUrl('', { urlPromise: pendingViewerUrl })
    .then((url) => { pendingViewerState = 'success'; return url; });
await Promise.resolve();
assert.equal(pendingViewerState, 'loading');
resolvePendingViewerUrl('https://example.test/image.jpeg');
assert.equal(await pendingViewerResult, 'https://example.test/image.jpeg');
assert.equal(pendingViewerState, 'success');
context.window.ClassRecordData = {
    isEnabled: () => true,
    signAssetUrl: async (path) => `https://storage.example.test/original/${path}`
};
assert.equal(
    await resolveImageViewerUrl('images/record-pages/01.jpeg', { resolvedUrl: 'https://storage.example.test/thumbnail.jpeg' }),
    'https://storage.example.test/original/images/record-pages/01.jpeg'
);
context.window.ClassRecordData.signAssetUrl = async () => '';
assert.equal(
    await resolveImageViewerUrl('images/record-pages/01.jpeg', { resolvedUrl: 'https://storage.example.test/already-loaded.jpeg' }),
    'https://storage.example.test/already-loaded.jpeg'
);
let forceRefreshReceived = false;
context.window.ClassRecordData.signAssetUrl = async (path, options) => {
    forceRefreshReceived = options.forceRefresh;
    return 'https://storage.example.test/fresh-original.jpeg';
};
assert.equal(
    await resolveImageViewerFallbackUrl(
        'images/record-pages/01.jpeg',
        { resolvedUrl: 'https://storage.example.test/already-loaded.jpeg' },
        new Set(['https://storage.example.test/expired-original.jpeg']),
        { forceRefresh: true }
    ),
    'https://storage.example.test/fresh-original.jpeg'
);
assert.equal(forceRefreshReceived, true);
delete context.window.ClassRecordData;
assert.equal([...fixedScale(8, 12, 3)].join(','), '12,9,6,3,0');
assert.equal([...fixedScale(72, 100, 25)].join(','), '100,75,50,25,0');
assert.equal([...fixedScale(1200, 3000, 750)].join(','), '3000,2250,1500,750,0');
assert.equal([...fixedScale(640, 1000, 250)].join(','), '1000,750,500,250,0');
assert.equal([...fixedScale(13, 12, 3)].join(','), '15,12,9,6,3,0');
assert.equal([...fixedScale(101, 100, 25)].join(','), '125,100,75,50,25,0');
assert.equal(
    peopleContext.sortPeopleForTest([
        { id: 'chem', subject: '化学' },
        { id: 'unknown', subject: '' },
        { id: 'chinese', subject: '语文' },
        { id: 'math', subject: '数学' }
    ], { key: 'subject', order: 'asc' }, 'teacher').map((item) => item.id).join(','),
    'chinese,math,chem,unknown'
);
assert.equal(
    peopleContext.sortPeopleForTest([
        { id: 'former', main: false },
        { id: 'main-b', main: true },
        { id: 'main-a', main: true }
    ], { key: 'id', order: 'asc', mainFirst: true }, 'teacher').map((item) => item.id).join(','),
    'main-a,main-b,former'
);
assert.equal(
    peopleContext.sortPeopleForTest([
        { id: 'main-math', main: true, subject: '数学' },
        { id: 'main-chinese', main: true, subject: '语文' },
        { id: 'normal-chem', main: false, subject: '化学' },
        { id: 'normal-physics', main: false, subject: '物理' }
    ], { key: 'subject', order: 'desc', mainFirst: true }, 'teacher').map((item) => item.id).join(','),
    'main-math,main-chinese,normal-chem,normal-physics'
);
assert.equal(peopleContext.getPeopleColumnsForTest('student').map((column) => column.label).join(','), '序号,姓名,别名,参与,记录,记录字数');
assert.equal(peopleContext.getPeopleColumnsForTest('teacher').map((column) => column.label).join(','), '序号,姓名,别名,参与,学科');
assert.equal(peopleContext.getPeopleColumnsForTest('other').map((column) => column.label).join(','), '序号,姓名,别名,参与');

console.log(`Passed ${cases.length + 47} markup, people, and timeline checks.`);
