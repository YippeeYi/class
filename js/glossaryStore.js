/************************************************************
 * glossaryStore.js
 * 全局名言仓库，运行时只从 Supabase 读取
 ************************************************************/

window.GlossaryStore = {
    terms: [],
    loaded: false
};

window.loadAllGlossary = async function ({ onProgressStep } = {}) {
    if (GlossaryStore.loaded) {
        return GlossaryStore.terms;
    }
    if (!window.ClassRecordData?.isEnabled()) {
        throw new Error("名言数据必须从 Supabase 读取。");
    }

    const list = await loadWithCache({
        key: "glossary",
        expire: 24 * 60 * 60 * 1000,
        loader: () => window.ClassRecordData.loadGlossary({ onProgressStep })
    });

    GlossaryStore.terms = list.filter(Boolean);
    GlossaryStore.loaded = true;
    return GlossaryStore.terms;
};
