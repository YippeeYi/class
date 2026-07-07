/************************************************************
 * quoteStore.js
 * 全局名言仓库，运行时只从 Supabase 读取
 ************************************************************/

window.QuoteStore = {
    quotes: [],
    loaded: false
};

window.loadAllQuotes = async function ({ onProgressStep } = {}) {
    if (QuoteStore.loaded) {
        return QuoteStore.quotes;
    }
    if (!window.ClassRecordData?.isEnabled()) {
        throw new Error("名言数据必须从 Supabase 读取。");
    }

    const list = await loadWithCache({
        key: "quotes",
        expire: 24 * 60 * 60 * 1000,
        loader: () => window.ClassRecordData.loadQuotes({ onProgressStep })
    });

    QuoteStore.quotes = list.filter(Boolean);
    QuoteStore.loaded = true;
    return QuoteStore.quotes;
};

// Compatibility only: older pages/extensions may still call the historical API.
window.GlossaryStore = window.QuoteStore;
window.loadAllGlossary = window.loadAllQuotes;
