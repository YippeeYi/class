/************************************************************
 * recordStore.js
 * 鍏ㄥ眬璁板綍浠撳簱
 ************************************************************/

window.RecordStore = {
    records: [],
    loaded: false
};

window.loadAllRecords = async function ({ onProgressStep, hidden = false } = {}) {
    if (!hidden && RecordStore.loaded) {
        return RecordStore.records;
    }

    const list = await loadWithCache({
        key: hidden ? "records:hidden" : "records",
        expire: 24 * 60 * 60 * 1000,
        loader: async () => {
            if (!window.ClassRecordData?.isEnabled()) throw new Error("Supabase 数据加载器不可用。");
            return window.ClassRecordData.loadRecords({ onProgressStep, hidden });
        }
    });

    const normalizedList = list.filter(Boolean);

    normalizedList.forEach((record, index) => {
        if (!record.time) {
            delete record.time;
        }
        if (!Number.isInteger(record.recordIndex)) {
            record.recordIndex = index;
        }
    });

    if (!hidden) {
        RecordStore.records = normalizedList;
        RecordStore.loaded = true;
    }
    return normalizedList;
};
