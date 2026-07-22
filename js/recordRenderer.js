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
const recordMarkupReferenceCache = new Map();
const recordNodeSources = new WeakMap();

window.addEventListener("classrecordcacheclearing", () => recordMarkupReferenceCache.clear());

function normalizeIllustrationPath(value) {
    const raw = String(value ?? "").trim();
    if (!raw || raw.length > 500 || /[\\?#%\u0000-\u001f\u007f]/.test(raw)) return "";
    if (/^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(raw)) return "";
    const hidden = raw.startsWith("hidden/");
    const fileName = hidden ? raw.slice("hidden/".length) : raw;
    if (!fileName || fileName.includes("/") || fileName === "." || fileName === "..") return "";
    const extension = fileName.split(".").pop()?.toLowerCase();
    if (!ILLUSTRATION_IMAGE_EXTENSIONS.has(extension)) return "";
    return `${hidden ? "hidden/" : ""}data/attachments/${fileName}`;
}

function getPersonDisplayNameById(id) {
    const person = window.PeopleStore?.people?.find((item) => item.id === id);
    return stripRecordMarkup(person?.name || person?.alias || id).trim() || id;
}

function isEscapedMarkupCharacter(source, index) {
    let slashCount = 0;
    for (let cursor = index - 1; cursor >= 0 && source[cursor] === "\\"; cursor -= 1) slashCount += 1;
    return slashCount % 2 === 1;
}

function findBalancedSquareEnd(source, start) {
    let depth = 1;
    for (let index = start + 2; index < source.length - 1; index += 1) {
        if (!isEscapedMarkupCharacter(source, index) && source.startsWith("[[", index)) {
            depth += 1;
            index += 1;
        } else if (!isEscapedMarkupCharacter(source, index) && source.startsWith("]]", index)) {
            depth -= 1;
            if (depth === 0) return index + 2;
            index += 1;
        }
    }
    return -1;
}

function findTopLevelSeparator(source, separator = "|") {
    let squareDepth = 0;
    for (let index = 0; index <= source.length - separator.length; index += 1) {
        if (isEscapedMarkupCharacter(source, index)) continue;
        if (source.startsWith("[[", index)) {
            squareDepth += 1;
            index += 1;
        } else if (source.startsWith("]]", index) && squareDepth > 0) {
            squareDepth -= 1;
            index += 1;
        } else if (squareDepth === 0 && source.startsWith(separator, index)) {
            return index;
        }
    }
    return -1;
}

function splitTopLevelOnce(source, separator = "|") {
    const index = findTopLevelSeparator(source, separator);
    return index < 0 ? null : [source.slice(0, index), source.slice(index + separator.length)];
}

function splitTopLevelAll(source, separator = "|") {
    const parts = [];
    let cursor = 0;
    for (let index = 0; index <= source.length - separator.length; index += 1) {
        const relativeIndex = findTopLevelSeparator(source.slice(cursor), separator);
        if (relativeIndex < 0) break;
        const absoluteIndex = cursor + relativeIndex;
        parts.push(source.slice(cursor, absoluteIndex));
        cursor = absoluteIndex + separator.length;
        index = cursor - 1;
    }
    parts.push(source.slice(cursor));
    return parts;
}

function extractRecordMarkupReferences(value) {
    const cacheKey = String(value ?? "");
    const cached = recordMarkupReferenceCache.get(cacheKey);
    if (cached) return cached;
    const participantIds = new Set();
    const extraAuthorIds = new Set();
    const quoteIds = new Set();
    const illustrationPaths = new Set();
    const personMarkers = [];
    const quoteMarkers = [];
    const binaryTypes = new Set(["person", "author", "quote", "record", "material", "frac", "anno", "illu", "arrow"]);
    const unaryTypes = new Set(["del", "under", "red", "hide", "sup", "sub", "center", "right"]);

    const visit = (input, depth = 0) => {
        if (depth > 32) return;
        const source = String(input ?? "");
        for (let index = 0; index < source.length;) {
            if (isEscapedMarkupCharacter(source, index) || !source.startsWith("[[", index)) {
                index += 1;
                continue;
            }
            const end = findBalancedSquareEnd(source, index);
            if (end < 0) {
                index += 2;
                continue;
            }
            const body = source.slice(index + 2, end - 2);
            const colon = body.indexOf(":");
            const type = colon > 0 ? body.slice(0, colon) : "";

            if (type === "person" || type === "author" || type === "quote") {
                const parts = splitTopLevelOnce(body.slice(colon + 1));
                if (parts && /^[a-zA-Z0-9_-]+$/.test(parts[0]) && parts[1]) {
                    if (type === "person") {
                        participantIds.add(parts[0]);
                        personMarkers.push({ id: parts[0], label: parts[1] });
                    }
                    else if (type === "author") extraAuthorIds.add(parts[0]);
                    else {
                        quoteIds.add(parts[0]);
                        quoteMarkers.push({ id: parts[0], quote: parts[1], label: parts[1] });
                    }
                    visit(parts[1], depth + 1);
                }
            } else if (unaryTypes.has(type)) {
                const content = body.slice(colon + 1);
                if (content) visit(content, depth + 1);
            } else if (type === "table") {
                const parts = splitTopLevelAll(body.slice(colon + 1));
                const size = String(parts.shift() || "").trim();
                if (/^\d{1,2}x\d{1,2}$/i.test(size)) {
                    parts.forEach((cell) => visit(cell, depth + 1));
                }
            } else if (binaryTypes.has(type)) {
                const parts = splitTopLevelOnce(body.slice(colon + 1));
                if (parts && parts[0] && parts[1]) {
                    if (type === "illu") {
                        const path = normalizeIllustrationPath(parts[0]);
                        if (path) illustrationPaths.add(path);
                    }
                    if (type === "frac" || type === "arrow" || type === "anno") visit(parts[0], depth + 1);
                    visit(parts[1], depth + 1);
                }
            }
            index = end;
        }
    };

    visit(value);
    const result = {
        participantIds: [...participantIds],
        extraAuthorIds: [...extraAuthorIds],
        quoteIds: [...quoteIds],
        illustrationPaths: [...illustrationPaths],
        personMarkers,
        quoteMarkers
    };
    if (recordMarkupReferenceCache.size >= 2000) recordMarkupReferenceCache.clear();
    recordMarkupReferenceCache.set(cacheKey, result);
    return result;
}

function extractParticipantPersonIds(value) {
    return extractRecordMarkupReferences(value).participantIds;
}

function extractExtraAuthorIds(value) {
    return extractRecordMarkupReferences(value).extraAuthorIds;
}

function extractMentionedQuoteIds(value) {
    return extractRecordMarkupReferences(value).quoteIds;
}

function extractIllustrationPaths(value) {
    return extractRecordMarkupReferences(value).illustrationPaths;
}

function extractQuoteMarkers(value) {
    return extractRecordMarkupReferences(value).quoteMarkers;
}

function extractRecordMarkupTokens(value, kind) {
    const references = extractRecordMarkupReferences(value);
    return kind === "quote" ? references.quoteMarkers : references.personMarkers;
}

function getRecordParticipantIds(record) {
    return extractParticipantPersonIds(record?.content || "");
}

function getRecordAuthorIds(record) {
    const ids = new Set(extractExtraAuthorIds(record?.content || ""));
    const primaryAuthor = String(record?.author || "").trim();
    if (primaryAuthor) ids.add(primaryAuthor);
    return [...ids];
}

window.extractRecordMarkupReferences = extractRecordMarkupReferences;
window.extractParticipantPersonIds = extractParticipantPersonIds;
window.extractMentionedPersonIds = extractParticipantPersonIds;
window.extractExtraAuthorIds = extractExtraAuthorIds;
window.extractMentionedQuoteIds = extractMentionedQuoteIds;
window.extractQuoteMarkers = extractQuoteMarkers;
window.extractRecordMarkupTokens = extractRecordMarkupTokens;
window.extractIllustrationPaths = extractIllustrationPaths;
window.getRecordParticipantIds = getRecordParticipantIds;
window.getRecordAuthorIds = getRecordAuthorIds;

function parseInlineStack(top, bottom, kind, context) {
    const topHtml = parseInlineMarkup(top, context);
    const bottomHtml = parseInlineMarkup(bottom, context);
    if (context.mode === "text") return `${topHtml} ${bottomHtml}`;
    const width = Math.max(Array.from(parseInlineMarkup(top, { ...context, mode: "text" })).length, Array.from(parseInlineMarkup(bottom, { ...context, mode: "text" })).length, 2);
    const middleClass = kind === "arrow" ? "record-arrow-note-line inline-stack-middle inline-stack-arrow" : "fraction-line inline-stack-middle inline-stack-fraction-line";
    return `<span class="inline-stack ${kind === "arrow" ? "record-arrow-note inline-stack--arrow" : "inline-fraction inline-stack--fraction"}" style="--arrow-note-chars:${width}"><span class="inline-stack-text inline-stack-top ${kind === "arrow" ? "record-arrow-note-text" : "fraction-top"}">${topHtml}</span><span class="${middleClass}" aria-hidden="true"></span><span class="inline-stack-text inline-stack-bottom ${kind === "arrow" ? "record-arrow-note-text" : "fraction-bottom"}">${bottomHtml}</span></span>`;
}

function getTableTextUnits(text) {
    return Array.from(String(text || "")).reduce((sum, character) => {
        if (/\s/.test(character)) return sum + 0.35;
        if (/[\u0000-\u007f]/.test(character)) return sum + 0.58;
        return sum + 1;
    }, 0);
}

function getTableHanCount(text) {
    return (String(text || "").match(/[\u4e00-\u9fff]/g) || []).length;
}

function getTableCellVisibleLength(cell, context) {
    const visibleText = parseInlineMarkup(cell, { ...context, mode: "text" }).trim();
    return {
        han: getTableHanCount(visibleText),
        units: getTableTextUnits(visibleText)
    };
}

function getRecordTableColumnWidths(cells, rows, cols, context) {
    const stats = Array.from({ length: cols }, () => ({
        max: 0,
        shortMax: 0,
        mediumMax: 0,
        longMax: 0,
        longTotal: 0,
        longCount: 0,
        total: 0,
        count: 0
    }));
    const cellMetrics = [];

    for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
        for (let colIndex = 0; colIndex < cols; colIndex += 1) {
            const metric = getTableCellVisibleLength(cells[rowIndex * cols + colIndex] || "", context);
            const length = metric.units;
            const stat = stats[colIndex];
            cellMetrics.push({ colIndex, ...metric });
            stat.max = Math.max(stat.max, length);
            stat.total += length;
            stat.count += 1;
            if (metric.han > 0 && metric.han <= 10) stat.shortMax = Math.max(stat.shortMax, Math.max(length, metric.han));
            if (metric.han > 0 && metric.han < 15) stat.mediumMax = Math.max(stat.mediumMax, Math.max(length, metric.han));
            if (length >= 15) {
                stat.longMax = Math.max(stat.longMax, length);
                stat.longTotal += length;
                stat.longCount += 1;
            }
        }
    }

    const tableWidthBudget = Math.max(34, Math.min(78, 84 - cols * 2.2));
    const maxByColumnCount = Math.max(13, Math.min(44, tableWidthBudget / Math.max(1, Math.sqrt(cols))));
    const columns = stats.map((stat) => {
        const average = stat.count ? stat.total / stat.count : 0;
        const longAverage = stat.longCount ? stat.longTotal / stat.longCount : 0;
        const shortFloor = stat.shortMax ? stat.shortMax + 3.2 : 0;
        const mediumFloor = stat.mediumMax ? Math.ceil(stat.mediumMax / 2) + 2.6 : 0;
        const longFloor = stat.longMax ? Math.min(Math.max(11, Math.sqrt(stat.longMax) * 3.7), maxByColumnCount * 0.72) : 0;
        const floor = Math.min(Math.max(4.4, shortFloor, mediumFloor, longFloor), maxByColumnCount);
        const longTarget = stat.longMax
            ? Math.min(Math.max(longAverage * 0.62, stat.longMax * 0.52, Math.sqrt(stat.longMax) * 5.7), maxByColumnCount)
            : 0;
        const contentTarget = stat.max <= 5
            ? stat.max + 2.2
            : stat.max < 15
                ? stat.max + 2.2
                : longTarget;
        const ideal = Math.min(Math.max(floor, contentTarget, Math.min(average + 3.2, maxByColumnCount * 0.76)), maxByColumnCount);
        return {
            floor: Number(floor.toFixed(2)),
            ideal: Number(ideal.toFixed(2)),
            max: stat.max,
            longMax: stat.longMax,
            weight: Math.max(1, stat.longMax || stat.max || average || 1)
        };
    });

    const idealTotal = columns.reduce((sum, column) => sum + column.ideal, 0);
    const floorTotal = columns.reduce((sum, column) => sum + column.floor, 0);
    const targetTotal = Math.max(floorTotal, Math.min(idealTotal, tableWidthBudget));
    let extraToRemove = Math.max(0, idealTotal - targetTotal);
    let widths = columns.map((column) => column.ideal);

    while (extraToRemove > 0.01) {
        const candidates = columns
            .map((column, index) => ({ column, index, room: widths[index] - column.floor }))
            .filter((item) => item.room > 0.01)
            .sort((a, b) => a.column.weight - b.column.weight);
        if (!candidates.length) break;
        const weightTotal = candidates.reduce((sum, item) => sum + (1 / item.column.weight), 0);
        let removed = 0;
        candidates.forEach((item) => {
            const share = extraToRemove * ((1 / item.column.weight) / weightTotal);
            const take = Math.min(item.room, share);
            widths[item.index] -= take;
            removed += take;
        });
        if (removed <= 0.01) break;
        extraToRemove -= removed;
    }

    let shouldExpand = floorTotal > tableWidthBudget || cellMetrics.some((metric) => metric.units > widths[metric.colIndex] + 0.35);
    if (shouldExpand) {
        let extraSpace = Math.max(0, tableWidthBudget - widths.reduce((sum, width) => sum + width, 0));
        while (extraSpace > 0.01) {
            const candidates = columns
                .map((column, index) => ({
                    column,
                    index,
                    room: Math.max(0, maxByColumnCount - widths[index]),
                    need: Math.max(0, column.max - widths[index])
                }))
                .filter((item) => item.room > 0.01 && (item.need > 0.01 || item.column.longMax > 0))
                .sort((a, b) => b.column.weight - a.column.weight);
            if (!candidates.length) break;
            const weightTotal = candidates.reduce((sum, item) => sum + item.column.weight * (item.need > 0 ? 1.4 : 1), 0);
            let added = 0;
            candidates.forEach((item) => {
                const weighted = item.column.weight * (item.need > 0 ? 1.4 : 1);
                const share = extraSpace * (weighted / weightTotal);
                const room = item.column.longMax > 0 ? item.room : Math.min(item.room, item.need);
                const add = Math.min(room, share);
                widths[item.index] += add;
                added += add;
            });
            if (added <= 0.01) break;
            extraSpace -= added;
        }
    }

    widths = widths.map((width) => Number(width.toFixed(2)));
    const totalWidth = Number(widths.reduce((sum, width) => sum + width, 0).toFixed(2));
    shouldExpand = shouldExpand || cellMetrics.some((metric) => metric.units > widths[metric.colIndex] + 0.35);
    return { widths, totalWidth, shouldExpand };
}

function renderSquareMarkup(body, raw, context) {
    const render = (value) => parseInlineMarkup(value, context);
    const asText = context.mode === "text";
    const unaryTypes = {
        del: { tag: "del", className: "inline-delete" },
        under: { tag: "span", className: "inline-underline" },
        red: { tag: "span", className: "inline-red" },
        hide: { className: "redacted" },
        sup: { tag: "sup" },
        sub: { tag: "sub" },
        center: { tag: "span", className: "record-center-line" },
        right: { tag: "span", className: "record-align-right" }
    };
    for (const [type, config] of Object.entries(unaryTypes)) {
        const prefix = `${type}:`;
        if (!body.startsWith(prefix)) continue;
        const content = body.slice(prefix.length);
        if (!content) return asText ? raw : escapeRecordText(raw);
        const rendered = render(content);
        if (asText) return rendered;
        if (type === "hide") return `<span class="redacted"><span class="redacted-mask"></span><span class="redacted-content">${rendered}</span></span>`;
        const classAttribute = config.className ? ` class="${config.className}"` : "";
        return `<${config.tag}${classAttribute}>${rendered}</${config.tag}>`;
    }

    if (body.startsWith("table:")) {
        const parts = splitTopLevelAll(body.slice("table:".length));
        const sizeText = String(parts.shift() || "").trim();
        const sizeMatch = /^(\d{1,2})x(\d{1,2})$/i.exec(sizeText);
        if (!sizeMatch) return asText ? raw : escapeRecordText(raw);
        const rows = Math.max(1, Math.min(30, Number(sizeMatch[1]) || 0));
        const cols = Math.max(1, Math.min(12, Number(sizeMatch[2]) || 0));
        const cellCount = rows * cols;
        if (parts.length > cellCount) {
            console.warn(`Record table markup has ${parts.length - cellCount} extra cells; extras were ignored.`);
        }
        const cells = parts.slice(0, cellCount);
        while (cells.length < cellCount) cells.push("");
        if (asText) return cells.map((cell) => parseInlineMarkup(cell, context)).join("");
        const tableRows = Array.from({ length: rows }, (_, rowIndex) => {
            const tds = Array.from({ length: cols }, (_, colIndex) => {
                const cell = cells[rowIndex * cols + colIndex] || "";
                return `<td>${render(cell)}</td>`;
            }).join("");
            return `<tr>${tds}</tr>`;
        }).join("");
        const { widths, totalWidth, shouldExpand } = getRecordTableColumnWidths(cells, rows, cols, context);
        const colgroup = `<colgroup>${widths.map((width) => {
            const colWidth = shouldExpand && totalWidth > 0
                ? `${Number(((width / totalWidth) * 100).toFixed(3))}%`
                : `${width}em`;
            return `<col style="width:${colWidth}">`;
        }).join("")}</colgroup>`;
        return `<span class="record-table-scroll" role="group" aria-label="record table"><table class="record-inline-table${shouldExpand ? " is-expanded" : ""}" style="--record-table-width:${totalWidth}em">${colgroup}<tbody>${tableRows}</tbody></table></span>`;
    }

    for (const type of ["person", "author", "quote", "record", "material", "frac", "anno", "illu", "arrow"]) {
        const prefix = `${type}:`;
        if (!body.startsWith(prefix)) continue;
        const parts = splitTopLevelOnce(body.slice(prefix.length));
        if (!parts || !parts[0] || !parts[1]) return asText && type === "illu" ? "" : asText ? raw : escapeRecordText(raw);
        const [first, second] = parts;
        if (context.plainReferenceTypes.has(type)) return render(second);
        if (type === "person" || type === "author") {
            if (!/^[a-zA-Z0-9_-]+$/.test(first)) return asText ? raw : escapeRecordText(raw);
            const label = render(second);
            return asText ? label : `<span class="person-tag" data-id="${first}" title="${escapeRecordAttribute(getPersonDisplayNameById(first))}">${label}</span>`;
        }
        if (type === "quote") {
            if (!/^[a-zA-Z0-9_-]+$/.test(first)) return asText ? raw : escapeRecordText(raw);
            const label = render(second);
            return asText ? label : `<span class="quote-tag" data-id="${first}">${label}</span>`;
        }
        if (type === "record") {
            if (!/^[a-zA-Z0-9_-]+(?:\.json)?$/.test(first)) return asText ? render(second) : render(second);
            const label = render(second);
            return asText || context.disableRecordLinks ? label : `<button type="button" class="record-jump-link" data-record-jump="${first}" style="--record-jump-hue:${stableRecordJumpHue(first)}">${label}</button>`;
        }
        if (type === "material") {
            if (!/^[a-zA-Z0-9_-]+$/.test(first)) return asText ? render(second) : render(second);
            const label = render(second);
            return asText ? label : `<button type="button" class="material-jump-link" data-material-jump="${escapeRecordAttribute(first)}">${label}</button>`;
        }
        if (type === "frac" || type === "arrow") return parseInlineStack(first, second, type === "arrow" ? "arrow" : "fraction", context);
        if (type === "anno") {
            const label = render(second);
            if (asText || context.tooltipContext) return label;
            return `<span class="annotation" data-note-source="${escapeRecordAttribute(first)}" tabindex="0" role="button" aria-haspopup="true" aria-expanded="false">${label}</span>`;
        }
        const safePath = normalizeIllustrationPath(first);
        const label = render(second);
        if (asText || context.tooltipContext || !safePath) return label;
        return `<span class="inline-illustration" data-image-src="${escapeRecordAttribute(safePath)}" data-image-label="${escapeRecordAttribute(parseInlineMarkup(second, { mode: "text" }))}" tabindex="0" role="button" aria-haspopup="dialog" aria-expanded="false">${label}</span>`;
    }

    return asText ? raw : escapeRecordText(raw);
}

function parseInlineMarkup(value, options = {}) {
    const source = String(value ?? "");
    const context = {
        mode: options.mode || "html",
        disableRecordLinks: Boolean(options.disableRecordLinks),
        plainReferenceTypes: options.plainReferenceTypes instanceof Set
            ? options.plainReferenceTypes
            : new Set(options.plainReferenceTypes || []),
        tooltipContext: Boolean(options.tooltipContext),
        depth: (options.depth || 0) + 1
    };
    if (context.depth > 32) return context.mode === "text" ? source : escapeRecordText(source);
    let output = "";
    for (let index = 0; index < source.length;) {
        if (source[index] === "\\" && index + 1 < source.length && "\\|[]".includes(source[index + 1])) {
            const literal = source[index + 1];
            output += context.mode === "text" ? literal : escapeRecordText(literal);
            index += 2;
            continue;
        }
        if (source.startsWith("[[", index)) {
            const end = findBalancedSquareEnd(source, index);
            if (end > 0) {
                const raw = source.slice(index, end);
                output += renderSquareMarkup(raw.slice(2, -2), raw, context);
                index = end;
                continue;
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

function countRecordTextCharacters(text) {
    return (stripRecordMarkup(text).match(/[\u4e00-\u9fffA-Za-z0-9\u2460-\u2473\u3251-\u325f\u32b1-\u32bf]/g) || []).length;
}

window.stripRecordMarkup = stripRecordMarkup;
window.countRecordTextCharacters = countRecordTextCharacters;

function materialExists(materialId) {
    const id = String(materialId || "").trim();
    if (!id) return false;
    const materials = window.MaterialStore?.materials;
    if (!Array.isArray(materials) || !window.MaterialStore?.loaded) return true;
    return materials.some((item) => item?.id === id);
}

function prepareRecordJump(anchorId, originHref = location.href) {
    const targetAnchorId = String(anchorId || "").replace(/^#/, "");
    if (!targetAnchorId) return "";
    try {
        sessionStorage.setItem("classrecord:pending-record-jump", JSON.stringify({
            targetAnchorId,
            originHref,
            createdAt: Date.now()
        }));
    } catch (error) {
        // Storage may be unavailable in privacy modes; the hash jump itself still works.
    }
    return targetAnchorId;
}

function getRecordListHref(anchorId) {
    const targetAnchorId = String(anchorId || "").replace(/^#/, "");
    return `record.html?view=list#${targetAnchorId}`;
}

window.ClassRecordPrepareRecordJump = prepareRecordJump;
window.ClassRecordGetRecordListHref = getRecordListHref;

document.addEventListener("click", (event) => {
    const materialJump = event.target.closest(".material-jump-link[data-material-jump]");
    if (materialJump) {
        const materialId = String(materialJump.dataset.materialJump || "").trim();
        if (!materialId) return;
        if (!materialExists(materialId)) {
            console.warn(`Material not found: ${materialId}`);
        } else if (!window.MaterialStore?.loaded && typeof window.loadAllMaterials === "function") {
            window.loadAllMaterials().then(() => {
                if (!materialExists(materialId)) console.warn(`Material not found: ${materialId}`);
            }).catch((error) => {
                window.ClassRecordDiagnostics?.warn("Material existence check failed", error, { id: materialId });
            });
        }
        const href = `materials.html?id=${encodeURIComponent(materialId)}`;
        if (typeof window.navigateTo === "function") window.navigateTo(href);
        else location.href = href;
        return;
    }

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
    prepareRecordJump(anchor, sourceUrl.href);
    const href = getRecordListHref(anchor);
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
    return normalizeSearchText([
        record.content || record.text || "",
        record.author || record.recorder || "",
        record.date || "",
        record.time || ""
    ].join(" "));
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

function renderPersonReference(value) {
    const id = String(value || "").trim();
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) return escapeRecordText(id);
    return parseContent(`[[person:${id}|${id}]]`);
}

window.renderPersonReference = renderPersonReference;

window.getRecordAnchorId = getRecordAnchorId;

function getRecordKey(record) {
    return String(record?.fileName || record?.id || "").trim();
}

function buildRecordBody(record) {
    const timeText = record.time ? `📌 ${escapeRecordText(record.time)} |` : "";
    const attachments = Array.isArray(record.attachments) ? record.attachments.filter(Boolean) : [];

    return `
        <div class="meta">
            <span>
                #${escapeRecordText(record.id)} |
                📅 ${escapeRecordText(record.date)} |
                ${timeText}
                ✍ ${renderPersonReference(record.author)}
            </span>
            <span class="icon-group">

                ${attachments.length ? `<span class="attach-toggle">📎</span>` : ""}

            </span>
        </div>

        <div class="content">
            ${formatContent(record.content)}
        </div>
        ${attachments.length ? `
            <div class="attachments-wrapper" style="display:none">
                <ul>
                    ${attachments.map((attachment) => `<li><a href="" data-secure-href="${escapeRecordAttribute(attachment.file)}" target="_blank" rel="noopener">${escapeRecordText(attachment.name || attachment.file)}</a></li>`).join("")}
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

let recordFocusGeneration = 0;
let recordScrollAnimation = null;
let lastAutoFocusedHash = "";

function cancelRecordFocus() {
    recordFocusGeneration += 1;
    if (recordScrollAnimation?.cancel) recordScrollAnimation.cancel();
    recordScrollAnimation = null;
}

function easeRecordScroll(t) {
    const progress = Math.max(0, Math.min(1, t));
    // Quartic ease-out: move decisively at the start, then reserve a long,
    // continuously slowing approach so the final frame never feels abrupt.
    return 1 - Math.pow(1 - progress, 4);
}

function animateRecordScrollTo(targetY, { behavior = "smooth" } = {}) {
    if (recordScrollAnimation?.cancel) recordScrollAnimation.cancel();
    const startY = window.scrollY;
    const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const endY = Math.max(0, Math.min(maxY, Number(targetY) || 0));
    if (behavior === "auto" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        window.scrollTo(0, endY);
        return Promise.resolve(true);
    }
    const distance = endY - startY;
    if (Math.abs(distance) < 2) {
        window.scrollTo(0, endY);
        return Promise.resolve(true);
    }
    const duration = Math.max(480, Math.min(1120, 480 + Math.abs(distance) * 0.2));
    const start = performance.now();
    return new Promise((resolve) => {
        let frame = 0;
        let cancelled = false;
        const cleanup = () => {
            window.removeEventListener("wheel", cancel, true);
            window.removeEventListener("touchstart", cancel, true);
            window.removeEventListener("keydown", cancel, true);
            if (recordScrollAnimation?.cancel === cancel) recordScrollAnimation = null;
        };
        const cancel = () => {
            if (cancelled) return;
            cancelled = true;
            cancelAnimationFrame(frame);
            cleanup();
            resolve(false);
        };
        recordScrollAnimation = { cancel };
        window.addEventListener("wheel", cancel, { passive: true, capture: true });
        window.addEventListener("touchstart", cancel, { passive: true, capture: true });
        window.addEventListener("keydown", cancel, true);
        const step = (now) => {
            if (cancelled) return;
            const progress = Math.min(1, (now - start) / duration);
            window.scrollTo(0, startY + distance * easeRecordScroll(progress));
            if (progress < 1) {
                frame = requestAnimationFrame(step);
            } else {
                window.scrollTo(0, endY);
                cleanup();
                resolve(true);
            }
        };
        frame = requestAnimationFrame(step);
    });
}

function focusRecordAnchor(anchorId, { behavior = "smooth" } = {}) {
    const target = document.getElementById(String(anchorId || "").replace(/^#/, ""));
    if (!target) return false;
    const generation = ++recordFocusGeneration;
    requestAnimationFrame(async () => {
        if (generation !== recordFocusGeneration) return;
        const rect = target.getBoundingClientRect();
        const targetY = window.scrollY + rect.top - Math.max(16, (window.innerHeight - Math.min(rect.height, window.innerHeight * 0.72)) / 2);
        const completed = await animateRecordScrollTo(targetY, { behavior });
        if (!completed || generation !== recordFocusGeneration) return;
        afterScrollSettles(target, () => {
            if (generation !== recordFocusGeneration) return;
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
window.ClassRecordCancelFocus = cancelRecordFocus;
window.ClassRecordScrollToRecord = focusRecordAnchor;
window.ClassRecordAnimateScrollTo = animateRecordScrollTo;
window.ClassRecordResetAutoFocus = () => {
    lastAutoFocusedHash = "";
};

function renderRecordList(records, container) {
    records.forEach((record) => {
        if (!record.id) {
            window.ClassRecordDiagnostics?.warn("Record has no initialized ID", null, {
                id: record?.fileName || record?.recordId || "unknown"
            });
        }
    });

    if (!records.length) {
        container.innerHTML = `
            <div class="record-empty">
                <strong>没有找到符合条件的记录。</strong>
                <span>可以放宽日期、关键词或重要性筛选后再试。</span>
            </div>
        `;
        return;
    }
    const existingNodes = new Map([...container.children]
        .filter((node) => node.matches?.(".record[data-record-key]"))
        .map((node) => [node.dataset.recordKey, node]));
    const fragment = document.createDocumentFragment();
    records.forEach((record) => {
        const importance = record.importance || "normal";
        const recordKey = getRecordKey(record);
        let div = existingNodes.get(recordKey);
        if (!div || recordNodeSources.get(div) !== record) {
            div = document.createElement("div");
            div.id = getRecordAnchorId(record);
            div.dataset.recordKey = recordKey;
            div.className = `record importance-${/^[a-zA-Z0-9_-]+$/.test(importance) ? importance : "normal"}`;
            div.innerHTML = buildRecordBody(record);
            bindToggle(div);
            recordNodeSources.set(div, record);
        }
        fragment.appendChild(div);
    });
    container.replaceChildren(fragment);
    if (window.ClassRecordData?.isEnabled()) {
        window.ClassRecordData.resolveAssetElements(container).catch((error) => {
            window.ClassRecordDiagnostics?.warn("Private attachment signing failed", error);
        });
    }

    if (location.hash && location.hash !== lastAutoFocusedHash) {
        if (focusRecordAnchor(location.hash.slice(1))) {
            lastAutoFocusedHash = location.hash;
        }
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
        if (hasYear || hasMonth || hasDay) {
            if (!record.date) return false;
            const [recordYear, recordMonth, recordDay] = record.date.split("-");
            if (hasYear && recordYear !== year) return false;
            if (hasMonth && recordMonth !== month) return false;
            if (hasDay && recordDay !== day) return false;
        }
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
    const dates = parseDateParts(records.filter((record) => !["message", "supplement"].includes(String(record?.recordType || "").trim())));

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

function renderRecordFilter({ container, onFilterChange, onClear, getRecords, filterRecords = filterRecordsByDate, initial = {} }) {
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
        const count = filterRecords(records, currentCriteria).length;
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
    clearButton.addEventListener("click", () => {
        onClear?.();
        applyCriteria({ year: "", month: "", day: "", important: false, excludeDaily: false, query: "" });
    });
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

const TOOLTIP_DELAY = 200;
const TOOLTIP_REMOVE_DELAY = 120;

function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
}

function getInlineMarkerRects(tag) {
    if (!tag) return [];
    const rects = typeof tag.getClientRects === "function"
        ? Array.from(tag.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0)
        : [];
    return rects.length ? rects : [tag.getBoundingClientRect()];
}

const illustrationReadyCache = new Map();
const illustrationDimensionCache = new Map();
const illustrationWarmPromises = new Map();
const illustrationPreviewWarmPromises = new Map();
const ILLUSTRATION_DISPLAY_TRANSFORM = Object.freeze({ width: 960, quality: 76 });

function getIllustrationDisplayTransform() {
    return window.ClassRecordData?.displayTransforms?.illustration || ILLUSTRATION_DISPLAY_TRANSFORM;
}

window.imageSizeCache = window.imageSizeCache || {};
window.illuSizeCache = window.illuSizeCache instanceof Map ? window.illuSizeCache : new Map();

function getIllustrationSourceDimensions(path) {
    const sourcePath = String(path || "").trim();
    return illustrationDimensionCache.get(sourcePath)
        || window.illuSizeCache.get(sourcePath)
        || window.imageSizeCache?.[sourcePath]
        || null;
}

function rememberIllustrationDimensions(path, width, height) {
    if (!path || width <= 0 || height <= 0) return;
    const dimensions = { width, height, ratio: width / height };
    illustrationDimensionCache.set(path, dimensions);
    window.illuSizeCache.set(path, dimensions);
    window.imageSizeCache[path] = dimensions;
}

window.getIllustrationSourceDimensions = getIllustrationSourceDimensions;

window.addEventListener("classrecordcacheclearing", () => {
    illustrationReadyCache.clear();
    illustrationDimensionCache.clear();
    illustrationWarmPromises.clear();
    illustrationPreviewWarmPromises.clear();
    window.illuSizeCache.clear();
    window.imageSizeCache = {};
    window.ClassRecordIllustrationMetadataPromise = null;
});

function warmIllustrationPreview(path, { priority = "low" } = {}) {
    const sourcePath = String(path || "").trim();
    if (!sourcePath) return Promise.resolve(null);
    if (illustrationReadyCache.has(sourcePath)) return Promise.resolve(illustrationReadyCache.get(sourcePath));
    if (illustrationPreviewWarmPromises.has(sourcePath)) return illustrationPreviewWarmPromises.get(sourcePath);
    const promise = (async () => {
        const data = window.ClassRecordData;
        if (!data?.isEnabled?.()) return { url: sourcePath };
        const transform = getIllustrationDisplayTransform();
        const url = await data.preloadAsset(sourcePath, { priority, transform });
        const ready = data.getPreloadedAsset(sourcePath, { transform });
        if (!url || !ready?.url) return null;
        illustrationReadyCache.set(sourcePath, ready);
        return ready;
    })().catch(() => null).finally(() => {
        illustrationPreviewWarmPromises.delete(sourcePath);
    });
    illustrationPreviewWarmPromises.set(sourcePath, promise);
    return promise;
}

function warmIllustrationAsset(path, { priority = "low" } = {}) {
    const sourcePath = String(path || "").trim();
    if (!sourcePath) return Promise.resolve(null);
    if (getIllustrationSourceDimensions(sourcePath)) return Promise.resolve(getIllustrationSourceDimensions(sourcePath));
    if (illustrationWarmPromises.has(sourcePath)) return illustrationWarmPromises.get(sourcePath);
    const promise = (async () => {
        const data = window.ClassRecordData;
        if (!data?.isEnabled?.()) {
            // Development/static deployments follow the same contract: read
            // dimensions during initialization, never during a hover.
            const local = await new Promise((resolve) => {
                const image = new Image();
                image.decoding = "async";
                image.fetchPriority = priority;
                image.onload = () => resolve(image.naturalWidth > 0 && image.naturalHeight > 0 ? image : null);
                image.onerror = () => resolve(null);
                image.src = sourcePath;
            });
            if (!local) return null;
            rememberIllustrationDimensions(sourcePath, local.naturalWidth, local.naturalHeight);
            illustrationReadyCache.set(sourcePath, { url: sourcePath, width: local.naturalWidth, height: local.naturalHeight });
            return getIllustrationSourceDimensions(sourcePath);
        }
        // Metadata deliberately comes from the original asset. A transformed
        // thumbnail may have a different pixel size even though it has the
        // same aspect ratio, so it cannot satisfy the source-dimension cache.
        const metadata = (async () => {
            const url = await data.preloadAsset(sourcePath, { priority, transform: null });
            const original = data.getPreloadedAsset(sourcePath, { transform: null });
            if (!url || !original?.width || !original?.height) return null;
            rememberIllustrationDimensions(sourcePath, original.width, original.height);
            return getIllustrationSourceDimensions(sourcePath);
        })();
        // The display variant is warmed in parallel. Its URL is optional for
        // sizing: the frame already uses the original metadata above.
        const [dimensions] = await Promise.all([metadata, warmIllustrationPreview(sourcePath, { priority })]);
        return dimensions;
    })().catch(() => null).finally(() => {
        illustrationWarmPromises.delete(sourcePath);
    });
    illustrationWarmPromises.set(sourcePath, promise);
    return promise;
}

function warmIllustrationPaths(paths, { priority = "low" } = {}) {
    const queue = [...new Set(paths || [])].filter(Boolean);
    let nextIndex = 0;
    let loaded = 0;
    const worker = async () => {
        while (nextIndex < queue.length) {
            const path = queue[nextIndex++];
            if (await warmIllustrationAsset(path, { priority })) loaded += 1;
        }
    };
    return Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker))
        .then(() => ({ total: queue.length, loaded }));
}

function collectIllustrationPathsFromData(value, paths, seen = new WeakSet()) {
    if (typeof value === "string") {
        extractIllustrationPaths(value).forEach((path) => paths.add(path));
        return;
    }
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
        value.forEach((item) => collectIllustrationPathsFromData(item, paths, seen));
        return;
    }
    Object.values(value).forEach((item) => collectIllustrationPathsFromData(item, paths, seen));
}

function preloadIllustrationDimensionsFromData() {
    if (window.ClassRecordIllustrationMetadataPromise) {
        return window.ClassRecordIllustrationMetadataPromise;
    }
    const promise = (async () => {
        await window.waitForAccess?.();
        const data = window.ClassRecordData;
        if (!data?.isEnabled?.()) return { total: 0, loaded: 0 };
        // This single bootstrap scans every protected JSON source once. Both
        // normal and hidden records are included because either can later be
        // opened without creating a second image-size cache.
        const sources = await Promise.allSettled([
            data.loadRecords?.({ hidden: false }),
            data.loadRecords?.({ hidden: true }),
            data.loadPageMessages?.(),
            data.loadPageSupplements?.({ hidden: false }),
            data.loadPageSupplements?.({ hidden: true }),
            data.loadMaterials?.()
        ]);
        const paths = new Set();
        sources.forEach((result) => {
            if (result.status === "fulfilled") collectIllustrationPathsFromData(result.value, paths);
        });
        return warmIllustrationPaths(paths, { priority: "low" });
    })();
    window.ClassRecordIllustrationMetadataPromise = promise;
    return promise;
}

function startIllustrationDimensionPreload() {
    const promise = preloadIllustrationDimensionsFromData().catch((error) => {
        window.ClassRecordDiagnostics?.warn("Illustration metadata preload failed", error);
    });
    // Pages that already expose a startup promise must not render marker text
    // before every source has been scanned and its original dimensions read.
    if (window.cacheReadyPromise) {
        const pageReady = window.cacheReadyPromise;
        window.cacheReadyPromise = Promise.all([pageReady, promise]).then(([result]) => result);
    }
    return promise;
}

window.preloadIllustrationDimensionsFromData = preloadIllustrationDimensionsFromData;
window.preloadIllustrationsFromContent = (value) => warmIllustrationPaths(extractIllustrationPaths(value), { priority: "low" });

function illustrationLabel(tag) {
    return String(tag?.dataset.imageLabel || tag?.textContent || "插图").trim() || "插图";
}

startIllustrationDimensionPreload();

const imageViewerState = {
    overlay: null,
    previousOverflow: "",
    closeHandler: null,
    resizeHandler: null,
    interaction: null
};

const IMAGE_VIEWER_MIN_SCALE = 0.25;
const IMAGE_VIEWER_MAX_SCALE = 12;

function calculateImageViewerBounds(viewportWidth, viewportHeight) {
    const width = Math.max(1, Number(viewportWidth) || 1);
    const height = Math.max(1, Number(viewportHeight) || 1);
    const padding = Math.min(28, Math.max(14, width * 0.03));
    return {
        width: Math.max(1, Math.min(1280, width - padding * 2)),
        height: Math.max(1, Math.min(980, height - padding * 2))
    };
}

function updateImageViewerBounds(overlay) {
    if (!overlay?.isConnected) return;
    const viewport = window.visualViewport;
    const bounds = calculateImageViewerBounds(
        viewport?.width || window.innerWidth || document.documentElement.clientWidth,
        viewport?.height || window.innerHeight || document.documentElement.clientHeight
    );
    overlay.style.setProperty("--image-viewer-max-width", `${bounds.width}px`);
    overlay.style.setProperty("--image-viewer-max-height", `${bounds.height}px`);
    imageViewerState.interaction?.refresh();
}

async function resolveOriginalImageUrl(sourcePath, { forceRefresh = false } = {}) {
    const direct = String(sourcePath || "").trim();
    if (!direct) return "";
    if (/^(?:https?:|data:|blob:)/i.test(direct)) return direct;
    if (window.ClassRecordData?.isEnabled?.()) {
        return window.ClassRecordData.signAssetUrl(direct, { quiet: true, forceRefresh }).catch(() => "");
    }
    if (/^(?:\.\/|\/)?images\//i.test(direct)) return new URL(direct.replace(/^\//, ""), document.baseURI).href;
    return direct;
}

async function resolveImageViewerUrl(sourcePath, { resolvedUrl = "", urlPromise = null } = {}) {
    const originalUrl = await resolveOriginalImageUrl(sourcePath).catch(() => "");
    if (originalUrl) return originalUrl;
    const refreshedOriginalUrl = await resolveOriginalImageUrl(sourcePath, { forceRefresh: true }).catch(() => "");
    if (refreshedOriginalUrl) return refreshedOriginalUrl;
    const readyUrl = String(resolvedUrl || "").trim();
    if (readyUrl) return readyUrl;
    if (urlPromise) {
        try {
            const pendingUrl = await (typeof urlPromise === "function" ? urlPromise() : urlPromise);
            if (pendingUrl) return String(pendingUrl).trim();
        } catch (error) {
            // Fall through to a fresh resolution attempt before reporting an error.
        }
    }
    return "";
}

function normalizeImageViewerUrl(url) {
    const candidate = String(url || "").trim();
    if (!candidate) return "";
    try {
        return new URL(candidate, document.baseURI).href;
    } catch (error) {
        return candidate;
    }
}

async function resolveImageViewerFallbackUrl(sourcePath, { resolvedUrl = "", urlPromise = null } = {}, attemptedUrls = new Set(), { forceRefresh = false } = {}) {
    const candidates = [];
    const freshOriginal = await resolveOriginalImageUrl(sourcePath, { forceRefresh }).catch(() => "");
    if (freshOriginal) candidates.push(freshOriginal);
    if (resolvedUrl) candidates.push(resolvedUrl);
    if (urlPromise) {
        try {
            const pendingUrl = await (typeof urlPromise === "function" ? urlPromise() : urlPromise);
            if (pendingUrl) candidates.push(pendingUrl);
        } catch (error) {
            // A rejected preload is a real failed candidate; try any remaining source.
        }
    }
    return candidates
        .map(normalizeImageViewerUrl)
        .find((candidate) => candidate && !attemptedUrls.has(candidate)) || "";
}

function setImageViewerStatus(overlay, frame, state) {
    if (!overlay || !frame) return;
    overlay.dataset.imageState = state;
    frame.classList.toggle("is-ready", state === "success");
    if (state === "success") return;
    const status = document.createElement("div");
    status.className = "image-viewer-status";
    status.textContent = state === "error" ? "Image failed to load." : "Loading image...";
    frame.replaceChildren(status);
}

function calculateImageViewerZoom({ scale, panX, panY, pointX, pointY, deltaY }) {
    const oldScale = scale;
    const nextScale = clamp(oldScale * Math.exp(-deltaY * 0.0015), IMAGE_VIEWER_MIN_SCALE, IMAGE_VIEWER_MAX_SCALE);
    if (nextScale <= 1) return { scale: nextScale, panX: 0, panY: 0 };
    const ratio = nextScale / oldScale;
    return {
        scale: nextScale,
        panX: pointX - (pointX - panX) * ratio,
        panY: pointY - (pointY - panY) * ratio
    };
}

function calculateImageViewerFit(naturalWidth, naturalHeight, availableWidth, availableHeight) {
    const width = Math.max(1, Number(naturalWidth) || 1);
    const height = Math.max(1, Number(naturalHeight) || 1);
    const scale = Math.min(1, Math.max(1, Number(availableWidth) || 1) / width, Math.max(1, Number(availableHeight) || 1) / height);
    return { width: width * scale, height: height * scale };
}

function calculateImageViewerRenderSize(baseWidth, baseHeight, scale) {
    const safeScale = Math.max(IMAGE_VIEWER_MIN_SCALE, Number(scale) || 1);
    return {
        width: Math.max(1, Number(baseWidth) || 1) * safeScale,
        height: Math.max(1, Number(baseHeight) || 1) * safeScale
    };
}

function calculateImageViewerPanBounds(renderedWidth, renderedHeight, availableWidth, availableHeight) {
    return {
        x: Math.max(0, (Math.max(1, Number(renderedWidth) || 1) - Math.max(1, Number(availableWidth) || 1)) / 2),
        y: Math.max(0, (Math.max(1, Number(renderedHeight) || 1) - Math.max(1, Number(availableHeight) || 1)) / 2)
    };
}

function createImageViewerInteraction(frame, image) {
    let scale = 1;
    let panX = 0;
    let panY = 0;
    let drag = null;
    let renderFrame = 0;
    let baseWidth = 1;
    let baseHeight = 1;
    let availableWidth = 1;
    let availableHeight = 1;

    const getPanBounds = () => calculateImageViewerPanBounds(image.offsetWidth, image.offsetHeight, availableWidth, availableHeight);
    const render = () => {
        renderFrame = 0;
        const rendered = calculateImageViewerRenderSize(baseWidth, baseHeight, scale);
        image.style.width = `${rendered.width}px`;
        image.style.height = `${rendered.height}px`;
        const bounds = getPanBounds();
        panX = clamp(panX, -bounds.x, bounds.x);
        panY = clamp(panY, -bounds.y, bounds.y);
        image.style.transform = `translate3d(calc(-50% + ${panX}px), calc(-50% + ${panY}px), 0)`;
        const canDrag = bounds.x > 0.5 || bounds.y > 0.5;
        frame.classList.toggle("can-drag", canDrag);
        frame.dataset.scale = scale.toFixed(3);
    };
    const scheduleRender = () => {
        if (!renderFrame) renderFrame = requestAnimationFrame(render);
    };
    const fitImage = () => {
        const style = getComputedStyle(frame);
        availableWidth = frame.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        availableHeight = frame.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
        const fitted = calculateImageViewerFit(image.naturalWidth, image.naturalHeight, availableWidth, availableHeight);
        baseWidth = fitted.width;
        baseHeight = fitted.height;
        scheduleRender();
    };
    const onWheel = (event) => {
        event.preventDefault();
        const rect = frame.getBoundingClientRect();
        const next = calculateImageViewerZoom({
            scale,
            panX,
            panY,
            pointX: event.clientX - (rect.left + rect.width / 2),
            pointY: event.clientY - (rect.top + rect.height / 2),
            deltaY: event.deltaY
        });
        if (next.scale === scale) return;
        ({ scale, panX, panY } = next);
        scheduleRender();
    };
    const finishDrag = (event) => {
        if (!drag || (event?.pointerId != null && event.pointerId !== drag.pointerId)) return;
        if (frame.hasPointerCapture?.(drag.pointerId)) frame.releasePointerCapture(drag.pointerId);
        drag = null;
        frame.classList.remove("is-dragging");
    };
    const onPointerDown = (event) => {
        if (event.button !== 0 || !frame.classList.contains("can-drag")) return;
        event.preventDefault();
        drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, panX, panY };
        frame.setPointerCapture?.(event.pointerId);
        frame.classList.add("is-dragging");
    };
    const onPointerMove = (event) => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        event.preventDefault();
        panX = drag.panX + event.clientX - drag.x;
        panY = drag.panY + event.clientY - drag.y;
        scheduleRender();
    };
    const preventNativeDrag = (event) => event.preventDefault();

    frame.addEventListener("wheel", onWheel, { passive: false });
    frame.addEventListener("pointerdown", onPointerDown);
    frame.addEventListener("pointermove", onPointerMove);
    frame.addEventListener("pointerup", finishDrag);
    frame.addEventListener("pointercancel", finishDrag);
    image.addEventListener("dragstart", preventNativeDrag);
    fitImage();

    return {
        refresh: fitImage,
        destroy() {
            if (renderFrame) cancelAnimationFrame(renderFrame);
            finishDrag();
            frame.removeEventListener("wheel", onWheel);
            frame.removeEventListener("pointerdown", onPointerDown);
            frame.removeEventListener("pointermove", onPointerMove);
            frame.removeEventListener("pointerup", finishDrag);
            frame.removeEventListener("pointercancel", finishDrag);
            image.removeEventListener("dragstart", preventNativeDrag);
        }
    };
}

function closeImageViewer() {
    const overlay = imageViewerState.overlay;
    if (!overlay) return;
    document.documentElement.style.overflow = imageViewerState.previousOverflow;
    document.removeEventListener("keydown", imageViewerState.closeHandler, true);
    window.removeEventListener("resize", imageViewerState.resizeHandler);
    window.visualViewport?.removeEventListener("resize", imageViewerState.resizeHandler);
    imageViewerState.interaction?.destroy();
    imageViewerState.overlay = null;
    imageViewerState.closeHandler = null;
    imageViewerState.resizeHandler = null;
    imageViewerState.interaction = null;
    overlay.classList.remove("is-visible");
    overlay.classList.add("is-leaving");
    window.setTimeout(() => overlay.remove(), 160);
}

async function openImageViewer(sourcePath, { alt = "image preview", resolvedUrl = "", urlPromise = null } = {}) {
    closeImageViewer();
    const overlay = document.createElement("div");
    overlay.className = "image-viewer";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML = `
        <button type="button" class="image-viewer-close" aria-label="Close image preview">×</button>
        <div class="image-viewer-frame">
            <div class="image-viewer-status">Loading image...</div>
        </div>
    `;
    imageViewerState.previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    imageViewerState.overlay = overlay;
    imageViewerState.closeHandler = (event) => {
        if (event.key === "Escape") closeImageViewer();
    };
    imageViewerState.resizeHandler = () => updateImageViewerBounds(overlay);
    document.addEventListener("keydown", imageViewerState.closeHandler, true);
    window.addEventListener("resize", imageViewerState.resizeHandler, { passive: true });
    window.visualViewport?.addEventListener("resize", imageViewerState.resizeHandler, { passive: true });
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay || event.target.closest(".image-viewer-close")) closeImageViewer();
    });
    document.body.appendChild(overlay);
    updateImageViewerBounds(overlay);
    setImageViewerStatus(overlay, overlay.querySelector(".image-viewer-frame"), "loading");
    requestAnimationFrame(() => overlay.classList.add("is-visible"));
    const frame = overlay.querySelector(".image-viewer-frame");
    const url = await resolveImageViewerUrl(sourcePath, { resolvedUrl, urlPromise }).catch(() => "");
    if (!overlay.isConnected || imageViewerState.overlay !== overlay) return;
    if (!url) {
        setImageViewerStatus(overlay, frame, "error");
        return;
    }
    const image = document.createElement("img");
    image.alt = alt;
    image.decoding = "async";
    image.draggable = false;
    const attemptedUrls = new Set();
    let resolvingFallback = false;
    let refreshedOriginal = false;
    const loadCandidate = (candidate) => {
        const normalized = normalizeImageViewerUrl(candidate);
        if (!normalized || attemptedUrls.has(normalized)) return false;
        attemptedUrls.add(normalized);
        image.src = normalized;
        return true;
    };
    const showFailure = () => {
        if (imageViewerState.overlay === overlay) setImageViewerStatus(overlay, frame, "error");
    };
    image.onload = () => {
        if (imageViewerState.overlay !== overlay) return;
        frame.replaceChildren(image);
        setImageViewerStatus(overlay, frame, "success");
        imageViewerState.interaction = createImageViewerInteraction(frame, image);
    };
    image.onerror = async () => {
        if (resolvingFallback || imageViewerState.overlay !== overlay) return;
        resolvingFallback = true;
        const fallbackUrl = await resolveImageViewerFallbackUrl(
            sourcePath,
            { resolvedUrl, urlPromise },
            attemptedUrls,
            { forceRefresh: !refreshedOriginal }
        ).catch(() => "");
        refreshedOriginal = true;
        resolvingFallback = false;
        if (imageViewerState.overlay !== overlay) return;
        if (!loadCandidate(fallbackUrl)) showFailure();
    };
    if (!loadCandidate(url)) showFailure();
}

window.ClassRecordImageViewer = {
    open: openImageViewer,
    close: closeImageViewer
};

function setIllustrationFailure(tooltip) {
    tooltip.classList.add("has-error");
    tooltip.replaceChildren();
    const message = document.createElement("span");
    message.className = "illustration-tooltip-status";
    message.textContent = "图片加载失败";
    tooltip.appendChild(message);
}

function setIllustrationFrameSize(tooltip, image, naturalWidth, naturalHeight) {
    const maxWidth = Math.min(360, window.innerWidth * 0.8);
    const maxHeight = Math.min(280, window.innerHeight * 0.6);
    const scale = Math.min(1, maxWidth / naturalWidth, maxHeight / naturalHeight);
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));
    const style = getComputedStyle(tooltip);
    const horizontalChrome = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
        + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
    const verticalChrome = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
        + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    tooltip.style.width = `${width + horizontalChrome}px`;
    tooltip.style.height = `${height + verticalChrome}px`;
    image.style.width = `${width}px`;
    image.style.height = `${height}px`;
}

function calculateInlineTooltipPosition({ tagRects, tagRect, tooltipRect, viewportWidth, viewportHeight, pointer, padding = 12, gap = 8 }) {
    const rects = Array.isArray(tagRects) && tagRects.length ? tagRects : [tagRect];
    const markerTop = Math.min(...rects.map((rect) => rect.top));
    const markerBottom = Math.max(...rects.map((rect) => rect.bottom));
    const markerLeft = Math.min(...rects.map((rect) => rect.left));
    const markerRight = Math.max(...rects.map((rect) => rect.right));
    const pointerX = Number.isFinite(pointer?.x) ? pointer.x : (markerLeft + markerRight) / 2;
    const left = clamp(pointerX - tooltipRect.width / 2, padding, Math.max(padding, viewportWidth - tooltipRect.width - padding));
    const pointerY = Number.isFinite(pointer?.y) ? pointer.y : (markerTop + markerBottom) / 2;
    const distanceToRect = (rect) => {
        const dx = pointerX < rect.left ? rect.left - pointerX : pointerX > rect.right ? pointerX - rect.right : 0;
        const dy = pointerY < rect.top ? rect.top - pointerY : pointerY > rect.bottom ? pointerY - rect.bottom : 0;
        return dx * dx + dy * dy;
    };
    const activeRect = rects.reduce((nearest, rect) => distanceToRect(rect) < distanceToRect(nearest) ? rect : nearest, rects[0]);
    const overlapsMarker = (top) => rects.some((rect) => (
        left < rect.right && left + tooltipRect.width > rect.left &&
        top < rect.bottom + gap && top + tooltipRect.height > rect.top - gap
    ));
    const fitsViewport = (top) => top >= padding && top + tooltipRect.height <= viewportHeight - padding;
    const candidates = [
        activeRect.top - gap - tooltipRect.height,
        activeRect.bottom + gap,
        markerTop - gap - tooltipRect.height,
        markerBottom + gap
    ];
    let top = candidates.find((candidate) => fitsViewport(candidate) && !overlapsMarker(candidate));
    if (!Number.isFinite(top)) {
        const globalAbove = markerTop - gap - tooltipRect.height;
        const globalBelow = markerBottom + gap;
        const spaceAbove = markerTop - gap - padding;
        const spaceBelow = viewportHeight - padding - markerBottom - gap;
        top = spaceAbove >= spaceBelow ? globalAbove : globalBelow;
    }
    top = clamp(top, padding, Math.max(padding, viewportHeight - tooltipRect.height - padding));
    return { left, top };
}

window.calculateInlineTooltipPosition = calculateInlineTooltipPosition;

function createInlineTooltipController({ triggerSelector, tooltipClass, role = "tooltip", populate, beforeShow, pointerAnchor = false, showDelay = TOOLTIP_DELAY, showBeforePopulate = false }) {
    let activeTag = null;
    let activeTooltip = null;
    let showTimer = null;
    let removeTimer = null;
    let requestToken = 0;
    let hoveringTrigger = false;
    let hoveringTooltip = false;
    let lastPointerTriggerAt = 0;
    let lastPointerPosition = null;
    let pointerTagOffset = null;
    let dismissedByScroll = false;

    const cancelRemoval = () => {
        clearTimeout(removeTimer);
        removeTimer = null;
    };
    const position = (tag = activeTag) => {
        if (!tag || !activeTooltip) return;
        const tagBounds = tag.getBoundingClientRect();
        const anchoredPointer = pointerAnchor && pointerTagOffset
            ? { x: tagBounds.left + pointerTagOffset.x, y: tagBounds.top + pointerTagOffset.y }
            : lastPointerPosition;
        const tooltipRect = activeTooltip.getBoundingClientRect();
        const { left, top } = calculateInlineTooltipPosition({
            tagRects: getInlineMarkerRects(tag),
            tooltipRect,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            pointer: pointerAnchor ? anchoredPointer : null
        });
        activeTooltip.style.left = `${left}px`;
        activeTooltip.style.top = `${top}px`;
    };
    const hide = (immediate = false) => {
        clearTimeout(showTimer);
        showTimer = null;
        cancelRemoval();
        requestToken += 1;
        activeTag?.setAttribute("aria-expanded", "false");
        const tooltip = activeTooltip;
        activeTag = null;
        activeTooltip = null;
        hoveringTrigger = false;
        hoveringTooltip = false;
        lastPointerPosition = null;
        pointerTagOffset = null;
        if (!tooltip) return;
        tooltip.classList.remove("show", "is-visible");
        tooltip.classList.add("is-hiding");
        if (immediate) tooltip.remove();
        else setTimeout(() => tooltip.remove(), 150);
    };
    const scheduleRemoval = () => {
        cancelRemoval();
        removeTimer = setTimeout(() => {
            if (!hoveringTrigger && !hoveringTooltip) hide();
        }, TOOLTIP_REMOVE_DELAY);
    };
    const show = async (tag, event) => {
        clearTimeout(showTimer);
        showTimer = null;
        cancelRemoval();
        if (!tag) return;
        const pointerPosition = Number.isFinite(event?.clientX) && Number.isFinite(event?.clientY)
            ? { x: event.clientX, y: event.clientY }
            : lastPointerPosition;
        const tagBounds = tag.getBoundingClientRect();
        const pointerOffset = pointerPosition
            ? { x: pointerPosition.x - tagBounds.left, y: pointerPosition.y - tagBounds.top }
            : pointerTagOffset;
        if (activeTag === tag && activeTooltip) return;
        hide(true);
        lastPointerPosition = pointerPosition;
        pointerTagOffset = pointerOffset;
        beforeShow?.();
        const token = requestToken;
        const tooltip = document.createElement("div");
        tooltip.className = `${tooltipClass} inline-tooltip hidden`;
        tooltip.setAttribute("role", role);
        document.body.appendChild(tooltip);
        activeTag = tag;
        activeTooltip = tooltip;
        tag.setAttribute("aria-expanded", "true");
        tooltip.addEventListener("mouseenter", () => {
            hoveringTooltip = true;
            cancelRemoval();
        });
        tooltip.addEventListener("mouseleave", () => {
            hoveringTooltip = false;
            scheduleRemoval();
        });
        let revealed = false;
        const reveal = () => {
            if (revealed || token !== requestToken || activeTooltip !== tooltip) return;
            revealed = true;
            position(tag);
            requestAnimationFrame(() => {
                if (token !== requestToken || activeTooltip !== tooltip) return;
                tooltip.classList.remove("hidden", "is-hiding");
                tooltip.classList.add("show", "is-visible");
            });
        };
        const population = populate({
            tag,
            tooltip,
            position: () => position(tag),
            reveal,
            isCurrent: () => token === requestToken && activeTag === tag && activeTooltip === tooltip && tooltip.isConnected
        });
        if (showBeforePopulate) {
            reveal();
        }
        await population;
        if (token !== requestToken || activeTooltip !== tooltip) return;
        if (!revealed) reveal();
    };
    const queueShow = (tag, event) => {
        clearTimeout(showTimer);
        cancelRemoval();
        if (activeTag && activeTag !== tag) hide();
        if (Number.isFinite(event?.clientX) && Number.isFinite(event?.clientY)) {
            lastPointerPosition = { x: event.clientX, y: event.clientY };
            const bounds = tag.getBoundingClientRect();
            pointerTagOffset = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
        }
        if (showDelay <= 0) show(tag);
        else showTimer = setTimeout(() => show(tag), showDelay);
    };

    document.addEventListener("pointerover", (event) => {
        if (event.pointerType === "touch") return;
        const tag = event.target.closest(triggerSelector);
        if (!tag || dismissedByScroll || (event.relatedTarget?.nodeType && tag.contains(event.relatedTarget))) return;
        hoveringTrigger = true;
        queueShow(tag, event);
    });
    document.addEventListener("pointermove", (event) => {
        const tag = event.target.closest(triggerSelector);
        if (event.pointerType === "touch") return;
        if (dismissedByScroll && tag) {
            dismissedByScroll = false;
            hoveringTrigger = true;
            queueShow(tag, event);
            return;
        }
        if (!tag) {
            if (activeTag) {
                hoveringTrigger = false;
                scheduleRemoval();
            }
            return;
        }
        lastPointerPosition = { x: event.clientX, y: event.clientY };
        const bounds = tag.getBoundingClientRect();
        pointerTagOffset = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    });
    document.addEventListener("pointerdown", (event) => {
        if (event.target.closest(triggerSelector)) lastPointerTriggerAt = Date.now();
    });
    document.addEventListener("pointerout", (event) => {
        if (event.pointerType === "touch") return;
        const tag = event.target.closest(triggerSelector);
        if (!tag || (event.relatedTarget?.nodeType && tag.contains(event.relatedTarget))) return;
        hoveringTrigger = false;
        clearTimeout(showTimer);
        scheduleRemoval();
    });
    document.addEventListener("focusin", (event) => {
        const tag = event.target.closest(triggerSelector);
        if (tag?.matches(":focus-visible") && Date.now() - lastPointerTriggerAt > 500) show(tag);
    });
    document.addEventListener("focusout", (event) => {
        if (event.target.closest(triggerSelector)) scheduleRemoval();
    });
    window.addEventListener("resize", () => hide(true));
    const dismissForScroll = () => {
        if (!activeTag && !activeTooltip && !showTimer) return;
        dismissedByScroll = true;
        hide();
    };
    window.addEventListener("wheel", dismissForScroll, { passive: true, capture: true });
    window.addEventListener("scroll", dismissForScroll, true);

    return {
        hide,
        show,
        toggle(tag, event) {
            if (activeTag === tag && activeTooltip) hide();
            else show(tag, event);
        }
    };
}

let illustrationTooltipController;
const annotationTooltipController = createInlineTooltipController({
    triggerSelector: ".annotation",
    tooltipClass: "annotation-tooltip",
    pointerAnchor: true,
    beforeShow: () => illustrationTooltipController?.hide(true),
    populate: async ({ tag, tooltip }) => {
        tooltip.innerHTML = parseInlineMarkup(tag.dataset.noteSource || "", { tooltipContext: true });
    }
});

illustrationTooltipController = createInlineTooltipController({
    triggerSelector: ".inline-illustration",
    tooltipClass: "illustration-tooltip",
    role: "dialog",
    pointerAnchor: true,
    beforeShow: () => annotationTooltipController.hide(true),
    populate: async ({ tag, tooltip, reveal, isCurrent }) => {
        const label = illustrationLabel(tag);
        tooltip.setAttribute("aria-label", `${label}预览`);
        const sourcePath = String(tag.dataset.imageSrc || "").trim();
        const sourceDimensions = getIllustrationSourceDimensions(sourcePath);
        const image = document.createElement("img");
        image.alt = label;
        image.decoding = "async";
        image.fetchPriority = "high";
        image.dataset.previewSrc = sourcePath;
        // Marker rendering is gated by the site-wide metadata pass. Therefore
        // a hover always knows the source frame before it asks for an image URL.
        // The fallback is only for a failed/externally injected marker, and it
        // intentionally stays a stable failure placeholder instead of resizing.
        if (!sourceDimensions) {
            setIllustrationFailure(tooltip);
            reveal();
            return;
        }
        setIllustrationFrameSize(tooltip, image, sourceDimensions.width, sourceDimensions.height);
        image.classList.add("is-pending");
        const loading = document.createElement("span");
        loading.className = "record-written-image-loading illustration-tooltip-loading";
        loading.innerHTML = '<i aria-hidden="true"></i><b>正在加载插图</b>';
        tooltip.replaceChildren(image, loading);
        reveal();
        const readyImage = illustrationReadyCache.get(sourcePath)
            || window.ClassRecordData?.getPreloadedAsset?.(sourcePath, {
                transform: getIllustrationDisplayTransform()
            })
            || await warmIllustrationPreview(sourcePath, { priority: "high" });
        if (!isCurrent()) return;
        if (!readyImage?.url) {
            setIllustrationFailure(tooltip);
            return;
        }
        const loaded = await new Promise((resolve) => {
            image.onload = () => {
                resolve(true);
            };
            image.onerror = () => {
                resolve(false);
            };
            image.src = readyImage.url;
        });
        if (!isCurrent()) return;
        if (!loaded) {
            setIllustrationFailure(tooltip);
            reveal();
            return;
        }
        illustrationReadyCache.set(sourcePath, readyImage);
        // Do not derive or overwrite metadata here: the displayed asset can
        // be transformed. The already-set original-dimension frame never
        // changes when this image finishes loading.
        image.classList.remove("is-pending");
        tooltip.querySelector(".illustration-tooltip-loading")?.remove();
    }
});

document.addEventListener("click", (event) => {
    const tooltipImage = event.target.closest(".illustration-tooltip img[data-preview-src]");
    if (tooltipImage && typeof window.ClassRecordImageViewer?.open === "function") {
        event.preventDefault();
        event.stopPropagation();
        illustrationTooltipController.hide(true);
        annotationTooltipController.hide(true);
        window.ClassRecordImageViewer.open(tooltipImage.dataset.previewSrc, {
            alt: tooltipImage.alt || "record illustration"
        });
        return;
    }

    const illustration = event.target.closest(".inline-illustration");
    if (illustration) {
        const src = String(illustration.dataset.imageSrc || "").trim();
        if (src && typeof window.ClassRecordImageViewer?.open === "function") {
            event.preventDefault();
            illustrationTooltipController.hide(true);
            annotationTooltipController.hide(true);
            window.ClassRecordImageViewer.open(src, { alt: illustration.textContent?.trim() || "record illustration" });
            return;
        }
        event.preventDefault();
        illustrationTooltipController.toggle(illustration, event);
        return;
    }

    const annotation = event.target.closest(".annotation");
    if (annotation) {
        event.preventDefault();
        annotationTooltipController.toggle(annotation, event);
        return;
    }
    if (!event.target.closest(".inline-tooltip")) {
        illustrationTooltipController.hide(true);
        annotationTooltipController.hide(true);
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
