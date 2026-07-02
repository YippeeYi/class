/************************************************************
 * recordRenderer.js
 * 功能：
 * - 统一解析记录文本
 * - 统一排序
 * - 统一渲染记录列表
 * - 主页面 & 详情页面共用
 ************************************************************/

function stableRecordJumpHue(fileName) {
    const key = `record-jump::${String(fileName || "").trim().toLowerCase().replace(/\.json$/i, "")}`;
    let hash = 2166136261;
    for (let index = 0; index < key.length; index += 1) {
        hash ^= key.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return 190 + ((hash >>> 0) % 140);
}

function escapeRecordAttribute(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function getPersonDisplayNameById(id) {
    const person = window.PeopleStore?.people?.find((item) => item.id === id);
    return stripRecordMarkup(person?.name || person?.alias || id).trim() || id;
}

function parseContent(text) {
    if (!text) return "";

    return text
        .replace(/!!(.+?)!!/g, (_, content) => `<span class="record-center-line">${content}</span>`)
        .replace(/->\[(.+?)\|\|(.+?)\]<-/g, (_, top, bottom) => {
            // 答题挖空会注入 span；箭头宽度只按可见文字计算，不能把标签字符算进去。
            const visibleLength = (value) => Array.from(stripRecordMarkup(value).replace(/<[^>]*>/g, "")).length;
            const width = Math.max(visibleLength(top), visibleLength(bottom), 2);
            return `<span class="record-arrow-note" style="--arrow-note-chars:${width}"><span class="record-arrow-note-text">${top}</span><span class="record-arrow-note-line" aria-hidden="true"></span><span class="record-arrow-note-text">${bottom}</span></span>`;
        })
        // 记录跳转语法：[[record:JSON文件名|显示文字]]，文件名可省略 .json。
        .replace(/\[\[record:([a-zA-Z0-9_-]+(?:\.json)?)\|(.+?)\]\]/g, (_, fileName, label) => `<button type="button" class="record-jump-link" data-record-jump="${fileName}" style="--record-jump-hue:${stableRecordJumpHue(fileName)}">${label}</button>`)
        .replace(/\{\{([a-zA-Z0-9_-]+)\|(.+?)\}\}/g, (_, id, label) => `<span class="term-tag" data-id="${id}">${label}</span>`)
        .replace(/\[\[([a-zA-Z0-9_-]+)\|(.+?)\]\]/g, (_, id, label) => `<span class="person-tag" data-id="${id}" title="${escapeRecordAttribute(getPersonDisplayNameById(id))}">${label}</span>`)
        .replace(/\(\((.+?)\)\)/g, (_, content) => `<span class="redacted"><span class="redacted-mask"></span><span class="redacted-content">${content}</span></span>`)
        .replace(/>>(.+?)<</g, (_, value) => `<span class="record-align-right">${value}</span>`)
        .replace(/\^(.+?)\^/g, (_, value) => `<sup>${value}</sup>`)
        .replace(/_(.+?)_/g, (_, value) => `<sub>${value}</sub>`);
}

function stripRecordMarkup(text) {
    if (!text) return "";

    return text
        .replace(/!!(.+?)!!/g, "$1")
        .replace(/->\[(.+?)\|\|(.+?)\]<-/g, "$1 $2")
        .replace(/\[\[record:([a-zA-Z0-9_-]+(?:\.json)?)\|(.+?)\]\]/g, "$2")
        .replace(/\{\{([a-zA-Z0-9_-]+)\|(.+?)\}\}/g, "$2")
        .replace(/\[\[([a-zA-Z0-9_-]+)\|(.+?)\]\]/g, "$2")
        .replace(/\(\((.+?)\)\)/g, "$1")
        .replace(/>>(.+?)<</g, "$1")
        .replace(/\^(.+?)\^/g, "$1")
        .replace(/_(.+?)_/g, "$1");
}

window.stripRecordMarkup = stripRecordMarkup;

document.addEventListener("click", (event) => {
    const jump = event.target.closest(".record-jump-link[data-record-jump]");
    if (!jump) return;
    const recordKey = String(jump.dataset.recordJump || "").replace(/\.json$/i, "");
    if (!recordKey) return;
    if (typeof window.ClassRecordNavigateToRecord === "function") {
        window.ClassRecordNavigateToRecord(recordKey, { sourceElement: jump });
        return;
    }
    const anchor = `record-${recordKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
    const sourceRecord = jump.closest(".record");
    const sourceUrl = new URL(location.href);
    if (sourceRecord?.id) sourceUrl.hash = sourceRecord.id;
    try {
        sessionStorage.setItem("classrecord:pending-record-jump", JSON.stringify({
            targetAnchorId: anchor,
            originHref: sourceUrl.href,
            createdAt: Date.now()
        }));
    } catch (error) {
        // Storage may be unavailable in privacy modes; the jump itself still works.
    }
    const href = `record.html?view=list#${anchor}`;
    if (typeof window.navigateTo === "function") window.navigateTo(href);
    else location.href = href;
});

function normalizeSearchText(text) {
    return stripRecordMarkup(String(text || ""))
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function getRecordSearchText(record) {
    return normalizeSearchText(record.content || "");
}

function formatContent(text) {
    return String(text || "")
        .split(/\n\s*\n/g)
        .map((paragraph) => `<span class="record-paragraph">${parseContent(paragraph).replace(/\n/g, "<br>")}</span>`)
        .join("");
}

function sortRecords(records) {
    records.sort((a, b) => b.id.localeCompare(a.id));
}

function getRecordAnchorId(record) {
    return `record-${String(record.fileName || record.id || "").replace(/\.json$/i, "").replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function getRecordKey(record) {
    return String(record?.fileName || record?.id || "").trim();
}

function buildRecordBody(record) {
    const timeText = record.time ? `📌 ${record.time} |` : "";

    return `
        <div class="meta">
            <span>
                #${record.id} |
                📅 ${record.date} |
                ${timeText}
                ✍ ${parseContent(`[[${record.author}|${record.author}]]`)}
            </span>
            <span class="icon-group">

                ${record.attachments?.length ? `<span class="attach-toggle">📎</span>` : ""}

            </span>
        </div>

        <div class="content">
            ${formatContent(record.content)}
        </div>
        ${record.attachments?.length ? `
            <div class="attachments-wrapper" style="display:none">
                <ul>
                    ${record.attachments.map(a => `<li><a href="" data-secure-href="${a.file}" target="_blank" rel="noopener">${a.name}</a></li>`).join("")}
                </ul>
            </div>
        ` : ""}
        `;
}


function afterScrollSettles(target, callback, { timeout = 2600, quiet = 220 } = {}) {
    const start = performance.now();
    let lastX = window.scrollX;
    let lastY = window.scrollY;
    let lastRect = target.getBoundingClientRect();
    let lastMoveAt = start;

    const tick = (now) => {
        const rect = target.getBoundingClientRect();
        const moved =
            Math.abs(window.scrollX - lastX) > 0.5 ||
            Math.abs(window.scrollY - lastY) > 0.5 ||
            Math.abs(rect.top - lastRect.top) > 0.5 ||
            Math.abs(rect.left - lastRect.left) > 0.5;
        if (moved) {
            lastX = window.scrollX;
            lastY = window.scrollY;
            lastRect = rect;
            lastMoveAt = now;
        }
        if (now - start >= timeout || now - lastMoveAt >= quiet) {
            callback();
            return;
        }
        requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
}

function focusRecordAnchor(anchorId, { behavior = "smooth" } = {}) {
    const target = document.getElementById(String(anchorId || "").replace(/^#/, ""));
    if (!target) return false;
    requestAnimationFrame(() => {
        target.scrollIntoView({ behavior, block: "center" });
        afterScrollSettles(target, () => {
            target.classList.remove("record-anchor-highlight");
            void target.offsetWidth;
            target.classList.add("record-anchor-highlight");
            window.setTimeout(() => target.classList.remove("record-anchor-highlight"), 1500);
            document.dispatchEvent(new CustomEvent("classrecord:record-focused", {
                detail: { anchorId: target.id, target }
            }));
        });
    });
    return true;
}

window.ClassRecordFocusAnchor = focusRecordAnchor;

function renderRecordList(records, container) {
    records.forEach((record) => {
        if (!record.id) {
            console.warn("发现未初始化 id 的记录：", record);
        }
    });

    container.innerHTML = "";
    if (!records.length) {
        container.innerHTML = `
            <div class="record-empty">
                <strong>没有找到符合条件的记录。</strong>
                <span>可以放宽日期、关键词或重要性筛选后再试。</span>
            </div>
        `;
        return;
    }
    const fragment = document.createDocumentFragment();
    records.forEach((record) => {
        const importance = record.importance || "normal";
        const div = document.createElement("div");
        div.id = getRecordAnchorId(record);
        div.dataset.recordKey = getRecordKey(record);
        div.className = `record importance-${importance}`;
        div.innerHTML = buildRecordBody(record);
        bindToggle(div);
        fragment.appendChild(div);
    });
    container.appendChild(fragment);
    if (window.ClassRecordData?.isEnabled()) {
        window.ClassRecordData.resolveAssetElements(container).catch((error) => {
            console.warn("私有附件链接加载失败：", error);
        });
    }

    if (location.hash) {
        focusRecordAnchor(location.hash.slice(1));
    }
}

function filterRecordsByDate(records, { year, month, day, important, excludeDaily, query } = {}) {
    const hasYear = Boolean(year);
    const hasMonth = Boolean(month);
    const hasDay = Boolean(day);
    const onlyImportant = Boolean(important);
    const hideDaily = Boolean(excludeDaily);
    const normalizedQuery = normalizeSearchText(query);
    if (!hasYear && !hasMonth && !hasDay && !onlyImportant && !hideDaily && !normalizedQuery) return records.slice();

    return records.filter((record) => {
        if (onlyImportant && record.importance !== "important") return false;
        if (hideDaily && String(record.fileName || record.id || "").replace(/\.json$/i, "").endsWith("-00")) return false;
        if (!record.date) return false;
        const [recordYear, recordMonth, recordDay] = record.date.split("-");
        if (hasYear && recordYear !== year) return false;
        if (hasMonth && recordMonth !== month) return false;
        if (hasDay && recordDay !== day) return false;
        if (normalizedQuery && !getRecordSearchText(record).includes(normalizedQuery)) return false;
        return true;
    });
}

function parseDateParts(records) {
    return records
        .map((record) => record.date)
        .filter(Boolean)
        .map((date) => {
            const [year, month, day] = date.split("-");
            return { year, month, day };
        });
}

function uniqueSorted(values) {
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function buildOptions(records, criteria) {
    const dates = parseDateParts(records);

    return {
        yearOptions: uniqueSorted(dates
            .filter((date) => (!criteria.month || date.month === criteria.month) && (!criteria.day || date.day === criteria.day))
            .map((date) => date.year)),
        monthOptions: uniqueSorted(dates
            .filter((date) => (!criteria.year || date.year === criteria.year) && (!criteria.day || date.day === criteria.day))
            .map((date) => date.month)),
        dayOptions: uniqueSorted(dates
            .filter((date) => (!criteria.year || date.year === criteria.year) && (!criteria.month || date.month === criteria.month))
            .map((date) => date.day))
    };
}

function renderRecordFilter({ container, onFilterChange, getRecords, initial = {} }) {
    if (!container) return;

    container.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "record-filter";
    wrapper.innerHTML = `
        <div class="filter-field">
            <button type="button" class="btn-select filter-dropdown-trigger" data-target="filter-year-options" aria-label="按年筛选">
                选择年
                <span class="dropdown-arrow" aria-hidden="true">▾</span>
            </button>
            <div id="filter-year-options" class="filter-options" role="group" aria-label="按年筛选"></div>
        </div>
        <div class="filter-field">
            <button type="button" class="btn-select filter-dropdown-trigger" data-target="filter-month-options" aria-label="按月筛选">
                选择月
                <span class="dropdown-arrow" aria-hidden="true">▾</span>
            </button>
            <div id="filter-month-options" class="filter-options" role="group" aria-label="按月筛选"></div>
        </div>
        <div class="filter-field">
            <button type="button" class="btn-select filter-dropdown-trigger" data-target="filter-day-options" aria-label="按日筛选">
                选择日
                <span class="dropdown-arrow" aria-hidden="true">▾</span>
            </button>
            <div id="filter-day-options" class="filter-options" role="group" aria-label="按日筛选"></div>
        </div>
        <div class="filter-search-field">
            <input id="record-keyword" class="record-search-input" type="search" placeholder="搜索记录正文" autocomplete="off" aria-label="搜索记录正文关键词">
        </div>
        <div class="filter-actions">
            <button type="button" class="btn-action filter-important" data-field="important">重要记录</button>
            <button type="button" class="btn-action filter-exclude-daily" data-field="excludeDaily">隐藏日期</button>
            <button type="button" class="btn-action clear">清空</button>
        </div>
        <div class="record-filter-status" aria-live="polite"></div>
    `;
    container.appendChild(wrapper);

    const yearOptions = wrapper.querySelector("#filter-year-options");
    const monthOptions = wrapper.querySelector("#filter-month-options");
    const dayOptions = wrapper.querySelector("#filter-day-options");
    const dropdownTriggers = wrapper.querySelectorAll(".filter-dropdown-trigger");
    const filterFields = wrapper.querySelectorAll(".filter-field");
    const clearButton = wrapper.querySelector(".clear");
    const importantButton = wrapper.querySelector(".filter-important");
    const excludeDailyButton = wrapper.querySelector(".filter-exclude-daily");
    const searchInput = wrapper.querySelector(".record-search-input");
    const statusEl = wrapper.querySelector(".record-filter-status");

    let currentCriteria = {
        year: initial.year || "",
        month: initial.month || "",
        day: initial.day || "",
        important: Boolean(initial.important),
        excludeDaily: Boolean(initial.excludeDaily),
        query: initial.query || ""
    };
    let lastRecordedSearchQuery = normalizeSearchText(currentCriteria.query);

    const updateTriggerLabels = (criteria) => {
        const labels = {
            year: criteria.year ? `${criteria.year}年` : "选择年",
            month: criteria.month ? `${criteria.month}月` : "选择月",
            day: criteria.day ? `${criteria.day}日` : "选择日"
        };
        importantButton?.classList.toggle("is-active", Boolean(criteria.important));
        excludeDailyButton?.classList.toggle("is-active", Boolean(criteria.excludeDaily));
        if (searchInput && searchInput.value !== criteria.query) searchInput.value = criteria.query || "";
        dropdownTriggers.forEach((trigger) => {
            const target = trigger.dataset.target || "";
            if (target.includes("year")) trigger.childNodes[0].textContent = `${labels.year} `;
            if (target.includes("month")) trigger.childNodes[0].textContent = `${labels.month} `;
            if (target.includes("day")) trigger.childNodes[0].textContent = `${labels.day} `;
        });
    };

    const renderSelectOptions = () => {
        const records = typeof getRecords === "function" ? getRecords() : [];
        const options = buildOptions(records, currentCriteria);
        const fillOptions = (containerEl, optionValues, selectedValue, fieldKey) => {
            const selected = selectedValue || "";
            containerEl.innerHTML = [
                `<button type="button" class="btn-action filter-option${selected === "" ? " is-active" : ""}" data-value="" data-field="${fieldKey}">全部</button>`,
                ...optionValues.map((value) => `<button type="button" class="btn-action filter-option${value === selected ? " is-active" : ""}" data-value="${value}" data-field="${fieldKey}">${value}</button>`)
            ].join("");
        };
        fillOptions(yearOptions, options.yearOptions, currentCriteria.year, "year");
        fillOptions(monthOptions, options.monthOptions, currentCriteria.month, "month");
        fillOptions(dayOptions, options.dayOptions, currentCriteria.day, "day");
    };

    const activeCriteriaText = (criteria) => {
        const items = [];
        if (criteria.year) items.push(`${criteria.year}年`);
        if (criteria.month) items.push(`${criteria.month}月`);
        if (criteria.day) items.push(`${criteria.day}日`);
        if (criteria.important) items.push("重要记录");
        if (criteria.excludeDaily) items.push("隐藏日期");
        if (criteria.query) items.push(`关键词“${criteria.query}”`);
        return items;
    };

    const updateFilterStatus = () => {
        if (!statusEl) return;
        const records = typeof getRecords === "function" ? getRecords() : [];
        const count = filterRecordsByDate(records, currentCriteria).length;
        const activeText = activeCriteriaText(currentCriteria);
        statusEl.innerHTML = `
            <span>共 ${count} 条结果</span>
            ${activeText.length ? `<span class="record-filter-tags">${activeText.map((item) => `<em>${item}</em>`).join("")}</span>` : ""}
        `;
    };

    const applyCriteria = (criteria) => {
        currentCriteria = { ...criteria };
        renderSelectOptions();
        updateTriggerLabels(currentCriteria);
        updateFilterStatus();
        const normalizedQuery = normalizeSearchText(currentCriteria.query);
        if (normalizedQuery && normalizedQuery !== lastRecordedSearchQuery) lastRecordedSearchQuery = normalizedQuery;
        onFilterChange?.(currentCriteria);
    };

    const handleOptionClick = (event) => {
        const target = event.target.closest(".filter-option");
        if (!target) return;
        const field = target.dataset.field;
        if (!field) return;
        const fieldElement = target.closest(".filter-field");
        if (fieldElement) closeField(fieldElement, false);
        applyCriteria({ ...currentCriteria, [field]: target.dataset.value || "" });
    };

    const closeTimers = new WeakMap();
    const openField = (field) => {
        const timer = closeTimers.get(field);
        if (timer) clearTimeout(timer);
        closeTimers.delete(field);
        field.classList.add("is-open");
    };
    const closeField = (field, withDelay = true) => {
        const timer = closeTimers.get(field);
        if (timer) clearTimeout(timer);
        if (!withDelay) {
            field.classList.remove("is-open");
            closeTimers.delete(field);
            return;
        }
        closeTimers.set(field, setTimeout(() => {
            field.classList.remove("is-open");
            closeTimers.delete(field);
        }, 140));
    };

    filterFields.forEach((field) => {
        const trigger = field.querySelector(".filter-dropdown-trigger");
        field.addEventListener("mouseenter", () => openField(field));
        field.addEventListener("mouseleave", () => closeField(field, true));
        trigger?.addEventListener("click", (event) => {
            event.preventDefault();
            const isOpen = field.classList.contains("is-open");
            filterFields.forEach((otherField) => { if (otherField !== field) closeField(otherField, false); });
            if (isOpen) closeField(field, false);
            else openField(field);
        });
    });

    document.addEventListener("click", (event) => {
        if (!wrapper.contains(event.target)) filterFields.forEach((field) => closeField(field, false));
    });

    yearOptions.addEventListener("click", handleOptionClick);
    monthOptions.addEventListener("click", handleOptionClick);
    dayOptions.addEventListener("click", handleOptionClick);
    importantButton?.addEventListener("click", () => applyCriteria({ ...currentCriteria, important: !currentCriteria.important }));
    excludeDailyButton?.addEventListener("click", () => applyCriteria({ ...currentCriteria, excludeDaily: !currentCriteria.excludeDaily }));
    clearButton.addEventListener("click", () => applyCriteria({ year: "", month: "", day: "", important: false, excludeDaily: false, query: "" }));
    searchInput?.addEventListener("input", () => {
        window.clearTimeout(searchInput._recordSearchTimer);
        searchInput._recordSearchTimer = window.setTimeout(() => {
            applyCriteria({ ...currentCriteria, query: searchInput.value.trim() });
        }, 120);
    });
    searchInput?.addEventListener("search", () => applyCriteria({ ...currentCriteria, query: searchInput.value.trim() }));

    renderSelectOptions();
    updateTriggerLabels(currentCriteria);
    updateFilterStatus();
}
function bindToggle(recordDiv) {
    const attachmentButton = recordDiv.querySelector(".attach-toggle");
    const attachmentWrap = recordDiv.querySelector(".attachments-wrapper");
    if (attachmentButton && attachmentWrap) {
        attachmentButton.onclick = () => {
            const open = attachmentWrap.style.display === "block";
            attachmentWrap.style.display = open ? "none" : "block";
            attachmentButton.textContent = open ? "📎" : "×";
        };
    }
}

let glossaryCache = null;
let activeTooltip = null;
let activeTermId = null;
let tooltipTimer = null;
let tooltipRemoveTimer = null;
let lastMouseX = 0;
let lastMouseY = 0;
let isHoveringTooltip = false;
let isHoveringTerm = false;

const TOOLTIP_DELAY = 200;
const TOOLTIP_REMOVE_DELAY = 300;

function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
}

function updateTooltipHorizontalPosition() {
    if (!activeTooltip) return;

    const tooltipRect = activeTooltip.getBoundingClientRect();
    const padding = 12;
    const left = clamp(
        lastMouseX - tooltipRect.width / 2,
        padding,
        window.innerWidth - tooltipRect.width - padding
    );

    activeTooltip.style.left = `${left + window.scrollX}px`;
}

async function ensureGlossary() {
    if (!glossaryCache) {
        const list = await loadAllGlossary();
        glossaryCache = {};
        list.forEach((term) => {
            glossaryCache[term.id] = term;
        });
    }
}

document.addEventListener("mousemove", (event) => {
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
});

document.addEventListener("mouseover", (event) => {
    const tag = event.target.closest(".term-tag");
    if (!tag) return;

    const termId = tag.dataset.id;
    isHoveringTerm = true;
    clearTimeout(tooltipTimer);

    tooltipTimer = setTimeout(async () => {
        await ensureGlossary();
        const term = glossaryCache[termId];
        if (!term) return;
        if (activeTooltip && activeTermId === termId) return;

        removeTooltip(true);
        activeTermId = termId;
        activeTooltip = document.createElement("div");
        activeTooltip.className = "term-tooltip hidden";
        activeTooltip.innerHTML = `
            <div class="term-tooltip-content">${formatContent(term.definition)}</div>
            <div class="term-tooltip-hint">点击此处查看完整术语页面</div>
        `;
        document.body.appendChild(activeTooltip);

        activeTooltip.addEventListener("mouseenter", () => {
            isHoveringTooltip = true;
            clearTimeout(tooltipRemoveTimer);
        });
        activeTooltip.addEventListener("mouseleave", () => {
            isHoveringTooltip = false;
            scheduleTooltipRemoval();
        });

        const tooltipRect = activeTooltip.getBoundingClientRect();
        const tagRect = tag.getBoundingClientRect();
        const padding = 12;
        const verticalGap = 10;
        let top = tagRect.bottom + verticalGap;

        if (top + tooltipRect.height > window.innerHeight - padding) {
            top = tagRect.top - tooltipRect.height - verticalGap;
        }

        top = clamp(Number.isFinite(top) ? top : lastMouseY + verticalGap, padding, window.innerHeight - tooltipRect.height - padding);
        activeTooltip.style.position = "absolute";
        activeTooltip.style.top = `${top + window.scrollY}px`;
        updateTooltipHorizontalPosition();

        requestAnimationFrame(() => {
            activeTooltip.classList.remove("hidden");
            activeTooltip.classList.add("show");
        });
    }, TOOLTIP_DELAY);
});

document.addEventListener("mouseout", (event) => {
    if (event.target.closest(".term-tag")) {
        isHoveringTerm = false;
    }

    clearTimeout(tooltipTimer);
    tooltipTimer = null;
    if (!activeTooltip) return;

    const to = event.relatedTarget;
    if (to && (to.closest(".term-tag") || to.closest(".term-tooltip"))) {
        return;
    }

    scheduleTooltipRemoval();
});

function scheduleTooltipRemoval() {
    clearTimeout(tooltipRemoveTimer);

    tooltipRemoveTimer = setTimeout(() => {
        const element = document.elementFromPoint(lastMouseX, lastMouseY);
        const hovering = isHoveringTerm ||
            isHoveringTooltip ||
            (element && (element.closest(".term-tag") || element.closest(".term-tooltip")));

        if (!hovering) {
            removeTooltip();
        }
    }, TOOLTIP_REMOVE_DELAY);
}

function removeTooltip(immediate = false) {
    if (!activeTooltip) return;

    activeTooltip.classList.remove("show");
    const element = activeTooltip;
    activeTooltip = null;
    activeTermId = null;
    isHoveringTooltip = false;
    isHoveringTerm = false;

    if (immediate) {
        element.remove();
    } else {
        setTimeout(() => element.remove(), 150);
    }
}

document.addEventListener("click", (event) => {
    const tooltip = event.target.closest(".term-tooltip");
    if (tooltip && activeTermId) {
        const href = `term.html?id=${activeTermId}`;
        if (typeof window.navigateTo === "function") {
            window.navigateTo(href);
        } else {
            location.href = href;
        }
        removeTooltip(true);
        return;
    }

    const termTag = event.target.closest(".term-tag");
    if (termTag && (event.pointerType === "touch" || window.matchMedia("(hover: none)").matches)) {
        const href = `term.html?id=${termTag.dataset.id}`;
        if (typeof window.navigateTo === "function") {
            window.navigateTo(href);
        } else {
            location.href = href;
        }
        removeTooltip(true);
        return;
    }

    const tag = event.target.closest(".person-tag");
    if (tag) {
        const href = `person.html?id=${tag.dataset.id}`;
        if (typeof window.navigateTo === "function") {
            window.navigateTo(href);
        } else {
            location.href = href;
        }
    }
});
