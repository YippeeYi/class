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

let participatedRecords = [];
let authoredRecords = [];
let currentFilter = { year: "", month: "", day: "", important: false, excludeDaily: false, query: "" };

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

async function renderFilteredRecords() {
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
        onFilterChange: (criteria) => {
            currentFilter = criteria;
            renderFilteredRecords();
        }
    });
}

async function signPersonAvatar(avatar) {
    if (!avatar) return "";
    if (/^https?:\/\//i.test(avatar)) return avatar;
    return window.ClassRecordData?.signAssetUrl?.(avatar, { quiet: true }).catch(() => "") || "";
}

async function renderPersonAvatar(person) {
    const info = document.querySelector(".person-info");
    if (!info) return;
    document.querySelector(".person-avatar-card")?.remove();
    info.classList.remove("has-person-avatar");
    const avatar = person.avatarUrl || person.avatar_url || person.avatar || "";
    if (!avatar) return;
    const src = await signPersonAvatar(avatar);
    if (!src) return;
    const card = document.createElement("div");
    card.className = "person-avatar-card";
    card.innerHTML = `<img src="${escapeHtml(src)}" alt="${escapeHtml(person.name || person.id)}" width="192" height="192" loading="eager" decoding="async" fetchpriority="high">`;
    card.querySelector("img")?.addEventListener("error", () => {
        card.remove();
        info.classList.remove("has-person-avatar");
    }, { once: true });
    info.prepend(card);
    info.classList.add("has-person-avatar");
}

const cacheReady = window.cacheReadyPromise || Promise.resolve();

cacheReady.then(() => Promise.all([loadAllPeople({ force: true }), loadAllRecords()])).then(([people, records]) => {
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
    participatedRecords = records.filter((record) => record.content && personRefPattern.test(record.content));
    authoredRecords = records.filter((record) => record.author === personId);

    sortRecords(participatedRecords);
    sortRecords(authoredRecords);
    renderRecordList(participatedRecords, recordContainer);
    renderFilterUI();
}).catch((error) => {
    console.error("Person page load failed:", error);
    recordContainer.innerHTML = `<div class="record-empty"><strong>页面加载失败。</strong><span>${escapeHtml(error?.message || "")}</span></div>`;
});

switchButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
        switchButtons.forEach((item) => item.classList.remove("active"));
        btn.classList.add("active");
        currentFilter = { year: "", month: "", day: "", important: false, excludeDaily: false, query: "" };
        renderFilterUI();
        renderFilteredRecords();
    });
});
