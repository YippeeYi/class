/************************************************************
 * guide.js
 * 导览页面逻辑
 ************************************************************/

(() => {
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

    let tipTimer = null;

    const startTipRotation = (tipEl) => {
        const tips = [
            '小提示：点击 logo 没有彩蛋。',
            '小提示：图片均可点击查看大图。',
            '小提示：人名可点击跳转至个人界面。',
            '小提示：可以在背景页切换全站背景。',
            '小提示：看看注释吧！',
            '小提示：挑战一下答题吗？',
            '小提示：每天看看左上角吧。'
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
            .forEach((result) => window.ClassRecordDiagnostics?.warn('Guide statistics load failed', result.reason));

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
            window.ClassRecordDiagnostics?.warn('Guide statistics render failed', error);
            const wrap = document.getElementById('guide-highlights');
            if (wrap) {
                wrap.hidden = false;
            }
        }));

})();
