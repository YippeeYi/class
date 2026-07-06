/************************************************************
 * script.js
 * 主记录页面逻辑
 ************************************************************/

const container = document.getElementById("record-list");
const filterContainer = document.getElementById("record-filter");
const HIDDEN_RECORD_SEQUENCE = "qibaishihuaxia";
const HIDDEN_PAGE_MIN = 1;
const HIDDEN_PAGE_MAX = 83;
const HIDDEN_PAGE_CHECK_CONCURRENCY = 6;

let allRecords = [];
let recordPageConfig = [];
let recordPageConfigMode = "";
let recordPageLoadToken = 0;
let writtenImageRenderToken = 0;
let hiddenMode = false;
let hiddenSequenceBuffer = "";
let hiddenRecordPagesPromise = null;
let pendingRecordJump = null;
let activeRecordJumpDialog = null;
let activeRecordJumpCleanup = null;
let pageMessageMap = new Map();
let pageMessagesPromise = null;
const writtenImagePreloadCache = new Map();

function parseInitialRecordCriteria() {
  const params = new URLSearchParams(location.search);
  return {
    year: params.get("year") || "",
    month: params.get("month") || "",
    day: params.get("day") || "",
    important: params.get("important") === "1" || params.get("important") === "true",
    excludeDaily: params.get("excludeDaily") === "1" || params.get("excludeDaily") === "true",
    query: params.get("q") || ""
  };
}

let currentCriteria = parseInitialRecordCriteria();
let currentView = new URLSearchParams(location.search).get("view") === "written" ? "written" : "list";
let currentPageIndex = 0;

function normalizeFileName(value) {
  return String(value || "").trim().replace(/^data\/record\//i, "");
}

function getFilteredRecords() {
  let filtered = filterRecordsByDate(allRecords, currentCriteria);
  sortRecords(filtered);
  return filtered;
}

function hasActiveRecordFilter() {
  return Boolean(
    currentCriteria.year
    || currentCriteria.month
    || currentCriteria.day
    || currentCriteria.important
    || currentCriteria.excludeDaily
    || String(currentCriteria.query || "").trim()
  );
}

function normalizeRecordPageImagePath(value, page) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const cleaned = raw.replace(/^\.\//, "").replace(/^\//, "");
  if (/\.(png|jpe?g|webp|gif)$/i.test(cleaned)) return cleaned;
  return `${cleaned}.jpeg`;
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

async function loadRecordPageConfig() {
  const targetMode = hiddenMode ? "hidden" : "normal";
  const loadToken = ++recordPageLoadToken;
  try {
    let pages = [];
    if (targetMode === "hidden") {
      [pages] = await Promise.all([
        loadHiddenRecordImagePages(),
        loadPageMessages()
      ]);
    } else if (window.ClassRecordData?.isEnabled()) {
      [pages] = await Promise.all([
        window.ClassRecordData.loadRecordPages({ hidden: false }),
        loadPageMessages()
      ]);
    }
    if (loadToken !== recordPageLoadToken || targetMode !== (hiddenMode ? "hidden" : "normal")) return;
    let normalizedPages = Array.isArray(pages) ? pages.map(normalizeRecordPage).filter((page) => page.page && page.imagePath) : [];
    recordPageConfig = normalizedPages;
    recordPageConfigMode = targetMode;
  } catch (error) {
    if (loadToken !== recordPageLoadToken) return;
    console.warn(targetMode === "hidden" ? "Hidden record page config load failed:" : "Record page config load failed:", error);
    recordPageConfig = [];
    recordPageConfigMode = targetMode;
  }
}

async function loadPageMessages() {
  if (!window.ClassRecordData?.isEnabled() || typeof window.ClassRecordData.loadPageMessages !== "function") {
    pageMessageMap = new Map();
    return pageMessageMap;
  }
  if (!pageMessagesPromise) {
    pageMessagesPromise = window.ClassRecordData.loadPageMessages()
      .then((messages) => {
        pageMessageMap = new Map(messages.map((message) => [String(message.page).trim(), message]));
        return pageMessageMap;
      })
      .catch((error) => {
        pageMessagesPromise = null;
        pageMessageMap = new Map();
        console.warn("书面记录寄语加载失败：", error);
        return pageMessageMap;
      });
  }
  return pageMessagesPromise;
}

function renderPageMessage(message) {
  if (!message?.content) return "";
  const author = String(message.author || "").trim();
  return `
    <article class="record record-written-message">
      <div class="meta"><span>寄语${author ? ` · ✍ ${parseContent(`[[${author}|${author}]]`)}` : ""}</span></div>
      <div class="content">${formatContent(message.content)}</div>
    </article>
  `;
}
function normalizeHiddenPageKey(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "";
  const fileName = text.split(/[\\/]/).pop() || text;
  const match = fileName.match(/^h?(\d{1,3})(?:\.jpeg)?$/i);
  if (match) return match[1].padStart(2, "0");
  return "";
}

function normalizePageNumber(value) {
  const match = String(value || "").trim().match(/^(?:H)?(\d{1,3})$/i);
  return match ? String(Number(match[1])) : "";
}

function deriveHiddenImagePath(originalPath, pageKey) {
  const hiddenFileName = `H${pageKey}.jpeg`;
  const rawPath = String(originalPath || "").trim();
  if (!rawPath) return "";
  if (/^https?:\/\//i.test(rawPath)) {
    try {
      const url = new URL(rawPath);
      url.pathname = url.pathname.replace(/[^/]*$/, hiddenFileName);
      return url.toString();
    } catch (error) {
      return "";
    }
  }
  return rawPath.replace(/[^/\\]*$/, hiddenFileName);
}

async function loadHiddenRecordImagePages() {
  if (!window.ClassRecordData?.isEnabled()) return [];
  if (hiddenRecordPagesPromise) return hiddenRecordPagesPromise;

  hiddenRecordPagesPromise = (async () => {
    const normalPages = (await window.ClassRecordData.loadRecordPages({ hidden: false }))
      .map(normalizeRecordPage);
    const normalPageMap = new Map(normalPages.map((page) => [normalizePageNumber(page.page), page]));
    const imageTemplate = normalPages.find((page) => page.imagePath)?.imagePath || "";
    if (!imageTemplate) return [];

    const normalizedTemplate = window.ClassRecordData.normalizePrivateStoragePath?.(imageTemplate) || imageTemplate;
    const lastDirectorySeparator = Math.max(normalizedTemplate.lastIndexOf("/"), normalizedTemplate.lastIndexOf("\\"));
    const directory = lastDirectorySeparator >= 0 ? normalizedTemplate.slice(0, lastDirectorySeparator) : "";
    if (window.ClassRecordData.listAssetPaths && !/^https?:\/\//i.test(normalizedTemplate)) {
      try {
        const listedPaths = await window.ClassRecordData.listAssetPaths(directory, { search: "H", limit: 100 });
        const existingPages = listedPaths.map((imagePath) => {
          const pageKey = normalizeHiddenPageKey(imagePath);
          const pageNumber = Number(pageKey);
          if (!pageKey || pageNumber < HIDDEN_PAGE_MIN || pageNumber > HIDDEN_PAGE_MAX) return null;
          const normalPage = normalPageMap.get(String(pageNumber));
          return {
            ...(normalPage || {}),
            page: `H${pageKey}`,
            originalPage: String(pageNumber),
            start: normalPage?.start || "",
            end: normalPage?.end || "",
            imagePath
          };
        }).filter(Boolean);
        return existingPages.sort((a, b) => Number(a.originalPage) - Number(b.originalPage));
      } catch (error) {
        // Fall back to quiet, cached probes when Storage listing is unavailable.
      }
    }

    const candidates = [];
    for (let pageNumber = HIDDEN_PAGE_MIN; pageNumber <= HIDDEN_PAGE_MAX; pageNumber += 1) {
      const pageKey = String(pageNumber).padStart(2, "0");
      const normalPage = normalPageMap.get(String(pageNumber));
      const imagePath = deriveHiddenImagePath(normalPage?.imagePath || imageTemplate, pageKey);
      if (imagePath) candidates.push({ pageKey, normalPage, imagePath });
    }

    const existingPages = [];
    let nextCandidate = 0;
    const checkNext = async () => {
      while (nextCandidate < candidates.length) {
        const candidate = candidates[nextCandidate];
        nextCandidate += 1;
        const signedUrl = await window.ClassRecordData
          .signAssetUrl(candidate.imagePath, { quiet: true })
          .catch(() => "");
        if (!signedUrl) continue;
        existingPages.push({
          ...(candidate.normalPage || {}),
          page: `H${candidate.pageKey}`,
          originalPage: String(Number(candidate.pageKey)),
          start: candidate.normalPage?.start || "",
          end: candidate.normalPage?.end || "",
          imagePath: candidate.imagePath
        });
      }
    };

    await Promise.all(Array.from(
      { length: Math.min(HIDDEN_PAGE_CHECK_CONCURRENCY, candidates.length) },
      () => checkNext()
    ));
    return existingPages.sort((a, b) => Number(a.originalPage) - Number(b.originalPage));
  })().catch((error) => {
    hiddenRecordPagesPromise = null;
    throw error;
  });

  return hiddenRecordPagesPromise;
}

function getPageRecords(page, filteredRecords) {
  const startFile = normalizeFileName(page.start).toLowerCase();
  const endFile = normalizeFileName(page.end).toLowerCase();
  if (!startFile || !endFile) return [];
  const from = startFile < endFile ? startFile : endFile;
  const to = startFile < endFile ? endFile : startFile;
  return filteredRecords.filter((record) => {
    const fileName = normalizeFileName(record.fileName || record.id).toLowerCase();
    return Boolean(fileName) && fileName >= from && fileName <= to;
  });
}

function getWrittenPages(records) {
  const filtering = hasActiveRecordFilter();
  return recordPageConfig
    .map((page) => ({ ...page, records: getPageRecords(page, records) }))
    .filter((page) => Boolean(getPageImagePath(page, page.records)))
    .filter((page) => !filtering || page.records.length > 0);
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

function preloadBrowserImage(src, priority = "low") {
  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.fetchPriority = priority;
    image.onload = () => resolve(src);
    image.onerror = () => resolve("");
    image.src = src;
  });
}

function preloadWrittenImage(path, { priority = "low" } = {}) {
  const sourcePath = String(path || "").trim();
  if (!sourcePath) return Promise.resolve("");
  if (writtenImagePreloadCache.has(sourcePath)) return writtenImagePreloadCache.get(sourcePath);
  const isDirectSource = /^(?:https?:|data:|blob:)/i.test(sourcePath) || /^(?:\.\/|\/)?images\//i.test(sourcePath);
  const promise = (async () => {
    if (isDirectSource) {
      const directUrl = /^(?:https?:|data:|blob:)/i.test(sourcePath)
        ? sourcePath
        : new URL(sourcePath.replace(/^\//, ""), document.baseURI).href;
      const directResult = await preloadBrowserImage(directUrl, priority);
      if (directResult) return directResult;
    }
    return window.ClassRecordData?.preloadAsset
      ? (await window.ClassRecordData.preloadAsset(sourcePath, { priority }).catch(() => "")) || ""
      : "";
  })();
  const reusable = promise.then((result) => {
    if (!result) writtenImagePreloadCache.delete(sourcePath);
    return result;
  });
  writtenImagePreloadCache.set(sourcePath, reusable);
  return reusable;
}

function preloadAdjacentWrittenPages(pages, pageIndex) {
  const paths = [pageIndex - 2, pageIndex - 1, pageIndex + 1, pageIndex + 2]
    .filter((index) => index >= 0 && index < pages.length)
    .map((index) => getPageImagePath(pages[index], pages[index].records || []))
    .filter(Boolean);
  if (!paths.length) return;
  const preload = () => paths.forEach((path) => {
    preloadWrittenImage(path, { priority: "low" }).catch(() => { });
  });
  if ("requestIdleCallback" in window) window.requestIdleCallback(preload, { timeout: 1200 });
  else window.setTimeout(preload, 250);
}

function renderWrittenView(records) {
  const token = ++writtenImageRenderToken;
  const pages = getWrittenPages(records);
  if (!pages.length) {
    container.innerHTML = `<div class="record-written-empty">${hiddenMode ? "隐藏记录模式下没有检测到 H01-H83 的书面记录图片。" : "当前筛选条件下没有可展示的记录。"}</div>`;
    return;
  }
  currentPageIndex = Math.max(0, Math.min(currentPageIndex, pages.length - 1));
  const page = pages[currentPageIndex];
  const pageRecords = page.records || [];
  pageRecords.sort((a, b) => (a.recordIndex ?? 0) - (b.recordIndex ?? 0));
  const imagePath = getPageImagePath(page, pageRecords);
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
          ${imagePath ? `<img alt="${hiddenMode ? `${page.page} 隐藏书面记录` : `${page.page} 原始书面记录`}" width="2856" height="4282" loading="eager" decoding="async" fetchpriority="high">` : ""}
          <span class="record-written-image-loading">${imagePath ? '<i aria-hidden="true"></i><b>正在加载书面记录</b>' : "未找到书面文件"}</span>
        </figure>
        <div class="record-written-records">
          ${renderPageMessage(pageMessageMap.get(String(page.page).trim()))}
          <div class="record-written-record-list"></div>
        </div>
      </div>
    </section>
  `;

  const recordHost = container.querySelector(".record-written-record-list");
  if (hiddenMode && !pageRecords.length && recordHost) {
    recordHost.innerHTML = '<div class="record-empty"><strong>这张隐藏书面页没有匹配记录。</strong><span>已检测到图片，但对应普通页范围内没有 hidden 为 true 的记录。</span></div>';
  } else {
    renderRecordList(pageRecords, recordHost);
  }
  const writtenFigure = container.querySelector(".record-written-image");
  const writtenImage = container.querySelector(".record-written-image img");
  writtenImage?.addEventListener("load", (event) => {
    setWrittenImageState(event.currentTarget.closest(".record-written-image"), "loaded", token);
  }, { once: true });
  writtenImage?.addEventListener("error", (event) => {
    setWrittenImageState(event.currentTarget.closest(".record-written-image"), "error", token);
  }, { once: true });
  if (imagePath && writtenImage) {
    preloadWrittenImage(imagePath, { priority: "high" }).then((src) => {
      if (!writtenImage.isConnected || String(writtenFigure?.dataset.renderToken) !== String(token)) return;
      if (!src) {
        setWrittenImageState(writtenFigure, "error", token);
        return;
      }
      writtenImage.src = src;
    }).catch((error) => {
      console.warn("书面记录图片加载失败：", error);
      setWrittenImageState(writtenFigure, "error", token);
    });
  }
  preloadAdjacentWrittenPages(pages, currentPageIndex);
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

function renderRecordFilterForCurrentState() {
  renderRecordFilter({
    container: filterContainer,
    getRecords: () => allRecords,
    initial: currentCriteria,
    onClear: clearRecordNavigationState,
    onFilterChange: criteria => {
      currentCriteria = { ...criteria };
      currentPageIndex = 0;
      renderCurrentViewAsync();
    }
  });
}

function clearRecordNavigationState() {
  window.ClassRecordCancelFocus?.();
  closeRecordJumpDialog({ immediate: true });
  pendingRecordJump = null;
  try {
    sessionStorage.removeItem("classrecord:pending-record-jump");
  } catch (error) {
    // Storage may be unavailable in privacy modes; in-memory state is already cleared.
  }
  document.querySelectorAll(".record-anchor-highlight").forEach((record) => record.classList.remove("record-anchor-highlight"));
  const params = new URLSearchParams(location.search);
  ["year", "month", "day", "important", "excludeDaily", "q"].forEach((key) => params.delete(key));
  history.replaceState(null, "", `${location.pathname}${params.toString() ? `?${params}` : ""}`);
}

function closeRecordJumpDialog({ immediate = false } = {}) {
  const dialog = activeRecordJumpDialog;
  activeRecordJumpDialog = null;
  activeRecordJumpCleanup?.();
  activeRecordJumpCleanup = null;
  if (!dialog) return;
  const remove = () => dialog.remove();
  if (immediate) {
    remove();
    return;
  }
  dialog.classList.remove("is-visible");
  dialog.classList.add("is-leaving");
  window.setTimeout(remove, 220);
}

async function returnFromRecordJump(origin) {
  closeRecordJumpDialog({ immediate: true });
  pendingRecordJump = null;
  if (origin.externalHref) {
    location.href = origin.externalHref;
    return;
  }
  currentView = origin.view;
  currentPageIndex = origin.pageIndex;
  currentCriteria = { ...origin.criteria };
  const returnHash = origin.anchorId ? `#${origin.anchorId}` : "";
  history.replaceState(null, "", `${location.pathname}${location.search}${returnHash}`);
  renderViewControls();
  renderRecordFilterForCurrentState();
  await renderCurrentViewAsync();
  if (!origin.anchorId) window.scrollTo({ top: origin.scrollY, behavior: "smooth" });
}

function showRecordJumpDialog(target, jumpState) {
  closeRecordJumpDialog({ immediate: true });
  const dialog = document.createElement("aside");
  dialog.className = "record-jump-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-label", "记录跳转完成");
  dialog.innerHTML = `
    <span>已定位到目标记录</span>
    <div>
      <button type="button" class="btn-action" data-jump-stay>留在这里</button>
      <button type="button" class="btn-action" data-jump-return>返回原位置</button>
    </div>
  `;
  dialog.querySelector("[data-jump-stay]")?.addEventListener("click", () => {
    pendingRecordJump = null;
    closeRecordJumpDialog();
  });
  dialog.querySelector("[data-jump-return]")?.addEventListener("click", () => returnFromRecordJump(jumpState.origin));
  document.body.appendChild(dialog);
  activeRecordJumpDialog = dialog;
  const positionDialog = () => {
    if (!dialog.isConnected || !target.isConnected) return;
    const gap = 12;
    const viewportPadding = 12;
    const targetRect = target.getBoundingClientRect();
    const width = Math.min(260, window.innerWidth - viewportPadding * 2);
    dialog.style.width = `${width}px`;
    const height = dialog.offsetHeight;
    const fitsRight = window.innerWidth - targetRect.right - gap >= width;
    dialog.classList.toggle("is-below", !fitsRight);
    if (fitsRight) {
      dialog.style.left = `${targetRect.right + gap}px`;
      dialog.style.top = `${Math.min(Math.max(targetRect.top + (targetRect.height - height) / 2, viewportPadding), window.innerHeight - height - viewportPadding)}px`;
      return;
    }
    const left = Math.min(Math.max(targetRect.left + (targetRect.width - width) / 2, viewportPadding), window.innerWidth - width - viewportPadding);
    const below = targetRect.bottom + gap;
    const top = below + height <= window.innerHeight - viewportPadding
      ? below
      : Math.max(viewportPadding, targetRect.top - height - gap);
    dialog.style.left = `${left}px`;
    dialog.style.top = `${top}px`;
  };
  const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(positionDialog) : null;
  resizeObserver?.observe(target);
  window.addEventListener("resize", positionDialog);
  window.addEventListener("scroll", positionDialog, { passive: true });
  activeRecordJumpCleanup = () => {
    resizeObserver?.disconnect();
    window.removeEventListener("resize", positionDialog);
    window.removeEventListener("scroll", positionDialog);
  };
  positionDialog();
  requestAnimationFrame(() => dialog.classList.add("is-visible"));
}

document.addEventListener("classrecord:record-focused", (event) => {
  if (!pendingRecordJump || event.detail?.anchorId !== pendingRecordJump.targetAnchorId) return;
  showRecordJumpDialog(event.detail.target, pendingRecordJump);
});

async function renderCurrentViewAsync() {
  const expectedMode = hiddenMode ? "hidden" : "normal";
  if (currentView === "written" && recordPageConfigMode !== expectedMode) {
    container.innerHTML = `<div class="record-written-empty">${hiddenMode ? "正在检测隐藏书面记录图片···" : "正在加载书面记录···"}</div>`;
    await loadRecordPageConfig();
    if (currentView !== "written" || expectedMode !== (hiddenMode ? "hidden" : "normal")) return;
  }
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
    const params = new URLSearchParams(location.search);
    if (currentView === "written") params.set("view", "written");
    else params.delete("view");
    history.replaceState(null, "", `${location.pathname}${params.toString() ? `?${params}` : ""}${location.hash}`);
    currentPageIndex = 0;
    controls.querySelectorAll(".switch-btn").forEach((item) => item.classList.toggle("active", item === button));
    renderCurrentViewAsync();
  });
}

// 供记录文本中的 [[record:文件名|文字]] 复用；动画仍由 renderRecordList 的锚点逻辑统一处理。
window.ClassRecordNavigateToRecord = async (recordKey, { sourceElement } = {}) => {
  const normalizedKey = normalizeFileName(recordKey).replace(/\.json$/i, "");
  const target = allRecords.find((record) => normalizeFileName(record.fileName || record.id).replace(/\.json$/i, "") === normalizedKey);
  if (!target) {
    console.warn(`未找到目标记录：${recordKey}`);
    window.alert("未找到要跳转的记录。");
    return;
  }
  closeRecordJumpDialog();
  const sourceRecord = sourceElement?.closest?.(".record");
  const origin = {
    view: currentView,
    pageIndex: currentPageIndex,
    criteria: { ...currentCriteria },
    anchorId: sourceRecord?.id || "",
    scrollY: window.scrollY
  };
  currentCriteria = { year: "", month: "", day: "", important: false, excludeDaily: false, query: "" };
  renderRecordFilterForCurrentState();
  const anchor = getRecordAnchorId(target);
  pendingRecordJump = { targetAnchorId: anchor, origin };
  history.replaceState(null, "", `${location.pathname}${location.search}#${anchor}`);
  if (currentView === "written") {
    if (recordPageConfigMode !== (hiddenMode ? "hidden" : "normal")) await loadRecordPageConfig();
    const pageIndex = recordPageConfig.findIndex((page) => getPageRecords(page, [target]).length > 0);
    if (pageIndex >= 0) currentPageIndex = pageIndex;
    else window.alert("目标记录存在，但没有找到对应的书面记录页。");
  } else {
    currentView = "list";
  }
  renderViewControls();
  await renderCurrentViewAsync();
};

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
  currentCriteria = { year: "", month: "", day: "", important: false, excludeDaily: false, query: "" };
  currentPageIndex = 0;
}

async function enterHiddenRecordMode() {
  if (hiddenMode) return;
  hiddenMode = true;
  recordPageLoadToken += 1;
  recordPageConfig = [];
  recordPageConfigMode = "";
  window.ClassRecordHiddenModeActive = true;
  document.body.classList.add("hidden-record-mode");
  resetCriteriaForHiddenMode();
  container.innerHTML = '<div class="record-empty"><strong>正在加载隐藏记录···</strong><span>仅本次会话可见，刷新后恢复普通记录。</span></div>';
  renderHiddenModeBanner("正在加载隐藏记录···", "info");
  try {
    const records = await window.loadHiddenRecords();
    allRecords = records;
    sortRecords(allRecords);
    renderHiddenModeBanner(`隐藏记录查看已开启，共 ${allRecords.length} 条。刷新后自动恢复普通记录。`, "success");
    renderViewControls();
    renderRecordFilter({
      container: filterContainer,
      getRecords: () => allRecords,
      initial: currentCriteria,
      onClear: clearRecordNavigationState,
      onFilterChange: criteria => {
        currentCriteria = { ...criteria };
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

const cacheReady = window.cacheReadyPromise || Promise.resolve();

bindHiddenRecordShortcut();

cacheReady.then(() => Promise.all([loadAllRecords(), loadRecordPageConfig()]))
  .then(([records]) => {
    if (hiddenMode) return;
    allRecords = records;
    sortRecords(allRecords);
    try {
      const storedJump = JSON.parse(sessionStorage.getItem("classrecord:pending-record-jump") || "null");
      sessionStorage.removeItem("classrecord:pending-record-jump");
      const isFresh = storedJump && Date.now() - Number(storedJump.createdAt || 0) < 5 * 60 * 1000;
      const targetExists = isFresh && allRecords.some((record) => getRecordAnchorId(record) === storedJump.targetAnchorId);
      if (targetExists) {
        pendingRecordJump = {
          targetAnchorId: storedJump.targetAnchorId,
          origin: { externalHref: storedJump.originHref }
        };
      } else if (isFresh) {
        window.alert("未找到要跳转的记录。");
      }
    } catch (error) {
      sessionStorage.removeItem("classrecord:pending-record-jump");
    }
    if (currentView === "written" && location.hash) {
      const anchor = location.hash.slice(1);
      const target = allRecords.find((record) => getRecordAnchorId(record) === anchor);
      const pageIndex = target ? recordPageConfig.findIndex((page) => getPageRecords(page, [target]).length > 0) : -1;
      if (pageIndex >= 0) currentPageIndex = pageIndex;
    }
    renderViewControls();
    renderCurrentViewAsync();

    renderRecordFilter({
      container: filterContainer,
      getRecords: () => allRecords,
      initial: currentCriteria,
      onClear: clearRecordNavigationState,
      onFilterChange: criteria => {
        currentCriteria = criteria;
        currentPageIndex = 0;
        renderCurrentViewAsync();
      }
    });
  })
  .catch((error) => {
    console.warn("记录加载失败：", error);
    container.innerHTML = '<div class="record-empty"><strong>记录加载失败。</strong><span>请确认 Supabase 数据表和访问密钥状态后重试。</span></div>';
  });
