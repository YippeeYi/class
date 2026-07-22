/************************************************************
 * search.js
 * 全站搜索：记录 / 人物 / 名言
 ************************************************************/

(() => {
    const input = document.getElementById("global-search-input");
    const resultsWrap = document.getElementById("search-results");
    const summary = document.getElementById("search-summary");
    const typeControls = document.getElementById("global-search-types");
    const searchPanel = document.getElementById("search-panel");
    const loading = document.getElementById("search-loading");
    if (!input || !resultsWrap) return;

    const typeLabels = {
        record: "记录",
        person: "人物",
        quote: "名言"
    };
    const activeTypes = new Set(Object.keys(typeLabels));
    let searchIndex = [];
    let searchTimer = null;
    let lastRecordedQuery = "";

    function revealSearch() {
        loading?.setAttribute("hidden", "");
        searchPanel?.removeAttribute("hidden");
        resultsWrap.removeAttribute("hidden");
        input.focus?.({ preventScroll: true });
    }

    function showSearchError() {
        loading?.setAttribute("hidden", "");
        resultsWrap.removeAttribute("hidden");
    }

    function escapeHtml(text) {
        return String(text || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    const escapeAttribute = escapeHtml;

    function normalize(text) {
        return stripRecordMarkup(String(text || ""))
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
    }

    function navigate(href) {
        if (typeof window.navigateTo === "function") {
            window.navigateTo(href);
        } else {
            location.href = href;
        }
    }

    function recordHref(record) {
        return `record.html?view=list#${getRecordAnchorId(record)}`;
    }

    function prepareRecordNavigation(href) {
        const url = new URL(href, location.href);
        if (!url.pathname.endsWith("/record.html") && !url.pathname.endsWith("record.html")) return;
        const anchor = url.hash.replace(/^#/, "");
        if (!anchor) return;
        if (typeof window.ClassRecordPrepareRecordJump === "function") {
            window.ClassRecordPrepareRecordJump(anchor, location.href);
            return;
        }
        try {
            sessionStorage.setItem("classrecord:pending-record-jump", JSON.stringify({
                targetAnchorId: anchor,
                originHref: location.href,
                createdAt: Date.now()
            }));
        } catch (error) {
            // Storage may be unavailable; the hash jump still works.
        }
    }

    function buildRecordText(record) {
        return [
            record.id,
            record.fileName,
            record.date,
            record.time,
            record.author,
            record.content,
            ...(record.attachments || []).flatMap((item) => [item.name, item.file])
        ].filter(Boolean).join(" ");
    }

    function makeSnippet(text, query) {
        const plain = stripRecordMarkup(String(text || "")).replace(/\s+/g, " ").trim();
        if (!plain) return "";
        const lower = plain.toLowerCase();
        const key = normalize(query);
        const index = key ? lower.indexOf(key) : -1;
        const start = index >= 0 ? Math.max(0, index - 34) : 0;
        const end = index >= 0 ? Math.min(plain.length, index + key.length + 56) : Math.min(plain.length, 96);
        const head = start > 0 ? "···" : "";
        const tail = end < plain.length ? "···" : "";
        const slice = plain.slice(start, end);
        if (!key || index < 0) return escapeHtml(`${head}${slice}${tail}`);
        const localIndex = index - start;
        return `${escapeHtml(head + slice.slice(0, localIndex))}<mark>${escapeHtml(slice.slice(localIndex, localIndex + key.length))}</mark>${escapeHtml(slice.slice(localIndex + key.length) + tail)}`;
    }

    function quoteHref(quote, records) {
        const recordFile = String(quote?.recordFile || "").replace(/\.json$/i, "");
        if (recordFile) {
            const direct = records.find((record) => String(record.fileName || record.id || "").replace(/\.json$/i, "") === recordFile);
            if (direct) return recordHref(direct);
        }
        const matches = records.filter((record) => extractMentionedQuoteIds(record.content || "").includes(quote.id));
        if (matches.length !== 1) return "";
        return recordHref(matches[0]);
    }

    function buildIndex(records, people, quotes) {
        return [
            ...records.map((record) => ({
                type: "record",
                id: record.id,
                title: `#${record.id} · ${record.date || "未知日期"}`,
                meta: [record.author ? `记录人 ${record.author}` : "", record.time || ""].filter(Boolean).join(" · "),
                text: buildRecordText(record),
                href: recordHref(record),
                sortKey: record.id || record.fileName || ""
            })),
            ...people.map((person) => ({
                type: "person",
                id: person.id,
                title: stripRecordMarkup(person.name || person.alias || person.id),
                richTitle: parseContent(person.name || person.alias || person.id),
                meta: person.role ? `身份 ${person.role}` : "人物条目",
                text: [person.id, person.name, person.alias, person.bio, person.role].filter(Boolean).join(" "),
                href: `person.html?id=${encodeURIComponent(person.id)}`,
                sortKey: person.id || ""
            })),
            ...quotes.map((quote) => ({
                type: "quote",
                id: quote.id,
                title: stripRecordMarkup(quote.quote || quote.id),
                richTitle: formatContent(quote.quote || quote.id),
                meta: quote.sourceDate ? `来源 ${quote.sourceDate}` : "名言条目",
                text: [quote.id, quote.quote, quote.content, quote.sourceDate, ...(quote.relatedPeople || [])].filter(Boolean).join(" "),
                href: quoteHref(quote, records),
                sortKey: quote.sourceDate || quote.id || ""
            }))
        ].map((item) => ({ ...item, normalized: normalize(item.text) }));
    }

    function scoreItem(item, query) {
        const normalizedQuery = normalize(query);
        if (!normalizedQuery) return 0;
        const titleText = normalize(`${item.title} ${item.richTitle || ""}`);
        if (titleText === normalizedQuery) return 100;
        if (titleText.startsWith(normalizedQuery)) return 80;
        if (titleText.includes(normalizedQuery)) return 62;
        if (item.normalized.includes(normalizedQuery)) return 36;
        return 0;
    }

    function renderEmpty(message, hint = "换一个关键词，或打开更多搜索范围后再试。") {
        resultsWrap.innerHTML = `
            <div class="search-empty">
                <strong>${escapeHtml(message)}</strong>
                <span>${escapeHtml(hint)}</span>
            </div>
        `;
    }

    function renderResults() {
        const query = input.value.trim();
        const enabledTypes = new Set(activeTypes);
        const params = new URLSearchParams(location.search);
        if (query) {
            params.set("q", query);
        } else {
            params.delete("q");
        }
        history.replaceState(null, "", `${location.pathname}${params.toString() ? `?${params}` : ""}`);

        if (!query) {
            if (summary) summary.textContent = `已索引 ${searchIndex.length} 个条目。`;
            renderEmpty("输入关键词开始搜索。", "支持记录正文、人物别名、名言内容、日期和作者。");
            return;
        }

        const normalizedQuery = normalize(query);
        if (normalizedQuery && normalizedQuery !== lastRecordedQuery) {
            lastRecordedQuery = normalizedQuery;
        }

        const matches = searchIndex
            .filter((item) => enabledTypes.has(item.type))
            .map((item) => ({ ...item, score: scoreItem(item, query) }))
            .filter((item) => item.score > 0)
            .sort((a, b) => b.score - a.score || b.sortKey.localeCompare(a.sortKey));

        if (summary) {
            summary.textContent = `找到 ${matches.length} 个结果。`;
        }
        if (!matches.length) {
            renderEmpty("没有找到匹配条目。");
            return;
        }

        const grouped = Object.keys(typeLabels).map((type) => ({
            type,
            items: matches.filter((item) => item.type === type)
        })).filter((group) => group.items.length);

        resultsWrap.innerHTML = grouped.map((group) => `
            <section class="search-result-group">
                <h2>${typeLabels[group.type]} <span>${group.items.length}</span></h2>
                <div class="search-result-list">
                    ${group.items.map((item) => `
                        <article class="search-result-card" data-href="${escapeAttribute(item.href || "")}">
                            <div class="search-result-type">${escapeHtml(typeLabels[item.type])}</div>
                            <h3>${item.richTitle || escapeHtml(item.title)}</h3>
                            <p class="search-result-meta">${escapeHtml(item.meta || item.id || "")}</p>
                            <p class="search-result-snippet">${makeSnippet(item.text, query)}</p>
                        </article>
                    `).join("")}
                </div>
            </section>
        `).join("");
    }

    input.addEventListener("input", () => {
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(renderResults, 120);
    });

    typeControls?.addEventListener("click", (event) => {
        const button = event.target.closest(".search-type");
        if (!button) return;
        const type = button.dataset.type;
        if (!type) return;
        if (activeTypes.has(type) && activeTypes.size > 1) {
            activeTypes.delete(type);
        } else {
            activeTypes.add(type);
        }
        button.classList.toggle("is-active", activeTypes.has(type));
        renderResults();
    });

    resultsWrap.addEventListener("click", (event) => {
        const card = event.target.closest(".search-result-card[data-href]");
        if (!card) return;
        if (!card.dataset.href) {
            window.alert("没有找到这条名言对应的记录。");
            return;
        }
        prepareRecordNavigation(card.dataset.href);
        navigate(card.dataset.href);
    });

    (window.cacheReadyPromise || Promise.resolve())
        .then(async () => {
            const [records, people] = await Promise.all([window.loadAllRecords(), window.loadAllPeople()]);
            const quotes = await window.loadAllQuotes({ records });
            return [records, people, quotes];
        })
        .then(([records, people, quotes]) => {
            searchIndex = buildIndex(records, people, quotes);
            const initialQuery = new URLSearchParams(location.search).get("q") || "";
            input.value = initialQuery;
            revealSearch();
            renderResults();
        })
        .catch((error) => {
            window.ClassRecordDiagnostics?.warn("Search data load failed", error);
            if (summary) summary.textContent = "搜索数据加载失败。";
            showSearchError();
            renderEmpty("搜索数据加载失败。", "请刷新页面或清空缓存后重试。");
        });
})();
