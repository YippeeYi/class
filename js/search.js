/************************************************************
 * search.js
 * 全站搜索：记录 / 人物 / 术语
 ************************************************************/

(() => {
    const input = document.getElementById("global-search-input");
    const resultsWrap = document.getElementById("search-results");
    const summary = document.getElementById("search-summary");
    const typeControls = document.getElementById("global-search-types");
    if (!input || !resultsWrap) return;

    const typeLabels = {
        record: "记录",
        person: "人物",
        term: "术语"
    };
    const activeTypes = new Set(Object.keys(typeLabels));
    let searchIndex = [];
    let searchTimer = null;
    let lastRecordedQuery = "";

    function escapeHtml(text) {
        return String(text || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

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
        return `record.html#${getRecordAnchorId(record)}`;
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
        const head = start > 0 ? "…" : "";
        const tail = end < plain.length ? "…" : "";
        const slice = plain.slice(start, end);
        if (!key || index < 0) return escapeHtml(`${head}${slice}${tail}`);
        const localIndex = index - start;
        return `${escapeHtml(head + slice.slice(0, localIndex))}<mark>${escapeHtml(slice.slice(localIndex, localIndex + key.length))}</mark>${escapeHtml(slice.slice(localIndex + key.length) + tail)}`;
    }

    function buildIndex(records, people, glossary) {
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
                title: person.id,
                richTitle: parseContent(person.alias || person.id),
                meta: person.role ? `身份 ${person.role}` : "人物条目",
                text: [person.id, person.alias, person.bio, person.role].filter(Boolean).join(" "),
                href: `person.html?id=${encodeURIComponent(person.id)}`,
                sortKey: person.id || ""
            })),
            ...glossary.map((term) => ({
                type: "term",
                id: term.id,
                title: stripRecordMarkup(term.term || term.id),
                richTitle: formatContent(term.term || term.id),
                meta: term.since ? `起源 ${term.since}` : "术语条目",
                text: [term.id, term.term, term.definition, term.since, ...(term.relatedPeople || [])].filter(Boolean).join(" "),
                href: `term.html?id=${encodeURIComponent(term.id)}`,
                sortKey: term.since || term.id || ""
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
            renderEmpty("输入关键词开始搜索。", "支持记录正文、人物别名、术语定义、日期和作者。");
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
            .sort((a, b) => b.score - a.score || b.sortKey.localeCompare(a.sortKey))
            .slice(0, 80);

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
                        <article class="search-result-card" data-href="${item.href}">
                            <div class="search-result-type">${typeLabels[item.type]}</div>
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
        navigate(card.dataset.href);
    });

    (window.cacheReadyPromise || Promise.resolve())
        .then(() => Promise.all([window.loadAllRecords(), window.loadAllPeople(), window.loadAllGlossary()]))
        .then(([records, people, glossary]) => {
            searchIndex = buildIndex(records, people, glossary);
            const initialQuery = new URLSearchParams(location.search).get("q") || "";
            input.value = initialQuery;
            renderResults();
        })
        .catch((error) => {
            console.warn("全站搜索加载失败：", error);
            if (summary) summary.textContent = "搜索数据加载失败。";
            renderEmpty("搜索数据加载失败。", "请刷新页面或清空缓存后重试。");
        });
})();
