/************************************************************
 * materialStore.js
 * 全局资料仓库，运行时只从 Supabase 读取
 ************************************************************/

window.MaterialStore = {
    materials: [],
    loaded: false
};

window.loadAllMaterials = async function ({ onProgressStep } = {}) {
    if (MaterialStore.loaded) return MaterialStore.materials;
    if (!window.ClassRecordData?.isEnabled()) {
        throw new Error("资料数据必须从 Supabase 读取。");
    }

    const list = await loadWithCache({
        key: "materials",
        expire: 24 * 60 * 60 * 1000,
        loader: () => window.ClassRecordData.loadMaterials({ onProgressStep })
    });

    MaterialStore.materials = list.filter(Boolean);
    MaterialStore.loaded = true;
    return MaterialStore.materials;
};
