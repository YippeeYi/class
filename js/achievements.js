(() => {
    const normalList = document.getElementById('achievement-normal-list');
    const hiddenList = document.getElementById('achievement-hidden-list');
    const summary = document.getElementById('achievement-summary');
    const hideCompleteButton = document.getElementById('achievement-hide-complete');
    const sortControls = document.querySelector('.achievement-sort-controls');
    if (!normalList || !hiddenList || !window.AchievementState) return;

    let hideCompleted = false;
    let currentSortKey = 'progress';
    let currentSortOrder = 'desc';
    let dropdownCloseTimer = null;
    let renderAnimationTimer = null;
    let hasRendered = false;
    const PENDING_HIGHLIGHT_KEY = 'classRecord:achievementPendingHighlights';
    const HIGHLIGHT_CLEAR_DELAY = 1120;
    let pendingHighlightIds = readPendingHighlights();
    const groupOrder = ['explore', 'people', 'term', 'detail', 'link', 'interact', 'quizAnswered', 'quizCorrect', 'quizStreak', 'coin', 'background', 'meta'];
    const sortKeyText = { progress: '按完成进度', group: '按类型' };
    const DROPDOWN_CLOSE_DELAY = 140;
    const sortDropdown = sortControls?.querySelector('.sort-dropdown');

    function readPendingHighlights() {
        try {
            const raw = JSON.parse(localStorage.getItem('classRecord:achievementPendingHighlights') || '[]');
            return new Set(Array.isArray(raw) ? raw.filter(Boolean) : []);
        } catch (error) {
            return new Set();
        }
    }

    function savePendingHighlights() {
        localStorage.setItem(PENDING_HIGHLIGHT_KEY, JSON.stringify([...pendingHighlightIds]));
    }

    function openSortDropdown() {
        if (!sortDropdown) return;
        window.clearTimeout(dropdownCloseTimer);
        sortDropdown.classList.add('is-open');
    }

    function closeSortDropdown(withDelay = true) {
        if (!sortDropdown) return;
        window.clearTimeout(dropdownCloseTimer);
        if (!withDelay) {
            sortDropdown.classList.remove('is-open');
            return;
        }
        dropdownCloseTimer = window.setTimeout(() => {
            sortDropdown.classList.remove('is-open');
        }, DROPDOWN_CLOSE_DELAY);
    }

    function sortNormalAchievements(list) {
        return [...list].sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? -1 : 1;
            let result = 0;
            if (currentSortKey === 'group') {
                result = groupOrder.indexOf(a.group) - groupOrder.indexOf(b.group);
                if (result === 0) result = b.progress - a.progress;
            } else {
                result = b.progress - a.progress;
            }
            if (currentSortOrder === 'asc') result *= -1;
            if (result !== 0) return result;
            return a.title.localeCompare(b.title, 'zh-CN');
        });
    }

    function updateSortControls() {
        if (!sortControls) return;
        const trigger = sortControls.querySelector('.dropdown-trigger');
        const label = sortControls.querySelector('.dropdown-label');
        const orderToggle = sortControls.querySelector('.sort-order-toggle');
        if (trigger) trigger.dataset.value = currentSortKey;
        if (label) label.textContent = sortKeyText[currentSortKey] || sortKeyText.progress;
        if (orderToggle) {
            orderToggle.dataset.value = currentSortOrder;
            orderToggle.textContent = currentSortOrder === 'asc' ? '升序' : '降序';
        }
        sortControls.querySelectorAll('.sort-option').forEach((option) => {
            option.classList.toggle('is-active', option.dataset.value === currentSortKey);
        });
    }

    function renderCard(achievement, newCompletedIds) {
        const lockedHidden = achievement.hidden && !achievement.completed;
        const completedHidden = achievement.hidden && achievement.completed;
        const title = lockedHidden ? '隐藏成就' : achievement.title;
        const description = lockedHidden ? '条件未知。继续浏览、答题，或者试试网页上的小彩蛋。' : achievement.description;
        const status = achievement.completed ? '已完成' : '未完成';
        const icon = lockedHidden
            ? '<svg class="achievement-icon-svg" viewBox="0 0 96 96" aria-hidden="true"><rect x="18" y="34" width="60" height="44" rx="10" fill="#1f2937"/><path d="M32 34V24a16 16 0 0132 0v10" fill="none" stroke="#f8fafc" stroke-width="7" stroke-linecap="round"/><circle cx="48" cy="56" r="5" fill="#facc15"/></svg>'
            : achievement.icon;
        const progressPercent = Math.round((achievement.progress || 0) * 100);
        const progressHtml = achievement.hidden ? '' : `
            <div class="achievement-progress" aria-label="完成进度 ${progressPercent}%">
                <div class="achievement-progress-track">
                    <span class="achievement-progress-fill" style="width:${progressPercent}%"></span>
                </div>
                <span class="achievement-progress-text">${progressPercent}%</span>
            </div>
        `;

        const groupClass = achievement.group ? ` is-group-${achievement.group}` : '';
        return `
            <article class="achievement-card${groupClass}${achievement.completed ? ' is-complete' : ''}${lockedHidden ? ' is-hidden-achievement' : ''}${completedHidden ? ' is-hidden-complete' : ''}${newCompletedIds.has(achievement.id) ? ' is-new-complete' : ''}" data-achievement-id="${achievement.id}">
                <div class="achievement-art" aria-hidden="true">${icon}</div>
                <div class="achievement-copy">
                    <h2>${title}</h2>
                    <p>${description}</p>
                    ${progressHtml}
                </div>
                <span class="achievement-status">${status}</span>
            </article>
        `;
    }

    function render() {
        const achievements = window.AchievementState.getAchievements();
        const consumedIds = window.AchievementState.consumeNewCompleted?.() || [];
        consumedIds.forEach((id) => pendingHighlightIds.add(id));
        const completedIds = new Set(achievements.filter((achievement) => achievement.completed).map((achievement) => achievement.id));
        pendingHighlightIds = new Set([...pendingHighlightIds].filter((id) => completedIds.has(id)));
        savePendingHighlights();
        const newCompletedIds = new Set(pendingHighlightIds);
        const visibleAchievements = hideCompleted ? achievements.filter((achievement) => !achievement.completed) : achievements;
        const completed = achievements.filter((achievement) => achievement.completed);
        if (summary) {
            summary.textContent = `已完成 ${completed.length} / ${achievements.length}`;
        }
        if (hideCompleteButton) {
            hideCompleteButton.classList.toggle('is-active', hideCompleted);
            hideCompleteButton.setAttribute('aria-pressed', hideCompleted ? 'true' : 'false');
            hideCompleteButton.textContent = '隐藏已完成';
        }
        updateSortControls();

        const normalAchievements = sortNormalAchievements(visibleAchievements.filter((achievement) => !achievement.hidden));
        const hiddenAchievements = visibleAchievements.filter((achievement) => achievement.hidden);
        if (hasRendered) {
            window.clearTimeout(renderAnimationTimer);
            normalList.classList.add('is-updating');
            hiddenList.classList.add('is-updating');
        }
        normalList.innerHTML = normalAchievements.length
            ? normalAchievements.map((achievement) => renderCard(achievement, newCompletedIds)).join('')
            : '<p class="achievement-empty">没有可显示的普通成就。</p>';
        hiddenList.innerHTML = hiddenAchievements.length
            ? hiddenAchievements.map((achievement) => renderCard(achievement, newCompletedIds)).join('')
            : '<p class="achievement-empty">没有可显示的隐藏成就。</p>';
        if (hasRendered) {
            renderAnimationTimer = window.setTimeout(() => {
                normalList.classList.remove('is-updating');
                hiddenList.classList.remove('is-updating');
            }, 360);
        }
        hasRendered = true;
    }

    hideCompleteButton?.addEventListener('click', () => {
        hideCompleted = !hideCompleted;
        render();
    });

    sortControls?.addEventListener('click', (event) => {
        const option = event.target.closest('.sort-option');
        if (option) {
            currentSortKey = option.dataset.value || 'progress';
            closeSortDropdown(false);
            render();
            return;
        }
        if (event.target.closest('.sort-order-toggle')) {
            currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
            render();
        }
    });

    sortDropdown?.addEventListener('mouseenter', openSortDropdown);
    sortDropdown?.addEventListener('mouseleave', () => closeSortDropdown(true));

    document.addEventListener('pointerover', (event) => {
        const card = event.target.closest?.('.achievement-card.is-new-complete');
        if (!card || card.classList.contains('is-new-clearing')) return;
        card.classList.add('is-new-clearing');
        const achievementId = card.dataset.achievementId;
        window.setTimeout(() => {
            card.classList.remove('is-new-complete', 'is-new-clearing');
            if (achievementId) {
                pendingHighlightIds.delete(achievementId);
                savePendingHighlights();
            }
        }, HIGHLIGHT_CLEAR_DELAY);
    });

    render();
    window.AchievementState.subscribe(render);
})();
