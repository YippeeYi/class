const params = new URLSearchParams(location.search);
const sayingId = params.get("id");

if (!sayingId) {
    alert("Missing saying id.");
    throw new Error("sayingId missing");
}

const recordContainer = document.getElementById("record-list");
let relatedRecords = [];
let sayingFilterCriteria = { year: "", month: "", day: "", important: false, excludeDaily: false };

const cacheReady = window.cacheReadyPromise || Promise.resolve();

cacheReady.then(() => Promise.all([loadAllGlossary(), loadAllPeople(), loadAllRecords()])).then(([glossary, people, records]) => {
    const saying = glossary.find((item) => item.id === sayingId);
    if (!saying) {
        alert("saying not found.");
        return;
    }

    document.getElementById("saying-id").innerHTML = formatContent(saying.saying);
    document.getElementById("saying-definition").innerHTML = `<strong>${formatContent(saying.definition || "-")}</strong>`;
    document.getElementById("saying-since").textContent = saying.since || "-";

    const relatedNames = (saying.relatedPeople || []).map((pid) => {
        const person = people.find((item) => item.id === pid);
        const label = person?.name || person?.alias || person?.id || pid;
        return person ? parseContent(`[[${person.id}|${label}]]`) : pid;
    });
    document.getElementById("saying-related").innerHTML = relatedNames.length ? relatedNames.join(", ") : "-";

    relatedRecords = records.filter((record) => extractMentionedsayingIds(record.content || "").includes(sayingId));
    sortRecords(relatedRecords);

    const filterHost = document.createElement("div");
    filterHost.id = "record-filter";
    recordContainer.before(filterHost);

    const renderFilteredRecords = async () => {
        let filtered = filterRecordsByDate(relatedRecords, sayingFilterCriteria);
        sortRecords(filtered);
        renderRecordList(filtered, recordContainer);
    };

    renderRecordFilter({
        container: filterHost,
        getRecords: () => relatedRecords,
        initial: sayingFilterCriteria,
        onFilterChange: (criteria) => {
            sayingFilterCriteria = criteria;
            renderFilteredRecords();
        }
    });

    renderFilteredRecords();
});
