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
    const favorites = await window.RecordInteractions?.getFavorites?.().catch(() => []);
    favoriteRecordKeys = new Set((favorites || []).map((item) => String(item.record_id || item.fileName || item.id || item)));
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

function renderPersonReviewPanel(person) {
    if (!window.ReviewSystem || !person?.id) return;
    const bioNode = document.getElementById("person-bio");
    if (!bioNode || document.querySelector(".person-review-panel")) return;
    const panel = document.createElement("section");
    panel.className = "person-review-panel";
    panel.innerHTML = `
        <h2>Profile claim</h2>
        <p class="person-review-status" aria-live="polite">Loading request status...</p>
        <form class="person-claim-form">
            <label><span>Claim note</span><textarea name="note" rows="3" placeholder="Tell the admin why this is you"></textarea></label>
            <button type="submit" class="btn-action">Submit claim</button>
        </form>
        <form class="person-edit-form">
            <label><span>Display name</span><input name="displayName" type="text" maxlength="80" value="${escapeHtml(person.name || person.id || '')}"></label>
            <label><span>Aliases</span><input name="alias" type="text" maxlength="200" value="${escapeHtml(person.alias || '')}"></label>
            <label><span>Bio</span><textarea name="bio" rows="4">${escapeHtml(person.bio || '')}</textarea></label>
            <button type="submit" class="btn-action">Submit edit</button>
        </form>
    `;
    bioNode.insertAdjacentElement("afterend", panel);
    const status = panel.querySelector(".person-review-status");
    const refreshStatus = async () => {
        const requests = await window.ReviewSystem.listMyRequests({ personId: person.id }).catch(() => null);
        if (!requests) {
            status.textContent = "Request status unavailable.";
            return;
        }
        const claim = requests.claims?.[0];
        const edit = requests.edits?.[0];
        status.textContent = `Claim: ${claim?.status || 'none'} / Edit: ${edit?.status || 'none'}`;
    };
    panel.querySelector(".person-claim-form")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        status.textContent = "Submitting claim...";
        await window.ReviewSystem.submitPersonClaim({ personId: person.id, note: form.note.value.trim() }).then(() => {
            form.reset();
            status.textContent = "Claim submitted for review.";
            refreshStatus();
        }).catch((error) => {
            console.warn("Claim submit failed:", error);
            status.textContent = "Claim submit failed.";
        });
    });
    panel.querySelector(".person-edit-form")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        status.textContent = "Submitting edit...";
        await window.ReviewSystem.submitPersonEdit({
            personId: person.id,
            displayName: form.displayName.value.trim(),
            alias: form.alias.value.trim(),
            bio: form.bio.value.trim()
        }).then(() => {
            status.textContent = "Edit submitted for review.";
            refreshStatus();
        }).catch((error) => {
            console.warn("Edit submit failed:", error);
            status.textContent = "Edit submit failed.";
        });
    });
    refreshStatus();
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
    document.getElementById("person-alias").innerHTML = `<strong>${parseContent(person.alias || "-")}</strong>`;
    document.getElementById("person-bio").innerHTML = `<strong>${formatContent(person.bio || "-")}</strong>`;

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
    renderPersonReviewPanel(person);
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