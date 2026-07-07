/************************************************************
 * quoteStore.js
 * 全局名言仓库，从普通记录正文标记 [[quote:id|内容]] 派生
 ************************************************************/

window.QuoteStore = {
    quotes: [],
    loaded: false
};

function isQuoteEscapedMarkupCharacter(source, index) {
    let slashCount = 0;
    for (let cursor = index - 1; cursor >= 0 && source[cursor] === "\\"; cursor -= 1) slashCount += 1;
    return slashCount % 2 === 1;
}

function findQuoteBalancedSquareEnd(source, start) {
    let depth = 1;
    for (let index = start + 2; index < source.length - 1; index += 1) {
        if (!isQuoteEscapedMarkupCharacter(source, index) && source.startsWith("[[", index)) {
            depth += 1;
            index += 1;
        } else if (!isQuoteEscapedMarkupCharacter(source, index) && source.startsWith("]]", index)) {
            depth -= 1;
            if (depth === 0) return index + 2;
            index += 1;
        }
    }
    return -1;
}

function findQuoteTopLevelSeparator(source, separator = "|") {
    let squareDepth = 0;
    let curlyDepth = 0;
    for (let index = 0; index <= source.length - separator.length; index += 1) {
        if (isQuoteEscapedMarkupCharacter(source, index)) continue;
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

function splitQuoteTopLevelOnce(source, separator = "|") {
    const index = findQuoteTopLevelSeparator(source, separator);
    return index < 0 ? null : [source.slice(0, index), source.slice(index + separator.length)];
}

function extractQuoteMarkers(value) {
    const markers = [];
    const source = String(value || "");
    for (let index = 0; index < source.length;) {
        if (!isQuoteEscapedMarkupCharacter(source, index) && source.startsWith("{{", index)) {
            const end = source.indexOf("}}", index + 2);
            if (end >= 0) {
                const parts = splitQuoteTopLevelOnce(source.slice(index + 2, end));
                if (parts && /^[a-zA-Z0-9_-]+$/.test(parts[0]) && parts[1]) {
                    markers.push({ id: parts[0], quote: parts[1] });
                    markers.push(...extractQuoteMarkers(parts[1]));
                    index = end + 2;
                    continue;
                }
            }
        }
        if (isQuoteEscapedMarkupCharacter(source, index) || !source.startsWith("[[", index)) {
            index += 1;
            continue;
        }
        const end = findQuoteBalancedSquareEnd(source, index);
        if (end < 0) {
            index += 2;
            continue;
        }
        const body = source.slice(index + 2, end - 2);
        const colon = body.indexOf(":");
        const type = colon > 0 ? body.slice(0, colon) : "";
        const content = colon > 0 ? body.slice(colon + 1) : body;
        if (type === "quote" || type === "term") {
            const parts = splitQuoteTopLevelOnce(content);
            if (parts && /^[a-zA-Z0-9_-]+$/.test(parts[0]) && parts[1]) {
                markers.push({ id: parts[0], quote: parts[1] });
                markers.push(...extractQuoteMarkers(parts[1]));
            }
        } else {
            const nested = colon > 0 ? content : body;
            markers.push(...extractQuoteMarkers(nested));
        }
        index = end;
    }
    return markers;
}

function buildQuotesFromRecords(records) {
    const quoteMap = new Map();
    (records || []).forEach((record) => {
        extractQuoteMarkers(record?.content || "").forEach((marker) => {
            if (!marker.id || quoteMap.has(marker.id)) return;
            quoteMap.set(marker.id, {
                id: marker.id,
                quote: marker.quote,
                content: marker.quote,
                recordFile: record.fileName || record.id || "",
                sourceDate: record.date || ""
            });
        });
    });
    return [...quoteMap.values()].sort((a, b) => (a.sourceDate || "").localeCompare(b.sourceDate || "") || a.id.localeCompare(b.id));
}

window.loadAllQuotes = async function ({ onProgressStep, records } = {}) {
    if (QuoteStore.loaded) {
        return QuoteStore.quotes;
    }
    const list = await loadWithCache({
        key: "quotes:from-records",
        expire: 24 * 60 * 60 * 1000,
        force: Array.isArray(records),
        loader: async () => buildQuotesFromRecords(Array.isArray(records) ? records : await window.loadAllRecords())
    });

    QuoteStore.quotes = list.filter(Boolean);
    QuoteStore.loaded = true;
    if (typeof onProgressStep === "function") {
        QuoteStore.quotes.forEach((quote) => onProgressStep(quote.id));
    }
    return QuoteStore.quotes;
};

// Compatibility only: older pages/extensions may still call the historical API.
window.GlossaryStore = window.QuoteStore;
window.loadAllGlossary = window.loadAllQuotes;
