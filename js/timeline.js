function buildFixedTimelineChartScale(maxValue, baseMax, step) {
    const safeStep = Math.max(1, Number(step) || 1);
    const safeBaseMax = Math.max(safeStep, Number(baseMax) || safeStep);
    const dataMax = Math.max(0, Number(maxValue) || 0);
    const scaleMax = dataMax > safeBaseMax ? Math.ceil(dataMax / safeStep) * safeStep : safeBaseMax;
    return Array.from({ length: Math.round(scaleMax / safeStep) + 1 }, (_, index) => scaleMax - safeStep * index);
}

window.ClassRecordFixedChartScale = buildFixedTimelineChartScale;

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
    let quotes = [];
    let months = [];
    let years = [];
    let activeYear = '';
    let activeMonth = '';
    let knownPeopleIds = new Set();

    const MONTH_LABELS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    let authorColorMap = new Map();
    let pieScopeSequence = 0;

    function createPieScope(prefix = 'chart') {
        pieScopeSequence += 1;
        return `${prefix}-${pieScopeSequence}`;
    }

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

    function isKnownPersonId(id) {
        return Boolean(id) && (!knownPeopleIds.size || knownPeopleIds.has(id));
    }

    function extractPeople(record) {
        return getRecordParticipantIds(record).filter(isKnownPersonId);
    }

    function extractQuotes(record) {
        return extractMentionedQuoteIds(record.content || '');
    }

    function getPersonLabel(id) {
        if (id === '__other__') return '其他';
        if (!id || id === 'unknown') return '未知记录人';
        const person = people.find((item) => item.id === id);
        return stripRecordMarkup(person?.name || person?.alias || id);
    }

    function getQuoteLabel(id) {
        const quote = quotes.find((item) => item.id === id);
        return stripRecordMarkup(quote?.quote || quote?.title || id);
    }

    function quoteRecordHref(id) {
        const quote = quotes.find((item) => item.id === id);
        const recordFile = String(quote?.recordFile || '').replace(/\.json$/i, '');
        if (recordFile) {
            const direct = records.find((record) => String(record.fileName || record.id || '').replace(/\.json$/i, '') === recordFile);
            if (direct) return recordHref(direct);
        }
        const matches = records.filter((record) => extractMentionedQuoteIds(record.content || '').includes(id));
        return matches.length === 1 ? recordHref(matches[0]) : '';
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
    function renderChartScale(values) {
        return `<div class="timeline-chart-scale" aria-hidden="true">${values.map((value) => `<span>${Math.round(value)}</span>`).join('')}</div>`;
    }

    function renderBarChart(items, { title, label = '', valueSuffix = '', full = false, dataKey = '', fixedMax = 0, fixedStep = 0 } = {}) {
        const maxValue = Math.max(0, ...items.map((item) => Number(item.value) || 0));
        const scaleValues = fixedMax && fixedStep ? buildFixedTimelineChartScale(maxValue, fixedMax, fixedStep) : chartScale(maxValue);
        const scaleMax = scaleValues[0] || 1;
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
                    ${renderChartScale(scaleValues)}
                    <div class="timeline-chart-bars">${bars}</div>
                </div>
            </section>
        `;
    }

    function getAuthorId(record) {
        return String(record?.author || '').trim() || 'unknown';
    }

    function getAuthorColor(id) {
        if (id === '__other__') return '#7c8799';
        return authorColorMap.get(id) || '#3978d4';
    }

    function buildAuthorColor(index) {
        const palette = [
            '#3978d4', '#e56b36', '#2ca46f', '#d84f91',
            '#16a6b6', '#d94b4b', '#7b61d1', '#d5a51f',
            '#2369a8', '#ef8f2f', '#238b57', '#b946a8'
        ];
        if (index < palette.length) return palette[index];
        const generatedIndex = index - palette.length;
        const hue = (205 + generatedIndex * 137.508) % 360;
        const saturation = 66 + (generatedIndex % 3) * 5;
        const lightness = generatedIndex % 2 ? 58 : 52;
        return `hsl(${hue.toFixed(1)} ${saturation}% ${lightness}%)`;
    }

    function getPieColor(id, index, type) {
        if (id === '__other__') return getAuthorColor(id);
        return isSummaryPieType(type) ? buildAuthorColor(index) : getAuthorColor(id);
    }

    function isSummaryPieType(type) {
        return type === 'overall' || type === 'yearly' || type === 'monthly';
    }

    function mergeSummaryAuthorEntries(entries, maxSlices = 6) {
        if (entries.length <= maxSlices) return entries;
        const visible = entries.slice(0, maxSlices - 1);
        const otherCount = entries.slice(maxSlices - 1).reduce((sum, [, count]) => sum + count, 0);
        return [...visible, ['__other__', otherCount]];
    }

    function getAuthorDistribution(recordList, { type = 'daily' } = {}) {
        const counts = new Map();
        recordList.forEach((record) => countMapValue(counts, getAuthorId(record)));
        const allEntries = topEntries(counts, Number.MAX_SAFE_INTEGER);
        const total = allEntries.reduce((sum, [, count]) => sum + count, 0);
        const entries = isSummaryPieType(type) ? mergeSummaryAuthorEntries(allEntries) : allEntries;
        return { entries, allEntries, total };
    }

    function getPiePoint(angle, radius = 49) {
        const radians = (angle - 90) * Math.PI / 180;
        return {
            x: 50 + radius * Math.cos(radians),
            y: 50 + radius * Math.sin(radians)
        };
    }

    function getPieSlicePath(startAngle, endAngle) {
        const start = getPiePoint(startAngle);
        const end = getPiePoint(endAngle);
        const largeArc = endAngle - startAngle > 180 ? 1 : 0;
        return `M 50 50 L ${start.x.toFixed(4)} ${start.y.toFixed(4)} A 49 49 0 ${largeArc} 1 ${end.x.toFixed(4)} ${end.y.toFixed(4)} Z`;
    }

    function renderAuthorPieSvg(entries, total, { compact = false, type = 'daily', scopeId = '', chartKind = type } = {}) {
        if (!total) return '';
        const scopeAttribute = scopeId ? ` data-pie-scope="${escapeHtml(scopeId)}"` : '';
        const kindAttribute = ` data-chart-kind="${escapeHtml(chartKind)}"`;
        const svgClass = `timeline-pie-svg${chartKind === 'daily' ? ' timeline-pie-svg--daily' : ''}`;
        const highlightStroke = compact ? 1.5 : 2.6;
        const styleAttribute = ` style="--pie-highlight-stroke:${highlightStroke}"`;
        if (entries.length === 1) {
            return `<svg class="${svgClass}" viewBox="0 0 100 100" aria-hidden="true" focusable="false"${scopeAttribute}${kindAttribute}${styleAttribute}><circle class="timeline-pie-slice" data-pie-slice data-slice-key="${escapeHtml(entries[0][0])}" cx="50" cy="50" r="49" fill="${getPieColor(entries[0][0], 0, type)}" stroke="white" stroke-width="${compact ? 0.55 : 1.2}" vector-effect="non-scaling-stroke"></circle></svg>`;
        }
        let angle = 0;
        const paths = entries.map(([id, count], index) => {
            const start = angle;
            angle = index === entries.length - 1 ? 360 : angle + count / total * 360;
            return `<path class="timeline-pie-slice" data-pie-slice data-slice-key="${escapeHtml(id)}" d="${getPieSlicePath(start, angle)}" fill="${getPieColor(id, index, type)}" stroke="white" stroke-width="${compact ? 0.55 : 1.2}" stroke-linejoin="round" vector-effect="non-scaling-stroke"></path>`;
        }).join('');
        return `<svg class="${svgClass}" viewBox="0 0 100 100" aria-hidden="true" focusable="false"${scopeAttribute}${kindAttribute}${styleAttribute}>${paths}</svg>`;
    }

    function renderAuthorLegend(recordList, className = 'timeline-author-legend', { showValues = true, type = 'daily', scopeId = '' } = {}) {
        const { entries, total } = getAuthorDistribution(recordList, { type });
        const legend = entries.map(([id, count], index) => `
            <li class="${showValues ? 'has-values' : ''}"${scopeId ? ` data-pie-legend-item data-pie-scope="${escapeHtml(scopeId)}" data-slice-key="${escapeHtml(id)}" tabindex="0"` : ''}><i style="--legend-color:${getPieColor(id, index, type)}"></i><span class="timeline-author-legend-name">${escapeHtml(getPersonLabel(id))}</span>${showValues ? `<span class="timeline-author-legend-count">${count} 条</span><span class="timeline-author-legend-percent">${formatPercent(count, total)}</span>` : ''}</li>
        `).join('');
        return `<ul class="${className}">${legend || '<li class="is-empty">暂无可统计数据</li>'}</ul>`;
    }

    function renderAuthorPie(recordList, title, type) {
        const { entries, allEntries, total } = getAuthorDistribution(recordList, { type });
        const scopeId = createPieScope(type || 'summary');
        return `
            <section class="timeline-chart-card timeline-pie-card timeline-author-pie-card" data-pie-chart="${scopeId}" aria-label="${escapeHtml(title)}">
                <header><h3>${escapeHtml(title)}</h3><p>${total ? `${allEntries.length} 位记录人 · ${total} 条记录` : '暂无记录人数据'}</p></header>
                <div class="timeline-author-pie-body">
                    <div class="timeline-pie timeline-author-pie">${renderAuthorPieSvg(entries, total, { type, scopeId })}<strong>${total}</strong></div>
                    ${renderAuthorLegend(recordList, 'timeline-author-legend', { type, scopeId })}
                </div>
            </section>
        `;
    }

    function getTopLabel(map, type) {
        const top = topEntries(map, 1)[0];
        if (!top) return '--';
        const label = type === 'quote' ? getQuoteLabel(top[0]) : getPersonLabel(top[0]);
        return `${escapeHtml(label)} · ${top[1]}`;
    }

    function summarizeRecords(recordList) {
        const summary = {
            records: [...recordList],
            important: [],
            authors: new Map(),
            people: new Map(),
            quotes: new Map()
        };
        recordList.forEach((record) => {
            if (record.importance === 'important') summary.important.push(record);
            countMapValue(summary.authors, String(record.author || '').trim() || 'unknown');
            extractPeople(record).forEach((id) => countMapValue(summary.people, id));
            extractQuotes(record).forEach((id) => countMapValue(summary.quotes, id));
        });
        return summary;
    }

    function buildTimelineData() {
        const authorIds = [...new Set(records.map(getAuthorId))].sort((a, b) => a.localeCompare(b));
        authorColorMap = new Map(authorIds.map((id, index) => [id, buildAuthorColor(index)]));
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
            quotes: new Map()
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
        const activePeople = new Set(records.flatMap(extractPeople)).size;
        const monthTrend = [...months]
            .sort((a, b) => a.key.localeCompare(b.key))
            .map((month) => ({ label: month.key, shortLabel: month.key.slice(5), value: month.records.length, month: month.key }));
        overview.innerHTML = `
            <div class="timeline-overview-stats">
                <article class="archive-stat-card"><span>记录</span><strong>${records.length}</strong></article>
                <article class="archive-stat-card"><span>月份</span><strong>${months.length}</strong></article>
                <article class="archive-stat-card"><span>重要</span><strong>${totalImportant}</strong></article>
                <article class="archive-stat-card"><span>人物</span><strong>${activePeople}</strong></article>
                <article class="archive-stat-card"><span>名言</span><strong>${quotes.length}</strong></article>
            </div>
            <div class="timeline-chart-grid timeline-chart-grid--overview">
                ${renderAuthorPie(records, '整体记录人占比', 'overall')}
                ${renderBarChart(monthTrend, { title: '月度记录柱形图', valueSuffix: ' 条', dataKey: 'month', fixedMax: 100, fixedStep: 25 })}
            </div>
        `;
    }
    function renderYears() {
        const year = getActiveYear();
        yearsWrap.innerHTML = `
            <div class="timeline-period-layout timeline-period-layout--year">
                <div class="timeline-period-chart">
                    ${year ? renderAuthorPie(year.records, `${year.key} 年记录人占比`, 'yearly') : ''}
                </div>
                <div class="timeline-period-controls">
                    <div class="timeline-period-actions">
                        ${year ? `<button type="button" class="btn-action" data-open-year="${year.key}">打开本年记录</button>` : ''}
                    </div>
                    <div class="timeline-year-strip">
                        ${years.map((item) => `
                            <button type="button" class="timeline-year-card${item.key === activeYear ? ' is-active' : ''}" data-year="${item.key}">
                                <span class="timeline-year-key">${item.key}</span>
                                <span>${item.records.length} 条</span>
                            </button>
                        `).join('')}
                    </div>
                </div>
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
        const month = getActiveMonth();
        yearOverview.innerHTML = `
            <div class="timeline-period-layout timeline-period-layout--month">
                <div class="timeline-period-chart">
                    ${renderAuthorPie(month?.records || [], `${formatMonthTitle(month?.key)}记录人占比`, 'monthly')}
                </div>
                <div class="timeline-period-controls">
                    <div class="timeline-period-actions">
                        ${month ? `<button type="button" class="btn-action" data-open-month="${month.key}">打开本月记录</button>` : ''}
                    </div>
                    <div class="timeline-month-picker">
                        ${MONTH_LABELS.map((monthNumber) => {
                            const item = byMonth.get(monthNumber);
                            const key = item?.key || `${year.key}-${monthNumber}`;
                            return `
                                <button type="button" class="timeline-month-pill${key === activeMonth ? ' is-active' : ''}${item ? '' : ' is-empty'}" data-month="${key}"${item ? '' : ' disabled aria-disabled="true"'}>
                                    <strong>${monthNumber}</strong>
                                    <span>${item ? `${item.records.length} 条` : '0 条'}</span>
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    }
    function renderMonths() {
        monthsWrap.innerHTML = '';
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
        const quoteChips = topEntries(month.quotes, 8).map(([id, count]) => `<button type="button" class="timeline-chip" data-quote="${escapeHtml(id)}">${escapeHtml(getQuoteLabel(id))}<span>${count}</span></button>`).join('');
        const plainLengths = month.records.map((record) => countRecordTextCharacters(record.content || ''));
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
        const dayCount = getMonthDayCount(month);
        const daySeries = Array.from({ length: dayCount }, (_, index) => {
            const day = padDay(index + 1);
            const dayRecords = recordsByDay.get(day) || [];
            return { label: `${day} 日`, shortLabel: day, value: dayRecords.length, day, important: dayRecords.filter((record) => record.importance === 'important').length };
        });
        const dailyPieScope = createPieScope('daily');
        const calendarCells = daySeries.map((day) => {
            const dayRecords = recordsByDay.get(day.day) || [];
            const pie = getAuthorDistribution(dayRecords, { type: 'daily' });
            return `
                <button type="button" class="timeline-calendar-day${day.value ? '' : ' is-empty'}${day.important ? ' has-important' : ''}"${day.value ? ` data-day="${day.shortLabel}"` : ' disabled aria-disabled="true"'} aria-label="${day.value ? `打开 ${month.key}-${day.shortLabel} 的记录` : `${month.key}-${day.shortLabel} 无记录`}">
                    <span>${day.shortLabel}</span>
                    <strong>${day.value}</strong>
                    ${day.value ? `<i class="timeline-day-author-pie" aria-hidden="true">${renderAuthorPieSvg(pie.entries, pie.total, { compact: true, scopeId: dailyPieScope })}</i>` : ''}
                    <em>${day.important ? `重要 ${day.important}` : ' '}</em>
                </button>
            `;
        }).join('');

        detail.innerHTML = `
            <section class="timeline-month-stat-grid" aria-label="${formatMonthTitle(month.key)} 统计摘要">
                <article><span>记录总数</span><strong>${month.records.length}</strong></article>
                <article><span>重要记录</span><strong>${month.important.length}</strong></article>
                <article><span>有记录天数</span><strong>${activeDays}</strong></article>
                <article><span>全月天数</span><strong>${dayCount}</strong></article>
                <article><span>活跃人物</span><strong>${month.people.size}</strong></article>
                <article><span>记录人</span><strong>${month.authors.size}</strong></article>
                <article><span>高频名言</span><strong>${month.quotes.size}</strong></article>
                <article><span>平均正文</span><strong>${avgLength} 字</strong></article>
            </section>
            <div class="timeline-chart-grid">
                ${renderBarChart(daySeries, { title: '每日记录柱形图', valueSuffix: ' 条', full: true, dataKey: 'day', fixedMax: 12, fixedStep: 3 })}
            </div>
            <section class="timeline-insight-card timeline-calendar-card">
                <header class="timeline-calendar-head">
                    <h3>每日记录分布</h3>
                </header>
                <div class="timeline-calendar-grid">${calendarCells}</div>
                <div class="timeline-calendar-legend">
                    <span>记录人</span>
                    ${renderAuthorLegend(month.records, 'timeline-author-legend timeline-author-legend--calendar', { showValues: false, scopeId: dailyPieScope })}
                </div>
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
                    <h3>高频名言</h3>
                    <div class="timeline-chip-list">${quoteChips || '<span class="timeline-muted">暂无名言标记</span>'}</div>
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
        renderYears();
        renderYearOverview();
        renderMonths();
        renderDetail();
    }

    function setPieLegendHighlight(legendItem, active) {
        const scopeId = legendItem?.dataset.pieScope;
        const sliceKey = legendItem?.dataset.sliceKey;
        if (!scopeId || !sliceKey) return;

        document.querySelectorAll('[data-pie-legend-item]').forEach((item) => {
            if (item.dataset.pieScope === scopeId) {
                item.classList.toggle('is-active', active && item === legendItem);
            }
        });
        document.querySelectorAll('.timeline-pie-svg[data-pie-scope]').forEach((svg) => {
            if (svg.dataset.pieScope !== scopeId) return;
            svg.querySelectorAll('[data-pie-slice]').forEach((slice) => {
                slice.classList.toggle('is-highlighted', active && slice.dataset.sliceKey === sliceKey);
            });
        });
    }

    document.addEventListener('pointerover', (event) => {
        const item = event.target.closest('[data-pie-legend-item]');
        if (!item || (event.relatedTarget?.nodeType && item.contains(event.relatedTarget))) return;
        setPieLegendHighlight(item, true);
    });

    document.addEventListener('pointerout', (event) => {
        const item = event.target.closest('[data-pie-legend-item]');
        if (!item || (event.relatedTarget?.nodeType && item.contains(event.relatedTarget))) return;
        setPieLegendHighlight(item, false);
    });

    document.addEventListener('focusin', (event) => {
        const item = event.target.closest('[data-pie-legend-item]');
        if (item) setPieLegendHighlight(item, true);
    });

    document.addEventListener('focusout', (event) => {
        const item = event.target.closest('[data-pie-legend-item]');
        if (item) setPieLegendHighlight(item, false);
    });

    overview.addEventListener('click', (event) => {
        const monthBar = event.target.closest('[data-month]');
        if (!monthBar) return;
        selectMonth(monthBar.dataset.month);
    });

    yearsWrap.addEventListener('click', (event) => {
        const openYearButton = event.target.closest('[data-open-year]');
        if (openYearButton) {
            navigate(`record.html?year=${encodeURIComponent(openYearButton.dataset.openYear)}`);
            return;
        }
        const button = event.target.closest('[data-year]');
        if (!button) return;
        activeYear = button.dataset.year;
        const year = getActiveYear();
        activeMonth = year?.months[year.months.length - 1]?.key || '';
        renderYears();
        renderYearOverview();
        renderMonths();
        renderDetail();
    });

    yearOverview.addEventListener('click', (event) => {
        const openMonthButton = event.target.closest('[data-open-month]');
        if (openMonthButton) {
            const [year, month] = openMonthButton.dataset.openMonth.split('-');
            navigate(`record.html?year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}`);
            return;
        }
        const monthButton = event.target.closest('[data-month]');
        if (monthButton && !monthButton.disabled) {
            selectMonth(monthButton.dataset.month);
        }
        const personButton = event.target.closest('[data-person]');
        if (personButton) navigate(`person.html?id=${encodeURIComponent(personButton.dataset.person)}`);
        const quoteButton = event.target.closest('[data-quote]');
        if (quoteButton) {
            const href = quoteRecordHref(quoteButton.dataset.quote);
            if (href) navigate(href);
            else window.alert('没有找到这条名言对应的记录。');
        }
    });

    monthsWrap.addEventListener('click', (event) => {
        const button = event.target.closest('[data-month]');
        if (!button || button.disabled) return;
        selectMonth(button.dataset.month);
    });

    detail.addEventListener('click', (event) => {
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
        const quoteButton = event.target.closest('[data-quote]');
        if (quoteButton) {
            const href = quoteRecordHref(quoteButton.dataset.quote);
            if (href) navigate(href);
            else window.alert('没有找到这条名言对应的记录。');
            return;
        }
        const card = event.target.closest('[data-href]');
        if (card) navigate(card.dataset.href);
    });

    (window.cacheReadyPromise || Promise.resolve())
        .then(() => Promise.all([window.loadAllRecords(), window.loadAllPeople(), window.loadAllQuotes()]))
        .then(([recordList, peopleList, quotesList]) => {
            records = [...recordList];
            people = [...peopleList];
            knownPeopleIds = new Set(people.map((person) => person.id).filter(Boolean));
            quotes = [...quotesList];
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
