/************************************************************
 * recordStore.js
 * 全局记录仓库，运行时只从 Supabase 读取
 ************************************************************/

window.RecordStore = {
    records: [],
    loaded: false,
    hiddenRecords: [],
    hiddenLoaded: false
};

function isHiddenRecord(record) {
    return record?.hidden === true || String(record?.hidden || "").trim().toLowerCase() === "true";
}

function normalizeRecordList(list, { hidden = false } = {}) {
    return list.filter((record) => record && isHiddenRecord(record) === Boolean(hidden)).map((record, index) => {
        if (!record.time) {
            delete record.time;
        }
        if (!Number.isInteger(record.recordIndex)) {
            record.recordIndex = index;
        }
        record.hidden = Boolean(hidden);
        return record;
    });
}

window.loadAllRecords = async function ({ onProgressStep } = {}) {
    if (RecordStore.loaded) {
        return RecordStore.records;
    }
    if (!window.ClassRecordData?.isEnabled()) {
        throw new Error("记录数据必须从 Supabase 读取。");
    }

    const list = await loadWithCache({
        key: "records:visible",
        expire: 24 * 60 * 60 * 1000,
        loader: () => window.ClassRecordData.loadRecords({ onProgressStep, hidden: false })
    });

    RecordStore.records = normalizeRecordList(list, { hidden: false });
    RecordStore.loaded = true;
    return RecordStore.records;
};

window.loadHiddenRecords = async function ({ onProgressStep } = {}) {
    if (RecordStore.hiddenLoaded) {
        return RecordStore.hiddenRecords;
    }
    if (!window.ClassRecordData?.isEnabled()) {
        throw new Error("隐藏记录只能从 Supabase 安全数据源读取。");
    }

    const list = await loadWithCache({
        key: "records:hidden",
        expire: 5 * 60 * 1000,
        loader: () => window.ClassRecordData.loadRecords({ onProgressStep, hidden: true })
    });

    RecordStore.hiddenRecords = normalizeRecordList(list, { hidden: true });
    RecordStore.hiddenLoaded = true;
    return RecordStore.hiddenRecords;
};
