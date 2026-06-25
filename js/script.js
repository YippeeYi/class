/************************************************************
 * script.js
 * 主页面逻辑
 ************************************************************/

const container = document.getElementById("record-list");
const filterContainer = document.getElementById("record-filter");
let allRecords = [];
let recordPageConfig = [];
let favoriteRecordKeys = null;

function parseInitialRecordCriteria() {
  const params = new URLSearchParams(location.search);
  return {
    year: params.get("year") || "",
    month: params.get("month") || "",
    day: params.get("day") || "",
    important: params.get("important") === "1" || params.get("important") === "true",
    excludeDaily: params.get("excludeDaily") === "1" || params.get("excludeDaily") === "true",
    favorites: params.get("favorites") === "1" || params.get("favorites") === "true",
    query: params.get("q") || ""
  };
}

let currentCriteria = parseInitialRecordCriteria();
let currentView = "list";
let currentPageIndex = 0;

function getRecordSerial(record) {
  return (record.fileName || record.id || "").replace(/.json$/i, "").slice(-2);
}

function isDailyRecord(record) {
  return getRecordSerial(record) === "00";
}

function getFilteredRecords() {
  let filtered = filterRecordsByDate(allRecords, currentCriteria);
  if (currentCriteria.favorites) {
    filtered = favoriteRecordKeys ? filtered.filter((record) => favoriteRecordKeys.has(record.fileName || record.id)) : [];
  }
  sortRecords(filtered);
  return filtered;
}

function normalizeFileName(value) {
  return String(value || "").trim().replace(/^data\/record\//i, "");
}

function normalizeRecordPage(page, index) {
  if (typeof page === "string") {
    return { page, start: "", end: "" };
  }
  return {
    page: String(page?.page || page?.id || String(index + 1).padStart(2, "0")).trim(),
    start: normalizeFileName(page?.start || page?.startFile || page?.from),
    end: normalizeFileName(page?.end || page?.endFile || page?.to)
  };
}

async function loadRecordPageConfig() {
  try {
    const pages = window.ClassRecordData?.isEnabled()
      ? await window.ClassRecordData.loadRecordPages()
      : await (async () => {
        const res = await fetch("data/record/record_pages.json");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })();
    recordPageConfig = Array.isArray(pages) ? pages.map(normalizeRecordPage).filter((page) => page.page) : [];
  } catch (error) {
    console.warn("无法加载书面记录页配置：", error);
    recordPageConfig = [];
  }
}

function getRecordIndexMap() {
  const map = new Map();
  allRecords.forEach((record) => {
    const fileName = normalizeFileName(record.fileName);
    if (fileName) map.set(fileName, record.recordIndex);
  });
  return map;
}

function getPageRecords(page, filteredRecords, recordIndexMap) {
  const startIndex = recordIndexMap.get(normalizeFileName(page.start));
  const endIndex = recordIndexMap.get(normalizeFileName(page.end));
  if (!Number.isInteger(startIndex) || !Number.isInteger(endIndex)) {
    return [];
  }

  const from = Math.min(startIndex, endIndex);
  const to = Math.max(startIndex, endIndex);
  return filteredRecords.filter((record) => record.recordIndex >= from && record.recordIndex <= to);
}

function getWrittenPages(records) {
  const recordIndexMap = getRecordIndexMap();
  return recordPageConfig
    .map((page) => ({ ...page, records: getPageRecords(page, records, recordIndexMap) }))
    .filter((page) => page.records.length || (!page.start && !page.end));
}

function renderWrittenView(records) {
  const pages = getWrittenPages(records);
  if (!pages.length) {
<<<<<<< HEAD
    container.innerHTML = '<div class="record-written-empty">\u5f53\u524d\u7b5b\u9009\u6761\u4ef6\u4e0b\u6ca1\u6709\u53ef\u5c55\u793a\u7684\u8bb0\u5f55\u3002</div>';
=======
    container.innerHTML = '<div class="record-written-empty">当前筛选条件下没有可展示的记录。</div>';
>>>>>>> parent of df4efb0 (add)
    return;
  }
  currentPageIndex = Math.min(currentPageIndex, pages.length - 1);
  const page = pages[currentPageIndex];
  const pageRecords = page.records || [];
  pageRecords.sort((a, b) => (a.recordIndex ?? 0) - (b.recordIndex ?? 0));
  const imageBase = `images/record-pages/${page.page}`;
  const pageOptions = pages.map((item, index) => `
    <button type="button" class="btn-action filter-option${index === currentPageIndex ? ' is-active' : ''}" data-page-index="${index}">
      ${item.page}
    </button>
  `).join("");
  container.innerHTML = `
    <section class="record-written-view">
      <div class="record-written-toolbar">
<<<<<<< HEAD
        <button class="btn-action record-page-prev" type="button" ${currentPageIndex <= 0 ? 'disabled' : ''}>\u4e0a\u4e00\u9875</button>
        <span class="record-written-page">${page.page} \u9875 \u7b2c ${currentPageIndex + 1} / ${pages.length} \u9875</span>
        <button class="btn-action record-page-next" type="button" ${currentPageIndex >= pages.length - 1 ? 'disabled' : ''}>\u4e0b\u4e00\u9875</button>
        <div class="filter-field record-page-jump">
          <label>\u8df3\u8f6c</label>
          <button type="button" class="btn-select filter-dropdown-trigger record-page-trigger">\u7b2c ${page.page} \u9875<span class="dropdown-arrow" aria-hidden="true">\u25be</span></button>
          <div class="filter-options record-page-options" role="group" aria-label="\u9009\u62e9\u4e66\u9762\u8bb0\u5f55\u9875">
=======
        <button class="btn-action record-page-prev" type="button" ${currentPageIndex <= 0 ? 'disabled' : ''}>上一页</button>
        <span class="record-written-page">${page.page} · 第 ${currentPageIndex + 1} / ${pages.length} 页</span>
        <button class="btn-action record-page-next" type="button" ${currentPageIndex >= pages.length - 1 ? 'disabled' : ''}>下一页</button>
        <div class="filter-field record-page-jump">
          <label>跳转</label>
          <button type="button" class="btn-select filter-dropdown-trigger record-page-trigger">第 ${page.page} 页 <span class="dropdown-arrow" aria-hidden="true">▾</span></button>
          <div class="filter-options record-page-options" role="group" aria-label="选择书面记录页">
>>>>>>> parent of df4efb0 (add)
            ${pageOptions}
          </div>
        </div>
      </div>
      <div class="record-written-layout">
        <figure class="record-written-image">
<<<<<<< HEAD
          <img src="" data-secure-src="${imageBase}.jpeg" alt="${page.page} \u539f\u59cb\u4e66\u9762\u8bb0\u5f55" loading="eager" decoding="async" fetchpriority="high">
          <span class="record-written-image-loading">\u52a0\u8f7d\u4e2d...</span>
=======
          <img src="" data-secure-src="${imageBase}.png" alt="${page.page} 原始书面记录" loading="eager" decoding="async" fetchpriority="high">
          <span class="record-written-image-loading">加载中…</span>
>>>>>>> parent of df4efb0 (add)
        </figure>
        <div class="record-written-records"></div>
      </div>
    </section>
  `;
  renderRecordList(pageRecords, container.querySelector(".record-written-records"));
  if (window.ClassRecordData?.isEnabled()) {
    window.ClassRecordData.resolveAssetElements(container).catch((error) => console.warn("\u4e66\u9762\u8bb0\u5f55\u56fe\u7247\u52a0\u8f7d\u5931\u8d25\uff1a", error));
  } else {
<<<<<<< HEAD
    container.querySelector(".record-written-image")?.classList.add("is-missing");
    console.warn("Supabase ????????????????????");
=======
    const img = container.querySelector(".record-written-image img");
    if (img && !img.src) img.src = `${imageBase}.png`;
>>>>>>> parent of df4efb0 (add)
  }
  container.querySelector(".record-page-prev")?.addEventListener("click", () => {
    currentPageIndex = Math.max(currentPageIndex - 1, 0);
    renderCurrentViewAsync();
  });
  container.querySelector(".record-page-next")?.addEventListener("click", () => {
    currentPageIndex = Math.min(currentPageIndex + 1, pages.length - 1);
    renderCurrentViewAsync();
  });
  const pageJump = container.querySelector(".record-page-jump");
  let pageJumpCloseTimer = null;
  const openPageJump = () => {
    window.clearTimeout(pageJumpCloseTimer);
    pageJump?.classList.add("is-open");
  };
  const closePageJump = (withDelay = true) => {
    window.clearTimeout(pageJumpCloseTimer);
    if (!pageJump) return;
    if (!withDelay) {
      pageJump.classList.remove("is-open");
      return;
    }
    pageJumpCloseTimer = window.setTimeout(() => {
      pageJump.classList.remove("is-open");
    }, 140);
  };
  pageJump?.addEventListener("mouseenter", openPageJump);
  pageJump?.addEventListener("mouseleave", () => closePageJump(true));
  pageJump?.querySelector(".record-page-trigger")?.addEventListener("click", () => {
    window.clearTimeout(pageJumpCloseTimer);
    pageJump.classList.toggle("is-open");
  });
  pageJump?.querySelector(".record-page-options")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-page-index]");
    if (!button) return;
    currentPageIndex = Math.min(Math.max(Number(button.dataset.pageIndex) || 0, 0), pages.length - 1);
    closePageJump(false);
    renderCurrentViewAsync();
  });
}

async function ensureFavoriteRecordKeys() {
  if (!currentCriteria.favorites || favoriteRecordKeys) return;
  if (!window.RecordInteractions?.getFavoriteKeys) {
    favoriteRecordKeys = new Set();
    return;
  }
  favoriteRecordKeys = await window.RecordInteractions.getFavoriteKeys().catch((error) => {
    console.warn("收藏记录加载失败：", error);
    return new Set();
  });
}

async function renderCurrentViewAsync() {
  await ensureFavoriteRecordKeys();
  renderCurrentView();
}

function renderCurrentView() {
  const records = getFilteredRecords();
  if (currentView === "written") {
    renderWrittenView(records);
  } else {
    renderRecordList(records, container);
  }
}

function renderViewControls() {
  const controls = document.createElement("div");
  controls.className = "record-view-switch switch-group";
  controls.innerHTML = `
    <button class="switch-btn active" type="button" data-view="list">按条显示</button>
    <button class="switch-btn" type="button" data-view="written">书面记录</button>
  `;
  filterContainer?.before(controls);
  controls.addEventListener("click", (event) => {
    const button = event.target.closest(".switch-btn");
    if (!button) return;
    currentView = button.dataset.view || "list";
    currentPageIndex = 0;
    controls.querySelectorAll(".switch-btn").forEach((item) => item.classList.toggle("active", item === button));
    renderCurrentViewAsync();
  });
}

window.addEventListener("recordfavoritechange", (event) => {
  if (!favoriteRecordKeys) return;
  const key = event.detail?.recordKey;
  if (!key) return;
  if (event.detail?.favorited) {
    favoriteRecordKeys.add(key);
  } else {
    favoriteRecordKeys.delete(key);
  }
  if (currentCriteria.favorites) renderCurrentViewAsync();
});

/* ===============================
   加载并渲染记录
   =============================== */
const cacheReady = window.cacheReadyPromise || Promise.resolve();

cacheReady.then(() => Promise.all([loadAllRecords(), loadRecordPageConfig()]))
  .then(([records]) => {
    allRecords = records;
    sortRecords(allRecords);
    renderViewControls();
    renderCurrentViewAsync();

    renderRecordFilter({
      container: filterContainer,
      getRecords: () => allRecords,
      initial: currentCriteria,
      onFilterChange: criteria => {
        currentCriteria = criteria;
        if (!criteria.favorites) favoriteRecordKeys = null;
        currentPageIndex = 0;
        renderCurrentViewAsync();
      }
    });
  });

