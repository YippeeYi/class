/************************************************************
 * guide.js
 * 导览页面逻辑
 ************************************************************/

(() => {
    const progressWrap = document.getElementById('guide-progress');
    const progressFill = document.getElementById('guide-progress-fill');
    const progressText = document.getElementById('guide-progress-text');

    const resetGuideScroll = () => {
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        window.scrollTo(0, 0);
    };

    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    resetGuideScroll();
    window.addEventListener('pageshow', resetGuideScroll);

    const setProgress = (value) => {
        const percent = Math.max(0, Math.min(100, Math.round(value * 100)));
        if (progressFill) {
            progressFill.style.width = `${percent}%`;
        }
        if (progressText) {
            progressText.textContent = `缓存加载中 ${percent}%`;
        }
    };


    let tipTimer = null;

    const startTipRotation = (tipEl) => {
        const tips = [
            '💡 小提示：人物页支持多维排序，适合快速找人。',
            '📝 小提示：记录页可按时间和重要性筛选。',
            '📚 小提示：名言页可以快速补齐班级“黑话”背景。',
            '🔎 小提示：记录详情里的人名和名言都可点击跳转查看。',
            '🧠 小提示：核心入口优先看记录、人物和名言。',
            '🗓️ 小提示：时间线页面适合按月份复盘重要事件。',
            '🎹 小提示：背景页可以直接切换全站背景。'
        ];

        if (!tipEl || tips.length === 0) {
            return;
        }

        let currentIndex = Math.floor(Math.random() * tips.length);
        tipEl.textContent = tips[currentIndex];

        if (tips.length === 1) {
            return;
        }

        const switchTip = () => {
            let nextIndex = currentIndex;
            while (nextIndex === currentIndex) {
                nextIndex = Math.floor(Math.random() * tips.length);
            }

            tipEl.classList.add('is-switching');
            window.setTimeout(() => {
                currentIndex = nextIndex;
                tipEl.textContent = tips[currentIndex];
                tipEl.classList.remove('is-switching');
            }, 280);
        };

        if (tipTimer) {
            window.clearInterval(tipTimer);
        }
        tipTimer = window.setInterval(switchTip, 3600);
    };

    const bindStatCardLinks = () => {
        const cards = document.querySelectorAll('.guide-stat-link[data-target]');
        cards.forEach((card) => {
            const target = card.getAttribute('data-target');
            if (!target) {
                return;
            }

            card.addEventListener('click', () => {
                if (typeof window.navigateTo === 'function') {
                    window.navigateTo(target);
                } else {
                    location.href = target;
                }
            });

            card.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    if (typeof window.navigateTo === 'function') {
                        window.navigateTo(target);
                    } else {
                        location.href = target;
                    }
                }
            });
        });
    };

    const renderGuideHighlights = async () => {
        const wrap = document.getElementById('guide-highlights');
        const secondary = document.querySelector('.guide-secondary-panel');
        if (!wrap) {
            return;
        }

        wrap.hidden = false;
        if (secondary) secondary.hidden = true;
        const tipEl = document.getElementById('guide-tip');
        if (tipEl) {
            startTipRotation(tipEl);
        }

        const [recordsResult, peopleResult] = await Promise.allSettled([
            typeof window.loadAllRecords === 'function' ? window.loadAllRecords() : [],
            typeof window.loadAllPeople === 'function' ? window.loadAllPeople() : []
        ]);
        const recordsForQuotes = recordsResult.status === 'fulfilled' && Array.isArray(recordsResult.value) ? recordsResult.value : [];
        const quotesResult = typeof window.loadAllQuotes === 'function'
            ? await window.loadAllQuotes({ records: recordsForQuotes }).then(
                (value) => ({ status: 'fulfilled', value }),
                (reason) => ({ status: 'rejected', reason })
            )
            : { status: 'fulfilled', value: [] };

        [recordsResult, peopleResult, quotesResult]
            .filter((result) => result.status === 'rejected')
            .forEach((result) => console.warn('导览统计加载失败：', result.reason));

        const valueOrEmpty = (result) => result.status === 'fulfilled' && Array.isArray(result.value) ? result.value : [];
        const setText = (id, value) => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = String(value);
            }
        };

        setText('guide-record-count', valueOrEmpty(recordsResult).length);
        setText('guide-people-count', valueOrEmpty(peopleResult).length);
        setText('guide-quote-count', valueOrEmpty(quotesResult).length);

        if (typeof window.preloadAllJsonImageMetadata === 'function') {
            window.setTimeout(async () => {
                try {
                    const materials = typeof window.loadAllMaterials === 'function' ? await window.loadAllMaterials().catch(() => []) : [];
                    const creditsPage = typeof window.ClassRecordData?.loadCreditsPage === 'function'
                        ? await window.ClassRecordData.loadCreditsPage().catch(() => null)
                        : null;
                    const pageMessages = typeof window.ClassRecordData?.loadPageMessages === 'function'
                        ? await window.ClassRecordData.loadPageMessages().catch(() => [])
                        : [];
                    const pageSupplements = typeof window.ClassRecordData?.loadPageSupplements === 'function'
                        ? await window.ClassRecordData.loadPageSupplements({ hidden: false }).catch(() => [])
                        : [];
                    const recordPages = typeof window.ClassRecordData?.loadRecordPages === 'function'
                        ? await window.ClassRecordData.loadRecordPages({ hidden: false }).catch(() => [])
                        : [];
                    window.preloadAllJsonImageMetadata({
                        records: valueOrEmpty(recordsResult),
                        people: valueOrEmpty(peopleResult),
                        quotes: valueOrEmpty(quotesResult),
                        materials,
                        creditsPage,
                        pageMessages,
                        pageSupplements,
                        recordPages
                    }).catch((error) => console.warn('Image metadata prewarm failed:', error));
                } catch (error) {
                    console.warn('Image metadata prewarm failed:', error);
                }
            }, 120);
        }

        const records = valueOrEmpty(recordsResult).filter((record) => {
            const hidden = record?.hidden === true || String(record?.hidden || '').trim().toLowerCase() === 'true';
            return !hidden;
        });
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayMatches = records.filter((record) => {
            const match = String(record.date || '').trim().match(/^\d{4}-(\d{2})-(\d{2})$/);
            return Boolean(match && match[1] === month && match[2] === day);
        });
        const todayButton = document.getElementById('guide-today-history');
        if (todayButton) {
            todayButton.hidden = todayMatches.length === 0;
            document.body.classList.toggle('guide-has-today-history', !todayButton.hidden);
            todayButton.onclick = () => {
                const target = `record.html?month=${encodeURIComponent(month)}&day=${encodeURIComponent(day)}`;
                if (typeof window.navigateTo === 'function') window.navigateTo(target);
                else location.href = target;
            };
        }
        if (secondary) secondary.hidden = false;
    };

    const showNav = () => {
        if (progressWrap) {
            progressWrap.hidden = true;
        }
    };

    const waitForAccess = () => {
        if (typeof window.waitForAccess === 'function') {
            return window.waitForAccess();
        }

        return new Promise((resolve) => {
            window.addEventListener('authGateReady', () => {
                window.waitForAccess().then(resolve);
            }, { once: true });
        });
    };

    window.cacheReadyPromise = (async () => {
        await waitForAccess();
    })();

    bindStatCardLinks();

    document.getElementById('clear-access-btn')?.addEventListener('click', async () => {
        if (!window.confirm('确定移除本机保存的访问权限并清除本站缓存吗？')) return;
        await window.clearAccessKey?.();
        window.location.replace('auth.html');
    });

    const logo = document.querySelector('.guide-logo');
    if (logo) {
        let logoTapCount = 0;
        let logoTapTimer = null;
        logo.addEventListener('click', () => {
            logoTapCount += 1;
            logo.classList.remove('is-logo-tapped');
            void logo.offsetWidth;
            logo.classList.add('is-logo-tapped');
            window.clearTimeout(logoTapTimer);
            logoTapTimer = window.setTimeout(() => {
                logoTapCount = 0;
            }, 1200);
            if (logoTapCount >= 5) {
                logoTapCount = 0;
                logo.classList.remove('is-logo-secret');
                void logo.offsetWidth;
                logo.classList.add('is-logo-secret');
            }
        });
    }

    waitForAccess()
        .then(() => renderGuideHighlights().catch((error) => {
            console.warn('导览统计渲染失败，继续显示入口：', error);
            const wrap = document.getElementById('guide-highlights');
            if (wrap) {
                wrap.hidden = false;
            }
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

        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(warmCaches, { timeout: 900 });
        } else {
            window.setTimeout(warmCaches, 300);
        }
    });
})();
