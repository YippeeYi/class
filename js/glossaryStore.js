/************************************************************
 * glossaryStore.js
 * 全局术语仓库（带缓存 + Store）
 ************************************************************/

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
            if (window.ClassRecordData?.isEnabled()) {
                return window.ClassRecordData.loadGlossary({ onProgressStep });
            }

            const files = await window.fetchJson("data/glossary/glossary_index.json");
            const terms = await Promise.all(
                files.map(async (f) => {
                    const term = await window.fetchJson(`data/glossary/${f}`);
                    if (typeof onProgressStep === "function") {
                        onProgressStep();
                    }
                    return term;
                })
            );

            return terms;
        }
    });

    GlossaryStore.terms = list;
    GlossaryStore.loaded = true;
    return list;
};
