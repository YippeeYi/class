/************************************************************
 * recordStore.js
 * 全局记录仓库，运行时只从 Supabase 读取
 ************************************************************/

window.RecordStore = {
    allRecords: [],
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
        return { ...record, hidden: Boolean(hidden) };
    });
}

function normalizeRecordKey(value) {
    return String(value || "").trim().replace(/^data\/record\//i, "").replace(/\.json$/i, "");
}

function derivePageDateMap(records, pages) {
    const byKey = new Map((records || []).map((record) => [normalizeRecordKey(record.fileName || record.id), record]));
    const result = new Map();
    (pages || []).forEach((page) => {
        const pageKey = String(page.page || "").trim();
        if (!pageKey) return;
        const start = byKey.get(normalizeRecordKey(page.startFile || page.start || page.from));
        const end = byKey.get(normalizeRecordKey(page.endFile || page.end || page.to));
        result.set(pageKey, {
            date: start?.date || end?.date || "",
            time: start?.time || ""
        });
    });
    return result;
}

function normalizeSupplementalRecords({ records, pageMessages, pageSupplements, pages, hidden = false }) {
    const pageDateMap = derivePageDateMap(records, pages);
    const supplemental = [];
    (pageMessages || []).forEach((item, index) => {
        const page = String(item.page || "").trim();
        const dateInfo = pageDateMap.get(page) || {};
        supplemental.push({
            ...item,
            id: `message-${page || index + 1}`,
            fileName: `message-${page || index + 1}`,
            date: item.date || dateInfo.date || "",
            time: item.time || dateInfo.time || "",
            author: item.author || item.recorder || "",
            recorder: item.author || item.recorder || "",
            content: item.content || item.text || "",
            text: item.content || item.text || "",
            importance: item.importance || "normal",
            attachments: Array.isArray(item.attachments) ? item.attachments : [],
            hidden: Boolean(hidden),
            recordType: "message"
        });
    });
    (pageSupplements || []).forEach((item, index) => {
        const page = String(item.page || "").trim();
        const dateInfo = pageDateMap.get(page) || {};
        supplemental.push({
            ...item,
            id: item.id || `supplement-${page || index + 1}-${item.supplementIndex || index + 1}`,
            fileName: item.fileName || item.id || `supplement-${page || index + 1}-${item.supplementIndex || index + 1}`,
            date: item.date || dateInfo.date || "",
            time: item.time || dateInfo.time || "",
            author: item.author || item.recorder || "",
            recorder: item.author || item.recorder || "",
            content: item.content || item.text || "",
            text: item.content || item.text || "",
            importance: item.importance || "normal",
            attachments: Array.isArray(item.attachments) ? item.attachments : [],
            hidden: Boolean(hidden),
            recordType: "supplement"
        });
    });
    return supplemental.filter((item) => item.content);
}

function refreshCombinedRecords() {
    RecordStore.allRecords = [...RecordStore.records, ...RecordStore.hiddenRecords];
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
    refreshCombinedRecords();
    return RecordStore.records;
};

window.loadHiddenRecords = async function ({ onProgressStep } = {}) {
    if (RecordStore.hiddenLoaded) {
        return RecordStore.hiddenRecords;
    }
    if (!window.ClassRecordData?.isEnabled()) {
        throw new Error("隐藏记录只能从 Supabase 安全数据源读取。");
    }
    const isAdmin = await window.ClassRecordSupabase?.hasAdminAccess?.();
    if (!isAdmin) {
        throw new Error("隐藏记录仅允许 admin 访问。");
    }

    const list = await loadWithCache({
        key: "records:hidden",
        expire: 5 * 60 * 1000,
        loader: async () => {
            const records = await window.ClassRecordData.loadRecords({ onProgressStep, hidden: true });
            const [pageSupplements, pages] = await Promise.all([
                window.ClassRecordData.loadPageSupplements?.({ hidden: true }).catch(() => []),
                window.ClassRecordData.loadRecordPages?.({ hidden: true }).catch(() => [])
            ]);
            return [
                ...records,
                ...normalizeSupplementalRecords({ records, pageMessages: [], pageSupplements, pages, hidden: true })
            ];
        }
    });
    RecordStore.hiddenRecords = normalizeRecordList(list, { hidden: true });
    RecordStore.hiddenLoaded = true;
    refreshCombinedRecords();
    return RecordStore.hiddenRecords;
};
