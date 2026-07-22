/************************************************************
 * people.js
 * 人物名单页面
 ************************************************************/

const container = document.getElementById("people-list");

let peopleList = [];
let records = [];
let participantCountMap = new Map();
let authorCountMap = new Map();
let authorCharacterCountMap = new Map();

const roleSortState = {
    student: { key: "id", order: "asc" },
    teacher: { key: "id", order: "asc", mainFirst: false },
    other: { key: "id", order: "asc" }
};

const roleSortOptions = {
    student: [
        ["id", "id"],
        ["participation", "参与事件数"],
        ["record", "记录事件数"],
        ["characters", "记录字数"]
    ],
    teacher: [
        ["id", "id"],
        ["participation", "参与事件数"],
        ["subject", "学科"]
    ],
    other: [
        ["id", "id"],
        ["participation", "参与事件数"]
    ]
};

const subjectOrder = ["语文", "数学", "英语", "物理", "化学", "生物", "历史", "政治", "地理"];

/* ===============================
   启动加载流程
   =============================== */
const cacheReady = window.cacheReadyPromise || Promise.resolve();

cacheReady.then(() => Promise.all([
    loadAllPeople(),
    loadAllRecords()
])).then(([people, allRecords]) => {
    peopleList = people;
    records = allRecords;
    ({ participantCountMap, authorCountMap, authorCharacterCountMap } = buildPeopleStats(records));
    renderByRole();
    container.setAttribute("aria-busy", "false");
}).catch((error) => {
    window.ClassRecordDiagnostics?.warn("People data load failed", error);
    container.innerHTML = '<div class="record-empty"><strong>人物名单加载失败。</strong><span>请稍后重试。</span></div>';
    container.setAttribute("aria-busy", "false");
});

/* ===============================
   角色显示名映射
   =============================== */
const roleNameMap = {
    student: "同学",
    teacher: "老师",
    other: "其他"
};

function getPersonDisplayName(person) {
    return String(person?.name || person?.alias || person?.id || "").trim();
}

function getPeopleTableColumns(role) {
    const columns = [
        { label: "序号", render: (_person, index) => String(index + 1) },
        { label: "姓名", render: (person) => parseContent(getPersonDisplayName(person)) || "-" },
        { label: "别名", render: (person) => parseContent(person.alias) || "-" },
        { label: "参与", render: (person) => String(countAsParticipant(person.id)) }
    ];
    if (role === "student") {
        columns.push({ label: "记录", render: (person) => String(countAsAuthor(person.id)) });
        columns.push({ label: "记录字数", render: (person) => String(countAsAuthorCharacters(person.id)) });
    }
    if (role === "teacher") columns.push({ label: "学科", render: (person) => parseContent(person.subject || "") || "—" });
    return columns;
}

/* ===============================
   按角色分组渲染
   =============================== */
function renderByRole() {
    container.replaceChildren();
    Object.keys(roleSortState).forEach((role) => renderPeopleSection(role, { initial: true }));
}

function getPeopleByRole(role) {
    return peopleList.filter((person) => {
        const normalizedRole = roleSortState[person.role] ? person.role : "other";
        return normalizedRole === role;
    });
}

function renderPeopleSection(role, { initial = false } = {}) {
        const state = roleSortState[role];
        if (!state) return;
        const list = sortPeople(getPeopleByRole(role), state, role);
        if (!list.length) return;

        const section = document.createElement("section");
        section.className = "people-section";
        section.dataset.role = role;
        const columns = getPeopleTableColumns(role);
        const sortButtons = roleSortOptions[role].map(([key, label]) => `
            <button type="button" class="btn-action sort-option people-sort-option${state.key === key ? " is-active" : ""}" data-role="${role}" data-sort-key="${key}">${label}</button>
        `).join("");
        const activeSortLabel = roleSortOptions[role].find(([key]) => key === state.key)?.[1] || "id";
        section.innerHTML = `
      <div class="people-section-heading">
        <h2>${roleNameMap[role]}</h2>
        <div class="sort-controls people-role-sort" role="group" aria-label="${roleNameMap[role]}排序">
          <div class="sort-dropdown" data-role="${role}">
            <button type="button" class="btn-select dropdown-trigger" data-value="${state.key}">
              <span class="dropdown-label">按 ${activeSortLabel}</span>
              <span class="dropdown-arrow" aria-hidden="true">▾</span>
            </button>
            <div class="select-menu" role="menu" aria-label="${roleNameMap[role]}排序依据">
              ${sortButtons}
            </div>
          </div>
          <button type="button" class="btn-action people-sort-order" data-role="${role}">${state.order === "asc" ? "升序" : "降序"}</button>
          ${role === "teacher" ? `<button type="button" class="btn-action people-main-toggle${state.mainFirst ? " is-active" : ""}" data-role="teacher" aria-pressed="${state.mainFirst}">主要</button>` : ""}
        </div>
      </div>
      <table class="people-table">
        <thead>
          <tr>
            ${columns.map((column) => `<th>${column.label}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${list.map((p, i) => `
            <tr data-id="${escapeRecordAttribute(p.id)}" class="${role === "teacher" && p.main === true ? "people-row-main-teacher" : ""}">
              ${columns.map((column) => `<td>${column.render(p, i)}</td>`).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
        if (initial) container.appendChild(section);
        else container.querySelector(`.people-section[data-role="${role}"]`)?.replaceWith(section);

        bindRowClick(section);
        bindRoleSortDropdowns(section);
}

function bindRoleSortDropdowns(section) {
    section.querySelectorAll(".sort-dropdown").forEach((dropdown) => {
        let closeTimer = null;
        const open = () => {
            clearTimeout(closeTimer);
            dropdown.classList.add("is-open");
        };
        const close = () => {
            clearTimeout(closeTimer);
            closeTimer = setTimeout(() => dropdown.classList.remove("is-open"), 140);
        };
        dropdown.addEventListener("mouseenter", open);
        dropdown.addEventListener("mouseleave", close);
        dropdown.addEventListener("focusin", open);
        dropdown.addEventListener("focusout", close);
    });
}

/* ===============================
   行点击跳转
   =============================== */
function bindRowClick(section) {
    section.querySelectorAll(".people-table tbody tr").forEach(tr => {
        tr.onclick = () => {
            const href = `person.html?id=${encodeURIComponent(tr.dataset.id || "")}`;
            if (typeof window.navigateTo === 'function') {
                window.navigateTo(href);
            } else {
                location.href = href;
            }
        };
    });
}

/* ===============================
   统计
   =============================== */
function countAsAuthor(id) {
    return authorCountMap.get(id) || 0;
}

function countAsParticipant(id) {
    return participantCountMap.get(id) || 0;
}

function countAsAuthorCharacters(id) {
    return authorCharacterCountMap.get(id) || 0;
}

function buildPeopleStats(recordList) {
    const participantCounts = new Map();
    const authorCounts = new Map();
    const authorCharacterCounts = new Map();

    recordList.forEach((record) => {
        getRecordAuthorIds(record).forEach((id) => {
            authorCounts.set(id, (authorCounts.get(id) || 0) + 1);
        });
        getRecordParticipantIds(record).forEach((id) => {
            participantCounts.set(id, (participantCounts.get(id) || 0) + 1);
        });
        const primaryAuthor = String(record.author || "").trim();
        if (primaryAuthor) {
            authorCharacterCounts.set(primaryAuthor, (authorCharacterCounts.get(primaryAuthor) || 0) + countRecordTextCharacters(record.content || ""));
        }
    });

    return { participantCountMap: participantCounts, authorCountMap: authorCounts, authorCharacterCountMap: authorCharacterCounts };
}

/* ===============================
   排序
   =============================== */
function sortPeople(list, state, role) {
    const { key, order } = state;
    const direction = order === "desc" ? -1 : 1;
    const compareId = (a, b) => String(a.id || "").localeCompare(String(b.id || "")) * direction;
    return [...list].sort((a, b) => {
        if (role === "teacher" && state.mainFirst && (a.main === true) !== (b.main === true)) {
            return Number(b.main === true) - Number(a.main === true);
        }
        if (key === "id") return compareId(a, b);
        if (key === "participation" || key === "record" || key === "characters") {
            const getCount = key === "record" ? countAsAuthor : key === "characters" ? countAsAuthorCharacters : countAsParticipant;
            return (getCount(a.id) - getCount(b.id)) * direction || compareId(a, b);
        }
        if (role === "teacher" && key === "subject") {
            const rank = (person) => {
                const index = subjectOrder.indexOf(String(person.subject || "").trim());
                return index < 0 ? Number.MAX_SAFE_INTEGER : index;
            };
            const aRank = rank(a);
            const bRank = rank(b);
            if (aRank === Number.MAX_SAFE_INTEGER || bRank === Number.MAX_SAFE_INTEGER) {
                if (aRank !== bRank) return aRank === Number.MAX_SAFE_INTEGER ? 1 : -1;
            }
            return (aRank - bRank) * direction || compareId(a, b);
        }
        return compareId(a, b);
    });
}

/* ===============================
   分组独立排序
   =============================== */
container.addEventListener("click", event => {
    const option = event.target.closest(".people-sort-option");
    if (option) {
        const role = option.dataset.role;
        const key = option.dataset.sortKey;
        if (!roleSortState[role] || !roleSortOptions[role].some(([allowed]) => allowed === key)) return;
        roleSortState[role].key = key;
        renderPeopleSection(role);
        return;
    }
    const orderButton = event.target.closest(".people-sort-order");
    if (orderButton) {
        const role = orderButton.dataset.role;
        if (!roleSortState[role]) return;
        roleSortState[role].order = roleSortState[role].order === "asc" ? "desc" : "asc";
        renderPeopleSection(role);
        return;
    }
    const mainButton = event.target.closest(".people-main-toggle");
    if (mainButton) {
        roleSortState.teacher.mainFirst = !roleSortState.teacher.mainFirst;
        renderPeopleSection("teacher");
    }
});
