/************************************************************
 * quoteStore.js
 * 全局名言仓库，从普通记录正文标记 [[quote:id|内容]] 派生
 ************************************************************/

window.QuoteStore = {
    quotes: [],
    loaded: false
};

function buildQuotesFromRecords(records) {
    if (typeof window.extractQuoteMarkers !== "function") {
        throw new Error("Record markup parser is unavailable.");
    }
    const quoteMap = new Map();
    (records || []).forEach((record) => {
        window.extractQuoteMarkers(record?.content || "").forEach((marker) => {
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
