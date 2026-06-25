const params = new URLSearchParams(location.search);
const termId = params.get("id");

if (!termId) {
    alert("Missing term id.");
    throw new Error("termId missing");
}

const recordContainer = document.getElementById("record-list");
let allRecords = [];
let relatedRecords = [];
let termFilterCriteria = { year: "", month: "", day: "", important: false, excludeDaily: false, favorites: false };
let favoriteRecordKeys = null;

async function ensureFavoriteRecordKeys() {
    if (favoriteRecordKeys) return favoriteRecordKeys;
    const favorites = await window.RecordInteractions?.getFavorites?.().catch(() => []);
    favoriteRecordKeys = new Set((favorites || []).map((item) => String(item.record_id || item.fileName || item.id || item)));
    return favoriteRecordKeys;
}

const cacheReady = window.cacheReadyPromise || Promise.resolve();

cacheReady.then(() => Promise.all([loadAllGlossary(), loadAllPeople(), loadAllRecords()])).then(([glossary, people, records]) => {
    allRecords = records;
    const term = glossary.find((item) => item.id === termId);
    if (!term) {
        alert("Term not found.");
        return;
    }

    document.getElementById("term-id").innerHTML = formatContent(term.term);
    document.getElementById("term-definition").innerHTML = `<strong>${formatContent(term.definition || "-")}</strong>`;
    document.getElementById("term-since").textContent = term.since || "-";

    const relatedNames = (term.relatedPeople || []).map((pid) => {
        const person = people.find((item) => item.id === pid);
        return person ? parseContent(`[[${person.id}|${person.id}]]`) : pid;
    });
    document.getElementById("term-related").innerHTML = relatedNames.length ? relatedNames.join(", ") : "-";

    const pattern = new RegExp(`\\{\\{${termId}\\|.+?\\}\\}`);
    relatedRecords = allRecords.filter((record) => record.content && pattern.test(record.content));
    sortRecords(relatedRecords);

    const filterHost = document.createElement("div");
    filterHost.id = "record-filter";
    recordContainer.before(filterHost);

    const renderFilteredRecords = async () => {
        let filtered = filterRecordsByDate(relatedRecords, termFilterCriteria);
        if (termFilterCriteria.favorites) {
            const keys = await ensureFavoriteRecordKeys();
            filtered = filtered.filter((record) => keys.has(String(record.fileName || record.id)));
        }
        sortRecords(filtered);
        renderRecordList(filtered, recordContainer);
    };

    renderRecordFilter({
        container: filterHost,
        getRecords: () => relatedRecords,
        initial: termFilterCriteria,
        onFilterChange: (criteria) => {
            termFilterCriteria = criteria;
            renderFilteredRecords();
        }
    });

    renderFilteredRecords();
});