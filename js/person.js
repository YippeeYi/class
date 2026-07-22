const params = new URLSearchParams(location.search);
const personId = params.get("id");

const recordContainer = document.getElementById("record-list");
const filterContainer = document.getElementById("record-filter");
const switchContainer = document.querySelector(".record-switch");
const switchButtons = document.querySelectorAll(".switch-btn");
const personInfo = document.getElementById("person-info");
const personLoading = document.getElementById("person-loading");

let participatedRecords = [];
let authoredRecords = [];
let currentFilter = { year: "", month: "", day: "", important: false, excludeDaily: false, query: "" };

const escapeHtml = (value) => String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

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
    const image = document.createElement("img");
    image.src = src;
    image.alt = stripRecordMarkup(person.name || person.id || "");
    image.width = 192;
    image.height = 192;
    image.loading = "eager";
    image.decoding = "async";
    image.fetchPriority = "high";
    card.appendChild(image);
    image.addEventListener("error", () => {
        card.remove();
        info.classList.remove("has-person-avatar");
    }, { once: true });
    info.prepend(card);
    info.classList.add("has-person-avatar");
}

function showPersonLoadError(title, detail) {
    if (personLoading) {
        personLoading.hidden = false;
        personLoading.className = "record-empty person-loading";
        personLoading.innerHTML = `<strong>${escapeHtml(title)}</strong>${detail ? `<span>${escapeHtml(detail)}</span>` : ""}`;
    }
    personInfo?.setAttribute("hidden", "");
}

async function initializePersonPage() {
    if (!personId) {
        showPersonLoadError("人物参数缺失。", "请从人物名单页重新打开。");
        recordContainer.innerHTML = '<div class="record-empty"><strong>人物参数缺失。</strong><span>请从人物名单页重新打开。</span></div>';
        recordContainer.setAttribute("aria-busy", "false");
        return;
    }
    try {
        await (window.waitForAccess?.() || Promise.resolve());
        const people = await loadAllPeople();
        const person = people.find((item) => item.id === personId);
        if (!person) {
            showPersonLoadError("没有找到这个人物。", "请检查链接或从人物名单页重新打开。");
            recordContainer.innerHTML = '<div class="record-empty"><strong>没有找到这个人物。</strong><span>请检查链接或从人物名单页重新打开。</span></div>';
            recordContainer.setAttribute("aria-busy", "false");
            return;
        }

        const displayName = String(person.name || person.alias || person.id || "").trim();
        document.getElementById("person-name").textContent = stripRecordMarkup(displayName) || person.id;
        const aliasText = person.alias || (Array.isArray(person.aliases) ? person.aliases.join("、") : "");
        document.getElementById("person-alias").innerHTML = `<strong>${parseContent(aliasText || "-")}</strong>`;
        document.getElementById("person-bio").innerHTML = `<strong>${formatContent(person.bio || "-")}</strong>`;
        personInfo?.removeAttribute("hidden");
        if (personLoading) personLoading.hidden = true;
        renderPersonAvatar(person);

        await (window.ClassRecordIllustrationMetadataPromise || Promise.resolve());
        const records = await loadAllRecords();
        participatedRecords = records.filter((record) => getRecordParticipantIds(record).includes(personId));
        authoredRecords = records.filter((record) => getRecordAuthorIds(record).includes(personId));

        sortRecords(participatedRecords);
        sortRecords(authoredRecords);
        const showSwitch = authoredRecords.length > 0;
        switchContainer?.classList.remove("is-pending");
        switchContainer?.classList.toggle("is-hidden", !showSwitch);
        if (!showSwitch) {
            switchButtons.forEach((item) => item.classList.toggle("active", item.dataset.type === "participated"));
        }
        filterContainer?.removeAttribute("hidden");
        renderRecordList(participatedRecords, recordContainer);
        recordContainer.setAttribute("aria-busy", "false");
        renderFilterUI();
    } catch (error) {
        window.ClassRecordDiagnostics?.warn("Person page load failed", error);
        showPersonLoadError("人物资料加载失败。", "请稍后重试。");
        recordContainer.innerHTML = '<div class="record-empty"><strong>页面加载失败。</strong><span>请稍后重试。</span></div>';
        recordContainer.setAttribute("aria-busy", "false");
    }
}

initializePersonPage();

switchButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
        switchButtons.forEach((item) => item.classList.remove("active"));
        btn.classList.add("active");
        currentFilter = { year: "", month: "", day: "", important: false, excludeDaily: false, query: "" };
        renderFilterUI();
        renderFilteredRecords();
    });
});
