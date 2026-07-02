(() => {
    const overview = document.getElementById('timeline-overview');
    const yearsWrap = document.getElementById('timeline-years');
    const yearOverview = document.getElementById('timeline-year-overview');
    const monthsWrap = document.getElementById('timeline-months');
    const detail = document.getElementById('timeline-detail');
    const summary = document.getElementById('timeline-summary');
    if (!overview || !yearsWrap || !yearOverview || !monthsWrap || !detail) return;

    let records = [];
    let people = [];
    let glossary = [];
    let months = [];
    let years = [];
    let activeYear = '';
    let activeMonth = '';
    let activeDay = '';
    let knownPeopleIds = new Set();

    const MONTH_LABELS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

    function escapeHtml(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function navigate(href) {
        if (typeof window.navigateTo === 'function') window.navigateTo(href);
        else location.href = href;
    }

    function recordHref(record) {
        return `record.html#${getRecordAnchorId(record)}`;
    }

    function parseRecordDate(record) {
        const dateSource = [record?.date, record?.fileName, record?.id]
            .filter(Boolean)
            .map(String)
            .join(' ');
        const match = /(\d{4})-(\d{2})-(\d{2})/.exec(dateSource);
        if (!match) return null;
        const month = Number(match[2]);
        const day = Number(match[3]);
        if (month < 1 || month > 12 || day < 1 || day > 31) return null;
        return { year: match[1], month: match[2], day: match[3], key: `${match[1]}-${match[2]}` };
    }

    function countMapValue(map, key, amount = 1) {
        if (!key) return;
        map.set(key, (map.get(key) || 0) + amount);
    }

    function extractIds(record, pattern) {
        const ids = new Set();
        let match = pattern.exec(record.content || '');
        while (match) {
            ids.add(match[1]);
            match = pattern.exec(record.content || '');
        }
        return [...ids];
    }

    function isKnownPersonId(id) {
        return Boolean(id) && (!knownPeopleIds.size || knownPeopleIds.has(id));
    }

    function extractPeople(record) {
        const ids = new Set(extractIds(record, /\[\[([a-zA-Z0-9_-]+)\|.+?\]\]/g));
        if (record.author) ids.add(record.author);
        return [...ids].filter(isKnownPersonId);
    }

    function extractTerms(record) {
        return extractIds(record, /\{\{([a-zA-Z0-9_-]+)\|.+?\}\}/g);
    }

    function getPersonLabel(id) {
        if (!id || id === 'unknown') return '未知记录人';
        const person = people.find((item) => item.id === id);
        return stripRecordMarkup(person?.alias || id);
    }

    function getTermLabel(id) {
        const term = glossary.find((item) => item.id === id);
        return stripRecordMarkup(term?.term || term?.title || id);
    }

    function topEntries(map, count = 3) {
        return [...map.entries()]
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .slice(0, count);
    }

    function formatPercent(value, total) {
        if (!total) return '0%';
        return `${Math.round(value / total * 100)}%`;
    }

    function formatMonthTitle(key) {
        const [year, month] = String(key || '').split('-');
        return year && month ? `${year} 年 ${month} 月` : String(key || '--');
    }
    function getMonthDayCount(month) {
        const year = Number(month?.year);
        const monthNumber = Number(month?.month);
        if (!Number.isInteger(year) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
            return 31;
        }
        return new Date(year, monthNumber, 0).getDate();
    }

    function padDay(day) {
        return String(day).padStart(2, '0');
    }
    function chartScale(maxValue, steps = 4) {
        const safeSteps = Math.max(1, Number(steps) || 4);
        const rawMax = Math.max(0, Number(maxValue) || 0);
        if (rawMax === 0) {
            return Array.from({ length: safeSteps + 1 }, (_, index) => safeSteps - index);
        }
        const roughStep = rawMax / safeSteps;
        const magnitude = 10 ** Math.floor(Math.log10(roughStep));
        const normalized = roughStep / magnitude;
        const niceStep = Math.max(1, (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude);
        const niceMax = Math.max(niceStep * safeSteps, Math.ceil(rawMax / (niceStep * safeSteps)) * niceStep * safeSteps);
        return Array.from({ length: safeSteps + 1 }, (_, index) => Math.round((niceMax - niceStep * index) * 100) / 100);
    }
    function renderChartScale(maxValue) {
        return `<div class="timeline-chart-scale" aria-hidden="true">${chartScale(maxValue).map((value) => `<span>${Math.round(value)}</span>`).join('')}</div>`;
    }

    function renderBarChart(items, { title, label = '', valueSuffix = '', full = false, dataKey = '' } = {}) {
        const maxValue = Math.max(0, ...items.map((item) => Number(item.value) || 0));
        const scaleMax = chartScale(maxValue)[0] || 1;
        const bars = items.map((item) => {
            const value = Number(item.value) || 0;
            const height = Math.max(value ? 8 : 2, Math.round(value / scaleMax * 100));
            const dataAttribute = value > 0 && dataKey && item[dataKey] ? ` data-${dataKey}="${escapeHtml(item[dataKey])}"` : '';
            const disabledAttribute = value > 0 ? '' : ' disabled aria-disabled="true"';
            return `
                <button type="button" class="timeline-chart-bar${value ? '' : ' is-empty'}"${dataAttribute}${disabledAttribute} title="${escapeHtml(item.label)}：${value}${escapeHtml(valueSuffix)}">
                    <i style="height:${height}%"></i>
                    <em>${escapeHtml(item.shortLabel || item.label)}</em>
                </button>
            `;
        }).join('');
        return `
            <section class="timeline-chart-card timeline-bar-card${full ? ' timeline-chart-card--full' : ''}" aria-label="${escapeHtml(title || '柱形图')}">
                <header><h3>${escapeHtml(title || '柱形图')}</h3>${label ? `<p>${escapeHtml(label)}</p>` : ''}</header>
                <div class="timeline-chart-plot">
                    ${renderChartScale(maxValue)}
                    <div class="timeline-chart-bars">${bars}</div>
                </div>
            </section>
        `;
    }

    function renderAuthorPie(recordList, title, { dayOptions = [] } = {}) {
        const counts = new Map();
        recordList.forEach((record) => countMapValue(counts, String(record.author || '').trim() || 'unknown'));
        const entries = topEntries(counts, Number.MAX_SAFE_INTEGER);
        const total = entries.reduce((sum, [, count]) => sum + count, 0);
        const palette = ['#6f8fe8', '#e8899f', '#65b7a5', '#e4ad58', '#9a7bd1', '#6da7cf', '#d07f69', '#82a85d'];
        let cursor = 0;
        const segments = entries.map(([id, count], index) => {
            const start = cursor;
            cursor += total ? count / total * 100 : 0;
            return `${palette[index % palette.length]} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
        });
        const legend = entries.map(([id, count], index) => `
            <li><i style="--legend-color:${palette[index % palette.length]}"></i><span>${escapeHtml(getPersonLabel(id))}</span><strong>${count} · ${formatPercent(count, total)}</strong></li>
        `).join('');
        const dayButtons = dayOptions.length ? `<div class="timeline-author-day-options" aria-label="选择日期">${dayOptions.map((day) => `<button type="button" class="${day === activeDay ? 'is-active' : ''}" data-author-day="${day}">${day}</button>`).join('')}</div>` : '';
        return `
            <section class="timeline-chart-card timeline-pie-card timeline-author-pie-card" aria-label="${escapeHtml(title)}">
                <header><h3>${escapeHtml(title)}</h3><p>${total ? `${entries.length} 位记录人 · ${total} 条记录` : '暂无记录人数据'}</p></header>
                ${dayButtons}
                <div class="timeline-author-pie-body">
                    <div class="timeline-pie timeline-author-pie" style="background:${segments.length ? `conic-gradient(${segments.join(',')})` : 'var(--theme-surface-strong)'}"><strong>${total}</strong></div>
                    <ul class="timeline-author-legend">${legend || '<li class="is-empty">暂无可统计数据</li>'}</ul>
                </div>
            </section>
        `;
    }

    function getTopLabel(map, type) {
        const top = topEntries(map, 1)[0];
        if (!top) return '--';
        const label = type === 'term' ? getTermLabel(top[0]) : getPersonLabel(top[0]);
        return `${escapeHtml(label)} · ${top[1]}`;
    }

    function summarizeRecords(recordList) {
        const summary = {
            records: [...recordList],
            important: [],
            authors: new Map(),
            people: new Map(),
            terms: new Map()
        };
        recordList.forEach((record) => {
            if (record.importance === 'important') summary.important.push(record);
            countMapValue(summary.authors, String(record.author || '').trim() || 'unknown');
            extractPeople(record).forEach((id) => countMapValue(summary.people, id));
            extractTerms(record).forEach((id) => countMapValue(summary.terms, id));
        });
        return summary;
    }

    function buildTimelineData() {
        const monthGroups = new Map();
        records.forEach((record) => {
            const date = parseRecordDate(record);
            if (!date) return;
            const group = monthGroups.get(date.key) || {
                key: date.key,
                year: date.year,
                month: date.month,
                records: []
            };
            group.records.push(record);
            monthGroups.set(date.key, group);
        });

        months = [...monthGroups.values()]
            .map((group) => ({
                ...group,
                ...summarizeRecords(group.records),
                records: [...group.records].sort((a, b) => String(b.id).localeCompare(String(a.id)))
            }))
            .sort((a, b) => b.key.localeCompare(a.key));

        const yearGroups = new Map();
        months.forEach((month) => {
            const group = yearGroups.get(month.year) || { key: month.year, records: [], months: [] };
            group.records.push(...month.records);
            group.months.push(month);
            yearGroups.set(month.year, group);
        });

        years = [...yearGroups.values()]
            .map((group) => ({
                ...group,
                ...summarizeRecords(group.records),
                months: [...group.months].sort((a, b) => a.key.localeCompare(b.key))
            }))
            .sort((a, b) => b.key.localeCompare(a.key));
    }

    function getActiveYear() {
        return years.find((item) => item.key === activeYear) || years[0] || null;
    }

    function getActiveYearMonths() {
        const year = getActiveYear();
        return year ? year.months : [];
    }

    function createEmptyMonth(key) {
        const match = /^(\d{4})-(\d{2})$/.exec(String(key || ''));
        if (!match) return null;
        const monthNumber = Number(match[2]);
        if (monthNumber < 1 || monthNumber > 12) return null;
        return {
            key,
            year: match[1],
            month: match[2],
            records: [],
            important: [],
            authors: new Map(),
            people: new Map(),
            terms: new Map()
        };
    }

    function getActiveMonth() {
        const yearMonths = getActiveYearMonths();
        const existing = yearMonths.find((item) => item.key === activeMonth);
        if (existing) return existing;
        const year = getActiveYear();
        if (year && /^\d{4}-\d{2}$/.test(activeMonth) && activeMonth.startsWith(`${year.key}-`)) {
            return createEmptyMonth(activeMonth);
        }
        return yearMonths[yearMonths.length - 1] || months[0] || null;
    }
    function renderOverview() {
        const totalImportant = records.filter((record) => record.importance === 'important').length;
        const latestMonth = months[0];
        const activePeople = new Set(records.flatMap(extractPeople)).size;
        const monthTrend = [...months]
            .sort((a, b) => a.key.localeCompare(b.key))
            .map((month) => ({ label: month.key, shortLabel: month.key.slice(5), value: month.records.length, month: month.key }));
        overview.innerHTML = `
            <article class="archive-stat-card">
                <span>记录</span>
                <strong>${records.length}</strong>
            </article>
            <article class="archive-stat-card">
                <span>月份</span>
                <strong>${months.length}</strong>
            </article>
            <article class="archive-stat-card">
                <span>重要</span>
                <strong>${totalImportant}</strong>
            </article>
            <article class="archive-stat-card">
                <span>人物</span>
                <strong>${activePeople}</strong>
            </article>
            <article class="archive-stat-card archive-stat-card--wide">
                <span>最新月份</span>
                <strong>${latestMonth ? `${latestMonth.key} · ${latestMonth.records.length} 条` : '--'}</strong>
            </article>
            <div class="timeline-chart-grid timeline-chart-grid--overview">
                ${renderBarChart(monthTrend, { title: '月度记录柱形图', valueSuffix: ' 条', dataKey: 'month' })}
                ${renderAuthorPie(records, '整体记录人占比')}
            </div>
        `;
    }
    function renderYears() {
        yearsWrap.innerHTML = `
            <header class="timeline-step-head">
                <span>1</span>
                <div>
                    <h2>选择年份</h2>
                    <p>先确定年份，再进入月份统计。</p>
                </div>
            </header>
            <div class="timeline-year-strip">
                ${years.map((year) => `
                    <button type="button" class="timeline-year-card${year.key === activeYear ? ' is-active' : ''}" data-year="${year.key}">
                        <span class="timeline-year-key">${year.key}</span>
                        <strong>${year.records.length}</strong>
                        <span>${year.months.length} 个月</span>
                    </button>
                `).join('')}
            </div>
        `;
    }
    function renderYearOverview() {
        const year = getActiveYear();
        if (!year) {
            yearOverview.innerHTML = '<div class="record-empty"><strong>暂无年度数据。</strong><span>有效日期记录会显示在这里。</span></div>';
            return;
        }

        const byMonth = new Map(year.months.map((item) => [item.month, item]));
        yearOverview.innerHTML = `
            <header class="timeline-step-head">
                <span>2</span>
                <div>
                    <h2>选择月份</h2>
                    <p>${year.key} 年 12 个月都可查看，无记录月份会显示全月 0。</p>
                </div>
                <button type="button" class="btn-action" data-open-year="${year.key}">打开本年记录</button>
            </header>
            <div class="timeline-month-picker">
                ${MONTH_LABELS.map((month) => {
                    const item = byMonth.get(month);
                    const key = item?.key || `${year.key}-${month}`;
                    return `
                        <button type="button" class="timeline-month-pill${key === activeMonth ? ' is-active' : ''}${item ? '' : ' is-empty'}" data-month="${key}"${item ? '' : ' disabled aria-disabled="true"'}>
                            <strong>${month}</strong>
                            <span>${item ? `${item.records.length} 条` : '0 条'}</span>
                        </button>
                    `;
                }).join('')}
            </div>
            <div class="timeline-chart-grid timeline-chart-grid--overview">
                ${renderAuthorPie(year.records, `${year.key} 年记录人占比`)}
            </div>
        `;
    }
    function renderMonths() {
        const month = getActiveMonth();
        monthsWrap.innerHTML = `
            <section class="timeline-month-list-panel timeline-current-month-panel">
                <header class="timeline-step-head timeline-step-head--small">
                    <span>3</span>
                    <div>
                        <h2>查看每日统计</h2>
                        <p>当前月份：${formatMonthTitle(month?.key)}，下方显示完整日历。</p>
                    </div>
                </header>
            </section>
        `;
    }
    function renderDetail() {
        const month = getActiveMonth();
        if (!month) {
            detail.innerHTML = '<div class="record-empty"><strong>暂无记录。</strong><span>数据加载完成后会在这里显示月度统计。</span></div>';
            return;
        }
        activeMonth = month.key;
        activeYear = month.year;
        const peopleChips = topEntries(month.people, 10).map(([id, count]) => `<button type="button" class="timeline-chip" data-person="${escapeHtml(id)}">${escapeHtml(getPersonLabel(id))}<span>${count}</span></button>`).join('');
        const authorChips = topEntries(month.authors, 8).map(([id, count]) => `<button type="button" class="timeline-chip" data-person="${escapeHtml(id)}">${escapeHtml(getPersonLabel(id))}<span>${count}</span></button>`).join('');
        const termChips = topEntries(month.terms, 8).map(([id, count]) => `<button type="button" class="timeline-chip" data-term="${escapeHtml(id)}">${escapeHtml(getTermLabel(id))}<span>${count}</span></button>`).join('');
        const plainLengths = month.records.map((record) => stripRecordMarkup(record.content || '').length);
        const avgLength = plainLengths.length ? Math.round(plainLengths.reduce((sum, item) => sum + item, 0) / plainLengths.length) : 0;
        const recordsByDay = new Map();
        month.records.forEach((record) => {
            const date = parseRecordDate(record);
            if (!date) return;
            const list = recordsByDay.get(date.day) || [];
            list.push(record);
            recordsByDay.set(date.day, list);
        });
        const activeDays = recordsByDay.size;
        const availableDays = [...recordsByDay.keys()].sort();
        if (!recordsByDay.has(activeDay)) activeDay = availableDays[availableDays.length - 1] || '';
        const activeDayRecords = recordsByDay.get(activeDay) || [];
        const dayCount = getMonthDayCount(month);
        const daySeries = Array.from({ length: dayCount }, (_, index) => {
            const day = padDay(index + 1);
            const dayRecords = recordsByDay.get(day) || [];
            return { label: `${day} 日`, shortLabel: day, value: dayRecords.length, day, important: dayRecords.filter((record) => record.importance === 'important').length };
        });
        const calendarCells = daySeries.map((day) => `
                <button type="button" class="timeline-calendar-day${day.value ? '' : ' is-empty'}${day.important ? ' has-important' : ''}"${day.value ? ` data-day="${day.shortLabel}"` : ' disabled aria-disabled="true"'} aria-label="${day.value ? `打开 ${month.key}-${day.shortLabel} 的记录` : `${month.key}-${day.shortLabel} 无记录`}">
                    <span>${day.shortLabel}</span>
                    <strong>${day.value}</strong>
                    <em>${day.important ? `重要 ${day.important}` : ' '}</em>
                </button>
            `).join('');

        detail.innerHTML = `
            <header class="timeline-detail-head">
                <div>
                    <h2>${formatMonthTitle(month.key)} 每日统计</h2>
                    <p>${month.records.length} 条记录，覆盖 ${activeDays} / ${dayCount} 天，平均正文 ${avgLength} 字。</p>
                </div>
                <button type="button" class="btn-action" data-open-month="${month.key}">打开本月记录</button>
            </header>
            <section class="timeline-month-stat-grid" aria-label="${formatMonthTitle(month.key)} 统计摘要">
                <article><span>记录总数</span><strong>${month.records.length}</strong></article>
                <article><span>重要记录</span><strong>${month.important.length}</strong></article>
                <article><span>重要占比</span><strong>${formatPercent(month.important.length, month.records.length)}</strong></article>
                <article><span>有记录天数</span><strong>${activeDays}</strong></article>
                <article><span>全月天数</span><strong>${dayCount}</strong></article>
                <article><span>活跃人物</span><strong>${month.people.size}</strong></article>
                <article><span>记录人</span><strong>${month.authors.size}</strong></article>
                <article><span>高频术语</span><strong>${month.terms.size}</strong></article>
            </section>
            <div class="timeline-chart-grid">
                ${renderBarChart(daySeries, { title: '每日记录柱形图', valueSuffix: ' 条', full: true, dataKey: 'day' })}
                ${renderAuthorPie(month.records, `${formatMonthTitle(month.key)}记录人占比`)}
                ${renderAuthorPie(activeDayRecords, `${month.key}-${activeDay || '--'} 记录人占比`, { dayOptions: availableDays })}
            </div>
            <section class="timeline-insight-card timeline-calendar-card">
                <header class="timeline-calendar-head">
                    <h3>每日记录分布</h3>
                </header>
                <div class="timeline-calendar-grid">${calendarCells}</div>
            </section>
            <div class="timeline-insight-grid">
                <section class="timeline-insight-card">
                    <h3>活跃人物</h3>
                    <div class="timeline-chip-list">${peopleChips || '<span class="timeline-muted">暂无人物标记</span>'}</div>
                </section>
                <section class="timeline-insight-card">
                    <h3>记录人</h3>
                    <div class="timeline-chip-list">${authorChips || '<span class="timeline-muted">暂无记录人</span>'}</div>
                </section>
                <section class="timeline-insight-card">
                    <h3>高频术语</h3>
                    <div class="timeline-chip-list">${termChips || '<span class="timeline-muted">暂无术语标记</span>'}</div>
                </section>
            </div>

        `;
    }
    function renderAll() {
        renderOverview();
        renderYears();
        renderYearOverview();
        renderMonths();
        renderDetail();
    }

    function selectMonth(monthKey) {
        if (!/^\d{4}-\d{2}$/.test(monthKey)) return;
        activeMonth = monthKey;
        activeYear = monthKey.slice(0, 4);
        activeDay = '';
        renderYears();
        renderYearOverview();
        renderMonths();
        renderDetail();
    }

    overview.addEventListener('click', (event) => {
        const monthBar = event.target.closest('[data-month]');
        if (!monthBar) return;
        selectMonth(monthBar.dataset.month);
    });

    yearsWrap.addEventListener('click', (event) => {
        const button = event.target.closest('[data-year]');
        if (!button) return;
        activeYear = button.dataset.year;
        activeDay = '';
        const year = getActiveYear();
        activeMonth = year?.months[year.months.length - 1]?.key || '';
        renderYears();
        renderYearOverview();
        renderMonths();
        renderDetail();
    });

    yearOverview.addEventListener('click', (event) => {
        const yearButton = event.target.closest('[data-open-year]');
        if (yearButton) {
            navigate(`record.html?year=${encodeURIComponent(yearButton.dataset.openYear)}`);
            return;
        }
        const monthButton = event.target.closest('[data-month]');
        if (monthButton && !monthButton.disabled) {
            selectMonth(monthButton.dataset.month);
        }
        const personButton = event.target.closest('[data-person]');
        if (personButton) navigate(`person.html?id=${encodeURIComponent(personButton.dataset.person)}`);
        const termButton = event.target.closest('[data-term]');
        if (termButton) navigate(`term.html?id=${encodeURIComponent(termButton.dataset.term)}`);
    });

    monthsWrap.addEventListener('click', (event) => {
        const button = event.target.closest('[data-month]');
        if (!button || button.disabled) return;
        selectMonth(button.dataset.month);
    });

    detail.addEventListener('click', (event) => {
        const authorDayButton = event.target.closest('[data-author-day]');
        if (authorDayButton) {
            activeDay = authorDayButton.dataset.authorDay;
            renderDetail();
            return;
        }
        const monthButton = event.target.closest('[data-open-month]');
        if (monthButton) {
            const [year, month] = monthButton.dataset.openMonth.split('-');
            navigate(`record.html?year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}`);
            return;
        }
        const dayButton = event.target.closest('[data-day]');
        if (dayButton) {
            const month = getActiveMonth();
            if (month) {
                navigate(`record.html?year=${encodeURIComponent(month.year)}&month=${encodeURIComponent(month.month)}&day=${encodeURIComponent(dayButton.dataset.day)}`);
            }
            return;
        }
        const personButton = event.target.closest('[data-person]');
        if (personButton) {
            navigate(`person.html?id=${encodeURIComponent(personButton.dataset.person)}`);
            return;
        }
        const termButton = event.target.closest('[data-term]');
        if (termButton) {
            navigate(`term.html?id=${encodeURIComponent(termButton.dataset.term)}`);
            return;
        }
        const card = event.target.closest('[data-href]');
        if (card) navigate(card.dataset.href);
    });

    (window.cacheReadyPromise || Promise.resolve())
        .then(() => Promise.all([window.loadAllRecords(), window.loadAllPeople(), window.loadAllGlossary()]))
        .then(([recordList, peopleList, glossaryList]) => {
            records = [...recordList];
            people = [...peopleList];
            knownPeopleIds = new Set(people.map((person) => person.id).filter(Boolean));
            glossary = [...glossaryList];
            buildTimelineData();
            const params = new URLSearchParams(location.search);
            activeYear = params.get('year') || years[0]?.key || '';
            activeMonth = params.get('month') || '';
            if (activeMonth && /^\d{2}$/.test(activeMonth)) activeMonth = `${activeYear}-${activeMonth}`;
            if (!years.some((item) => item.key === activeYear)) activeYear = years[0]?.key || '';
            if (!months.some((item) => item.key === activeMonth)) {
                const year = getActiveYear();
                const isValidEmptyMonth = year && /^\d{4}-\d{2}$/.test(activeMonth) && activeMonth.startsWith(`${year.key}-`);
                if (!isValidEmptyMonth) {
                    activeMonth = year?.months[year.months.length - 1]?.key || months[0]?.key || '';
                }
            }
            if (summary) summary.textContent = `已整理 ${years.length} 个年份、${months.length} 个月份、${records.length} 条记录。`;
            renderAll();
        })
        .catch((error) => {
            console.warn('时间线加载失败：', error);
            detail.innerHTML = '<div class="record-empty"><strong>时间线加载失败。</strong><span>请刷新页面或清空缓存后重试。</span></div>';
        });
})();
