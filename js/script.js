/************************************************************
 * script.js
 * 涓婚〉闈㈤€昏緫
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
let hiddenMode = false;

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
    const pages = await window.ClassRecordData.loadRecordPages();
    recordPageConfig = Array.isArray(pages) ? pages.map(normalizeRecordPage).filter((page) => page.page) : [];
  } catch (error) {
    console.warn("收藏记录加载失败：", error);
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
    container.innerHTML = '<div class="record-written-empty">褰撳墠绛涢€夋潯浠朵笅娌℃湁鍙睍绀虹殑璁板綍銆?/div>';
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
        <button class="btn-action record-page-prev" type="button" ${currentPageIndex <= 0 ? 'disabled' : ''}>涓婁竴椤?/button>
        <span class="record-written-page">${page.page} 路 绗?${currentPageIndex + 1} / ${pages.length} 椤?/span>
        <button class="btn-action record-page-next" type="button" ${currentPageIndex >= pages.length - 1 ? 'disabled' : ''}>涓嬩竴椤?/button>
        <div class="filter-field record-page-jump">
          <label>璺宠浆</label>
          <button type="button" class="btn-select filter-dropdown-trigger record-page-trigger">绗?${page.page} 椤?<span class="dropdown-arrow" aria-hidden="true">鈻?/span></button>
          <div class="filter-options record-page-options" role="group" aria-label="閫夋嫨涔﹂潰璁板綍椤?>
            ${pageOptions}
          </div>
        </div>
      </div>
      <div class="record-written-layout">
        <figure class="record-written-image">
          <img src="" data-secure-src="${imageBase}.jpeg" alt="${page.page} 鍘熷涔﹂潰璁板綍" loading="eager" decoding="async" fetchpriority="high">
          <span class="record-written-image-loading">鍔犺浇涓€?/span>
        </figure>
        <div class="record-written-records"></div>
      </div>
    </section>
  `;
  renderRecordList(pageRecords, container.querySelector(".record-written-records"));
  if (window.ClassRecordData?.isEnabled()) {
    window.ClassRecordData.resolveAssetElements(container).catch((error) => console.warn("书面记录图片加载失败：", error));
  } else {
    const img = container.querySelector(".record-written-image img");
    if (img && !img.src) img.src = `${imageBase}.jpeg`;
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
    <button class="switch-btn active" type="button" data-view="list">鎸夋潯鏄剧ず</button>
    <button class="switch-btn" type="button" data-view="written">涔﹂潰璁板綍</button>
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


function bindHiddenRecordShortcut() {
  const code = "qibaishihuaxia";
  let buffer = "";
  window.addEventListener("keydown", async (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target && /input|textarea|select/i.test(event.target.tagName)) return;
    const key = String(event.key || "").toLowerCase();
    if (!/^[a-z]$/.test(key)) return;
    buffer = `${buffer}${key}`.slice(-code.length);
    if (buffer !== code || hiddenMode) return;
    hiddenMode = true;
    container.innerHTML = '<div class="record-empty"><strong>隐藏记录加载中...</strong></div>';
    try {
      allRecords = await loadAllRecords({ hidden: true });
      sortRecords(allRecords);
      currentCriteria = { year: "", month: "", day: "", important: false, excludeDaily: false, favorites: false, query: "" };
      favoriteRecordKeys = null;
      currentView = "list";
      currentPageIndex = 0;
      renderCurrentViewAsync();
      const status = filterContainer?.querySelector(".record-filter-status");
      if (status) status.textContent = "已进入隐藏记录模式，刷新页面后恢复普通记录。";
    } catch (error) {
      hiddenMode = false;
      container.innerHTML = '<div class="record-empty"><strong>隐藏记录加载失败。</strong><span>请检查 Supabase 隐藏记录表或 Storage 路径。</span></div>';
    console.warn("收藏记录加载失败：", error);
    }
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
   鍔犺浇骞舵覆鏌撹褰?
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


bindHiddenRecordShortcut();
