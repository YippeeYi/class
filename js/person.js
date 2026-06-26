const params = new URLSearchParams(location.search);
const personId = params.get("id");

if (!personId) {
    alert("Missing person id.");
    throw new Error("personId missing");
}

const recordContainer = document.getElementById("record-list");
const filterContainer = document.getElementById("record-filter");
const recordSwitch = document.querySelector(".record-switch");
const switchButtons = document.querySelectorAll(".switch-btn");

let allRecords = [];
let participatedRecords = [];
let authoredRecords = [];
let currentFilter = { year: "", month: "", day: "", important: false, excludeDaily: false, query: "", favorites: false };
let favoriteRecordKeys = null;

const escapeHtml = (value) => String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getActiveRecords() {
    const active = document.querySelector(".switch-btn.active");
    return active?.dataset.type === "authored" ? authoredRecords : participatedRecords;
}

async function ensureFavoriteRecordKeys() {
    if (favoriteRecordKeys) return favoriteRecordKeys;
    favoriteRecordKeys = await window.RecordInteractions?.getFavoriteKeys?.().catch(() => new Set()) || new Set();
    return favoriteRecordKeys;
}

async function renderFilteredRecords() {
    const activeRecords = getActiveRecords();
    let filtered = filterRecordsByDate(activeRecords, currentFilter);
    if (currentFilter.favorites) {
        const keys = await ensureFavoriteRecordKeys();
        filtered = filtered.filter((record) => keys.has(String(record.fileName || record.id)));
    }
    sortRecords(filtered);
    renderRecordList(filtered, recordContainer);
}

function renderFilterUI() {
    renderRecordFilter({
        container: filterContainer,
        getRecords: () => getActiveRecords(),
        initial: currentFilter,
        onFilterChange: (criteria) => {
            currentFilter = criteria;
            renderFilteredRecords();
        }
    });
}

function renderPersonReviewStatus(person) {
    if (!window.ReviewSystem || !person?.id) return;
    const info = document.querySelector(".person-info");
    if (!info || document.querySelector(".person-review-status")) return;
    const status = document.createElement("p");
    status.className = "person-review-status";
    status.setAttribute("aria-live", "polite");
    status.textContent = "正在读取认领状态…";
    info.appendChild(status);
    const refreshStatus = async () => {
        const requests = await window.ReviewSystem.listMyRequests({ personId: person.id }).catch(() => null);
        if (!requests) {
            status.textContent = "认领状态暂不可用。";
            return;
        }
        const claim = requests.claims?.[0];
        const edit = requests.edits?.[0];
        status.textContent = `认领审核：${claim?.status || '暂无'}；资料编辑审核：${edit?.status || '暂无'}。请从右上角账号菜单进入认领或编辑流程。`;
    };
    refreshStatus();
}

function renderPersonAvatar(person) {
    const info = document.querySelector(".person-info");
    if (!info || document.querySelector(".person-avatar-card")) return;
    const card = document.createElement("div");
    card.className = "person-avatar-card";
    const avatar = person.avatarUrl || person.avatar_url || person.avatar || "";
    card.innerHTML = avatar
        ? `<img src="${escapeHtml(avatar)}" alt="${escapeHtml(person.name || person.id)} 的头像" loading="lazy" decoding="async">`
        : `<span>${escapeHtml((person.name || person.id || "?").slice(0, 1))}</span>`;
    info.prepend(card);
}

const cacheReady = window.cacheReadyPromise || Promise.resolve();

cacheReady.then(() => Promise.all([loadAllPeople(), loadAllRecords()])).then(([people, records]) => {
    allRecords = records;
    const person = people.find((item) => item.id === personId);
    if (!person) {
        alert("Person not found.");
        return;
    }

    document.getElementById("person-id").textContent = person.id;
    const aliasText = person.alias || (Array.isArray(person.aliases) ? person.aliases.join("、") : "");
    document.getElementById("person-alias").innerHTML = `<strong>${parseContent(aliasText || "-")}</strong>`;
    document.getElementById("person-bio").innerHTML = `<strong>${formatContent(person.bio || "-")}</strong>`;
    renderPersonAvatar(person);

    if (person.role === "teacher" || person.role === "other") {
        if (recordSwitch) recordSwitch.hidden = true;
    }

    const personRefPattern = new RegExp(`\\[\\[${escapeRegExp(personId)}\\|.+?\\]\\]`);
    participatedRecords = allRecords.filter((record) => record.content && personRefPattern.test(record.content));
    authoredRecords = allRecords.filter((record) => record.author === personId);

    sortRecords(participatedRecords);
    sortRecords(authoredRecords);
    renderRecordList(participatedRecords, recordContainer);
    renderFilterUI();
    renderPersonReviewStatus(person);
});

switchButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
        switchButtons.forEach((item) => item.classList.remove("active"));
        btn.classList.add("active");
        currentFilter = { year: "", month: "", day: "", important: false, excludeDaily: false, query: "", favorites: false };
        renderFilterUI();
        renderFilteredRecords();
    });
});
