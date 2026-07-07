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
    const raw = String(value ?? "").trim();
    if (!raw || raw.length > 500 || /[\\?#%\u0000-\u001f\u007f]/.test(raw)) return "";
    if (/^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(raw)) return "";
    // Full paths remain accepted for remote records written before the
    // filename-only syntax was introduced.
    const fileName = raw.replace(/^data\/attachments\//i, "");
    if (!fileName || fileName.includes("/") || fileName === "." || fileName === "..") return "";
    const extension = fileName.split(".").pop()?.toLowerCase();
    return ILLUSTRATION_IMAGE_EXTENSIONS.has(extension) ? `data/attachments/${fileName}` : "";
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
    let curlyDepth = 0;
    for (let index = 0; index <= source.length - separator.length; index += 1) {
        if (isEscapedMarkupCharacter(source, index)) continue;
        if (source.startsWith("[[", index)) {
            squareDepth += 1;
            index += 1;
        } else if (source.startsWith("]]", index) && squareDepth > 0) {
            squareDepth -= 1;
            index += 1;
        } else if (source.startsWith("{{", index)) {
            curlyDepth += 1;
            index += 1;
        } else if (source.startsWith("}}", index) && curlyDepth > 0) {
            curlyDepth -= 1;
            index += 1;
        } else if (squareDepth === 0 && curlyDepth === 0 && source.startsWith(separator, index)) {
            return index;
        }
    }
    return -1;
}

function splitTopLevelOnce(source, separator = "|") {
    const index = findTopLevelSeparator(source, separator);
    return index < 0 ? null : [source.slice(0, index), source.slice(index + separator.length)];
}

function extractRecordMarkupReferences(value) {
    const participantIds = new Set();
    const extraAuthorIds = new Set();
    const quoteIds = new Set();
    const illustrationPaths = new Set();
    const binaryTypes = new Set(["person", "author", "quote", "term", "record", "frac", "anno", "illu", "arrow"]);
    const unaryTypes = new Set(["del", "under", "red", "hide", "sup", "sub", "center", "right"]);

    const visit = (input, depth = 0) => {
        if (depth > 32) return;
        const source = String(input ?? "");
        for (let index = 0; index < source.length;) {
            if (!isEscapedMarkupCharacter(source, index) && source.startsWith("{{", index)) {
                const end = source.indexOf("}}", index + 2);
                if (end >= 0) {
                    const parts = splitTopLevelOnce(source.slice(index + 2, end));
                    if (parts && /^[a-zA-Z0-9_-]+$/.test(parts[0]) && parts[1]) {
                        quoteIds.add(parts[0]);
                        visit(parts[1], depth + 1);
                        index = end + 2;
                        continue;
                    }
                }
            }
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

            if (type === "person" || type === "author" || type === "quote" || type === "term") {
                const parts = splitTopLevelOnce(body.slice(colon + 1));
                if (parts && /^[a-zA-Z0-9_-]+$/.test(parts[0]) && parts[1]) {
                    if (type === "person") participantIds.add(parts[0]);
                    else if (type === "author") extraAuthorIds.add(parts[0]);
                    else quoteIds.add(parts[0]);
                    visit(parts[1], depth + 1);
                }
            } else if (unaryTypes.has(type)) {
                const content = body.slice(colon + 1);
                if (content) visit(content, depth + 1);
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
            } else {
                const legacyPerson = splitTopLevelOnce(body);
                if (legacyPerson && /^[a-zA-Z0-9_-]+$/.test(legacyPerson[0]) && legacyPerson[1]) {
                    participantIds.add(legacyPerson[0]);
                    visit(legacyPerson[1], depth + 1);
                }
            }
            index = end;
        }
    };

    visit(value);
    return {
        participantIds: [...participantIds],
        extraAuthorIds: [...extraAuthorIds],
        quoteIds: [...quoteIds],
        illustrationPaths: [...illustrationPaths]
    };
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
// Transitional compatibility for legacy integrations; new code uses quotes.
window.extractMentionedTermIds = extractMentionedQuoteIds;
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

    for (const type of ["person", "author", "quote", "term", "record", "frac", "anno", "illu", "arrow"]) {
        const prefix = `${type}:`;
        if (!body.startsWith(prefix)) continue;
        const parts = splitTopLevelOnce(body.slice(prefix.length));
        if (!parts || !parts[0] || !parts[1]) return asText ? raw : escapeRecordText(raw);
        const [first, second] = parts;
        if (type === "person" || type === "author") {
            if (!/^[a-zA-Z0-9_-]+$/.test(first)) return asText ? raw : escapeRecordText(raw);
            const label = render(second);
            return asText ? label : `<span class="person-tag" data-id="${first}" title="${escapeRecordAttribute(getPersonDisplayNameById(first))}">${label}</span>`;
        }
        if (type === "quote" || type === "term") {
            if (!/^[a-zA-Z0-9_-]+$/.test(first)) return asText ? raw : escapeRecordText(raw);
            const label = render(second);
            return asText ? label : `<span class="quote-tag" data-id="${first}">${label}</span>`;
        }
        if (type === "record") {
            if (!/^[a-zA-Z0-9_-]+(?:\.json)?$/.test(first)) return asText ? render(second) : render(second);
            const label = render(second);
            return asText || context.disableRecordLinks ? label : `<button type="button" class="record-jump-link" data-record-jump="${first}" style="--record-jump-hue:${stableRecordJumpHue(first)}">${label}</button>`;
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
    const context = {
        mode: options.mode || "html",
        disableRecordLinks: Boolean(options.disableRecordLinks),
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
            ["{{", "}}", "quote"], ["((", "))", "redacted"], ["!!", "!!", "center"],
            [">>", "<<", "right"], ["^", "^", "sup"], ["_", "_", "sub"]
        ].find(([open]) => source.startsWith(open, index));
        if (paired) {
            const [open, close, type] = paired;
            const end = source.indexOf(close, index + open.length);
            if (end >= 0) {
                const inner = source.slice(index + open.length, end);
                let rendered = parseInlineMarkup(inner, context);
                if (type === "quote") {
                    const parts = splitTopLevelOnce(inner);
                    if (parts && /^[a-zA-Z0-9_-]+$/.test(parts[0]) && parts[1]) {
                        rendered = parseInlineMarkup(parts[1], context);
                        output += context.mode === "text" ? rendered : `<span class="quote-tag" data-id="${parts[0]}">${rendered}</span>`;
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

function countRecordTextCharacters(text) {
    return Array.from(stripRecordMarkup(text)).length;
}

window.stripRecordMarkup = stripRecordMarkup;
window.countRecordTextCharacters = countRecordTextCharacters;

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

window.getRecordAnchorId = getRecordAnchorId;

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

let recordFocusGeneration = 0;
let recordScrollAnimation = null;
let lastAutoFocusedHash = "";

function cancelRecordFocus() {
    recordFocusGeneration += 1;
    if (recordScrollAnimation?.cancel) recordScrollAnimation.cancel();
    recordScrollAnimation = null;
}

function easeRecordScroll(t) {
    return 1 - Math.pow(1 - t, 3);
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
    const duration = Math.max(420, Math.min(980, 420 + Math.abs(distance) * 0.22));
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

function renderRecordFilter({ container, onFilterChange, onClear, getRecords, initial = {} }) {
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

const illustrationPreloadCache = new Map();
const illustrationReadyCache = new Map();
const illustrationDimensionCache = new Map();
const illustrationDimensionPromises = new Map();

function getIllustrationSourceDimensions(path) {
    return illustrationDimensionCache.get(String(path || "").trim()) || null;
}

window.getIllustrationSourceDimensions = getIllustrationSourceDimensions;

window.addEventListener("classrecordcacheclearing", () => {
    illustrationPreloadCache.clear();
    illustrationReadyCache.clear();
    illustrationDimensionCache.clear();
    illustrationDimensionPromises.clear();
});

function resolveIllustrationUrl(path) {
    const sourcePath = String(path || "").trim();
    if (!sourcePath) return Promise.resolve(null);
    if (illustrationPreloadCache.has(sourcePath)) return illustrationPreloadCache.get(sourcePath);
    const promise = window.ClassRecordData?.isEnabled?.()
        ? window.ClassRecordData.signAssetUrl(sourcePath, { quiet: true }).catch(() => null)
        : Promise.resolve(sourcePath);
    const reusable = promise.then((url) => {
        if (!url) illustrationPreloadCache.delete(sourcePath);
        return url;
    });
    illustrationPreloadCache.set(sourcePath, reusable);
    return reusable;
}

function preloadIllustrationDimensions(path) {
    const sourcePath = String(path || "").trim();
    if (!sourcePath) return Promise.resolve(null);
    if (illustrationDimensionCache.has(sourcePath)) return Promise.resolve(illustrationDimensionCache.get(sourcePath));
    if (illustrationDimensionPromises.has(sourcePath)) return illustrationDimensionPromises.get(sourcePath);
    const promise = (async () => {
        const preloaded = window.ClassRecordData?.getPreloadedAsset?.(sourcePath);
        if (preloaded?.width > 0 && preloaded?.height > 0) {
            illustrationReadyCache.set(sourcePath, preloaded);
            const dimensions = { width: preloaded.width, height: preloaded.height };
            illustrationDimensionCache.set(sourcePath, dimensions);
            return dimensions;
        }
        const url = await resolveIllustrationUrl(sourcePath);
        if (!url) return null;
        return new Promise((resolve) => {
            const image = new Image();
            image.decoding = "async";
            image.fetchPriority = "high";
            let dimensionFrame = null;
            let dimensionsResolved = false;
            const resolveDimensions = () => {
                if (dimensionsResolved || image.naturalWidth <= 0 || image.naturalHeight <= 0) return false;
                dimensionsResolved = true;
                const dimensions = { width: image.naturalWidth, height: image.naturalHeight };
                illustrationDimensionCache.set(sourcePath, dimensions);
                resolve(dimensions);
                return true;
            };
            const inspectDimensions = () => {
                if (!resolveDimensions() && !image.complete) dimensionFrame = requestAnimationFrame(inspectDimensions);
            };
            image.onload = () => {
                cancelAnimationFrame(dimensionFrame);
                resolveDimensions();
                illustrationReadyCache.set(sourcePath, {
                    url,
                    width: image.naturalWidth,
                    height: image.naturalHeight
                });
            };
            image.onerror = () => {
                cancelAnimationFrame(dimensionFrame);
                if (!dimensionsResolved) resolve(null);
            };
            image.src = url;
            inspectDimensions();
        });
    })();
    const reusable = promise.then((dimensions) => {
        if (!dimensions) illustrationDimensionPromises.delete(sourcePath);
        return dimensions;
    });
    illustrationDimensionPromises.set(sourcePath, reusable);
    return reusable;
}

async function preloadRecordIllustrationMetadata(records) {
    const paths = new Set();
    (Array.isArray(records) ? records : []).forEach((record) => {
        extractIllustrationPaths(record?.content || "").forEach((path) => paths.add(path));
    });
    await Promise.all([...paths].map((path) => preloadIllustrationDimensions(path)));
}

window.preloadRecordIllustrationMetadata = preloadRecordIllustrationMetadata;

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
    document.addEventListener("pointerove", (event) => {
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
        tooltip.setAttribute("aria-label", `${tag.textContent?.trim() || "插图"}预览`);
        const sourcePath = String(tag.dataset.imageSrc || "").trim();
        let readyImage = illustrationReadyCache.get(sourcePath)
            || window.ClassRecordData?.getPreloadedAsset?.(sourcePath);
        if (!readyImage && sourcePath && !window.ClassRecordData?.isEnabled?.()) {
            const cachedImage = new Image();
            cachedImage.src = sourcePath;
            if (cachedImage.complete && cachedImage.naturalWidth > 0) {
                readyImage = {
                    url: sourcePath,
                    width: cachedImage.naturalWidth,
                    height: cachedImage.naturalHeight
                };
            }
        }
        if (readyImage) {
            illustrationReadyCache.set(sourcePath, readyImage);
            const image = document.createElement("img");
            image.alt = tag.textContent?.trim() || "记录插图";
            image.decoding = "async";
            image.width = readyImage.width;
            image.height = readyImage.height;
            image.src = readyImage.url;
            setIllustrationFrameSize(tooltip, image, readyImage.width, readyImage.height);
            image.addEventListener("error", () => {
                illustrationReadyCache.delete(sourcePath);
                if (isCurrent()) setIllustrationFailure(tooltip);
            }, { once: true });
            tooltip.replaceChildren(image);
            reveal();
            return;
        }
        const image = document.createElement("img");
        image.alt = tag.textContent?.trim() || "记录插图";
        image.decoding = "async";
        image.fetchPriority = "high";
        let placeholderShown = false;
        let dimensionFrame = null;
        const sourceDimensions = getIllustrationSourceDimensions(sourcePath);
        if (sourceDimensions) {
            placeholderShown = true;
            setIllustrationFrameSize(tooltip, image, sourceDimensions.width, sourceDimensions.height);
            image.classList.add("is-pending");
            const loading = document.createElement("span");
            loading.className = "record-written-image-loading illustration-tooltip-loading";
            loading.innerHTML = '<i aria-hidden="true"></i><b>正在加载插图</b>';
            tooltip.replaceChildren(image, loading);
            reveal();
        }
        const url = await resolveIllustrationUrl(sourcePath);
        if (!isCurrent()) return;
        if (!url) {
            setIllustrationFailure(tooltip);
            reveal();
            return;
        }
        const loaded = await new Promise((resolve) => {
            const inspectDimensions = () => {
                if (!image.complete && !placeholderShown && image.naturalWidth > 0 && image.naturalHeight > 0) {
                    placeholderShown = true;
                    setIllustrationFrameSize(tooltip, image, image.naturalWidth, image.naturalHeight);
                    image.classList.add("is-pending");
                    const loading = document.createElement("span");
                    loading.className = "record-written-image-loading illustration-tooltip-loading";
                    loading.innerHTML = '<i aria-hidden="true"></i><b>正在加载插图</b>';
                    tooltip.replaceChildren(image, loading);
                    reveal();
                }
                if (!image.complete) dimensionFrame = requestAnimationFrame(inspectDimensions);
            };
            image.onload = () => {
                cancelAnimationFrame(dimensionFrame);
                resolve(true);
            };
            image.onerror = () => {
                cancelAnimationFrame(dimensionFrame);
                resolve(false);
            };
            image.src = url;
            inspectDimensions();
        });
        if (!isCurrent()) return;
        if (!loaded) {
            setIllustrationFailure(tooltip);
            reveal();
            return;
        }
        illustrationReadyCache.set(sourcePath, {
            url,
            width: image.naturalWidth,
            height: image.naturalHeight
        });
        if (!placeholderShown) {
            setIllustrationFrameSize(tooltip, image, image.naturalWidth, image.naturalHeight);
            tooltip.replaceChildren(image);
            reveal();
            return;
        }
        image.classList.remove("is-pending");
        tooltip.querySelector(".illustration-tooltip-loading")?.remove();
    }
});

document.addEventListener("click", (event) => {
    const illustration = event.target.closest(".inline-illustration");
    if (illustration) {
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
