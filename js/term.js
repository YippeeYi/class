const params = new URLSearchParams(location.search);
const termId = params.get("id");

if (!termId) {
    alert("Missing term id.");
    throw new Error("termId missing");
}

const recordContainer = document.getElementById("record-list");
let relatedRecords = [];
let termFilterCriteria = { year: "", month: "", day: "", important: false, excludeDaily: false };

const cacheReady = window.cacheReadyPromise || Promise.resolve();

cacheReady.then(() => Promise.all([loadAllGlossary(), loadAllPeople(), loadAllRecords()])).then(([glossary, people, records]) => {
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
        const label = person?.name || person?.alias || person?.id || pid;
        return person ? parseContent(`[[${person.id}|${label}]]`) : pid;
    });
    document.getElementById("term-related").innerHTML = relatedNames.length ? relatedNames.join(", ") : "-";

    relatedRecords = records.filter((record) => extractMentionedTermIds(record.content || "").includes(termId));
    document.getElementById("term-related-count").textContent = String(relatedRecords.length);
    sortRecords(relatedRecords);

    const filterHost = document.createElement("div");
    filterHost.id = "record-filter";
    recordContainer.before(filterHost);

    const renderFilteredRecords = async () => {
        let filtered = filterRecordsByDate(relatedRecords, termFilterCriteria);
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
