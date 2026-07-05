/************************************************************
 * people.js
 * 人物名单页面
 ************************************************************/

const container = document.getElementById("people-list");

let peopleList = [];
let records = [];
let participantCountMap = new Map();
let authorCountMap = new Map();

const roleSortState = {
    student: { key: "id", order: "asc" },
    teacher: { key: "id", order: "asc", mainFirst: false },
    other: { key: "id", order: "asc" }
};

const roleSortOptions = {
    student: [
        ["id", "id"],
        ["participation", "参与事件数"],
        ["record", "记录事件数"]
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
    ({ participantCountMap, authorCountMap } = buildPeopleStats(records));
    renderByRole();
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

/* ===============================
   按角色分组渲染
   =============================== */
function renderByRole() {
    container.innerHTML = "";

    const groups = { student: [], teacher: [], other: [] };

    peopleList.forEach(p => {
        if (groups[p.role]) groups[p.role].push(p);
        else groups.other.push(p);
    });

    Object.keys(groups).forEach(role => {
        const state = roleSortState[role];
        const list = sortPeople(groups[role], state, role);
        if (!list.length) return;

        const section = document.createElement("section");
        const roleSpecificHeader = role === "student"
            ? "<th>记录</th>"
            : role === "teacher" ? "<th>学科</th>" : "";
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
            <th>序号</th>
            <th>姓名</th>
            <th>别名</th>
            <th>参与</th>
            ${roleSpecificHeader}
          </tr>
        </thead>
        <tbody>
          ${list.map((p, i) => `
            <tr data-id="${p.id}" class="${role === "teacher" && p.main === true ? "people-row-main-teacher" : ""}">
              <td>${i + 1}</td>
              <td>${parseContent(getPersonDisplayName(p)) || "-"}</td>
              <td>${parseContent(p.alias) || "-"}</td>
              <td>${countAsParticipant(p.id)}</td>
              ${role === "student" ? `<td>${countAsAuthor(p.id)}</td>` : ""}
              ${role === "teacher" ? `<td>${parseContent(p.subject || "") || "—"}</td>` : ""}
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
        container.appendChild(section);
    });

    bindRowClick();
    bindRoleSortDropdowns();
}

function bindRoleSortDropdowns() {
    container.querySelectorAll(".sort-dropdown").forEach((dropdown) => {
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
function bindRowClick() {
    document.querySelectorAll(".people-table tbody tr").forEach(tr => {
        tr.onclick = () => {
            const href = `person.html?id=${tr.dataset.id}`;
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

function buildPeopleStats(recordList) {
    const participantCounts = new Map();
    const authorCounts = new Map();

    recordList.forEach((record) => {
        getRecordAuthorIds(record).forEach((id) => {
            authorCounts.set(id, (authorCounts.get(id) || 0) + 1);
        });
        getRecordParticipantIds(record).forEach((id) => {
            participantCounts.set(id, (participantCounts.get(id) || 0) + 1);
        });
    });

    return { participantCountMap: participantCounts, authorCountMap: authorCounts };
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
        if (key === "participation" || key === "record") {
            const getCount = key === "record" ? countAsAuthor : countAsParticipant;
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
        renderByRole();
        return;
    }
    const orderButton = event.target.closest(".people-sort-order");
    if (orderButton) {
        const role = orderButton.dataset.role;
        if (!roleSortState[role]) return;
        roleSortState[role].order = roleSortState[role].order === "asc" ? "desc" : "asc";
        renderByRole();
        return;
    }
    const mainButton = event.target.closest(".people-main-toggle");
    if (mainButton) {
        roleSortState.teacher.mainFirst = !roleSortState.teacher.mainFirst;
        renderByRole();
    }
});
