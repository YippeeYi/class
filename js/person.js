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

function currentUserOwnsPerson(person, user, requests) {
    if (!person || !user) return false;
    if (person.claimedBy && person.claimedBy === user.id) return true;
    return Boolean(requests?.personClaims?.some((row) => row.person_id === person.id && row.user_id === user.id && row.status === "approved"));
}

function getClaimStatusLabel(status) {
    const labels = {
        pending: "待审核",
        approved: "已通过",
        rejected: "已驳回"
    };
    return labels[status] || "暂无";
}

async function signPersonAvatar(avatar) {
    if (!avatar) return "";
    if (/^https?:\/\//i.test(avatar)) return avatar;
    return window.ClassRecordData?.signAssetUrl?.(avatar, { quiet: true }).catch(() => "") || "";
}

async function renderPersonAvatar(person, isClaimed) {
    const info = document.querySelector(".person-info");
    if (!info) return;
    document.querySelector(".person-avatar-card")?.remove();
    info.classList.remove("has-person-avatar");
    if (!isClaimed) return;
    const avatar = person.avatarUrl || person.avatar_url || person.avatar || "";
    if (!avatar) return;
    const src = await signPersonAvatar(avatar);
    if (!src) return;
    const card = document.createElement("div");
    card.className = "person-avatar-card";
    card.innerHTML = `<img src="${escapeHtml(src)}" alt="${escapeHtml(person.name || person.id)}" loading="lazy" decoding="async">`;
    card.querySelector("img")?.addEventListener("error", () => {
        card.remove();
        info.classList.remove("has-person-avatar");
    }, { once: true });
    info.prepend(card);
    info.classList.add("has-person-avatar");
}

function validateAvatarFile(file) {
    if (!file) throw new Error("请选择头像图片。");
    if (!file.type || !file.type.startsWith("image/")) throw new Error("请上传图片文件。");
    if (file.size > 500 * 1024) throw new Error("头像不能超过 500KB。");
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            if (img.naturalWidth !== img.naturalHeight) {
                reject(new Error("头像必须是正方形图片。"));
                return;
            }
            resolve();
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("无法读取图片尺寸。"));
        };
        img.src = url;
    });
}

function avatarExtension(file) {
    const map = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
    return map[file.type] || "img";
}

async function updatePersonAvatar(person, user, file) {
    await validateAvatarFile(file);
    const path = `images/avatars/${user.id}/${person.id}.${avatarExtension(file)}`;
    const uploadedPath = await window.ClassRecordData.uploadAssetFile(path, file, { contentType: file.type, upsert: true });
    const client = await window.ClassRecordSupabase.getClient();
    const table = window.ClassRecordSupabase.getConfig().tables.people || "class_people";
    const { data, error } = await client
        .from(table)
        .update({ avatar_url: uploadedPath, updated_at: new Date().toISOString() })
        .eq("id", person.id)
        .eq("claimed_by", user.id)
        .select("id,avatar_url")
        .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("只有已认领该人物的账号才能更新头像。");
    person.avatarUrl = data.avatar_url || uploadedPath;
    return person.avatarUrl;
}

async function renderPersonReviewStatus(person) {
    const info = document.querySelector(".person-info");
    if (!info || document.querySelector(".person-review-panel")) return;
    const panel = document.createElement("section");
    panel.className = "person-review-panel";
    panel.innerHTML = `<p class="person-review-status" aria-live="polite">正在读取认领状态...</p>`;
    info.appendChild(panel);

    const user = await window.ClassRecordSupabase.getUser().catch(() => null);
    if (!user) {
        panel.querySelector(".person-review-status").textContent = "请先登录后查看认领状态。";
        await renderPersonAvatar(person, false);
        return;
    }

    const requests = await window.ReviewSystem?.listMyRequests?.({ personId: person.id }).catch(() => null);
    const claim = requests?.personClaims?.[0];
    const edit = requests?.personEdits?.[0];
    const isClaimed = currentUserOwnsPerson(person, user, requests);
    const status = panel.querySelector(".person-review-status");
    status.textContent = isClaimed
        ? "已认领成功。"
        : `认领审核：${getClaimStatusLabel(claim?.status)}；资料编辑审核：${getClaimStatusLabel(edit?.status)}。`;

    if (!isClaimed) {
        if (claim?.status !== "pending") {
            const form = document.createElement("form");
            form.innerHTML = `
                <label>认领说明<textarea name="note" rows="2" maxlength="300" placeholder="可填写你与这个人物的关系或说明"></textarea></label>
                <button type="submit" class="btn-action">申请认领</button>
            `;
            form.addEventListener("submit", async (event) => {
                event.preventDefault();
                const button = form.querySelector("button");
                button.disabled = true;
                try {
                    await window.ReviewSystem.submitPersonClaim({ personId: person.id, note: form.elements.note.value });
                    status.textContent = "认领申请已提交，等待管理员审核。";
                    form.remove();
                } catch (error) {
                    alert(error?.message || "认领申请提交失败。");
                    button.disabled = false;
                }
            });
            panel.appendChild(form);
        }
        await renderPersonAvatar(person, false);
        return;
    }

    const tools = document.createElement("div");
    tools.className = "person-avatar-tools";
    tools.innerHTML = `
        <label>上传头像<input type="file" accept="image/*"></label>
        <span class="person-review-status" data-avatar-status>头像需不超过 500KB，且必须是正方形。</span>
    `;
    const input = tools.querySelector("input");
    const avatarStatus = tools.querySelector("[data-avatar-status]");
    input.addEventListener("change", async () => {
        const file = input.files?.[0];
        if (!file) return;
        input.disabled = true;
        avatarStatus.textContent = "正在校验并上传头像...";
        try {
            await updatePersonAvatar(person, user, file);
            avatarStatus.textContent = "头像已更新。";
            await renderPersonAvatar(person, true);
        } catch (error) {
            avatarStatus.textContent = error?.message || "头像上传失败。";
            input.value = "";
        } finally {
            input.disabled = false;
        }
    });
    panel.appendChild(tools);
    await renderPersonAvatar(person, true);
}

const cacheReady = window.cacheReadyPromise || Promise.resolve();

cacheReady.then(() => Promise.all([loadAllPeople({ force: true }), loadAllRecords()])).then(([people, records]) => {
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
}).catch((error) => {
    console.error("Person page load failed:", error);
    recordContainer.innerHTML = `<div class="record-empty"><strong>页面加载失败。</strong><span>${escapeHtml(error?.message || "")}</span></div>`;
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
