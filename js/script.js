/************************************************************
 * script.js
 * 主记录页面逻辑
 ************************************************************/

const container = document.getElementById("record-list");
const filterContainer = document.getElementById("record-filter");
const HIDDEN_RECORD_SEQUENCE = "qibaishihuaxia";

let allRecords = [];
let recordPageConfig = [];
let favoriteRecordKeys = null;
let writtenImageRenderToken = 0;
let hiddenMode = false;
let hiddenSequenceBuffer = "";

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

function normalizeFileName(value) {
  return String(value || "").trim().replace(/^data\/record\//i, "");
}

function getRecordSerial(record) {
  return (record.fileName || record.id || "").replace(/\.json$/i, "").slice(-2);
}

function isDailyRecord(record) {
  return getRecordSerial(record) === "00";
}

function getRecordKeyForFavorite(record) {
  return record.fileName || record.id || "";
}

function getFilteredRecords() {
  let filtered = filterRecordsByDate(allRecords, currentCriteria);
  if (currentCriteria.favorites) {
    filtered = favoriteRecordKeys ? filtered.filter((record) => favoriteRecordKeys.has(getRecordKeyForFavorite(record))) : [];
  }
  sortRecords(filtered);
  return filtered;
}

function normalizeRecordPageImagePath(value, page) {
  const raw = String(value || "").trim();
  const source = raw || String(page || "").trim();
  if (!source) return "";
  if (/^https?:\/\//i.test(source)) return source;
  const cleaned = source.replace(/^\.\//, "").replace(/^\//, "");
  if (/\.(png|jpe?g|webp|gif)$/i.test(cleaned)) return cleaned.replace(/\.jpg$/i, ".jpeg").replace(/\.png$/i, ".jpeg");
  const base = cleaned.startsWith("images/record-pages/") ? cleaned : `images/record-pages/${cleaned}`;
  return `${base}.jpeg`;
}

function normalizeRecordPage(page, index) {
  if (typeof page === "string") {
    return {
      page,
      start: "",
      end: "",
      imagePath: normalizeRecordPageImagePath("", page)
    };
  }
  const pageId = String(page?.page || page?.id || String(index + 1).padStart(2, "0")).trim();
  return {
    page: pageId,
    start: normalizeFileName(page?.start || page?.startFile || page?.from),
    end: normalizeFileName(page?.end || page?.endFile || page?.to),
    imagePath: normalizeRecordPageImagePath(page?.imagePath || page?.image_path || page?.image, pageId)
  };
}

async function loadHiddenRecordImagePages() {
  if (!window.ClassRecordData?.listAssetPaths) return [];
  const paths = await window.ClassRecordData.listAssetPaths("images/record-pages");
  return paths
    .map((path) => {
      const fileName = String(path || "").split(/[\\/]/).pop() || "";
      const match = fileName.match(/^(H\d{2,3})\.jpeg$/i);
      return match ? { page: match[1].toUpperCase(), start: "", end: "", imagePath: path } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.page.localeCompare(b.page, undefined, { numeric: true }));
}

async function loadRecordPageConfig() {
  try {
    let pages = [];
    if (hiddenMode) {
      pages = await loadHiddenRecordImagePages();
    } else if (window.ClassRecordData?.isEnabled()) {
      pages = await window.ClassRecordData.loadRecordPages({ hidden: false });
    }
    recordPageConfig = Array.isArray(pages) ? pages.map(normalizeRecordPage).filter((page) => page.page) : [];
  } catch (error) {
    console.warn(hiddenMode ? "Hidden record page config load failed:" : "Record page config load failed:", error);
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

function normalizeHiddenPageKey(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "";
  const fileName = text.split(/[\\/]/).pop() || text;
  const match = fileName.match(/^h?(\d{1,3})(?:\.jpeg)?$/i);
  if (match) return match[1].padStart(2, "0");
  return "";
}

function getPageRecords(page, filteredRecords, recordIndexMap) {
  if (hiddenMode) {
    const pageId = normalizeHiddenPageKey(page.page);
    const byImage = filteredRecords.filter((record) => {
      const fields = [record.page, record.pageNumber, record.image, record.imagePath, record.pageImage, record.image_path, record.pageId, record.page_id];
      return fields.some((value) => normalizeHiddenPageKey(value) === pageId);
    });
    if (byImage.length) return byImage;
  }
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
function getPageImagePath(page, pageRecords) {
  if (hiddenMode) return page.imagePath || "";
  return normalizeRecordPageImagePath(page.imagePath || pageRecords.find((record) => record.imagePath)?.imagePath, page.page);
}

function setWrittenImageState(figure, state, token) {
  if (!figure || String(figure.dataset.renderToken || "") !== String(token)) return;
  figure.dataset.imageState = state;
  figure.classList.toggle("is-loading", state === "loading");
  figure.classList.toggle("is-loaded", state === "loaded");
  figure.classList.toggle("is-missing", state === "missing");
  figure.classList.toggle("is-error", state === "error");
}

function renderWrittenView(records) {
  const token = ++writtenImageRenderToken;
  const pages = getWrittenPages(records);
  if (!pages.length) {
    container.innerHTML = `<div class="record-written-empty">${hiddenMode ? "隐藏记录模式下没有可展示的书面记录页。" : "当前筛选条件下没有可展示的记录。"}</div>`;
    return;
  }
  currentPageIndex = Math.max(0, Math.min(currentPageIndex, pages.length - 1));
  const page = pages[currentPageIndex];
  const pageRecords = page.records || [];
  pageRecords.sort((a, b) => (a.recordIndex ?? 0) - (b.recordIndex ?? 0));
  const imagePath = getPageImagePath(page, pageRecords);
  const secureAttr = imagePath ? `data-secure-src="${imagePath}"` : "";
  const srcAttr = 'src=""';
  const pageOptions = pages.map((item, index) => `
    <button type="button" class="btn-action filter-option${index === currentPageIndex ? ' is-active' : ''}" data-page-index="${index}">
      ${item.page}
    </button>
  `).join("");

  container.innerHTML = `
    <section class="record-written-view${hiddenMode ? ' is-hidden-record-mode' : ''}">
      <div class="record-written-toolbar">
        <button class="btn-action record-page-prev" type="button" ${currentPageIndex <= 0 ? 'disabled' : ''}>上一页</button>
        <span class="record-written-page">${hiddenMode ? '隐藏 ' : ''}${page.page} · 第 ${currentPageIndex + 1} / ${pages.length} 页</span>
        <button class="btn-action record-page-next" type="button" ${currentPageIndex >= pages.length - 1 ? 'disabled' : ''}>下一页</button>
        <div class="filter-field record-page-jump">
          <label>跳转</label>
          <button type="button" class="btn-select filter-dropdown-trigger record-page-trigger">第 ${page.page} 页<span class="dropdown-arrow" aria-hidden="true">▾</span></button>
          <div class="filter-options record-page-options" role="group" aria-label="选择书面记录页">
            ${pageOptions}
          </div>
        </div>
      </div>
      <div class="record-written-layout">
        <figure class="record-written-image${imagePath ? ' is-loading' : ' is-missing'}${hiddenMode ? ' is-hidden-image' : ''}" data-render-token="${token}" data-image-state="${imagePath ? 'loading' : 'missing'}">
          ${imagePath ? `<img ${srcAttr} ${secureAttr} alt="${page.page} 原始书面记录" loading="eager" decoding="async" fetchpriority="high">` : ""}
          <span class="record-written-image-loading">${imagePath ? "加载中…" : "未找到书面文件"}</span>
        </figure>
        <div class="record-written-records"></div>
      </div>
    </section>
  `;

  renderRecordList(pageRecords, container.querySelector(".record-written-records"));
  const writtenFigure = container.querySelector(".record-written-image");
  const writtenImage = container.querySelector(".record-written-image img");
  writtenImage?.addEventListener("load", (event) => {
    setWrittenImageState(event.currentTarget.closest(".record-written-image"), "loaded", token);
  }, { once: true });
  writtenImage?.addEventListener("error", (event) => {
    setWrittenImageState(event.currentTarget.closest(".record-written-image"), "error", token);
  }, { once: true });
  if (window.ClassRecordData?.isEnabled() && imagePath) {
    window.ClassRecordData.resolveAssetElements(container).then(() => {
      if (!writtenImage || writtenImage.src) return;
      setWrittenImageState(writtenFigure, "missing", token);
    }).catch((error) => {
      console.warn("书面记录图片加载失败：", error);
      setWrittenImageState(writtenFigure, "error", token);
    });
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
    pageJumpCloseTimer = window.setTimeout(() => pageJump.classList.remove("is-open"), 140);
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
  if (hiddenMode || !currentCriteria.favorites || favoriteRecordKeys) return;
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
  const existing = document.querySelector(".record-view-switch");
  if (existing) existing.remove();
  const controls = document.createElement("div");
  controls.className = "record-view-switch switch-group";
  controls.innerHTML = `
    <button class="switch-btn${currentView === 'list' ? ' active' : ''}" type="button" data-view="list">按条显示</button>
    <button class="switch-btn${currentView === 'written' ? ' active' : ''}" type="button" data-view="written">书面记录</button>
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

function renderHiddenModeBanner(message = "隐藏记录查看已开启。本模式不会保存，刷新或退出后自动回到普通记录。", tone = "info") {
  let banner = document.getElementById("hidden-record-banner");
  if (!hiddenMode) {
    banner?.remove();
    return;
  }
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "hidden-record-banner";
    banner.className = "hidden-record-banner";
    filterContainer?.before(banner);
  }
  banner.dataset.tone = tone;
  banner.textContent = message;
}

function resetCriteriaForHiddenMode() {
  currentCriteria = { year: "", month: "", day: "", important: false, excludeDaily: false, favorites: false, query: "" };
  favoriteRecordKeys = null;
  currentPageIndex = 0;
}

async function enterHiddenRecordMode() {
  if (hiddenMode) return;
  hiddenMode = true;
  window.ClassRecordHiddenModeActive = true;
  document.body.classList.add("hidden-record-mode");
  resetCriteriaForHiddenMode();
  container.innerHTML = '<div class="record-empty"><strong>正在加载隐藏记录…</strong><span>仅本次会话可见，刷新后恢复普通记录。</span></div>';
  renderHiddenModeBanner("正在加载隐藏记录…", "info");
  try {
    const [records] = await Promise.all([window.loadHiddenRecords(), loadRecordPageConfig()]);
    allRecords = records;
    sortRecords(allRecords);
    renderHiddenModeBanner(`隐藏记录查看已开启，共 ${allRecords.length} 条。刷新后自动恢复普通记录。`, "success");
    renderViewControls();
    renderRecordFilter({
      container: filterContainer,
      getRecords: () => allRecords,
      initial: currentCriteria,
      onFilterChange: criteria => {
        currentCriteria = { ...criteria, favorites: false };
        currentPageIndex = 0;
        renderCurrentViewAsync();
      }
    });
    renderCurrentViewAsync();
  } catch (error) {
    console.warn("隐藏记录加载失败：", error);
    container.innerHTML = '<div class="record-empty"><strong>隐藏记录加载失败。</strong><span>请确认 Supabase 表、RLS 和 Storage 路径已配置。</span></div>';
    renderHiddenModeBanner("隐藏记录加载失败，请确认 Supabase 配置。", "error");
  }
}

function bindHiddenRecordShortcut() {
  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.altKey || event.metaKey || event.key.length !== 1) return;
    const active = document.activeElement;
    if (active && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName)) return;
    hiddenSequenceBuffer = (hiddenSequenceBuffer + event.key.toLowerCase()).slice(-HIDDEN_RECORD_SEQUENCE.length);
    if (hiddenSequenceBuffer === HIDDEN_RECORD_SEQUENCE) {
      hiddenSequenceBuffer = "";
      enterHiddenRecordMode();
    }
  });
}

window.addEventListener("recordfavoritechange", (event) => {
  if (hiddenMode || !favoriteRecordKeys) return;
  const key = event.detail?.recordKey;
  if (!key) return;
  if (event.detail?.favorited) {
    favoriteRecordKeys.add(key);
  } else {
    favoriteRecordKeys.delete(key);
  }
  if (currentCriteria.favorites) renderCurrentViewAsync();
});

const cacheReady = window.cacheReadyPromise || Promise.resolve();

bindHiddenRecordShortcut();

cacheReady.then(() => Promise.all([loadAllRecords(), loadRecordPageConfig()]))
  .then(([records]) => {
    if (hiddenMode) return;
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
  })
  .catch((error) => {
    console.warn("记录加载失败：", error);
    container.innerHTML = '<div class="record-empty"><strong>记录加载失败。</strong><span>请确认 Supabase 数据表和登录状态后重试。</span></div>';
  });
