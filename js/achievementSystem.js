(() => {
    const STORAGE_KEY = 'classRecord:achievementState';
    const NOTIFY_QUEUE_KEY = 'classRecord:achievementNotifyQueue';
    const listeners = new Set();

    const icon = (text) => `<span class="achievement-emoji-icon" aria-hidden="true">${text}</span>`;
    const ratio = (value, target) => Math.max(0, Math.min(1, Number(value || 0) / target));
    const hasPage = (state, page) => Number(state.stats.pages[page] || 0) > 0;

    const ACHIEVEMENTS = [
        { id: 'guide-first', group: 'explore', title: '回到导览', description: '打开导览页 1 次。', icon: icon('🧭'), condition: (s) => hasPage(s, 'index'), progress: (s) => ratio(s.stats.pages.index, 1) },
        { id: 'archive-opened', group: 'explore', title: '翻开档案', description: '进入记录页 1 次。', icon: icon('📖'), condition: (s) => hasPage(s, 'record'), progress: (s) => ratio(s.stats.pages.record, 1) },
        { id: 'all-rounder', group: 'explore', title: '四线巡游', description: '浏览记录、人物、术语和答题四个入口。', icon: icon('🗺'), condition: (s) => ['record', 'people', 'glossary', 'quiz'].every((p) => hasPage(s, p)), progress: (s) => ['record', 'people', 'glossary', 'quiz'].filter((p) => hasPage(s, p)).length / 4 },
        { id: 'entrance-complete', group: 'interact', title: '入口全试', description: '从导览页点击 5 个不同入口。', icon: icon('🚪'), condition: (s) => s.stats.interactions.guideTargets.length >= 5, progress: (s) => ratio(s.stats.interactions.guideTargets.length, 5) },
        { id: 'name-browser-1', group: 'people', title: '点名开始', description: '查看 1 个不同人物详情。', icon: icon('👥'), condition: (s) => s.stats.peopleViewed.length >= 1, progress: (s) => ratio(s.stats.peopleViewed.length, 1) },
        { id: 'name-archivist', group: 'people', title: '熟人网络', description: '查看 15 个不同人物详情。', icon: icon('🧑‍🤝‍🧑'), condition: (s) => s.stats.peopleViewed.length >= 15, progress: (s) => ratio(s.stats.peopleViewed.length, 15) },
        { id: 'glossary-reader', group: 'term', title: '黑话入门', description: '查看 3 个不同术语详情。', icon: icon('📚'), condition: (s) => s.stats.termsViewed.length >= 3, progress: (s) => ratio(s.stats.termsViewed.length, 3) },
        { id: 'glossary-master', group: 'term', title: '术语通读', description: '查看 8 个不同术语详情。', icon: icon('🧠'), condition: (s) => s.stats.termsViewed.length >= 8, progress: (s) => ratio(s.stats.termsViewed.length, 8) },
        { id: 'record-linker', group: 'link', title: '顺藤摸瓜', description: '从记录正文中点击人物或术语链接 5 次。', icon: icon('🔗'), condition: (s) => s.stats.interactions.recordLinkClicks >= 5, progress: (s) => ratio(s.stats.interactions.recordLinkClicks, 5) },
        { id: 'filter-tuner', group: 'interact', title: '筛选调音师', description: '使用筛选 5 次。', icon: icon('🔎'), condition: (s) => s.stats.interactions.filterUses >= 5, progress: (s) => ratio(s.stats.interactions.filterUses, 5) },
        { id: 'sort-flipper', group: 'interact', title: '排序翻面', description: '切换排序 3 次。', icon: icon('↕'), condition: (s) => s.stats.interactions.sortUses >= 3, progress: (s) => ratio(s.stats.interactions.sortUses, 3) },
        { id: 'quiz-first', group: 'quizAnswered', title: '先答一题', description: '完成任意 1 道答题。', icon: icon('❓'), condition: (s) => s.stats.quiz.answered >= 1, progress: (s) => ratio(s.stats.quiz.answered, 1) },
        { id: 'quiz-marathon', group: 'quizAnswered', title: '题海热身', description: '累计完成 30 道答题。', icon: icon('🏃'), condition: (s) => s.stats.quiz.answered >= 30, progress: (s) => ratio(s.stats.quiz.answered, 30) },
        { id: 'quiz-five-correct', group: 'quizCorrect', title: '校准答案', description: '累计答对 5 道题。', icon: icon('✅'), condition: (s) => s.stats.quiz.correct >= 5, progress: (s) => ratio(s.stats.quiz.correct, 5) },
        { id: 'streak-ten', group: 'quizStreak', title: '十连能手', description: '连续答对 10 道题。', icon: icon('🔥'), condition: (s) => s.stats.quiz.bestStreak >= 10, progress: (s) => ratio(s.stats.quiz.bestStreak, 10) },
        { id: 'qcoin-keeper', group: 'coin', title: '小有积蓄', description: 'Q 币余额达到 1000。', icon: icon('🪙'), condition: (s) => s.stats.balance >= 1000, progress: (s) => ratio(s.stats.balance, 1000) },
        { id: 'qcoin-tycoon', group: 'coin', title: 'Q 币大户', description: 'Q 币余额达到 10000。', icon: icon('💰'), condition: (s) => s.stats.balance >= 10000, progress: (s) => ratio(s.stats.balance, 10000) },
        { id: 'hidden-logo', group: 'hidden', title: '敲敲招牌', description: '发现导览页 logo 彩蛋。', icon: icon('✨'), hidden: true, condition: (s) => s.stats.secrets.includes('guide-logo'), progress: () => 0 },
        { id: 'hidden-fullscreen', group: 'hidden', title: '沉浸阅读', description: '进入过一次全屏浏览。', icon: icon('🖥'), hidden: true, condition: (s) => s.stats.fullscreenEntries >= 1, progress: () => 0 }
    ];

    const defaultState = () => ({
        completed: {},
        seenCompleted: [],
        stats: {
            pages: {},
            peopleViewed: [],
            termsViewed: [],
            secrets: [],
            fullscreenEntries: 0,
            balance: 0,
            quiz: { answered: 0, correct: 0, currentStreak: 0, bestStreak: 0 },
            interactions: { guideTargets: [], filterUses: 0, sortUses: 0, recordLinkClicks: 0 }
        }
    });

    const unique = (items) => [...new Set((items || []).filter(Boolean))];
    const mergeState = (raw) => {
        const state = defaultState();
        if (!raw || typeof raw !== 'object') return state;
        state.completed = { ...(raw.completed || {}) };
        state.seenCompleted = unique(raw.seenCompleted);
        state.stats.pages = { ...(raw.stats?.pages || {}) };
        state.stats.peopleViewed = unique(raw.stats?.peopleViewed);
        state.stats.termsViewed = unique(raw.stats?.termsViewed);
        state.stats.secrets = unique(raw.stats?.secrets);
        state.stats.fullscreenEntries = Number(raw.stats?.fullscreenEntries) || 0;
        state.stats.balance = Number(raw.stats?.balance) || 0;
        state.stats.quiz = { ...state.stats.quiz, ...(raw.stats?.quiz || {}) };
        state.stats.interactions = { ...state.stats.interactions, ...(raw.stats?.interactions || {}) };
        state.stats.interactions.guideTargets = unique(state.stats.interactions.guideTargets);
        return state;
    };

    let currentState = (() => {
        try { return mergeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')); }
        catch { return defaultState(); }
    })();

    const saveState = () => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState)); } catch {}
        window.ClassRecordUserState?.saveAchievementState?.(currentState);
    };

    const syncQcoinStats = (state = window.QcoinState?.getState?.()) => {
        if (state) currentState.stats.balance = Number(state.balance || 0);
    };

    const getAchievementView = (state = currentState) => ACHIEVEMENTS.map((achievement) => ({
        ...achievement,
        completed: Boolean(state.completed[achievement.id]),
        progress: achievement.hidden ? 0 : Math.max(0, Math.min(1, achievement.progress ? achievement.progress(state) : 0))
    }));

    const notifyAchievement = (achievement) => {
        let host = document.getElementById('achievement-unlock-stack');
        if (!host) {
            host = document.createElement('div');
            host.id = 'achievement-unlock-stack';
            document.body.appendChild(host);
        }
        const notice = document.createElement('div');
        notice.className = `achievement-unlock${achievement.hidden ? ' is-hidden-unlock' : ''}`;
        notice.innerHTML = `<div class="achievement-unlock-art">${achievement.icon}</div><div class="achievement-unlock-copy"><span>${achievement.hidden ? '隐藏成就解锁' : '成就达成'}</span><strong>${achievement.title}</strong></div>`;
        host.appendChild(notice);
        window.setTimeout(() => notice.remove(), 4600);
    };

    const evaluate = ({ notify = true } = {}) => {
        syncQcoinStats();
        const unlocked = [];
        ACHIEVEMENTS.forEach((achievement) => {
            if (currentState.completed[achievement.id]) return;
            if (!achievement.condition(currentState)) return;
            currentState.completed[achievement.id] = new Date().toISOString();
            unlocked.push(achievement);
        });
        if (unlocked.length) {
            saveState();
            const snapshot = getAchievementView();
            listeners.forEach((listener) => listener(snapshot, unlocked));
            window.dispatchEvent(new CustomEvent('achievementchange', { detail: { achievements: snapshot, unlocked } }));
            if (notify) unlocked.forEach(notifyAchievement);
        }
    };

    const record = (type, value) => {
        if (type === 'page') currentState.stats.pages[value] = Number(currentState.stats.pages[value] || 0) + 1;
        else if (type === 'person' && value) currentState.stats.peopleViewed = unique([...currentState.stats.peopleViewed, value]);
        else if (type === 'term' && value) currentState.stats.termsViewed = unique([...currentState.stats.termsViewed, value]);
        else if (type === 'secret' && value) currentState.stats.secrets = unique([...currentState.stats.secrets, value]);
        else if (type === 'fullscreen') currentState.stats.fullscreenEntries += 1;
        else if (type === 'guide-target' && value) currentState.stats.interactions.guideTargets = unique([...currentState.stats.interactions.guideTargets, value]);
        else if (type === 'filter') currentState.stats.interactions.filterUses += 1;
        else if (type === 'sort') currentState.stats.interactions.sortUses += 1;
        else if (type === 'record-link') currentState.stats.interactions.recordLinkClicks += 1;
        saveState();
        evaluate();
    };

    const recordCurrentPage = () => {
        const path = window.location.pathname.split('/').pop() || 'index.html';
        const params = new URLSearchParams(window.location.search);
        const map = { 'index.html': 'index', 'record.html': 'record', 'people.html': 'people', 'glossary.html': 'glossary', 'quiz.html': 'quiz', 'achievements.html': 'achievements', 'search.html': 'search', 'timeline.html': 'timeline', 'shop.html': 'shop' };
        record('page', map[path] || path.replace(/\.html$/, ''));
        if (path === 'person.html') record('person', params.get('id'));
        if (path === 'term.html') record('term', params.get('id'));
    };

    document.addEventListener('click', (event) => {
        if (event.target.closest('.record-filter .filter-option, .quiz-filter .filter-option, .filter-important, .filter-exclude-daily, .filter-favorites, .clear, .quiz-filter-all')) record('filter', 'use');
        if (event.target.closest('.sort-option, .sort-order-toggle')) record('sort', 'use');
        if (event.target.closest('.person-tag, .term-tag, .term-tooltip')) record('record-link', 'use');
    }, { capture: true });

    window.AchievementState = {
        definitions: ACHIEVEMENTS.map((achievement) => ({ ...achievement })),
        getState() { syncQcoinStats(); evaluate({ notify: false }); return mergeState(currentState); },
        getAchievements() { syncQcoinStats(); evaluate({ notify: false }); return getAchievementView(); },
        consumeNewCompleted() {
            syncQcoinStats();
            evaluate({ notify: false });
            const unseen = ACHIEVEMENTS.filter((achievement) => currentState.completed[achievement.id] && !currentState.seenCompleted.includes(achievement.id)).map((achievement) => achievement.id);
            currentState.seenCompleted = unique([...currentState.seenCompleted, ...unseen]);
            saveState();
            return unseen;
        },
        record,
        subscribe(listener) { if (typeof listener !== 'function') return () => {}; listeners.add(listener); return () => listeners.delete(listener); }
    };

    window.addEventListener('qcoinchange', (event) => {
        if (event.detail?.reason === 'quiz-result') {
            currentState.stats.quiz.answered += 1;
            if (event.detail.isCorrect) {
                currentState.stats.quiz.correct += 1;
                currentState.stats.quiz.currentStreak += 1;
                currentState.stats.quiz.bestStreak = Math.max(currentState.stats.quiz.bestStreak, currentState.stats.quiz.currentStreak);
            } else {
                currentState.stats.quiz.currentStreak = 0;
            }
        }
        syncQcoinStats(event.detail?.state);
        saveState();
        evaluate();
    });

    document.addEventListener('fullscreenchange', () => { if (document.fullscreenElement) record('fullscreen', 'entered'); });

    const syncRemoteAchievementState = () => {
        window.ClassRecordUserState?.getAchievementState?.().then((remoteState) => {
            if (!remoteState || !Object.keys(remoteState).length) {
                window.ClassRecordUserState?.saveAchievementState?.(currentState);
                return;
            }
            currentState = mergeState(remoteState);
            syncQcoinStats();
            evaluate({ notify: false });
            window.dispatchEvent(new CustomEvent('achievementchange', { detail: { achievements: getAchievementView(), unlocked: [] } }));
        }).catch((error) => console.warn('账号成就状态加载失败：', error));
    };

    syncRemoteAchievementState();
    window.addEventListener('classRecordUserStateReady', syncRemoteAchievementState);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', recordCurrentPage, { once: true });
    else recordCurrentPage();
})();