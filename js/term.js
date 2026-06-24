/************************************************************
 * term.js
 * 班级辞典 · 术语页面（使用 CacheLoader + Store）
 ************************************************************/

const params = new URLSearchParams(location.search);
const termId = params.get("id");

if (!termId) {
    alert("未指定术语 ID");
    throw new Error("termId missing");
}

const recordContainer = document.getElementById("record-list");

// 页面状态
let allRecords = [];
let relatedRecords = [];
let termFilterCriteria = { year: "", month: "", day: "", important: false, excludeDaily: false };

/* ===============================
   页面初始化
   =============================== */
const cacheReady = window.cacheReadyPromise || Promise.resolve();

cacheReady.then(() => Promise.all([
    loadAllGlossary(), // 术语
    loadAllPeople(),   // 相关人物
    loadAllRecords()   // 记录
])).then(([glossary, people, records]) => {

    allRecords = records;

    // === 获取术语 ===
    const term = glossary.find(t => t.id === termId);
    if (!term) {
        alert("术语不存在");
        return;
    }

    // === 渲染术语信息 ===
    document.getElementById("term-id").innerHTML = formatContent(term.term);

    document.getElementById("term-definition").innerHTML =
        `<strong>${formatContent(term.definition || "—")}</strong>`;

    document.getElementById("term-since").textContent =
        term.since || "—";

    // 相关人物
    const relatedNames = (term.relatedPeople || [])
        .map(pid => {
            const p = people.find(x => x.id === pid);
            if (!p) return pid;
            return parseContent(`[[${p.id}|${p.id}]]`);
        });

    document.getElementById("term-related").innerHTML =
        relatedNames.length ? relatedNames.join("，") : "—";

    // === 关联记录（通过 {{termId|显示文本}}）===
    const pattern = new RegExp(`\\{\\{${termId}\\|.+?\\}\\}`);
    relatedRecords = allRecords.filter(r =>
        r.content && pattern.test(r.content)
    );
    sortRecords(relatedRecords);

    const filterHost = document.createElement("div");
    filterHost.id = "record-filter";
    recordContainer.before(filterHost);

    const renderFilteredRecords = () => {
        const filtered = filterRecordsByDate(relatedRecords, termFilterCriteria);
        sortRecords(filtered);
        renderRecordList(filtered, recordContainer);
    };

    renderRecordFilter({
        container: filterHost,
        getRecords: () => relatedRecords,
        initial: termFilterCriteria,
        onFilterChange: criteria => {
            termFilterCriteria = criteria;
            renderFilteredRecords();
        }
    });

    renderFilteredRecords();
});
