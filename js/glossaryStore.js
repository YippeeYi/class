/************************************************************
 * glossaryStore.js
 * 鍏ㄥ眬鏈浠撳簱锛堝甫缂撳瓨 + Store锛? ************************************************************/

window.GlossaryStore = {
    terms: [],
    loaded: false
};

window.loadAllGlossary = async function ({ onProgressStep } = {}) {
    if (GlossaryStore.loaded) {
        return GlossaryStore.terms;
    }

    const list = await loadWithCache({
        key: "glossary",
        expire: 24 * 60 * 60 * 1000,
        loader: async () => {
            if (!window.ClassRecordData?.isEnabled()) throw new Error("Supabase 数据加载器不可用。");
            return window.ClassRecordData.loadGlossary({ onProgressStep });
        }
    });

    GlossaryStore.terms = list;
    GlossaryStore.loaded = true;
    return list;
};
