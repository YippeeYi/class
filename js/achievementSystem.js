(() => {
    const STORAGE_KEY = 'classRecord:achievementState';
    const QCOIN_STORAGE_KEY = 'classRecord:qcoinState';
    const NOTIFY_QUEUE_KEY = 'classRecord:achievementNotifyQueue';
    const NOTIFY_VISIBLE_MS = 4600;
    const NOTIFY_REMOVE_MS = 560;

    const icon = (body) => `<svg class="achievement-icon-svg" viewBox="0 0 96 96" role="img" aria-hidden="true">${body}</svg>`;
    const ICONS = {
        guide: icon('<rect x="14" y="20" width="68" height="52" rx="12" fill="#fff7d6"/><path d="M26 38h44M26 50h30M26 62h18" stroke="#8b5cf6" stroke-width="6" stroke-linecap="round"/><circle cx="70" cy="64" r="10" fill="#f59e0b"/>'),
        archive: icon('<path d="M18 30h60v42H18z" fill="#fef3c7"/><path d="M18 30l10-12h22l8 12" fill="#fde68a"/><path d="M30 46h36M30 58h24" stroke="#0f766e" stroke-width="6" stroke-linecap="round"/>'),
        routes: icon('<circle cx="22" cy="24" r="10" fill="#60a5fa"/><circle cx="74" cy="26" r="10" fill="#f97316"/><circle cx="30" cy="72" r="10" fill="#22c55e"/><circle cx="72" cy="70" r="10" fill="#a78bfa"/><path d="M31 28c18 8 28 8 34 2M31 66c17-8 27-8 34 0M25 34l4 28" stroke="#334155" stroke-width="5" stroke-linecap="round"/>'),
        people: icon('<circle cx="36" cy="30" r="12" fill="#fbbf24"/><circle cx="60" cy="34" r="10" fill="#38bdf8"/><path d="M18 74c3-18 33-18 37 0M45 74c3-15 28-14 32 0" fill="#e0f2fe" stroke="#2563eb" stroke-width="5" stroke-linecap="round"/>'),
        term: icon('<rect x="16" y="18" width="64" height="60" rx="10" fill="#ecfccb"/><path d="M30 36h36M30 50h24M30 64h30" stroke="#365314" stroke-width="6" stroke-linecap="round"/><path d="M64 20l12 12" stroke="#84cc16" stroke-width="7" stroke-linecap="round"/>'),
        quiz: icon('<rect x="18" y="16" width="60" height="64" rx="14" fill="#dbeafe"/><path d="M34 38c2-12 24-11 24 2 0 10-10 10-10 18" stroke="#1d4ed8" stroke-width="7" stroke-linecap="round"/><circle cx="48" cy="68" r="4" fill="#1d4ed8"/>'),
        correct: icon('<circle cx="48" cy="48" r="34" fill="#dcfce7"/><path d="M30 50l12 12 26-30" fill="none" stroke="#16a34a" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>'),
        coin: icon('<circle cx="48" cy="48" r="32" fill="#fde68a"/><circle cx="48" cy="48" r="22" fill="#f59e0b"/><path d="M38 39h16a8 8 0 010 16H38V31" fill="none" stroke="#fff7ed" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>'),
        filter: icon('<path d="M18 24h60L56 50v20l-16 8V50z" fill="#ede9fe" stroke="#7c3aed" stroke-width="6" stroke-linejoin="round"/><circle cx="68" cy="24" r="8" fill="#f59e0b"/>'),
        sort: icon('<path d="M32 20v52M32 72l-12-12M32 72l12-12M64 76V24M64 24L52 36M64 24l12 12" stroke="#0f766e" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>'),
        link: icon('<path d="M40 30l8-8a16 16 0 0123 23l-9 9M56 66l-8 8a16 16 0 01-23-23l9-9M37 59l22-22" fill="none" stroke="#2563eb" stroke-width="7" stroke-linecap="round"/>'),
        marathon: icon('<path d="M20 70c16-24 40-24 56 0" fill="none" stroke="#fb7185" stroke-width="8" stroke-linecap="round"/><circle cx="48" cy="34" r="12" fill="#fbbf24"/><path d="M34 54l14-12 14 12M48 42v28" fill="none" stroke="#0f172a" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>'),
        deep: icon('<rect x="18" y="16" width="48" height="64" rx="8" fill="#e0e7ff"/><path d="M30 34h24M30 48h18M30 62h24" stroke="#4338ca" stroke-width="6" stroke-linecap="round"/><circle cx="66" cy="66" r="14" fill="#fbbf24"/><path d="M76 76l8 8" stroke="#92400e" stroke-width="7" stroke-linecap="round"/>'),
        sparkle: icon('<path d="M48 10l8 24 24 8-24 8-8 24-8-24-24-8 24-8z" fill="#fef08a" stroke="#ca8a04" stroke-width="5" stroke-linejoin="round"/><path d="M74 14l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" fill="#f0abfc"/>'),
        background: icon('<rect x="14" y="18" width="68" height="56" rx="12" fill="#bfdbfe"/><circle cx="64" cy="34" r="10" fill="#facc15"/><path d="M18 68l22-24 16 14 10-10 16 20" fill="#22c55e"/>'),
        fullscreen: icon('<path d="M18 38V18h20M58 18h20v20M78 58v20H58M38 78H18V58" fill="none" stroke="#111827" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><rect x="34" y="34" width="28" height="28" rx="4" fill="#a7f3d0"/>'),
        search: icon('<circle cx="42" cy="42" r="22" fill="#dbeafe" stroke="#2563eb" stroke-width="7"/><path d="M58 58l18 18" stroke="#1e3a8a" stroke-width="8" stroke-linecap="round"/><path d="M31 39h22M31 50h14" stroke="#0f766e" stroke-width="5" stroke-linecap="round"/>'),
    };

    const ACHIEVEMENTS = [
        { id: 'guide-first', group: 'explore', title: '回到导览', description: '打开主页面一次。', icon: ICONS.guide, condition: (state) => hasPage(state, 'index') },
        { id: 'guide-returner', group: 'explore', title: '导览常客', description: '累计打开主页面 3 次。', icon: ICONS.guide, condition: (state) => Number(state.stats.pages.index || 0) >= 3 },
        { id: 'archive-opened', group: 'explore', title: '翻开档案', description: '进入记录页面一次。', icon: ICONS.archive, condition: (state) => hasPage(state, 'record') },
        { id: 'archive-regular', group: 'explore', title: '档案回访', description: '累计进入记录页面 5 次。', icon: ICONS.archive, condition: (state) => Number(state.stats.pages.record || 0) >= 5 },
        { id: 'all-rounder', group: 'explore', title: '四线巡游', description: '浏览记录、人物、术语和答题四个入口。', icon: ICONS.routes, condition: (state) => ['record', 'people', 'glossary', 'quiz'].every((page) => hasPage(state, page)) },
        { id: 'site-expedition', group: 'explore', title: '全站巡礼', description: '浏览主页面、记录、人物、术语、答题、成就和全站搜索。', icon: ICONS.routes, condition: (state) => ['index', 'record', 'people', 'glossary', 'quiz', 'achievements', 'search'].every((page) => hasPage(state, page)) },
        { id: 'entrance-clicker', group: 'interact', title: '入口试运行', description: '从主页面点击 3 个不同入口卡片或按钮。', icon: ICONS.routes, condition: (state) => state.stats.interactions.guideTargets.length >= 3 },
        { id: 'entrance-complete', group: 'interact', title: '入口全试', description: '从主页面点击 5 个不同入口卡片或按钮。', icon: ICONS.routes, condition: (state) => state.stats.interactions.guideTargets.length >= 5 },
        { id: 'name-browser-1', group: 'people', title: '点名开始', description: '查看 1 个不同的人物详情。', icon: ICONS.people, condition: (state) => state.stats.peopleViewed.length >= 1 },
        { id: 'name-collector', group: 'people', title: '点名册', description: '查看 5 个不同的人物详情。', icon: ICONS.people, condition: (state) => state.stats.peopleViewed.length >= 5 },
        { id: 'name-archivist', group: 'people', title: '熟人网络', description: '查看 15 个不同的人物详情。', icon: ICONS.people, condition: (state) => state.stats.peopleViewed.length >= 15 },
        { id: 'name-cartographer', group: 'people', title: '全员索引', description: '查看 30 个不同的人物详情。', icon: ICONS.people, condition: (state) => state.stats.peopleViewed.length >= 30 },
        { id: 'name-biographer', group: 'people', title: '人物传记员', description: '查看 45 个不同的人物详情。', icon: ICONS.people, condition: (state) => state.stats.peopleViewed.length >= 45 },
        { id: 'glossary-reader', group: 'term', title: '黑话入门', description: '查看 3 个不同的术语详情。', icon: ICONS.term, condition: (state) => state.stats.termsViewed.length >= 3 },
        { id: 'glossary-scholar', group: 'term', title: '词库巡礼', description: '查看 6 个不同的术语详情。', icon: ICONS.term, condition: (state) => state.stats.termsViewed.length >= 6 },
        { id: 'glossary-master', group: 'term', title: '术语通读', description: '查看 7 个不同的术语详情。', icon: ICONS.term, condition: (state) => state.stats.termsViewed.length >= 7 },
        { id: 'glossary-regular', group: 'term', title: '词条回访', description: '累计进入术语页面 3 次。', icon: ICONS.term, condition: (state) => Number(state.stats.pages.glossary || 0) >= 3 },
        { id: 'glossary-encyclopedia', group: 'term', title: '术语索引员', description: '查看全部 8 个术语详情。', icon: ICONS.term, condition: (state) => state.stats.termsViewed.length >= 8 },
        { id: 'record-linker', group: 'link', title: '顺藤摸瓜', description: '从记录正文中点击人物或术语链接 5 次。', icon: ICONS.link, condition: (state) => state.stats.interactions.recordLinkClicks >= 5 },
        { id: 'link-cartographer', group: 'link', title: '线索地图', description: '从记录正文中点击人物或术语链接 15 次。', icon: ICONS.link, condition: (state) => state.stats.interactions.recordLinkClicks >= 15 },
        { id: 'link-weaver', group: 'link', title: '线索织网', description: '从记录正文中点击人物或术语链接 30 次。', icon: ICONS.link, condition: (state) => state.stats.interactions.recordLinkClicks >= 30 },
        { id: 'link-constellation', group: 'link', title: '线索星图', description: '从记录正文中点击人物或术语链接 60 次。', icon: ICONS.link, condition: (state) => state.stats.interactions.recordLinkClicks >= 60 },
        { id: 'link-archaeologist', group: 'link', title: '线索考古', description: '从记录正文中点击人物或术语链接 100 次。', icon: ICONS.link, condition: (state) => state.stats.interactions.recordLinkClicks >= 100 },
        { id: 'filter-tuner', group: 'interact', title: '筛选调音师', description: '使用记录或答题筛选按钮 5 次。', icon: ICONS.filter, condition: (state) => state.stats.interactions.filterUses >= 5 },
        { id: 'filter-master', group: 'interact', title: '条件反射', description: '累计使用筛选 15 次。', icon: ICONS.filter, condition: (state) => state.stats.interactions.filterUses >= 15 },
        { id: 'filter-oracle', group: 'interact', title: '条件检索者', description: '累计使用筛选 30 次。', icon: ICONS.filter, condition: (state) => state.stats.interactions.filterUses >= 30 },
        { id: 'filter-precision', group: 'interact', title: '精确检索', description: '累计使用筛选 50 次。', icon: ICONS.filter, condition: (state) => state.stats.interactions.filterUses >= 50 },
        { id: 'filter-architect', group: 'interact', title: '筛选建筑师', description: '累计使用筛选 75 次。', icon: ICONS.filter, condition: (state) => state.stats.interactions.filterUses >= 75 },
        { id: 'search-first', group: 'interact', title: '检索启动', description: '使用任意搜索框完成 1 次搜索。', icon: ICONS.search, condition: (state) => state.stats.interactions.searchUses >= 1 },
        { id: 'search-regular', group: 'interact', title: '关键词熟手', description: '累计使用搜索 5 次。', icon: ICONS.search, condition: (state) => state.stats.interactions.searchUses >= 5 },
        { id: 'search-deep', group: 'interact', title: '检索深挖', description: '累计使用搜索 15 次。', icon: ICONS.search, condition: (state) => state.stats.interactions.searchUses >= 15 },
        { id: 'search-global', group: 'interact', title: '全站搜查', description: '使用全站搜索入口完成一次搜索。', icon: ICONS.search, condition: (state) => state.stats.interactions.searchScopes.includes('global') },
        { id: 'search-mixed', group: 'interact', title: '双线检索', description: '分别使用记录页搜索和全站搜索。', icon: ICONS.search, condition: (state) => ['record', 'global'].every((scope) => state.stats.interactions.searchScopes.includes(scope)) },
        { id: 'sort-flipper', group: 'interact', title: '排序翻面', description: '切换人物或术语排序 3 次。', icon: ICONS.sort, condition: (state) => state.stats.interactions.sortUses >= 3 },
        { id: 'sort-master', group: 'interact', title: '秩序重排', description: '累计切换排序 10 次。', icon: ICONS.sort, condition: (state) => state.stats.interactions.sortUses >= 10 },
        { id: 'sort-conductor', group: 'interact', title: '秩序指挥', description: '累计切换排序 25 次。', icon: ICONS.sort, condition: (state) => state.stats.interactions.sortUses >= 25 },
        { id: 'sort-orchestrator', group: 'interact', title: '排序总谱', description: '累计切换排序 50 次。', icon: ICONS.sort, condition: (state) => state.stats.interactions.sortUses >= 50 },
        { id: 'quiz-first', group: 'quizAnswered', title: '先答一题', description: '完成任意 1 道答题。', icon: ICONS.quiz, condition: (state) => state.stats.quiz.answered >= 1 },
        { id: 'quiz-warmup', group: 'quizAnswered', title: '十题热身', description: '累计完成 10 道答题。', icon: ICONS.quiz, condition: (state) => state.stats.quiz.answered >= 10 },
        { id: 'quiz-marathon', group: 'quizAnswered', title: '题海热身', description: '累计完成 30 道答题。', icon: ICONS.marathon, condition: (state) => state.stats.quiz.answered >= 30 },
        { id: 'quiz-half-century', group: 'quizAnswered', title: '五十题刻度', description: '累计完成 50 道答题。', icon: ICONS.marathon, condition: (state) => state.stats.quiz.answered >= 50 },
        { id: 'quiz-century', group: 'quizAnswered', title: '百题留痕', description: '累计完成 100 道答题。', icon: ICONS.marathon, condition: (state) => state.stats.quiz.answered >= 100 },
        { id: 'quiz-double-century', group: 'quizAnswered', title: '双百题卷', description: '累计完成 200 道答题。', icon: ICONS.marathon, condition: (state) => state.stats.quiz.answered >= 200 },
        { id: 'quiz-triple-century', group: 'quizAnswered', title: '三百题册', description: '累计完成 300 道答题。', icon: ICONS.marathon, condition: (state) => state.stats.quiz.answered >= 300 },
        { id: 'quiz-five-correct', group: 'quizCorrect', title: '校准答案', description: '累计答对 5 道题。', icon: ICONS.correct, condition: (state) => state.stats.quiz.correct >= 5 },
        { id: 'quiz-ten-correct', group: 'quizCorrect', title: '稳定发挥', description: '累计答对 10 道题。', icon: ICONS.correct, condition: (state) => state.stats.quiz.correct >= 10 },
        { id: 'quiz-fifty-correct', group: 'quizCorrect', title: '答案肌肉记忆', description: '累计答对 50 道题。', icon: ICONS.correct, condition: (state) => state.stats.quiz.correct >= 50 },
        { id: 'quiz-hundred-correct', group: 'quizCorrect', title: '百分校准', description: '累计答对 100 道题。', icon: ICONS.correct, condition: (state) => state.stats.quiz.correct >= 100 },
        { id: 'quiz-double-hundred-correct', group: 'quizCorrect', title: '双百校准', description: '累计答对 200 道题。', icon: ICONS.correct, condition: (state) => state.stats.quiz.correct >= 200 },
        { id: 'streak-three', group: 'quizStreak', title: '三连击', description: '连续答对 3 道题。', icon: ICONS.correct, condition: (state) => state.stats.quiz.bestStreak >= 3 },
        { id: 'streak-ten', group: 'quizStreak', title: '十连胜', description: '连续答对 10 道题。', icon: ICONS.correct, condition: (state) => state.stats.quiz.bestStreak >= 10 },
        { id: 'streak-twenty', group: 'quizStreak', title: '二十连斩', description: '连续答对 20 道题。', icon: ICONS.correct, condition: (state) => state.stats.quiz.bestStreak >= 20 },
        { id: 'streak-thirty', group: 'quizStreak', title: '三十连胜', description: '连续答对 30 道题。', icon: ICONS.correct, condition: (state) => state.stats.quiz.bestStreak >= 30 },
        { id: 'qcoin-keeper', group: 'coin', title: '小有积蓄', description: 'Q币余额达到 1000。', icon: ICONS.coin, condition: (state) => state.stats.balance >= 1000 },
        { id: 'qcoin-vault', group: 'coin', title: '金库初成', description: 'Q币余额达到 3000。', icon: ICONS.coin, condition: (state) => state.stats.balance >= 3000 },
        { id: 'qcoin-tycoon', group: 'coin', title: 'Q币大户', description: 'Q币余额达到 10000。', icon: ICONS.coin, condition: (state) => state.stats.balance >= 10000 },
        { id: 'qcoin-myth', group: 'coin', title: 'Q币神话', description: 'Q币余额达到 50000。', icon: ICONS.coin, condition: (state) => state.stats.balance >= 50000 },
        { id: 'deep-reader', group: 'detail', title: '深挖档案', description: '累计查看 12 个不同的人物或术语详情。', icon: ICONS.deep, condition: (state) => state.stats.peopleViewed.length + state.stats.termsViewed.length >= 12 },
        { id: 'detail-specialist', group: 'detail', title: '详情巡检', description: '累计查看 20 个不同的人物或术语详情。', icon: ICONS.deep, condition: (state) => state.stats.peopleViewed.length + state.stats.termsViewed.length >= 20 },
        { id: 'detail-curator', group: 'detail', title: '档案馆值班', description: '累计查看 35 个不同的人物或术语详情。', icon: ICONS.deep, condition: (state) => state.stats.peopleViewed.length + state.stats.termsViewed.length >= 35 },
        { id: 'detail-keeper', group: 'detail', title: '详情保管员', description: '累计查看 50 个不同的人物或术语详情。', icon: ICONS.deep, condition: (state) => state.stats.peopleViewed.length + state.stats.termsViewed.length >= 50 },
        { id: 'background-sampler', group: 'background', title: '换个天色', description: '使用过 3 种不同背景。', icon: ICONS.background, condition: (state) => state.stats.backgrounds.length >= 3 },
        { id: 'background-curator', group: 'background', title: '布景收藏家', description: '使用过 5 种不同背景。', icon: ICONS.background, condition: (state) => state.stats.backgrounds.length >= 5 },
        { id: 'background-director', group: 'background', title: '场景导演', description: '使用过 7 种不同背景。', icon: ICONS.background, condition: (state) => state.stats.backgrounds.length >= 7 },
        { id: 'achievement-spark', group: 'meta', title: '成就启程', description: '累计完成 5 个成就。', icon: ICONS.sparkle, condition: (state) => Object.keys(state.completed || {}).length >= 5 },
        { id: 'achievement-hunter', group: 'meta', title: '成就猎手', description: '累计完成 12 个成就。', icon: ICONS.sparkle, condition: (state) => Object.keys(state.completed || {}).length >= 12 },
        { id: 'achievement-completionist', group: 'meta', title: '奖章陈列室', description: '累计完成 24 个成就。', icon: ICONS.sparkle, condition: (state) => Object.keys(state.completed || {}).length >= 24 },
        { id: 'achievement-master', group: 'meta', title: '满柜奖章', description: '累计完成 36 个成就。', icon: ICONS.sparkle, condition: (state) => Object.keys(state.completed || {}).length >= 36 },
        { id: 'achievement-grandmaster', group: 'meta', title: '奖章满墙', description: '累计完成 48 个成就。', icon: ICONS.sparkle, condition: (state) => Object.keys(state.completed || {}).length >= 48 },
        { id: 'achievement-legend', group: 'meta', title: '成就名册', description: '累计完成 60 个成就。', icon: ICONS.sparkle, condition: (state) => Object.keys(state.completed || {}).length >= 60 },
        { id: 'achievement-check', group: 'meta', title: '翻领奖册', description: '进入成就页面查看进度。', icon: ICONS.sparkle, condition: (state) => hasPage(state, 'achievements') },
        { id: 'achievement-returner', group: 'meta', title: '奖章复盘', description: '累计进入成就页面 3 次。', icon: ICONS.sparkle, condition: (state) => Number(state.stats.pages.achievements || 0) >= 3 },
        { id: 'hidden-lamian', group: 'hidden', title: '拉面暗号', description: '发现答题页里的隐藏题入口。', icon: ICONS.sparkle, hidden: true, condition: (state) => state.stats.secrets.includes('lamian') },
        { id: 'hidden-logo', group: 'hidden', title: '敲敲招牌', description: '发现主页面 logo 上的小彩蛋。', icon: ICONS.sparkle, hidden: true, condition: (state) => state.stats.secrets.includes('guide-logo') },
        { id: 'hidden-fullscreen', group: 'hidden', title: '沉浸阅读', description: '进入过一次全屏浏览。', icon: ICONS.fullscreen, hidden: true, condition: (state) => state.stats.fullscreenEntries >= 1 }
    ];

    const DEFAULT_STATE = {
        completed: {},
        seenCompleted: [],
        notifiedCompleted: [],
        stats: {
            pages: {},
            peopleViewed: [],
            termsViewed: [],
            backgrounds: [],
            secrets: [],
            fullscreenEntries: 0,
            quiz: { answered: 0, correct: 0, currentStreak: 0, bestStreak: 0 },
            balance: 0,
            interactions: {
                guideTargets: [],
                filterUses: 0,
                sortUses: 0,
                recordLinkClicks: 0,
                logoTaps: 0,
                searchUses: 0,
                searchScopes: [],}
        }
    };

    const clone = (value) => JSON.parse(JSON.stringify(value));
    const ACHIEVEMENT_IDS = new Set(ACHIEVEMENTS.map((achievement) => achievement.id));
    const uniquePush = (list, value) => value && list.includes(value) ? list : [...list, value].filter(Boolean);
    const hasPage = (state, page) => Number(state.stats.pages[page] || 0) > 0;

    function mergeState(raw) {
        const state = clone(DEFAULT_STATE);
        if (!raw || typeof raw !== 'object') return state;
        state.completed = raw.completed && typeof raw.completed === 'object'
            ? Object.fromEntries(Object.entries(raw.completed).filter(([id]) => ACHIEVEMENT_IDS.has(id)))
            : {};
        state.seenCompleted = Array.isArray(raw.seenCompleted) ? [...new Set(raw.seenCompleted)].filter((id) => ACHIEVEMENT_IDS.has(id)) : [];
        state.notifiedCompleted = Array.isArray(raw.notifiedCompleted) ? [...new Set(raw.notifiedCompleted)].filter((id) => ACHIEVEMENT_IDS.has(id)) : [];
        state.stats = { ...state.stats, ...(raw.stats || {}) };
        state.stats.pages = { ...(raw.stats?.pages || {}) };
        state.stats.peopleViewed = Array.isArray(raw.stats?.peopleViewed) ? [...new Set(raw.stats.peopleViewed)] : [];
        state.stats.termsViewed = Array.isArray(raw.stats?.termsViewed) ? [...new Set(raw.stats.termsViewed)] : [];
        state.stats.backgrounds = Array.isArray(raw.stats?.backgrounds) ? [...new Set(raw.stats.backgrounds)] : [];
        state.stats.secrets = Array.isArray(raw.stats?.secrets) ? [...new Set(raw.stats.secrets)] : [];
        state.stats.fullscreenEntries = Number(raw.stats?.fullscreenEntries) || 0;
        state.stats.quiz = { ...DEFAULT_STATE.stats.quiz, ...(raw.stats?.quiz || {}) };
        state.stats.balance = Number(raw.stats?.balance) || 0;
        state.stats.interactions = { ...DEFAULT_STATE.stats.interactions, ...(raw.stats?.interactions || {}) };
        state.stats.interactions.guideTargets = Array.isArray(raw.stats?.interactions?.guideTargets) ? [...new Set(raw.stats.interactions.guideTargets)] : [];
        state.stats.interactions.filterUses = Number(raw.stats?.interactions?.filterUses) || 0;
        state.stats.interactions.sortUses = Number(raw.stats?.interactions?.sortUses) || 0;
        state.stats.interactions.recordLinkClicks = Number(raw.stats?.interactions?.recordLinkClicks) || 0;
        state.stats.interactions.logoTaps = Number(raw.stats?.interactions?.logoTaps) || 0;
        state.stats.interactions.searchUses = Number(raw.stats?.interactions?.searchUses) || 0;
        state.stats.interactions.searchScopes = Array.isArray(raw.stats?.interactions?.searchScopes) ? [...new Set(raw.stats.interactions.searchScopes)] : [];
        return state;
    }

    function maxNumber(a, b) {
        return Math.max(Number(a) || 0, Number(b) || 0);
    }

    function unionList(a, b) {
        return [...new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])].filter(Boolean))];
    }

    function mergeAchievementStates(localRaw, remoteRaw) {
        const local = mergeState(localRaw);
        const remote = mergeState(remoteRaw);
        const state = mergeState(remote);
        state.completed = { ...remote.completed };
        Object.entries(local.completed || {}).forEach(([id, completedAt]) => {
            if (!ACHIEVEMENT_IDS.has(id)) return;
            const remoteCompletedAt = Number(state.completed[id]) || 0;
            const localCompletedAt = Number(completedAt) || Date.now();
            state.completed[id] = remoteCompletedAt ? Math.min(remoteCompletedAt, localCompletedAt) : localCompletedAt;
        });
        const completedIds = Object.keys(state.completed);
        state.seenCompleted = unionList(unionList(remote.seenCompleted, local.seenCompleted), completedIds);
        state.notifiedCompleted = unionList(unionList(remote.notifiedCompleted, local.notifiedCompleted), completedIds);
        state.stats.pages = { ...remote.stats.pages };
        Object.entries(local.stats.pages || {}).forEach(([page, count]) => {
            state.stats.pages[page] = maxNumber(state.stats.pages[page], count);
        });
        state.stats.peopleViewed = unionList(remote.stats.peopleViewed, local.stats.peopleViewed);
        state.stats.termsViewed = unionList(remote.stats.termsViewed, local.stats.termsViewed);
        state.stats.backgrounds = unionList(remote.stats.backgrounds, local.stats.backgrounds);
        state.stats.secrets = unionList(remote.stats.secrets, local.stats.secrets);
        state.stats.fullscreenEntries = maxNumber(remote.stats.fullscreenEntries, local.stats.fullscreenEntries);
        state.stats.quiz = {
            answered: maxNumber(remote.stats.quiz.answered, local.stats.quiz.answered),
            correct: maxNumber(remote.stats.quiz.correct, local.stats.quiz.correct),
            currentStreak: maxNumber(remote.stats.quiz.currentStreak, local.stats.quiz.currentStreak),
            bestStreak: maxNumber(remote.stats.quiz.bestStreak, local.stats.quiz.bestStreak)
        };
        state.stats.balance = maxNumber(remote.stats.balance, local.stats.balance);
        state.stats.interactions = {
            guideTargets: unionList(remote.stats.interactions.guideTargets, local.stats.interactions.guideTargets),
            filterUses: maxNumber(remote.stats.interactions.filterUses, local.stats.interactions.filterUses),
            sortUses: maxNumber(remote.stats.interactions.sortUses, local.stats.interactions.sortUses),
            recordLinkClicks: maxNumber(remote.stats.interactions.recordLinkClicks, local.stats.interactions.recordLinkClicks),
            logoTaps: maxNumber(remote.stats.interactions.logoTaps, local.stats.interactions.logoTaps),
            searchUses: maxNumber(remote.stats.interactions.searchUses, local.stats.interactions.searchUses),
            searchScopes: unionList(remote.stats.interactions.searchScopes, local.stats.interactions.searchScopes)
        };
        return state;
    }

    function settleExistingCompleted(state) {
        const ids = Object.keys(state.completed || {});
        state.seenCompleted = unionList(state.seenCompleted, ids);
        state.notifiedCompleted = unionList(state.notifiedCompleted, ids);
        return state;
    }

    function getCurrentUserId() {
        return window.getCurrentUser?.()?.id || '';
    }

    function getAchievementStorageKey() {
        const userId = getCurrentUserId();
        return userId ? `${STORAGE_KEY}:${userId}` : '';
    }

    function readState() {
        const storageKey = getAchievementStorageKey();
        if (!storageKey) return clone(DEFAULT_STATE);
        try {
            return mergeState(JSON.parse(localStorage.getItem(storageKey) || 'null'));
        } catch (error) {
            return clone(DEFAULT_STATE);
        }
    }

    function readQcoinState() {
        const userId = getCurrentUserId();
        const storageKey = userId ? `${QCOIN_STORAGE_KEY}:${userId}` : '';
        if (!storageKey) return {};
        try {
            const raw = JSON.parse(localStorage.getItem(storageKey) || 'null');
            return raw && typeof raw === 'object' ? raw : {};
        } catch (error) {
            return {};
        }
    }

    let currentState = readState();
    let remoteStateReady = false;
    let syncingRemoteState = null;
    let evaluatingAchievementState = false;
    const pendingRecords = [];
    const listeners = new Set();

    function saveState() {
        const storageKey = getAchievementStorageKey();
        if (storageKey) localStorage.setItem(storageKey, JSON.stringify(currentState));
        window.ClassRecordUserState?.saveAchievementState?.(currentState);
        window.ClassRecordSupabase?.updateProfileState?.({
            achievement_progress: currentState.completed || {},
            achievement_hovered_state: { seenCompleted: currentState.seenCompleted || [], notifiedCompleted: currentState.notifiedCompleted || [] }
        }).catch(() => {});
    }

    function syncQcoinStats(sourceState) {
        const qcoin = sourceState || readQcoinState();
        currentState.stats.balance = Number(qcoin.balance) || 0;
        currentState.stats.quiz = {
            ...currentState.stats.quiz,
            answered: Number(qcoin.quiz?.answered) || 0,
            correct: Number(qcoin.quiz?.correct) || 0
        };
    }

    function ratio(value, target) {
        const safeValue = Number(value) || 0;
        const safeTarget = Number(target) || 1;
        return Math.max(0, Math.min(1, safeValue / safeTarget));
    }

    function progressForAchievement(achievement, state) {
        const interactions = state.stats.interactions;
        const pages = state.stats.pages;
        const detailCount = state.stats.peopleViewed.length + state.stats.termsViewed.length;
        const completedCount = Object.keys(state.completed || {}).length;
        const pageProgress = (keys) => ratio(keys.filter((key) => Number(pages[key] || 0) > 0).length, keys.length);
        const progressMap = {
            'guide-first': () => pageProgress(['index']),
            'guide-returner': () => ratio(pages.index, 3),
            'archive-opened': () => pageProgress(['record']),
            'archive-regular': () => ratio(pages.record, 5),
            'entrance-clicker': () => ratio(interactions.guideTargets.length, 3),
            'entrance-complete': () => ratio(interactions.guideTargets.length, 5),
            'all-rounder': () => pageProgress(['record', 'people', 'glossary', 'quiz']),
            'site-expedition': () => pageProgress(['index', 'record', 'people', 'glossary', 'quiz', 'achievements', 'search']),
            'name-collector': () => ratio(state.stats.peopleViewed.length, 5),
            'name-browser-1': () => ratio(state.stats.peopleViewed.length, 1),
            'name-archivist': () => ratio(state.stats.peopleViewed.length, 15),
            'name-cartographer': () => ratio(state.stats.peopleViewed.length, 30),
            'name-biographer': () => ratio(state.stats.peopleViewed.length, 45),
            'glossary-reader': () => ratio(state.stats.termsViewed.length, 3),
            'glossary-scholar': () => ratio(state.stats.termsViewed.length, 6),
            'glossary-master': () => ratio(state.stats.termsViewed.length, 7),
            'glossary-regular': () => ratio(pages.glossary, 3),
            'glossary-encyclopedia': () => ratio(state.stats.termsViewed.length, 8),
            'record-linker': () => ratio(interactions.recordLinkClicks, 5),
            'link-constellation': () => ratio(interactions.recordLinkClicks, 60),
            'link-archaeologist': () => ratio(interactions.recordLinkClicks, 100),
            'filter-tuner': () => ratio(interactions.filterUses, 5),
            'filter-precision': () => ratio(interactions.filterUses, 50),
            'filter-architect': () => ratio(interactions.filterUses, 75),
            'search-first': () => ratio(interactions.searchUses, 1),
            'search-regular': () => ratio(interactions.searchUses, 5),
            'search-deep': () => ratio(interactions.searchUses, 15),
            'search-global': () => ratio(interactions.searchScopes.includes('global') ? 1 : 0, 1),
            'search-mixed': () => ratio(['record', 'global'].filter((scope) => interactions.searchScopes.includes(scope)).length, 2),
            'sort-flipper': () => ratio(interactions.sortUses, 3),
            'sort-master': () => ratio(interactions.sortUses, 10),
            'sort-conductor': () => ratio(interactions.sortUses, 25),
            'sort-orchestrator': () => ratio(interactions.sortUses, 50),
            'quiz-first': () => ratio(state.stats.quiz.answered, 1),
            'quiz-warmup': () => ratio(state.stats.quiz.answered, 10),
            'quiz-ten-correct': () => ratio(state.stats.quiz.correct, 10),
            'quiz-marathon': () => ratio(state.stats.quiz.answered, 30),
            'quiz-half-century': () => ratio(state.stats.quiz.answered, 50),
            'quiz-century': () => ratio(state.stats.quiz.answered, 100),
            'quiz-double-century': () => ratio(state.stats.quiz.answered, 200),
            'quiz-triple-century': () => ratio(state.stats.quiz.answered, 300),
            'quiz-five-correct': () => ratio(state.stats.quiz.correct, 5),
            'quiz-fifty-correct': () => ratio(state.stats.quiz.correct, 50),
            'quiz-hundred-correct': () => ratio(state.stats.quiz.correct, 100),
            'quiz-double-hundred-correct': () => ratio(state.stats.quiz.correct, 200),
            'streak-three': () => ratio(state.stats.quiz.bestStreak, 3),
            'streak-ten': () => ratio(state.stats.quiz.bestStreak, 10),
            'streak-twenty': () => ratio(state.stats.quiz.bestStreak, 20),
            'streak-thirty': () => ratio(state.stats.quiz.bestStreak, 30),
            'qcoin-keeper': () => ratio(state.stats.balance, 1000),
            'qcoin-vault': () => ratio(state.stats.balance, 3000),
            'qcoin-tycoon': () => ratio(state.stats.balance, 10000),
            'qcoin-myth': () => ratio(state.stats.balance, 50000),
            'deep-reader': () => ratio(detailCount, 12),
            'detail-specialist': () => ratio(detailCount, 20),
            'detail-curator': () => ratio(detailCount, 35),
            'detail-keeper': () => ratio(detailCount, 50),
            'filter-master': () => ratio(interactions.filterUses, 15),
            'filter-oracle': () => ratio(interactions.filterUses, 30),
            'link-cartographer': () => ratio(interactions.recordLinkClicks, 15),
            'link-weaver': () => ratio(interactions.recordLinkClicks, 30),
            'background-sampler': () => ratio(state.stats.backgrounds.length, 3),
            'background-curator': () => ratio(state.stats.backgrounds.length, 5),
            'background-director': () => ratio(state.stats.backgrounds.length, 7),
            'achievement-spark': () => ratio(completedCount, 5),
            'achievement-hunter': () => ratio(completedCount, 12),
            'achievement-completionist': () => ratio(completedCount, 24),
            'achievement-master': () => ratio(completedCount, 36),
            'achievement-grandmaster': () => ratio(completedCount, 48),
            'achievement-legend': () => ratio(completedCount, 60),
            'achievement-check': () => pageProgress(['achievements']),
            'achievement-returner': () => ratio(pages.achievements, 3)
        };
        const progress = progressMap[achievement.id]?.() || (achievement.condition(state) ? 1 : 0);
        return achievement.hidden ? 0 : progress;
    }

    function getAchievementView(state = currentState) {
        return ACHIEVEMENTS.map((achievement) => ({
            ...achievement,
            completed: Boolean(state.completed[achievement.id]),
            completedAt: state.completed[achievement.id] || 0,
            seen: state.seenCompleted.includes(achievement.id),
            progress: progressForAchievement(achievement, state)
        }));
    }

    function ensureUnlockHost() {
        let host = document.getElementById('achievement-unlock-stack');
        if (!host) {
            host = document.createElement('div');
            host.id = 'achievement-unlock-stack';
            host.className = 'achievement-unlock-stack';
            document.body.appendChild(host);
        }
        return host;
    }

    function readNotifyQueue() {
        try {
            const raw = JSON.parse(sessionStorage.getItem(NOTIFY_QUEUE_KEY) || '[]');
            return Array.isArray(raw) ? raw.filter((item) => item && item.id && item.notifyId) : [];
        } catch (error) {
            return [];
        }
    }

    function writeNotifyQueue(queue) {
        try {
            sessionStorage.setItem(NOTIFY_QUEUE_KEY, JSON.stringify(queue));
        } catch (error) {
            // Ignore session storage failures.
        }
    }

    function enqueueAchievementNotice(achievement) {
        const queue = readNotifyQueue().filter((item) => item.id !== achievement.id);
        const notifyId = `${achievement.id}:${Date.now()}`;
        queue.push({ id: achievement.id, notifyId, createdAt: Date.now() });
        writeNotifyQueue(queue);
        return notifyId;
    }

    function removeAchievementNotice(notifyId) {
        if (!notifyId) return;
        writeNotifyQueue(readNotifyQueue().filter((item) => item.notifyId !== notifyId));
    }

    function notifyAchievement(achievement, { notifyId = '' } = {}) {
        const host = ensureUnlockHost();
        const notice = document.createElement('div');
        notice.className = `achievement-unlock${achievement.hidden ? ' is-hidden-unlock' : ''}`;
        notice.innerHTML = `
            <div class="achievement-unlock-burst" aria-hidden="true"></div>
            <div class="achievement-unlock-art">${achievement.icon}</div>
            <div class="achievement-unlock-copy">
                <span>${achievement.hidden ? '隐藏成就解锁' : '成就达成'}</span>
                <strong>${achievement.title}</strong>
                <p>${achievement.description}</p>
            </div>
        `;
        host.appendChild(notice);
        requestAnimationFrame(() => notice.classList.add('is-visible'));
        window.setTimeout(() => {
            notice.classList.remove('is-visible');
            window.setTimeout(() => {
                notice.remove();
                removeAchievementNotice(notifyId);
            }, NOTIFY_REMOVE_MS);
        }, NOTIFY_VISIBLE_MS);
    }

    function evaluate({ notify = true } = {}) {
        if (evaluatingAchievementState) return [];
        evaluatingAchievementState = true;
        syncQcoinStats();
        const unlocked = [];
        try {
            ACHIEVEMENTS.forEach((achievement) => {
                if (currentState.completed[achievement.id]) return;
                if (!achievement.condition(currentState)) return;
                currentState.completed[achievement.id] = Date.now();
                unlocked.push(achievement);
            });
            const notifyTargets = notify
                ? unlocked.filter((achievement) => !currentState.notifiedCompleted.includes(achievement.id))
                : [];
            if (notifyTargets.length) {
                currentState.notifiedCompleted = [...new Set([...currentState.notifiedCompleted, ...notifyTargets.map((achievement) => achievement.id)])];
            }
            if (unlocked.length || notifyTargets.length) saveState();
            if (unlocked.length) {
                const snapshot = getAchievementView();
                listeners.forEach((listener) => listener(snapshot, unlocked));
                window.dispatchEvent(new CustomEvent('achievementchange', { detail: { achievements: snapshot, unlocked } }));
                notifyTargets.forEach((achievement) => notifyAchievement(achievement, { notifyId: enqueueAchievementNotice(achievement) }));
            }
        } finally {
            evaluatingAchievementState = false;
        }
        return unlocked;
    }
    function record(type, value) {
        if (window.ClassRecordHiddenModeActive) return;
        if (!remoteStateReady) {
            pendingRecords.push([type, value]);
            return;
        }
        if (type === 'page') {
            currentState.stats.pages[value] = Number(currentState.stats.pages[value] || 0) + 1;
        } else if (type === 'person') {
            currentState.stats.peopleViewed = uniquePush(currentState.stats.peopleViewed, value);
        } else if (type === 'term') {
            currentState.stats.termsViewed = uniquePush(currentState.stats.termsViewed, value);
        } else if (type === 'background') {
            currentState.stats.backgrounds = uniquePush(currentState.stats.backgrounds, value);
        } else if (type === 'secret') {
            currentState.stats.secrets = uniquePush(currentState.stats.secrets, value);
        } else if (type === 'fullscreen') {
            currentState.stats.fullscreenEntries += 1;
        } else if (type === 'guide-target') {
            currentState.stats.interactions.guideTargets = uniquePush(currentState.stats.interactions.guideTargets, value);
        } else if (type === 'filter') {
            currentState.stats.interactions.filterUses += 1;
        } else if (type === 'sort') {
            currentState.stats.interactions.sortUses += 1;
        } else if (type === 'record-link') {
            currentState.stats.interactions.recordLinkClicks += 1;
        } else if (type === 'logo-tap') {
            currentState.stats.interactions.logoTaps += 1;
        } else if (type === 'search') {
            currentState.stats.interactions.searchUses += 1;
            currentState.stats.interactions.searchScopes = uniquePush(currentState.stats.interactions.searchScopes, value || 'record');
        }
        saveState();
        evaluate();
    }

    function recordCurrentPage() {
        const path = window.location.pathname.split('/').pop() || 'index.html';
        const params = new URLSearchParams(window.location.search);
        const pageMap = {
            'index.html': 'index',
            'record.html': 'record',
            'people.html': 'people',
            'glossary.html': 'glossary',
            'quiz.html': 'quiz',
            'achievements.html': 'achievements',
            'search.html': 'search'
        };
        const page = pageMap[path] || (path === '' ? 'index' : path.replace(/\.html$/i, ''));
        record('page', page);
        if (path === 'person.html') record('person', params.get('id'));
        if (path === 'term.html') record('term', params.get('id'));
    }

    function bindInteractionTracking() {
        document.addEventListener('click', (event) => {
            const guideTarget = event.target.closest('[data-target], [data-nav-target="achievements.html"]');
            if (guideTarget && document.body.classList.contains('guide-page')) {
                record('guide-target', guideTarget.getAttribute('data-target') || guideTarget.getAttribute('data-nav-target'));
            }
            if (event.target.closest('.record-filter .filter-option, .quiz-filter .filter-option, .filter-important, .filter-exclude-daily, .clear, .quiz-filter-all')) {
                record('filter', 'use');
            }
            if (event.target.closest('.sort-option, .sort-order-toggle')) {
                record('sort', 'use');
            }
            if (event.target.closest('.person-tag, .term-tag, .term-tooltip')) {
                record('record-link', 'use');
            }
        }, { capture: true });
    }

    window.AchievementState = {
        definitions: ACHIEVEMENTS.map((achievement) => ({ ...achievement })),
        getState() {
            syncQcoinStats();
            evaluate({ notify: false });
            return clone(currentState);
        },
        getAchievements() {
            syncQcoinStats();
            evaluate({ notify: false });
            return getAchievementView();
        },
        consumeNewCompleted() {
            syncQcoinStats();
            evaluate({ notify: false });
            const unseen = ACHIEVEMENTS
                .filter((achievement) => currentState.completed[achievement.id] && !currentState.seenCompleted.includes(achievement.id))
                .map((achievement) => achievement.id);
            currentState.seenCompleted = [...new Set([...currentState.seenCompleted, ...unseen])];
            saveState();
            return unseen;
        },
        record,
        subscribe(listener) {
            if (typeof listener !== 'function') return () => {};
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    };

    window.addEventListener('qcoinchange', (event) => {
        if (event.detail?.reason === 'quiz-result') {
            if (event.detail.isCorrect) {
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

    document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement) record('fullscreen', 'entered');
    });

    function flushPendingRecords() {
        if (!remoteStateReady || !pendingRecords.length) return;
        const records = pendingRecords.splice(0, pendingRecords.length);
        records.forEach(([type, value]) => record(type, value));
    }

    function syncRemoteAchievementState() {
        if (syncingRemoteState) return syncingRemoteState;
        syncingRemoteState = (window.ClassRecordUserState?.ready || Promise.resolve())
            .then(() => window.ClassRecordUserState?.getAchievementState?.())
            .then((remoteState) => {
                if (remoteState && Object.keys(remoteState).length) {
                    currentState = mergeAchievementStates(readState(), remoteState);
                } else {
                    currentState = settleExistingCompleted(readState());
                    window.ClassRecordUserState?.saveAchievementState?.(currentState);
                }
                syncQcoinStats();
                evaluate({ notify: false });
                remoteStateReady = true;
                listeners.forEach((listener) => listener(getAchievementView(), []));
                window.dispatchEvent(new CustomEvent("achievementchange", { detail: { achievements: getAchievementView(), unlocked: [] } }));
                flushPendingRecords();
            })
            .catch((error) => {
                console.warn('Account achievement state load failed:', error);
                remoteStateReady = true;
                flushPendingRecords();
            })
            .finally(() => {
                syncingRemoteState = null;
            });
        return syncingRemoteState;
    }

    function replayQueuedNotifications() {
        const queue = readNotifyQueue();
        if (!queue.length) return;
        const now = Date.now();
        const validQueue = queue.filter((item) => now - Number(item.createdAt || 0) < 30000 && !currentState.notifiedCompleted.includes(item.id));
        writeNotifyQueue(validQueue);
        validQueue.forEach((item, index) => {
            const achievement = ACHIEVEMENTS.find((entry) => entry.id === item.id);
            if (!achievement) {
                removeAchievementNotice(item.notifyId);
                return;
            }
            window.setTimeout(() => notifyAchievement(achievement, { notifyId: item.notifyId }), index * 180);
        });
    }

    bindInteractionTracking();
    const initialRemoteSync = syncRemoteAchievementState();
    window.addEventListener('classRecordUserStateReady', syncRemoteAchievementState);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initialRemoteSync.finally(() => {
                replayQueuedNotifications();
                recordCurrentPage();
            });
        }, { once: true });
    } else {
        initialRemoteSync.finally(() => {
            replayQueuedNotifications();
            recordCurrentPage();
        });
    }
})();
