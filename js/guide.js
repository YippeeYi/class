/************************************************************
 * guide.js
 * 导览页面逻辑
 ************************************************************/

(() => {
    const progressWrap = document.getElementById('guide-progress');
    const progressFill = document.getElementById('guide-progress-fill');
    const progressText = document.getElementById('guide-progress-text');
    const secondaryPanel = document.querySelector('.guide-secondary-panel');
    const todayLink = document.getElementById('guide-today-link');

    const resetGuideScroll = () => {
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        window.scrollTo(0, 0);
    };

    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    resetGuideScroll();
    window.addEventListener('pageshow', resetGuideScroll);

    const setProgress = (value) => {
        const percent = Math.max(0, Math.min(100, Math.round(value * 100)));
        if (progressFill) progressFill.style.width = `${percent}%`;
        if (progressText) progressText.textContent = `数据加载中 ${percent}%`;
    };

    let tipTimer = null;
    const startTipRotation = (tipEl) => {
        const tips = [
            '小提示：人物页支持多维排序，适合快速找人。',
            '小提示：记录页可以按时间、重要性和收藏筛选。',
            '小提示：术语页可以快速补齐班级黑话背景。',
            '小提示：记录正文里的人名和术语都可以点击跳转。',
            '小提示：答题获得的 Q 币可以在商店兑换背景。'
        ];
        if (!tipEl) return;
        let currentIndex = Math.floor(Math.random() * tips.length);
        tipEl.textContent = tips[currentIndex];
        window.clearInterval(tipTimer);
        tipTimer = window.setInterval(() => {
            currentIndex = (currentIndex + 1) % tips.length;
            tipEl.classList.add('is-switching');
            window.setTimeout(() => {
                tipEl.textContent = tips[currentIndex];
                tipEl.classList.remove('is-switching');
            }, 240);
        }, 3600);
    };

    const bindStatCardLinks = () => {
        document.querySelectorAll('.guide-stat-link[data-target]').forEach((card) => {
            const target = card.getAttribute('data-target');
            const go = () => {
                window.AchievementState?.record('guide-target', target);
                if (typeof window.navigateTo === 'function') window.navigateTo(target);
                else location.href = target;
            };
            card.addEventListener('click', go);
            card.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    go();
                }
            });
        });
    };

    const setupTodayLink = (records) => {
        if (!todayLink || !Array.isArray(records)) return;
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const matches = records.filter((record) => {
            if (!record?.date || record.hidden === true) return false;
            const [, recordMonth, recordDay] = String(record.date).split('-');
            return recordMonth === month && recordDay === day;
        });
        if (!matches.length) {
            todayLink.hidden = true;
            return;
        }
        sortRecords(matches);
        todayLink.hidden = false;
        todayLink.onclick = () => {
            const first = matches[0];
            const anchor = typeof getRecordAnchorId === 'function'
                ? getRecordAnchorId(first)
                : `record-${String(first.fileName || first.id || '').replace(/\.json$/i, '').replace(/[^a-zA-Z0-9_-]/g, '-')}`;
            const target = `record.html?month=${month}&day=${day}#${anchor}`;
            if (typeof window.navigateTo === 'function') window.navigateTo(target);
            else location.href = target;
        };
    };

    const syncAdminEntry = async () => {
        const entry = document.getElementById('guide-admin-entry');
        if (!entry || !window.ClassRecordSupabase?.isConfigured()) return;
        try {
            const client = await window.ClassRecordSupabase.getClient();
            const user = window.getCurrentUser?.();
            const table = window.ClassRecordSupabase.getConfig().tables.admins || 'admin_users';
            const { data, error } = await client.from(table).select('user_id').eq('user_id', user?.id).maybeSingle();
            if (error) throw error;
            entry.hidden = !data;
        } catch (error) {
            entry.hidden = true;
        }
    };

    const waitForAccess = () => {
        if (typeof window.waitForAccess === 'function') return window.waitForAccess();
        return new Promise((resolve) => {
            window.addEventListener('authGateReady', () => window.waitForAccess().then(resolve), { once: true });
        });
    };

    const renderGuideHighlights = async () => {
        const wrap = document.getElementById('guide-highlights');
        if (!wrap) return;
        wrap.hidden = false;
        startTipRotation(document.getElementById('guide-tip'));
        const [recordsResult, peopleResult, glossaryResult] = await Promise.allSettled([
            typeof window.loadAllRecords === 'function' ? window.loadAllRecords() : [],
            typeof window.loadAllPeople === 'function' ? window.loadAllPeople() : [],
            typeof window.loadAllGlossary === 'function' ? window.loadAllGlossary() : []
        ]);
        const valueOrEmpty = (result) => result.status === 'fulfilled' && Array.isArray(result.value) ? result.value : [];
        const records = valueOrEmpty(recordsResult);
        const setText = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = String(value);
        };
        setText('guide-record-count', records.length);
        setText('guide-people-count', valueOrEmpty(peopleResult).length);
        setText('guide-term-count', valueOrEmpty(glossaryResult).length);
        setupTodayLink(records);
        if (secondaryPanel) secondaryPanel.hidden = false;
    };

    const showNav = () => {
        if (progressWrap) progressWrap.hidden = true;
        syncAdminEntry();
    };

    window.cacheReadyPromise = (async () => { await waitForAccess(); })();
    bindStatCardLinks();

    const logo = document.querySelector('.guide-logo');
    if (logo) {
        let logoTapCount = 0;
        let logoTapTimer = null;
        logo.addEventListener('click', () => {
            logoTapCount += 1;
            window.AchievementState?.record('logo-tap', 'guide-logo');
            logo.classList.remove('is-logo-tapped');
            void logo.offsetWidth;
            logo.classList.add('is-logo-tapped');
            window.clearTimeout(logoTapTimer);
            logoTapTimer = window.setTimeout(() => { logoTapCount = 0; }, 1200);
            if (logoTapCount >= 5) {
                logoTapCount = 0;
                logo.classList.remove('is-logo-secret');
                void logo.offsetWidth;
                logo.classList.add('is-logo-secret');
                window.AchievementState?.record('secret', 'guide-logo');
            }
        });
    }

    waitForAccess()
        .then(() => renderGuideHighlights().catch((error) => {
            console.warn('导览统计渲染失败：', error);
            const wrap = document.getElementById('guide-highlights');
            if (wrap) wrap.hidden = false;
            if (secondaryPanel) secondaryPanel.hidden = false;
        }))
        .finally(showNav);

    waitForAccess().then(() => {
        const warmCaches = () => {
            if (typeof window.ensureAllCachesLoaded === 'function') {
                window.ensureAllCachesLoaded({ showOverlay: false, includeImages: false }).catch((error) => {
                    console.warn('导览后台缓存预热失败：', error);
                });
            }
        };
        if ('requestIdleCallback' in window) window.requestIdleCallback(warmCaches, { timeout: 900 });
        else window.setTimeout(warmCaches, 300);
    });
})();