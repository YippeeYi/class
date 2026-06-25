/************************************************************
 * person.js
 * 人物个人页面（使用 CacheLoader + Store）
 ************************************************************/

const params = new URLSearchParams(location.search);
const personId = params.get("id");

if (!personId) {
    alert("未指定人物 ID");
    throw new Error("personId missing");
}

const recordContainer = document.getElementById("record-list");
const filterContainer = document.getElementById("record-filter");
const recordSwitch = document.querySelector(".record-switch");
const switchButtons = document.querySelectorAll(".switch-btn");

let allRecords = [];
let participatedRecords = [];
let authoredRecords = [];
let currentFilter = { year: "", month: "", day: "", important: false, excludeDaily: false, query: "" };

function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getActiveRecords() {
    const active = document.querySelector(".switch-btn.active");
    if (active?.dataset.type === "authored") {
        return authoredRecords;
    }
    return participatedRecords;
}

function renderFilteredRecords() {
    const activeRecords = getActiveRecords();
    const filtered = filterRecordsByDate(activeRecords, currentFilter);
    sortRecords(filtered);
    renderRecordList(filtered, recordContainer);
}

function renderFilterUI() {
    renderRecordFilter({
        container: filterContainer,
        getRecords: () => getActiveRecords(),
        initial: currentFilter,
        onFilterChange: criteria => {
            currentFilter = criteria;
            renderFilteredRecords();
        }
    });
}

const cacheReady = window.cacheReadyPromise || Promise.resolve();

cacheReady.then(() => Promise.all([
    loadAllPeople(),
    loadAllRecords()
])).then(([people, records]) => {
    allRecords = records;

    const person = people.find(p => p.id === personId);
    if (!person) {
        alert("人物不存在");
        return;
    }

    document.getElementById("person-id").textContent = person.id;
    document.getElementById("person-alias").innerHTML =
        `<strong>${parseContent(person.alias || "—")}</strong>`;
    document.getElementById("person-bio").innerHTML =
        `<strong>${formatContent(person.bio || "—")}</strong>`;

    if (person.role === "teacher" || person.role === "other") {
        if (recordSwitch) recordSwitch.hidden = true;
    }

    const personRefPattern = new RegExp(`\\[\\[${escapeRegExp(personId)}\\|.+?\\]\\]`);
    participatedRecords = allRecords.filter(r => r.content && personRefPattern.test(r.content));
    authoredRecords = allRecords.filter(r => r.author === personId);

    sortRecords(participatedRecords);
    sortRecords(authoredRecords);

    renderRecordList(participatedRecords, recordContainer);
    renderFilterUI();
});

switchButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        switchButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        currentFilter = { year: "", month: "", day: "", important: false, excludeDaily: false, query: "" };
        renderFilterUI();
        renderFilteredRecords();
    });
});
