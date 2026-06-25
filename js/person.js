/************************************************************
 * person.js
 * 浜虹墿涓汉椤甸潰锛堜娇鐢?CacheLoader + Store锛? ************************************************************/

const params = new URLSearchParams(location.search);
const personId = params.get("id");

if (!personId) {
    alert("鏈寚瀹氫汉鐗?ID");
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


function renderPersonReviewTools(person) {
    const info = document.querySelector('.person-info');
    if (!info || !window.ClassRecordSupabase?.isConfigured()) return;
    const tools = document.createElement('section');
    tools.className = 'person-review-tools';
    tools.innerHTML = `
        <h2>认领与资料编辑</h2>
        <p>认领和资料编辑都会提交给管理员审核，审核通过后才会更新正式资料。</p>
        <div class="person-review-actions">
            <button type="button" class="btn-action" data-person-claim>认领自己</button>
            <button type="button" class="btn-action" data-person-edit>申请编辑资料</button>
        </div>
        <form class="person-edit-form" hidden>
            <input name="displayName" maxlength="32" placeholder="显示名">
            <input name="alias" maxlength="120" placeholder="别名" value="${String(person.alias || '').replace(/"/g, '&quot;')}">
            <textarea name="bio" maxlength="1000" rows="4" placeholder="简介">${String(person.bio || '')}</textarea>
            <button type="submit" class="btn-action">提交编辑申请</button>
        </form>
        <p class="person-review-status" aria-live="polite"></p>
    `;
    info.after(tools);
    const status = tools.querySelector('.person-review-status');
    const submitRow = async (tableKey, fallback, payload) => {
        const client = await window.ClassRecordSupabase.getClient();
        const table = window.ClassRecordSupabase.getConfig().tables[tableKey] || fallback;
        const { error } = await client.from(table).insert({ user_id: window.getCurrentUser?.()?.id, person_id: person.id, ...payload, status: 'pending' });
        if (error) throw error;
    };
    tools.querySelector('[data-person-claim]').addEventListener('click', async () => {
        try {
            await submitRow('personClaims', 'person_claim_requests', {});
            status.textContent = '认领申请已提交，等待管理员审核。';
            status.dataset.tone = 'success';
        } catch (error) {
            status.textContent = error?.message || '认领申请提交失败。';
            status.dataset.tone = 'error';
        }
    });
    tools.querySelector('[data-person-edit]').addEventListener('click', () => {
        const form = tools.querySelector('.person-edit-form');
        form.hidden = !form.hidden;
    });
    tools.querySelector('.person-edit-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        try {
            await submitRow('personEdits', 'person_edit_requests', {
                display_name: form.displayName.value.trim(),
                alias: form.alias.value.trim(),
                bio: form.bio.value.trim()
            });
            form.hidden = true;
            status.textContent = '编辑申请已提交，等待管理员审核。';
            status.dataset.tone = 'success';
        } catch (error) {
            status.textContent = error?.message || '编辑申请提交失败。';
            status.dataset.tone = 'error';
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
    document.getElementById("person-alias").innerHTML = `<strong>${parseContent(person.alias || "—")}</strong>`;
    document.getElementById("person-bio").innerHTML = `<strong>${formatContent(person.bio || "—")}</strong>`;

    renderPersonReviewTools(person);

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
