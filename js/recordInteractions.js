/************************************************************
 * recordInteractions.js
 * Supabase 记录表情互动
 ************************************************************/

(() => {
    const EMOTIONS = [
        { type: "like", icon: "👍", label: "点赞" },
        { type: "happy", icon: "😃", label: "开心" },
        { type: "surprised", icon: "😲", label: "惊讶" },
        { type: "sad", icon: "😢", label: "难过" },
        { type: "angry", icon: "😠", label: "生气" }
    ];
    const pendingActions = new Set();
    const summaryCache = new Map();

    const escapeHtml = (value) => String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    const escapeAttr = (value) => escapeHtml(value).replace(/`/g, "&#96;");
    const normalizeKey = (value) => String(value || "").trim();
    const getTables = () => window.ClassRecordSupabase?.getConfig().tables || {};
    const getRecordElements = (container) => Array.from(container?.querySelectorAll(".record[data-record-key]") || []);
    const getVisitorKey = () => window.getClassRecordVisitorKey?.() || "session-visitor";

    const emptySummary = (recordKey) => ({
        recordKey,
        emotionCounts: Object.fromEntries(EMOTIONS.map((item) => [item.type, 0])),
        myEmotions: new Set()
    });

    const queryChunks = async (items, query) => {
        const chunkSize = 120;
        const output = [];
        for (let i = 0; i < items.length; i += chunkSize) {
            const rows = await query(items.slice(i, i + chunkSize));
            output.push(...rows);
        }
        return output;
    };

    const loadSummaries = async (recordKeys) => {
        const keys = Array.from(new Set(recordKeys.map(normalizeKey).filter(Boolean)));
        if (!keys.length || !window.ClassRecordSupabase?.isConfigured()) return new Map();
        const client = await window.ClassRecordSupabase.getClient();
        const visitorKey = getVisitorKey();
        const summaries = new Map(keys.map((key) => [key, emptySummary(key)]));
        const validTypes = new Set(EMOTIONS.map((item) => item.type));

        const reactions = await queryChunks(keys, async (chunk) => {
            const { data, error } = await client
                .from(getTables().reactions)
                .select("record_key,type,actor_key")
                .in("record_key", chunk)
                .in("type", [...validTypes]);
            if (error) throw error;
            return data || [];
        });

        reactions.forEach((row) => {
            const type = String(row.type || "");
            if (!validTypes.has(type)) return;
            const item = summaries.get(row.record_key);
            if (!item) return;
            item.emotionCounts[type] = (item.emotionCounts[type] || 0) + 1;
            if (row.actor_key === visitorKey) item.myEmotions.add(type);
        });

        summaries.forEach((value, key) => summaryCache.set(key, value));
        return summaries;
    };

    const renderEmotionButton = (emotion, summary) => {
        const count = Number(summary.emotionCounts[emotion.type]) || 0;
        const active = summary.myEmotions.has(emotion.type);
        return `
            <button type="button" class="record-social-btn record-emotion-btn${active ? " is-active" : ""}" data-action="toggle-reaction" data-type="${escapeAttr(emotion.type)}" aria-label="${escapeAttr(emotion.label)}" aria-pressed="${active}">
                <span class="record-social-emoji" aria-hidden="true">${emotion.icon}</span>${count ? `<strong>${count}</strong>` : ""}
            </button>
        `;
    };

    const renderSummary = (recordEl, summary) => {
        const group = recordEl.querySelector("[data-emotion-group]");
        const popover = recordEl.querySelector("[data-emotion-popover]");
        const moreBtn = recordEl.querySelector('[data-action="open-emotions"]');
        const visible = EMOTIONS.filter((emotion) => (summary.emotionCounts[emotion.type] || 0) > 0 || summary.myEmotions.has(emotion.type));
        const hidden = EMOTIONS.filter((emotion) => !visible.some((item) => item.type === emotion.type));
        if (group) {
            group.innerHTML = visible.map((emotion) => renderEmotionButton(emotion, summary)).join("");
        }
        if (popover) {
            popover.innerHTML = hidden.length
                ? hidden.map((emotion) => renderEmotionButton(emotion, summary)).join("")
                : '<span class="record-social-empty">所有表情都已显示。</span>';
        }
        if (moreBtn) {
            moreBtn.hidden = hidden.length === 0;
            moreBtn.setAttribute("aria-expanded", String(popover && !popover.hidden));
        }
    };

    const showStatus = (recordEl, message, tone = "info") => {
        const status = recordEl.querySelector(".record-social-status");
        if (!status) return;
        status.textContent = message || "";
        status.dataset.tone = tone;
        window.clearTimeout(status._clearTimer);
        if (message) {
            status._clearTimer = window.setTimeout(() => {
                status.textContent = "";
                status.dataset.tone = "";
            }, 1600);
        }
    };

    const refreshRecordSummary = async (recordEl) => {
        const key = normalizeKey(recordEl.dataset.recordKey);
        const summaries = await loadSummaries([key]);
        renderSummary(recordEl, summaries.get(key) || emptySummary(key));
    };

    const toggleReaction = async (recordEl, type) => {
        if (!EMOTIONS.some((emotion) => emotion.type === type)) return;
        const key = normalizeKey(recordEl.dataset.recordKey);
        const visitorKey = getVisitorKey();
        const actionKey = `${key}:${visitorKey}:${type}`;
        if (pendingActions.has(actionKey)) return;
        pendingActions.add(actionKey);
        const client = await window.ClassRecordSupabase.getClient();
        const summary = summaryCache.get(key) || emptySummary(key);
        const active = summary.myEmotions.has(type);
        const optimistic = {
            ...summary,
            emotionCounts: { ...summary.emotionCounts },
            myEmotions: new Set(summary.myEmotions)
        };
        if (active) optimistic.myEmotions.delete(type);
        else optimistic.myEmotions.add(type);
        optimistic.emotionCounts[type] = Math.max(0, (optimistic.emotionCounts[type] || 0) + (active ? -1 : 1));
        summaryCache.set(key, optimistic);
        renderSummary(recordEl, optimistic);

        try {
            if (active) {
                const { error } = await client
                    .from(getTables().reactions)
                    .delete()
                    .eq("record_key", key)
                    .eq("type", type)
                    .eq("actor_key", visitorKey);
                if (error) throw error;
            } else {
                const { error } = await client
                    .from(getTables().reactions)
                    .upsert({ record_key: key, type, actor_key: visitorKey }, { onConflict: "record_key,actor_key,type" });
                if (error) throw error;
            }
            showStatus(recordEl, active ? "已取消。" : "已记录。", active ? "info" : "success");
            await refreshRecordSummary(recordEl);
        } catch (error) {
            summaryCache.set(key, summary);
            renderSummary(recordEl, summary);
            console.warn("记录表情写入失败：", { recordKey: key, type, error });
            showStatus(recordEl, "表情保存失败，请稍后重试。", "error");
        } finally {
            pendingActions.delete(actionKey);
        }
    };

    const shareRecord = async (recordEl) => {
        const anchor = recordEl.id ? `#${recordEl.id}` : "";
        const url = `${location.origin}${location.pathname}${location.search}${anchor}`;
        if (navigator.share) {
            try {
                await navigator.share({ title: "编日史记录", url });
                showStatus(recordEl, "分享已打开。", "success");
                return;
            } catch (error) {
                if (error?.name === "AbortError") return;
            }
        }
        try {
            await navigator.clipboard.writeText(url);
            showStatus(recordEl, "链接已复制。", "success");
        } catch (error) {
            showStatus(recordEl, `复制失败，请手动复制：${url}`, "error");
        }
    };

    const bindContainer = (container) => {
        if (!container || container.dataset.recordInteractionsBound === "true") return;
        container.dataset.recordInteractionsBound = "true";
        container.addEventListener("click", async (event) => {
            const button = event.target.closest("[data-action]");
            if (!button) return;
            const recordEl = button.closest(".record[data-record-key]");
            if (!recordEl) return;
            if (button.dataset.action === "toggle-reaction") {
                await toggleReaction(recordEl, button.dataset.type);
                recordEl.querySelector("[data-emotion-popover]")?.setAttribute("hidden", "");
                return;
            }
            if (button.dataset.action === "open-emotions") {
                const popover = recordEl.querySelector("[data-emotion-popover]");
                if (!popover) return;
                popover.hidden = !popover.hidden;
                button.setAttribute("aria-expanded", String(!popover.hidden));
                return;
            }
            if (button.dataset.action === "share-record") {
                await shareRecord(recordEl);
            }
        });
    };

    const hydrate = async (container, records) => {
        const recordEls = getRecordElements(container);
        if (!recordEls.length) return;
        bindContainer(container);
        const keys = records?.map((record) => record.fileName || record.id) || recordEls.map((el) => el.dataset.recordKey);
        if (!window.ClassRecordSupabase?.isConfigured()) {
            recordEls.forEach((el) => renderSummary(el, emptySummary(el.dataset.recordKey)));
            return;
        }
        try {
            const summaries = await loadSummaries(keys);
            recordEls.forEach((el) => {
                const key = normalizeKey(el.dataset.recordKey);
                renderSummary(el, summaries.get(key) || emptySummary(key));
            });
        } catch (error) {
            console.warn("记录表情加载失败：", error);
        }
    };

    window.RecordInteractions = { hydrate, refreshRecord: refreshRecordSummary, emotions: EMOTIONS };
})();
