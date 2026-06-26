(() => {
    const list = document.getElementById("wall-list");
    const summary = document.getElementById("wall-summary");
    if (!list) return;

    const escapeHtml = (value) => String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const formatTime = (value) => {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("zh-CN", {
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    async function loadApprovedWallMessages() {
        const client = await window.ClassRecordSupabase.getClient();
        const table = window.ClassRecordSupabase.getConfig().tables.wallMessages;
        const { data, error } = await client
            .from(table)
            .select("id,display_name,is_anonymous,body,reviewed_at,created_at")
            .eq("status", "approved")
            .order("reviewed_at", { ascending: false });
        if (error) throw error;
        return data || [];
    }

    async function renderMessages() {
        try {
            const rows = await loadApprovedWallMessages();
            if (summary) summary.textContent = `已展示 ${rows.length} 条审核通过的留言。`;
            list.innerHTML = rows.length ? rows.map((row) => `
                <article class="wall-message">
                    <p>${escapeHtml(row.body)}</p>
                    <footer><strong>${escapeHtml(row.display_name || "匿名同学")}</strong><span>${escapeHtml(formatTime(row.reviewed_at || row.created_at))}</span></footer>
                </article>
            `).join("") : '<div class="record-empty"><strong>还没有留言。</strong><span>第一条通过审核的留言会显示在这里。</span></div>';
        } catch (error) {
            console.warn("留言加载失败：", error);
            list.innerHTML = '<div class="record-empty"><strong>留言加载失败。</strong><span>请稍后刷新重试。</span></div>';
        }
    }

    (window.cacheReadyPromise || Promise.resolve()).then(renderMessages);
})();
