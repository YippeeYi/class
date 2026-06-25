/************************************************************
 * recordStore.js
 * 全局记录仓库
 ************************************************************/

window.RecordStore = {
    records: [],
    loaded: false
};

window.loadAllRecords = async function ({ onProgressStep } = {}) {
    if (RecordStore.loaded) {
        return RecordStore.records;
    }

    const list = await loadWithCache({
        key: "records",
        expire: 24 * 60 * 60 * 1000,
        loader: async () => {
            if (window.ClassRecordData?.isEnabled()) {
                return window.ClassRecordData.loadRecords({ onProgressStep });
            }

            const files = await window.fetchJson("data/record/records_index.json");
            const records = await Promise.all(
                files.map(async (file, i) => {
                    try {
                        const record = await window.fetchJson(`data/record/${file}`);
                        if (!record.time) {
                            delete record.time;
                        }
                        record.fileName = file;
                        record.recordIndex = i;
                        record.date = file.slice(0, 10);

                        if (!record.id) {
                            record.id = `R${String(i + 1).padStart(3, "0")}`;
                        }

                        return record;
                    } catch (error) {
                        console.warn(`跳过无法加载的记录文件：${file}`, error);
                        return null;
                    } finally {
                        if (typeof onProgressStep === "function") {
                            onProgressStep();
                        }
                    }
                })
            );

            return records.filter(Boolean);
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

    RecordStore.records = normalizedList;
    RecordStore.loaded = true;
    return normalizedList;
};
