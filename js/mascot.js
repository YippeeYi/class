/************************************************************
 * mascot.js
 * 全站网页吉祥物：档案小书签
 ************************************************************/

(() => {
    const STORAGE_KEY = 'classRecord:mascotState';
    const EDGE_MARGIN = 12;
    const HIDDEN_PEEK = 24;
    const DEFAULT_Y_RATIO = 0.58;
    const TIPS = [
        '试试在记录页搜索一句关键词，我会帮你记成就。',
        '人物和术语标签都能点开，线索会自己串起来。',
        '如果筛选没有结果，放宽日期或清空条件会更快。',
        '全站搜索可以同时找记录、人物和术语。',
        '答题页现在可以用数字 1 到 4 快速选择选项。',
        '答完题后按 Enter 可以直接进入下一题。',
        '把我拖到屏幕边缘，我会自动靠边待命。',
        '筛选题目时，题型和内容是两组并列条件。',
        '成就页能看到你在检索、答题和探索里的进度。'
    ];
    const MOODS = ['idle', 'happy', 'thinking', 'working', 'sleepy'];
    const IDLE_ACTIONS = ['is-blinking', 'is-waving', 'is-looking', 'is-nodding', 'is-bouncing', 'is-shining'];

    let state = readState();
    let root = null;
    let bubble = null;
    let hideBubbleTimer = null;
    let idleTimer = null;
    let dragState = null;
    let tapTimer = null;

    function readState() {
        try {
            const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            const edge = raw?.edge === 'left' || raw?.edge === 'right'
                ? raw.edge
                : Number(raw?.x) < window.innerWidth / 2 ? 'left' : 'right';
            return {
                x: Number.isFinite(raw?.x) ? raw.x : null,
                y: Number.isFinite(raw?.y) ? raw.y : null,
                edge,
                hidden: Boolean(raw?.hidden || raw?.collapsed),
                taps: Number(raw?.taps) || 0
            };
        } catch (error) {
            return { x: null, y: null, edge: 'right', hidden: false, taps: 0 };
        }
    }

    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
            // Ignore storage failures.
        }
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function getSize() {
        if (!root) return { width: 90, height: 118 };
        const rect = root.getBoundingClientRect();
        return { width: rect.width || 90, height: rect.height || 118 };
    }

    function applyEdgeClasses() {
        if (!root) return;
        root.classList.toggle('is-left-edge', state.edge === 'left');
        root.classList.toggle('is-right-edge', state.edge === 'right');
        root.classList.toggle('is-edge-hidden', state.hidden);
    }

    function placeAt(x, y, { persist = false } = {}) {
        if (!root) return;
        const { width, height } = getSize();
        const minY = EDGE_MARGIN;
        const maxY = Math.max(minY, window.innerHeight - height - EDGE_MARGIN);
        state.x = clamp(x, EDGE_MARGIN, Math.max(EDGE_MARGIN, window.innerWidth - width - EDGE_MARGIN));
        state.y = clamp(y, minY, maxY);
        root.style.left = `${state.x}px`;
        root.style.top = `${state.y}px`;
        if (persist) saveState();
    }

    function applyPosition({ persist = false } = {}) {
        if (!root) return;
        const { width, height } = getSize();
        const minY = EDGE_MARGIN;
        const maxY = Math.max(minY, window.innerHeight - height - EDGE_MARGIN);
        state.y = clamp(Number.isFinite(state.y) ? state.y : window.innerHeight * DEFAULT_Y_RATIO, minY, maxY);
        if (state.hidden) {
            state.x = state.edge === 'left' ? -(width - HIDDEN_PEEK) : window.innerWidth - HIDDEN_PEEK;
        } else {
            state.x = state.edge === 'left' ? EDGE_MARGIN : window.innerWidth - width - EDGE_MARGIN;
        }
        root.style.left = `${state.x}px`;
        root.style.top = `${state.y}px`;
        applyEdgeClasses();
        if (persist) saveState();
    }

    function placeInitial() {
        if (!root) return;
        if (Number.isFinite(state.x) && Number.isFinite(state.y) && !state.hidden) {
            state.edge = state.x < window.innerWidth / 2 ? 'left' : 'right';
        }
        applyPosition();
    }

    function snapToNearestEdge({ hide = false, persist = true } = {}) {
        if (!root) return;
        const { width } = getSize();
        const center = (Number(state.x) || 0) + width / 2;
        state.edge = center < window.innerWidth / 2 ? 'left' : 'right';
        state.hidden = Boolean(hide);
        root.classList.add('is-snapping');
        applyPosition({ persist });
        window.setTimeout(() => root?.classList.remove('is-snapping'), 360);
    }

    function setMood(mood) {
        if (!root) return;
        MOODS.forEach((item) => root.classList.toggle(`is-${item}`, item === mood));
    }

    function playAction(actionClass, duration = 1000) {
        if (!root || !actionClass) return;
        root.classList.remove(...IDLE_ACTIONS);
        root.classList.add(actionClass);
        window.setTimeout(() => root?.classList.remove(actionClass), duration);
    }

    function say(message, { mood = 'happy', duration = 4300 } = {}) {
        if (!root || !bubble) return;
        window.clearTimeout(hideBubbleTimer);
        bubble.textContent = message;
        root.classList.add('is-speaking');
        setMood(mood);
        hideBubbleTimer = window.setTimeout(() => {
            root.classList.remove('is-speaking');
            setMood(state.hidden ? 'sleepy' : 'idle');
        }, duration);
    }

    function getPageTip() {
        const page = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
        const pageTips = {
            'quiz.html': ['答题时先看题型，再看内容范围，两个筛选组是并列条件。', '作答后按钮会变成下一题，也可以按 Enter 继续。'],
            'record.html': ['记录页适合先用关键词缩小范围，再用日期做精确定位。'],
            'people.html': ['人物页排序能帮你快速找到出现频率更高的人。'],
            'glossary.html': ['术语页适合先扫高频词，再回记录里看上下文。'],
            'search.html': ['全站搜索会同时覆盖记录、人物和术语。'],
            'achievements.html': ['新完成的成就会带高亮，适合回来复盘路线。']
        };
        const tips = pageTips[page] || [];
        return tips.length ? tips[Math.floor(Math.random() * tips.length)] : '';
    }

    function randomTip() {
        const pageTip = getPageTip();
        if (pageTip && Math.random() < 0.45) return pageTip;
        return TIPS[Math.floor(Math.random() * TIPS.length)];
    }

    function recordInteraction(type) {
        window.AchievementState?.record('mascot', type);
    }

    function revealFromEdge() {
        if (!state.hidden) return;
        state.hidden = false;
        applyPosition({ persist: true });
        recordInteraction('reveal');
        say('我回来了。继续翻档案吧。', { mood: 'happy' });
    }

    function hideToEdge() {
        if (state.hidden) {
            revealFromEdge();
            return;
        }
        state.hidden = true;
        snapToNearestEdge({ hide: true });
        recordInteraction('hide');
        say('我先贴边待命，需要我时点一下边缘书签。', { mood: 'sleepy', duration: 3200 });
    }

    function handleTap() {
        if (dragState?.moved) return;
        if (state.hidden) {
            revealFromEdge();
            return;
        }
        state.taps += 1;
        saveState();
        recordInteraction('tap');
        playAction(state.taps % 3 === 0 ? 'is-looking' : 'is-waving', 1200);
        say(randomTip(), { mood: state.taps % 3 === 0 ? 'thinking' : 'happy' });
    }

    function startIdleLoop() {
        window.clearInterval(idleTimer);
        idleTimer = window.setInterval(() => {
            if (!root || state.hidden || root.classList.contains('is-speaking')) return;
            root.classList.add('is-breathing');
            window.setTimeout(() => root?.classList.remove('is-breathing'), 1600);
            const action = IDLE_ACTIONS[Math.floor(Math.random() * IDLE_ACTIONS.length)];
            window.setTimeout(() => playAction(action, action === 'is-blinking' ? 520 : 1250), 260);
        }, 8200);
    }

    function buildMascot() {
        root = document.createElement('div');
        root.id = 'archive-mascot';
        root.className = 'archive-mascot is-idle';
        root.innerHTML = `
            <div class="archive-mascot-bubble" role="status" aria-live="polite"></div>
            <button type="button" class="archive-mascot-body" aria-label="档案助理，点击显示提示，拖动移动位置">
                <span class="archive-mascot-avatar" aria-hidden="true">
                    <span class="archive-mascot-cap"></span>
                    <span class="archive-mascot-lens"></span>
                    <span class="archive-mascot-eyes"><i></i><i></i></span>
                    <span class="archive-mascot-mouth"></span>
                    <span class="archive-mascot-badge">档</span>
                    <span class="archive-mascot-arm archive-mascot-arm-left"></span>
                    <span class="archive-mascot-arm archive-mascot-arm-right"></span>
                    <span class="archive-mascot-feet"></span>
                </span>
            </button>
            <button type="button" class="archive-mascot-hide" aria-label="贴边隐藏或唤回吉祥物">藏</button>
        `;
        document.body.appendChild(root);
        bubble = root.querySelector('.archive-mascot-bubble');
        placeInitial();
        bindEvents();
        startIdleLoop();
        window.setTimeout(() => {
            if (!state.hidden) say('我是档案助理。点我可以拿提示，也可以拖到顺手的位置。', { mood: 'happy', duration: 5600 });
        }, 900);
    }

    function bindEvents() {
        const body = root.querySelector('.archive-mascot-body');
        const hideButton = root.querySelector('.archive-mascot-hide');

        body.addEventListener('pointerdown', (event) => {
            if (state.hidden) {
                revealFromEdge();
                dragState = null;
                return;
            }
            dragState = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                originX: Number(state.x) || 0,
                originY: Number(state.y) || 0,
                moved: false
            };
            body.setPointerCapture?.(event.pointerId);
            root.classList.add('is-dragging');
        });

        body.addEventListener('pointermove', (event) => {
            if (!dragState || dragState.pointerId !== event.pointerId) return;
            const dx = event.clientX - dragState.startX;
            const dy = event.clientY - dragState.startY;
            if (Math.hypot(dx, dy) > 4) dragState.moved = true;
            placeAt(dragState.originX + dx, dragState.originY + dy);
            state.edge = state.x < window.innerWidth / 2 ? 'left' : 'right';
            applyEdgeClasses();
        });

        const finishDrag = (event) => {
            if (!dragState || dragState.pointerId !== event.pointerId) return;
            body.releasePointerCapture?.(event.pointerId);
            root.classList.remove('is-dragging');
            const wasMoved = dragState.moved;
            const nearEdge = event.clientX < 22 || event.clientX > window.innerWidth - 22;
            dragState = null;
            if (wasMoved) {
                snapToNearestEdge({ hide: nearEdge });
                recordInteraction(nearEdge ? 'hide' : 'drag');
                if (nearEdge) say('贴边隐藏完成。点露出的书签就能叫我回来。', { mood: 'sleepy', duration: 3200 });
                return;
            }
            window.clearTimeout(tapTimer);
            tapTimer = window.setTimeout(handleTap, 260);
        };

        body.addEventListener('pointerup', finishDrag);
        body.addEventListener('pointercancel', finishDrag);
        hideButton.addEventListener('click', (event) => {
            event.stopPropagation();
            hideToEdge();
        });

        window.addEventListener('resize', () => applyPosition({ persist: true }));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', buildMascot, { once: true });
    } else {
        buildMascot();
    }
})();
