/************************************************************
 * materials.js
 * 资料页面
 ************************************************************/

(() => {
    const listHost = document.getElementById("materials-list");
    const contentHost = document.getElementById("materials-content");
    if (!listHost || !contentHost) return;

    let materials = [];
    let activeId = "";

    function renderList() {
        listHost.innerHTML = materials.map((item) => `
            <button type="button" class="material-list-item${item.id === activeId ? " is-active" : ""}" data-id="${escapeRecordAttribute(item.id)}">
                ${escapeRecordText(item.title || item.id)}
            </button>
        `).join("");
    }

    function renderContent() {
        const item = materials.find((entry) => entry.id === activeId);
        if (!item) {
            contentHost.innerHTML = '<div class="materials-placeholder">请选择资料</div>';
            return;
        }
        contentHost.innerHTML = `
            <article class="material-detail">
                <h2>${escapeRecordText(item.title || item.id)}</h2>
                <div class="material-detail-content">${formatContent(item.content || "")}</div>
            </article>
        `;
    }

    listHost.addEventListener("click", (event) => {
        const button = event.target.closest("[data-id]");
        if (!button) return;
        activeId = button.dataset.id || "";
        renderList();
        renderContent();
    });

    (window.cacheReadyPromise || Promise.resolve())
        .then(() => loadAllMaterials())
        .then((items) => {
            materials = items;
            const requestedId = new URLSearchParams(location.search).get("id") || "";
            activeId = materials.some((item) => item.id === requestedId) ? requestedId : (materials[0]?.id || "");
            if (requestedId && activeId !== requestedId) {
                console.warn(`Material not found: ${requestedId}`);
            }
            if (!materials.length) {
                listHost.innerHTML = "";
                contentHost.innerHTML = '<div class="materials-placeholder">暂无资料</div>';
                return;
            }
            renderList();
            renderContent();
        })
        .catch((error) => {
            window.ClassRecordDiagnostics?.warn("Material load failed", error);
            contentHost.innerHTML = '<div class="record-empty"><strong>资料加载失败。</strong><span>请检查 Supabase 资料表。</span></div>';
        });
})();
