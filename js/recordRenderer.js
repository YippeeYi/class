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

function escapeRecordText(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

const ILLUSTRATION_IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"]);

function normalizeIllustrationPath(value) {
    const path = String(value ?? "").trim();
    if (!path || path.length > 500 || /[\\?#%\u0000-\u001f\u007f]/.test(path)) return "";
    if (/^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(path)) return "";
    const segments = path.split("/");
    if (segments.some((segment) => !segment || segment === "." || segment === "..")) return "";
    if (!/^data\/attachments\//i.test(path)) return "";
    const extension = segments.at(-1)?.split(".").pop()?.toLowerCase();
    return ILLUSTRATION_IMAGE_EXTENSIONS.has(extension) ? path : "";
}

function getPersonDisplayNameById(id) {
    const person = window.PeopleStore?.people?.find((item) => item.id === id);
    return stripRecordMarkup(person?.name || person?.alias || id).trim() || id;
}

function findBalancedSquareEnd(source, start) {
    let depth = 1;
    for (let index = start + 2; index < source.length - 1; index += 1) {
        if (source.startsWith("[[", index)) {
            depth += 1;
            index += 1;
        } else if (source.startsWith("]]", index)) {
            depth -= 1;
            if (depth === 0) return index + 2;
            index += 1;
        }
    }
    return -1;
}

function findTopLevelSeparator(source, separator = "|") {
    let depth = 0;
    for (let index = 0; index <= source.length - separator.length; index += 1) {
        if (source.startsWith("[[", index)) {
            depth += 1;
            index += 1;
        } else if (source.startsWith("]]", index) && depth > 0) {
            depth -= 1;
            index += 1;
        } else if (depth === 0 && source.startsWith(separator, index)) {
            return index;
        }
    }
    return -1;
}

function splitTopLevelOnce(source, separator = "|") {
    const index = findTopLevelSeparator(source, separator);
    return index < 0 ? null : [source.slice(0, index), source.slice(index + separator.length)];
}

function parseInlineStack(top, bottom, kind, context) {
    const topHtml = parseInlineMarkup(top, context);
    const bottomHtml = parseInlineMarkup(bottom, context);
    if (context.mode === "text") return `${topHtml} ${bottomHtml}`;
    const width = Math.max(Array.from(parseInlineMarkup(top, { ...context, mode: "text" })).length, Array.from(parseInlineMarkup(bottom, { ...context, mode: "text" })).length, 2);
    const middleClass = kind === "arrow" ? "record-arrow-note-line inline-stack-middle inline-stack-arrow" : "fraction-line inline-stack-middle inline-stack-fraction-line";
    return `<span class="inline-stack ${kind === "arrow" ? "record-arrow-note inline-stack--arrow" : "inline-fraction inline-stack--fraction"}" style="--arrow-note-chars:${width}"><span class="inline-stack-text inline-stack-top ${kind === "arrow" ? "record-arrow-note-text" : "fraction-top"}">${topHtml}</span><span class="${middleClass}" aria-hidden="true"></span><span class="inline-stack-text inline-stack-bottom ${kind === "arrow" ? "record-arrow-note-text" : "fraction-bottom"}">${bottomHtml}</span></span>`;
}

function renderSquareMarkup(body, raw, context) {
    const render = (value) => parseInlineMarkup(value, context);
    const asText = context.mode === "text";
    if (body.startsWith("del:")) {
        const content = body.slice(4);
        if (!content) return asText ? raw : escapeRecordText(raw);
        const rendered = render(content);
        return asText ? rendered : `<del class="inline-delete">${rendered}</del>`;
    }

    for (const type of ["record", "frac", "anno", "illu"]) {
        const prefix = `${type}:`;
        if (!body.startsWith(prefix)) continue;
        const parts = splitTopLevelOnce(body.slice(prefix.length));
        if (!parts || !parts[0] || !parts[1]) return asText ? raw : escapeRecordText(raw);
        const [first, second] = parts;
        if (type === "record") {
            if (!/^[a-zA-Z0-9_-]+(?:\.json)?$/.test(first)) return asText ? render(second) : render(second);
            const label = render(second);
            return asText || context.disableRecordLinks ? label : `<button type="button" class="record-jump-link" data-record-jump="${first}" style="--record-jump-hue:${stableRecordJumpHue(first)}">${label}</button>`;
        }
        if (type === "frac") return parseInlineStack(first, second, "fraction", context);
        if (type === "anno") {
            const label = render(second);
            if (asText) return label;
            const note = parseInlineMarkup(first, { ...context, mode: "text" });
            return `<span class="annotation" data-note="${escapeRecordAttribute(note)}" tabindex="0" role="button" aria-haspopup="true" aria-expanded="false">${label}</span>`;
        }
        const safePath = normalizeIllustrationPath(first);
        const label = render(second);
        if (asText || !safePath) return label;
        return `<span class="inline-illustration" data-image-src="${escapeRecordAttribute(safePath)}" tabindex="0" role="button" aria-haspopup="dialog" aria-expanded="false">${label}</span>`;
    }

    const personParts = splitTopLevelOnce(body);
    if (personParts && /^[a-zA-Z0-9_-]+$/.test(personParts[0]) && personParts[1]) {
        const label = render(personParts[1]);
        return asText ? label : `<span class="person-tag" data-id="${personParts[0]}" title="${escapeRecordAttribute(getPersonDisplayNameById(personParts[0]))}">${label}</span>`;
    }
    return asText ? raw : escapeRecordText(raw);
}

function parseInlineMarkup(value, options = {}) {
    const source = String(value ?? "");
    const context = { mode: options.mode || "html", disableRecordLinks: Boolean(options.disableRecordLinks), depth: (options.depth || 0) + 1 };
    if (context.depth > 32) return context.mode === "text" ? source : escapeRecordText(source);
    let output = "";
    for (let index = 0; index < source.length;) {
        if (source.startsWith("[[", index)) {
            const end = findBalancedSquareEnd(source, index);
            if (end > 0) {
                const raw = source.slice(index, end);
                output += renderSquareMarkup(raw.slice(2, -2), raw, context);
                index = end;
                continue;
            }
        }
        if (source.startsWith("->[", index)) {
            const end = source.indexOf("]<-", index + 3);
            if (end >= 0) {
                const parts = splitTopLevelOnce(source.slice(index + 3, end), "||");
                if (parts) {
                    output += parseInlineStack(parts[0], parts[1], "arrow", context);
                    index = end + 3;
                    continue;
                }
            }
        }
        const paired = [
            ["{{", "}}", "term"], ["((", "))", "redacted"], ["!!", "!!", "center"],
            [">>", "<<", "right"], ["^", "^", "sup"], ["_", "_", "sub"]
        ].find(([open]) => source.startsWith(open, index));
        if (paired) {
            const [open, close, type] = paired;
            const end = source.indexOf(close, index + open.length);
            if (end >= 0) {
                const inner = source.slice(index + open.length, end);
                let rendered = parseInlineMarkup(inner, context);
                if (type === "term") {
                    const parts = splitTopLevelOnce(inner);
                    if (parts && /^[a-zA-Z0-9_-]+$/.test(parts[0]) && parts[1]) {
                        rendered = parseInlineMarkup(parts[1], context);
                        output += context.mode === "text" ? rendered : `<span class="term-tag" data-id="${parts[0]}">${rendered}</span>`;
                        index = end + close.length;
                        continue;
                    }
                } else {
                    if (context.mode === "text") output += rendered;
                    else if (type === "redacted") output += `<span class="redacted"><span class="redacted-mask"></span><span class="redacted-content">${rendered}</span></span>`;
                    else if (type === "center") output += `<span class="record-center-line">${rendered}</span>`;
                    else if (type === "right") output += `<span class="record-align-right">${rendered}</span>`;
                    else output += `<${type}>${rendered}</${type}>`;
                    index = end + close.length;
                    continue;
                }
            }
        }
        const character = source[index];
        output += context.mode === "text" ? character : escapeRecordText(character);
        index += 1;
    }
    return output;
}

function parseContent(text, options = {}) {
    if (!text) return "";
    return parseInlineMarkup(text, options);
}

function stripRecordMarkup(text) {
    if (!text) return "";
    return parseInlineMarkup(text, { mode: "text" });
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

function formatContent(text, options = {}) {
    return String(text || "")
        .split(/\n\s*\n/g)
        .map((paragraph) => `<span class="record-paragraph">${parseContent(paragraph, options).replace(/\n/g, "<br>")}</span>`)
        .join("");
}

function formatTrustedContent(text, options = {}) {
    const trustedTags = [];
    const protectedText = String(text || "").replace(/<\/span>|<span>|<span class="quiz-[a-zA-Z0-9 _-]+"(?: style="--blank-chars:\d+")?>/g, (tag) => `\uE100${trustedTags.push(tag) - 1}\uE101`);
    return formatContent(protectedText, options).replace(/\uE100(\d+)\uE101/g, (token, index) => trustedTags[Number(index)] ?? token);
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

let activeAnnotation = null;
let activeAnnotationTooltip = null;

let activeIllustration = null;
let activeIllustrationTooltip = null;
let illustrationRequestToken = 0;

function removeIllustrationTooltip() {
    illustrationRequestToken += 1;
    activeIllustration?.setAttribute("aria-expanded", "false");
    activeIllustrationTooltip?.remove();
    activeIllustration = null;
    activeIllustrationTooltip = null;
}

function positionIllustrationTooltip(tag, pointerEvent) {
    if (!activeIllustrationTooltip) return;
    const tagRect = tag.getBoundingClientRect();
    const tooltipRect = activeIllustrationTooltip.getBoundingClientRect();
    const padding = 12;
    const gap = 10;
    const pointerX = Number.isFinite(pointerEvent?.clientX) ? pointerEvent.clientX : tagRect.left + tagRect.width / 2;
    const left = clamp(pointerX - tooltipRect.width / 2, padding, Math.max(padding, window.innerWidth - tooltipRect.width - padding));
    let top = tagRect.bottom + gap;
    if (top + tooltipRect.height > window.innerHeight - padding) top = tagRect.top - tooltipRect.height - gap;
    top = clamp(top, padding, Math.max(padding, window.innerHeight - tooltipRect.height - padding));
    activeIllustrationTooltip.style.left = `${left}px`;
    activeIllustrationTooltip.style.top = `${top}px`;
}

async function resolveIllustrationUrl(path) {
    if (window.ClassRecordData?.isEnabled?.()) {
        return window.ClassRecordData.preloadAsset(path, { priority: "high" }).catch(() => null);
    }
    return path;
}

function setIllustrationFailure(tooltip) {
    tooltip.classList.add("has-error");
    tooltip.replaceChildren();
    const message = document.createElement("span");
    message.className = "illustration-tooltip-status";
    message.textContent = "图片加载失败";
    tooltip.appendChild(message);
}

async function showIllustrationTooltip(tag, event) {
    if (!tag || (activeIllustration === tag && activeIllustrationTooltip)) return;
    removeIllustrationTooltip();
    removeAnnotationTooltip();
    const requestToken = illustrationRequestToken;
    const tooltip = document.createElement("div");
    tooltip.className = "illustration-tooltip";
    tooltip.setAttribute("role", "dialog");
    tooltip.setAttribute("aria-label", `${tag.textContent?.trim() || "插图"}预览`);
    const loading = document.createElement("span");
    loading.className = "illustration-tooltip-status";
    loading.textContent = "正在加载插图…";
    tooltip.appendChild(loading);
    document.body.appendChild(tooltip);
    activeIllustration = tag;
    activeIllustrationTooltip = tooltip;
    tag.setAttribute("aria-expanded", "true");
    positionIllustrationTooltip(tag, event);
    requestAnimationFrame(() => tooltip.classList.add("is-visible"));

    const url = await resolveIllustrationUrl(tag.dataset.imageSrc || "");
    if (requestToken !== illustrationRequestToken || tooltip !== activeIllustrationTooltip || !tooltip.isConnected) return;
    if (!url) {
        setIllustrationFailure(tooltip);
        positionIllustrationTooltip(tag);
        return;
    }
    const image = document.createElement("img");
    image.alt = tag.textContent?.trim() || "记录插图";
    image.decoding = "async";
    image.onload = () => {
        if (tooltip !== activeIllustrationTooltip) return;
        tooltip.classList.remove("is-loading");
        tooltip.replaceChildren(image);
        positionIllustrationTooltip(tag);
    };
    image.onerror = () => {
        if (tooltip !== activeIllustrationTooltip) return;
        setIllustrationFailure(tooltip);
        positionIllustrationTooltip(tag);
    };
    image.src = url;
}

document.addEventListener("pointerover", (event) => {
    if (event.pointerType === "touch") return;
    const tag = event.target.closest(".inline-illustration");
    if (tag) showIllustrationTooltip(tag, event);
});

document.addEventListener("pointerout", (event) => {
    if (event.pointerType === "touch") return;
    const tag = event.target.closest(".inline-illustration");
    if (tag && !tag.contains(event.relatedTarget)) removeIllustrationTooltip();
});

document.addEventListener("focusin", (event) => {
    const tag = event.target.closest(".inline-illustration");
    if (tag?.matches(":focus-visible")) showIllustrationTooltip(tag);
});

document.addEventListener("focusout", (event) => {
    if (event.target.closest(".inline-illustration")) removeIllustrationTooltip();
});

function removeAnnotationTooltip() {
    activeAnnotation?.setAttribute("aria-expanded", "false");
    activeAnnotationTooltip?.remove();
    activeAnnotation = null;
    activeAnnotationTooltip = null;
}

function positionAnnotationTooltip(tag, pointerEvent) {
    if (!activeAnnotationTooltip) return;
    const tagRect = tag.getBoundingClientRect();
    const tooltipRect = activeAnnotationTooltip.getBoundingClientRect();
    const padding = 12;
    const gap = 9;
    const pointerX = Number.isFinite(pointerEvent?.clientX) ? pointerEvent.clientX : tagRect.left + tagRect.width / 2;
    const left = clamp(pointerX - tooltipRect.width / 2, padding, Math.max(padding, window.innerWidth - tooltipRect.width - padding));
    let top = tagRect.bottom + gap;
    if (top + tooltipRect.height > window.innerHeight - padding) top = tagRect.top - tooltipRect.height - gap;
    top = clamp(top, padding, Math.max(padding, window.innerHeight - tooltipRect.height - padding));
    activeAnnotationTooltip.style.left = `${left}px`;
    activeAnnotationTooltip.style.top = `${top}px`;
}

function showAnnotationTooltip(tag, event) {
    if (!tag || (activeAnnotation === tag && activeAnnotationTooltip)) return;
    removeAnnotationTooltip();
    removeIllustrationTooltip();
    const tooltip = document.createElement("div");
    tooltip.className = "annotation-tooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.textContent = tag.dataset.note || "";
    document.body.appendChild(tooltip);
    activeAnnotation = tag;
    activeAnnotationTooltip = tooltip;
    tag.setAttribute("aria-expanded", "true");
    positionAnnotationTooltip(tag, event);
    requestAnimationFrame(() => tooltip.classList.add("show"));
}

document.addEventListener("pointerover", (event) => {
    if (event.pointerType === "touch") return;
    const tag = event.target.closest(".annotation");
    if (tag) showAnnotationTooltip(tag, event);
});

document.addEventListener("pointerout", (event) => {
    if (event.pointerType === "touch") return;
    const tag = event.target.closest(".annotation");
    if (tag && !tag.contains(event.relatedTarget)) removeAnnotationTooltip();
});

document.addEventListener("focusin", (event) => {
    const tag = event.target.closest(".annotation");
    if (tag?.matches(":focus-visible")) showAnnotationTooltip(tag);
});

document.addEventListener("focusout", (event) => {
    if (event.target.closest(".annotation")) removeAnnotationTooltip();
});

window.addEventListener("resize", removeAnnotationTooltip);
window.addEventListener("scroll", removeAnnotationTooltip, true);
window.addEventListener("resize", removeIllustrationTooltip);
window.addEventListener("scroll", removeIllustrationTooltip, true);

document.addEventListener("click", (event) => {
    const illustration = event.target.closest(".inline-illustration");
    if (illustration) {
        event.preventDefault();
        if (activeIllustration === illustration && activeIllustrationTooltip) removeIllustrationTooltip();
        else showIllustrationTooltip(illustration, event);
        return;
    }
    if (activeIllustrationTooltip) removeIllustrationTooltip();

    const annotation = event.target.closest(".annotation");
    if (annotation) {
        event.preventDefault();
        if (activeAnnotation === annotation && activeAnnotationTooltip) removeAnnotationTooltip();
        else showAnnotationTooltip(annotation, event);
        return;
    }
    if (activeAnnotationTooltip) removeAnnotationTooltip();

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
