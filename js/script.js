/************************************************************
 * script.js
 * 主记录页面逻辑
 ************************************************************/

const container = document.getElementById("record-list");
const filterContainer = document.getElementById("record-filter");
const HIDDEN_PAGE_MIN = 1;
const HIDDEN_PAGE_MAX = 83;
const HIDDEN_PAGE_CHECK_CONCURRENCY = 6;

let allRecords = [];
let recordPageConfig = [];
let recordPageConfigMode = "";
let recordPageLoadToken = 0;
let writtenImageRenderToken = 0;
let hiddenMode = false;
let hiddenRecordPagesPromise = null;
let pendingRecordJump = null;
let activeRecordJumpDialog = null;
let activeRecordJumpCleanup = null;
let pageMessageMap = new Map();
let pageSupplementMap = new Map();
let pageMessagesPromise = null;
let pageSupplementsPromise = null;
const writtenImagePreloadCache = new Map();
const writtenImageReadyCache = new Map();

window.addEventListener("classrecordcacheclearing", () => {
  writtenImagePreloadCache.clear();
  writtenImageReadyCache.clear();
});

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
  return getFilteredRecordsForCurrentView(allRecords, currentCriteria);
}

function isNormalRecord(record) {
  return !["message", "supplement"].includes(String(record?.recordType || "").trim());
}

function isSupplementalRecord(record) {
  return ["message", "supplement"].includes(String(record?.recordType || "").trim());
}

function getListViewRecords(records) {
  return (Array.isArray(records) ? records : []).filter(isNormalRecord);
}

function getCurrentViewFilterRecords() {
  return currentView === "written" ? allRecords : getListViewRecords(allRecords);
}

function getRecordPageKey(record) {
  return String(record?.page || "").trim();
}

function hasRecordDateCriteria(criteria = {}) {
  return Boolean(criteria.year || criteria.month || criteria.day);
}

function supplementalRecordMatchesCriteria(record, criteria = {}) {
  if (!isSupplementalRecord(record)) return false;
  if (hasRecordDateCriteria(criteria)) return false;
  if (criteria.important) return false;
  const normalizedQuery = normalizeSearchText(criteria.query);
  if (normalizedQuery && !getRecordSearchText(record).includes(normalizedQuery)) return false;
  return true;
}

function filterRecordsForView(records, criteria = {}, view = currentView) {
  const sourceRecords = Array.isArray(records) ? records : [];
  const normalMatches = filterRecordsByDate(getListViewRecords(sourceRecords), criteria);
  if (view !== "written") {
    sortRecords(normalMatches);
    return normalMatches;
  }
  const supplementalMatches = sourceRecords.filter((record) => supplementalRecordMatchesCriteria(record, criteria));
  const combined = [...normalMatches, ...supplementalMatches];
  sortRecords(combined);
  return combined;
}

function getFilteredRecordsForCurrentView(records, criteria = currentCriteria) {
  return filterRecordsForView(records, criteria, currentView);
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
        loadPageMessages(),
        loadPageSupplements()
      ]);
    } else if (window.ClassRecordData?.isEnabled()) {
      [pages] = await Promise.all([
        window.ClassRecordData.loadRecordPages({ hidden: false }),
        loadPageMessages(),
        loadPageSupplements()
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
        console.warn("书面记录箴言加载失败：", error);
        return pageMessageMap;
      });
  }
  return pageMessagesPromise;
}

async function loadPageSupplements() {
  if (!window.ClassRecordData?.isEnabled() || typeof window.ClassRecordData.loadPageSupplements !== "function") {
    pageSupplementMap = new Map();
    return pageSupplementMap;
  }
  if (!pageSupplementsPromise) {
    pageSupplementsPromise = window.ClassRecordData.loadPageSupplements({ hidden: false })
      .then((items) => {
        const grouped = new Map();
        items.forEach((item) => {
          const page = String(item.page || "").trim();
          if (!page) return;
          const list = grouped.get(page) || [];
          list.push(item);
          grouped.set(page, list);
        });
        grouped.forEach((list) => list.sort((a, b) => (a.supplementIndex || 0) - (b.supplementIndex || 0)));
        pageSupplementMap = grouped;
        return pageSupplementMap;
      })
      .catch((error) => {
        pageSupplementsPromise = null;
        pageSupplementMap = new Map();
        console.warn("书面记录补充记录加载失败：", error);
        return pageSupplementMap;
      });
  }
  return pageSupplementsPromise;
}

function renderPageMessage(message) {
  if (!message?.content) return "";
  const author = String(message.author || "").trim();
  return `
    <article class="record record-written-message">
      <div class="meta"><span>箴言${author ? ` · ✍ ${parseContent(`[[${author}|${author}]]`)}` : ""}</span></div>
      <div class="content">${formatContent(message.content)}</div>
    </article>
  `;
}

function renderPageSupplements(items = []) {
  const supplements = Array.isArray(items) ? items.filter((item) => item?.content) : [];
  if (!supplements.length) return "";
  return `
    <section class="record-written-supplements" aria-label="补充记录">
      ${supplements.map((item) => {
        const author = String(item.author || "").trim();
        return `
          <article class="record record-written-supplement">
            <div class="meta"><span>补充记录${author ? ` · ✍ ${parseContent(`[[author:${author}|${author}]]`)}` : ""}</span></div>
            <div class="content">${formatContent(item.content)}</div>
          </article>
        `;
      }).join("")}
    </section>
  `;
}

function getPageKey(page) {
  return String(page?.page || "").trim();
}

function getPageMessage(page) {
  return pageMessageMap.get(getPageKey(page));
}

function getPageSupplements(page) {
  const items = pageSupplementMap.get(getPageKey(page));
  return Array.isArray(items) ? items.filter((item) => item?.content) : [];
}

function getVisiblePageMessage(page, matchedRecords = []) {
  const message = getPageMessage(page);
  if (!hasActiveRecordFilter()) return message;
  const hasMatchedMessage = matchedRecords.some((record) => String(record?.recordType || "").trim() === "message");
  return hasMatchedMessage ? message : null;
}

function getVisiblePageSupplements(page, matchedRecords = []) {
  const supplements = getPageSupplements(page);
  if (!hasActiveRecordFilter()) return supplements;
  const matchedSupplements = matchedRecords.filter((record) => String(record?.recordType || "").trim() === "supplement");
  if (!matchedSupplements.length) return [];
  return supplements.filter((item) => matchedSupplements.some((record) => isSamePageSupplement(item, record)));
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

function isRecordFileWithinPage(page, record) {
  const startFile = normalizeFileName(page.start).toLowerCase();
  const endFile = normalizeFileName(page.end).toLowerCase();
  if (!startFile || !endFile) return false;
  const from = startFile < endFile ? startFile : endFile;
  const to = startFile < endFile ? endFile : startFile;
  const fileName = normalizeFileName(record.fileName || record.id).toLowerCase();
  return Boolean(fileName) && fileName >= from && fileName <= to;
}

function getPageRecords(page, filteredRecords) {
  return filteredRecords.filter((record) => isNormalRecord(record) && isRecordFileWithinPage(page, record));
}

function getPageSupplementalMatches(page, filteredRecords) {
  const pageKey = getPageKey(page);
  if (!pageKey) return [];
  return filteredRecords.filter((record) => {
    const type = String(record?.recordType || "").trim();
    return (type === "message" || type === "supplement") && getRecordPageKey(record) === pageKey;
  });
}

function getPageMatchedRecords(page, filteredRecords) {
  return [
    ...getPageRecords(page, filteredRecords),
    ...getPageSupplementalMatches(page, filteredRecords)
  ];
}

function getSupplementIndex(item) {
  return String(item?.supplementIndex ?? item?.supplement_index ?? "").trim();
}

function isSamePageSupplement(left, right) {
  if (getRecordPageKey(left) !== getRecordPageKey(right)) return false;
  const leftIndex = getSupplementIndex(left);
  const rightIndex = getSupplementIndex(right);
  if (leftIndex && rightIndex && leftIndex === rightIndex) return true;
  const leftKey = normalizeFileName(left?.fileName || left?.id);
  const rightKey = normalizeFileName(right?.fileName || right?.id);
  return Boolean(leftKey && rightKey && leftKey === rightKey);
}

function getWrittenPages(records) {
  const filtering = hasActiveRecordFilter();
  return recordPageConfig
    .map((page) => {
      const pageRecords = getPageRecords(page, records);
      const matchedRecords = filtering ? getPageMatchedRecords(page, records) : pageRecords;
      return { ...page, records: pageRecords, matchedRecords };
    })
    .filter((page) => Boolean(getPageImagePath(page, page.records)))
    .filter((page) => !filtering || page.matchedRecords.length > 0);
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

function escapeWrittenAttribute(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getDirectWrittenImageUrl(path) {
  const sourcePath = String(path || "").trim();
  if (!sourcePath) return "";
  if (/^(?:https?:|data:|blob:)/i.test(sourcePath)) return sourcePath;
  if (/^(?:\.\/|\/)?images\//i.test(sourcePath)) {
    return new URL(sourcePath.replace(/^\//, ""), document.baseURI).href;
  }
  return "";
}

function getCachedWrittenImageSource(path) {
  const sourcePath = String(path || "").trim();
  if (!sourcePath) return "";
  const readySource = writtenImageReadyCache.get(sourcePath);
  if (readySource) return readySource;
  const preloaded = window.ClassRecordData?.getPreloadedAsset?.(sourcePath);
  if (preloaded?.url) {
    writtenImageReadyCache.set(sourcePath, preloaded.url);
    return preloaded.url;
  }
  const directUrl = getDirectWrittenImageUrl(sourcePath);
  if (directUrl) {
    const image = new Image();
    image.src = directUrl;
    if (image.complete && image.naturalWidth > 0) {
      writtenImageReadyCache.set(sourcePath, directUrl);
      return directUrl;
    }
  }
  return "";
}

function preloadWrittenImage(path, { priority = "low" } = {}) {
  const sourcePath = String(path || "").trim();
  if (!sourcePath) return Promise.resolve("");
  if (writtenImagePreloadCache.has(sourcePath)) return writtenImagePreloadCache.get(sourcePath);
  const promise = (async () => {
    const directUrl = getDirectWrittenImageUrl(sourcePath);
    if (directUrl) {
      const directResult = await preloadBrowserImage(directUrl, priority);
      if (directResult) return directResult;
    }
    return window.ClassRecordData?.preloadAsset
      ? (await window.ClassRecordData.preloadAsset(sourcePath, { priority }).catch(() => "")) || ""
      : "";
  })();
  const reusable = promise.then((result) => {
    if (!result) writtenImagePreloadCache.delete(sourcePath);
    else writtenImageReadyCache.set(sourcePath, result);
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
  const pageMatchedRecords = page.matchedRecords || pageRecords;
  const pageMessage = getVisiblePageMessage(page, pageMatchedRecords);
  const pageSupplements = getVisiblePageSupplements(page, pageMatchedRecords);
  const pageHasExtras = Boolean(pageMessage?.content) || pageSupplements.length > 0;
  pageRecords.sort((a, b) => (a.recordIndex ?? 0) - (b.recordIndex ?? 0));
  const imagePath = getPageImagePath(page, pageRecords);
  const cachedImageSrc = imagePath ? getCachedWrittenImageSource(imagePath) : "";
  const imageState = imagePath ? (cachedImageSrc ? "loaded" : "loading") : "missing";
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
        <figure class="record-written-image is-${imageState}${cachedImageSrc ? ' is-cache-hit' : ''}${hiddenMode ? ' is-hidden-image' : ''}" data-render-token="${token}" data-image-state="${imageState}">
          ${imagePath ? `<img alt="${hiddenMode ? `${page.page} 隐藏书面记录` : `${page.page} 原始书面记录`}" width="2856" height="4282" loading="eager" decoding="async" fetchpriority="high"${cachedImageSrc ? ` src="${escapeWrittenAttribute(cachedImageSrc)}"` : ""}>` : ""}
          <span class="record-written-image-loading">${imagePath ? '<i aria-hidden="true"></i><b>正在加载书面记录</b>' : "未找到书面文件"}</span>
        </figure>
        <div class="record-written-records">
          ${renderPageMessage(pageMessage)}
          ${renderPageSupplements(pageSupplements)}
          <div class="record-written-record-list"></div>
        </div>
      </div>
    </section>
  `;

  const recordHost = container.querySelector(".record-written-record-list");
  if (!pageRecords.length && pageHasExtras && recordHost) {
    recordHost.innerHTML = "";
  } else if (hiddenMode && !pageRecords.length && recordHost) {
    recordHost.innerHTML = '<div class="record-empty"><strong>这张隐藏书面页没有匹配记录。</strong><span>已检测到图片，但对应普通页范围内没有 hidden 为 true 的记录。</span></div>';
  } else {
    renderRecordList(pageRecords, recordHost);
  }
  const writtenFigure = container.querySelector(".record-written-image");
  const writtenImage = container.querySelector(".record-written-image img");
  writtenFigure?.addEventListener("click", () => {
    if (!imagePath || typeof window.ClassRecordImageViewer?.open !== "function") return;
    window.ClassRecordImageViewer.open(imagePath, {
      alt: hiddenMode ? `${page.page} hidden written record` : `${page.page} written record`
    });
  });
  writtenImage?.addEventListener("load", (event) => {
    setWrittenImageState(event.currentTarget.closest(".record-written-image"), "loaded", token);
  }, { once: true });
  writtenImage?.addEventListener("error", (event) => {
    setWrittenImageState(event.currentTarget.closest(".record-written-image"), "error", token);
  }, { once: true });
  if (imagePath && writtenImage && !cachedImageSrc) {
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
  if (window.ClassRecordData?.isEnabled()) {
    window.ClassRecordData.resolveAssetElements(container.querySelector(".record-written-records") || container).catch((error) => {
      console.warn("书面记录页内附件链接加载失败：", error);
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
    getRecords: getCurrentViewFilterRecords,
    filterRecords: getFilteredRecordsForCurrentView,
    initial: currentCriteria,
    onClear: clearRecordNavigationState,
    onFilterChange: criteria => {
      clearPendingRecordJumpState();
      currentCriteria = { ...criteria };
      currentPageIndex = 0;
      renderCurrentViewAsync();
    }
  });
}

function clearPendingRecordJumpState({ closeDialog = true, clearHash = true } = {}) {
  window.ClassRecordCancelFocus?.();
  if (closeDialog) closeRecordJumpDialog({ immediate: true });
  pendingRecordJump = null;
  try {
    sessionStorage.removeItem("classrecord:pending-record-jump");
  } catch (error) {
    // Storage may be unavailable in privacy modes; in-memory state is already cleared.
  }
  document.querySelectorAll(".record-anchor-highlight").forEach((record) => record.classList.remove("record-anchor-highlight"));
  if (clearHash && location.hash) {
    history.replaceState(null, "", `${location.pathname}${location.search}`);
  }
}

function clearRecordNavigationState() {
  clearPendingRecordJumpState();
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
  if (!origin.anchorId) {
    if (typeof window.ClassRecordAnimateScrollTo === "function") {
      await window.ClassRecordAnimateScrollTo(origin.scrollY, { behavior: "smooth" });
    } else {
      window.scrollTo({ top: origin.scrollY, behavior: "smooth" });
    }
  }
}

function showRecordJumpDialog(target, jumpState) {
  closeRecordJumpDialog({ immediate: true });
  pendingRecordJump = null;
  if (location.hash.replace(/^#/, "") === jumpState.targetAnchorId) {
    history.replaceState(null, "", `${location.pathname}${location.search}`);
  }
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
    const left = Math.min(Math.max(targetRect.left + (targetRect.width - width) / 2, viewportPadding), window.innerWidth - width - viewportPadding);
    const top = targetRect.bottom + gap;
    dialog.classList.add("is-below");
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
    renderRecordList(getListViewRecords(records), container);
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
    renderRecordFilterForCurrentState();
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
  window.ClassRecordResetAutoFocus?.();
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
  return false;
}

const cacheReady = window.cacheReadyPromise || Promise.resolve();

cacheReady.then(() => Promise.all([loadAllRecords(), loadRecordPageConfig()]))
  .then(async ([records]) => {
    if (hiddenMode) return;
    allRecords = records;
    sortRecords(allRecords);
    await window.preloadRecordIllustrationMetadata?.(allRecords);
    if (hiddenMode) return;
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
        window.ClassRecordResetAutoFocus?.();
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
      getRecords: getCurrentViewFilterRecords,
      filterRecords: getFilteredRecordsForCurrentView,
      initial: currentCriteria,
      onClear: clearRecordNavigationState,
      onFilterChange: criteria => {
        clearPendingRecordJumpState();
        currentCriteria = criteria;
        currentPageIndex = 0;
        renderCurrentViewAsync();
      }
    });
  })
  .catch((error) => {
    console.warn("记录加载失败：", error);
    container.innerHTML = '<div class="record-empty"><strong>记录加载失败。</strong><span>请确认 Supabase 数据表和访问权限状态后重试。</span></div>';
  });
