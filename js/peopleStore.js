/************************************************************
 * peopleStore.js
 * 鍏ㄥ眬浜虹墿浠撳簱
 ************************************************************/

window.PeopleStore = {
    people: [],
    loaded: false
};

window.loadAllPeople = async function ({ onProgressStep } = {}) {
    if (PeopleStore.loaded) {
        return PeopleStore.people;
    }

    const list = await loadWithCache({
        key: "people",
        expire: 24 * 60 * 60 * 1000,
        loader: async () => {
            if (!window.ClassRecordData?.isEnabled()) throw new Error("Supabase 数据加载器不可用。");
            return window.ClassRecordData.loadPeople({ onProgressStep });
        }
    });

    PeopleStore.people = list;
    PeopleStore.loaded = true;
    return list;
};
