/************************************************************
 * peopleStore.js
 * 全局人物仓库，运行时只从 Supabase 读取
 ************************************************************/

window.PeopleStore = {
    people: [],
    loaded: false
};

window.loadAllPeople = async function ({ onProgressStep, force = false } = {}) {
    if (PeopleStore.loaded && !force) {
        return PeopleStore.people;
    }
    if (!window.ClassRecordData?.isEnabled()) {
        throw new Error("人物数据必须从 Supabase 读取。");
    }

    const list = await loadWithCache({
        key: "people",
        expire: 24 * 60 * 60 * 1000,
        force,
        loader: () => window.ClassRecordData.loadPeople({ onProgressStep })
    });

    PeopleStore.people = list.filter(Boolean);
    PeopleStore.loaded = true;
    return PeopleStore.people;
};
