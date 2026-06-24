/************************************************************
 * people.js
 * 人物名单页面
 ************************************************************/

const container = document.getElementById("people-list");

let peopleList = [];
let records = [];
let currentSortKey = "id";
let currentSortOrder = "asc";
let participantCountMap = new Map();
let authorCountMap = new Map();

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
    renderByRole(currentSortKey, currentSortOrder);
});

/* ===============================
   角色显示名映射
   =============================== */
const roleNameMap = {
    student: "同学",
    teacher: "老师",
    other: "其他"
};

/* ===============================
   按角色分组渲染
   =============================== */
function renderByRole(sortKey = "id", sortOrder = "asc") {
    container.innerHTML = "";

    const groups = { student: [], teacher: [], other: [] };

    peopleList.forEach(p => {
        if (groups[p.role]) groups[p.role].push(p);
        else groups.other.push(p);
    });

    Object.keys(groups).forEach(role => {
        const list = sortPeople(groups[role], sortKey, sortOrder);
        if (!list.length) return;

        const section = document.createElement("section");
        section.innerHTML = `
      <h2>${roleNameMap[role]}</h2>
      <table class="people-table">
        <thead>
          <tr>
            <th>序号</th>
            <th>ID</th>
            <th>别名</th>
            <th>参与</th>
            <th>记录</th>
          </tr>
        </thead>
        <tbody>
          ${list.map((p, i) => `
            <tr data-id="${p.id}">
              <td>${i + 1}</td>
              <td>${p.id}</td>
              <td>${parseContent(p.alias) || "-"}</td>
              <td>${countAsParticipant(p.id)}</td>
              <td>${p.role === "student" ? countAsAuthor(p.id) : "-"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
        container.appendChild(section);
    });

    bindRowClick();
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
    const personPattern = /\[\[([a-zA-Z0-9_-]+)\|.+?\]\]/g;

    recordList.forEach((record) => {
        if (record.author) {
            authorCounts.set(record.author, (authorCounts.get(record.author) || 0) + 1);
        }

        const ids = new Set();
        let match = personPattern.exec(record.content || "");
        while (match) {
            ids.add(match[1]);
            match = personPattern.exec(record.content || "");
        }
        ids.forEach((id) => {
            participantCounts.set(id, (participantCounts.get(id) || 0) + 1);
        });
    });

    return { participantCountMap: participantCounts, authorCountMap: authorCounts };
}

/* ===============================
   排序
   =============================== */
function sortPeople(list, key, order) {
    return [...list].sort((a, b) => {
        const get = p => ({
            id: p[key] || "",
            participation: countAsParticipant(p.id),
            record: p.role === "student" ? countAsAuthor(p.id) : 0
        }[key]);

        let A = get(a);
        let B = get(b);

        // id 用字符串比较
        if (key === "id") {
            return order === "asc"
                ? A.localeCompare(B)
                : B.localeCompare(A);
        }

        // 其它字段用数字比较
        return order === "asc" ? A - B : B - A;
    });
}

/* ===============================
   绑定排序按钮
   =============================== */
const sortControls = document.querySelector(".sort-controls");
const sortDropdown = sortControls.querySelector(".sort-dropdown");
const keyTrigger = sortControls.querySelector(".dropdown-trigger");
const keyLabel = keyTrigger.querySelector(".dropdown-label");
const orderToggle = sortControls.querySelector(".sort-order-toggle");

const sortKeyText = {
    id: "按 id",
    participation: "按参与事件数",
    record: "按记录事件数"
};

function updateSortControls() {
    keyTrigger.dataset.value = currentSortKey;
    keyLabel.textContent = sortKeyText[currentSortKey] || "按 id";

    orderToggle.dataset.value = currentSortOrder;
    orderToggle.textContent = currentSortOrder === "asc" ? "升序" : "降序";

    sortControls.querySelectorAll(".sort-option").forEach(option => {
        option.classList.toggle("is-active", option.dataset.value === currentSortKey);
    });
}

sortControls.addEventListener("click", event => {
    const option = event.target.closest(".sort-option");
    if (option) {
        currentSortKey = option.dataset.value || "id";
        closeSortDropdown(false);
        updateSortControls();
        renderByRole(currentSortKey, currentSortOrder);
        return;
    }

    if (event.target.closest(".sort-order-toggle")) {
        currentSortOrder = currentSortOrder === "asc" ? "desc" : "asc";
        updateSortControls();
        renderByRole(currentSortKey, currentSortOrder);
    }
});

const DROPDOWN_CLOSE_DELAY = 140;
let dropdownCloseTimer = null;

function openSortDropdown() {
    if (dropdownCloseTimer) {
        clearTimeout(dropdownCloseTimer);
        dropdownCloseTimer = null;
    }
    sortDropdown.classList.add("is-open");
}

function closeSortDropdown(withDelay = true) {
    if (dropdownCloseTimer) {
        clearTimeout(dropdownCloseTimer);
    }

    if (!withDelay) {
        sortDropdown.classList.remove("is-open");
        dropdownCloseTimer = null;
        return;
    }

    dropdownCloseTimer = setTimeout(() => {
        sortDropdown.classList.remove("is-open");
        dropdownCloseTimer = null;
    }, DROPDOWN_CLOSE_DELAY);
}

sortDropdown.addEventListener("mouseenter", openSortDropdown);
sortDropdown.addEventListener("mouseleave", () => closeSortDropdown(true));

updateSortControls();
