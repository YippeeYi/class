(() => {
    const STORAGE_KEY = 'classRecord:qcoinState';
    const DEFAULT_STATE = {
        balance: 0,
        ownedBackgroundIds: ['default'],
        quiz: { answered: 0, correct: 0 }
    };

    const BACKGROUND_COSTS = {
        'your-name': 1200,
        'weathering-with-you': 1200,
        'blue-sky-mountain': 700,
        'red-sun': 900,
        'green-forest': 700,
        'dark-blue-sky': 900,
        'dark-red-ship': 900,
        'pink-orange': 800
    };

    const listeners = new Set();
    const clone = (value) => JSON.parse(JSON.stringify(value));

    function mergeState(raw) {
        const state = clone(DEFAULT_STATE);
        if (!raw || typeof raw !== 'object') return state;
        state.balance = Number.isFinite(raw.balance) ? raw.balance : 0;
        state.ownedBackgroundIds = Array.isArray(raw.ownedBackgroundIds)
            ? [...new Set(['default', ...raw.ownedBackgroundIds])]
            : ['default'];
        state.quiz = { ...state.quiz, ...(raw.quiz || {}) };
        return state;
    }

    function readState() {
        try {
            return mergeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'));
        } catch (error) {
            return clone(DEFAULT_STATE);
        }
    }

    let currentState = readState();

    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));
        } catch (error) {
            // Ignore storage failures and keep the in-memory state for this session.
        }
    }

    function emitChange(reason, detail = {}) {
        saveState();
        const snapshot = clone(currentState);
        listeners.forEach((listener) => listener(snapshot, reason, detail));
        window.dispatchEvent(new CustomEvent('qcoinchange', { detail: { state: snapshot, reason, ...detail } }));
    }

    function ensureToastHost() {
        let host = document.getElementById('app-toast-stack');
        if (!host) {
            host = document.createElement('div');
            host.id = 'app-toast-stack';
            host.className = 'app-toast-stack';
            document.body.appendChild(host);
        }
        return host;
    }

    window.showAppToast = function (message, type = 'info') {
        const host = ensureToastHost();
        const toast = document.createElement('div');
        toast.className = `app-toast is-${type}`;
        toast.textContent = message;
        host.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('is-visible'));
        window.setTimeout(() => {
            toast.classList.remove('is-visible');
            window.setTimeout(() => toast.remove(), 220);
        }, 2200);
    };

    function syncBalanceTargets() {
        document.querySelectorAll('[data-qcoin-balance]').forEach((node) => {
            node.textContent = String(currentState.balance);
        });
        document.querySelectorAll('[data-qcoin-quiz-correct]').forEach((node) => {
            node.textContent = String(currentState.quiz.correct);
        });
    }

    function ensureBalanceChip() {
        if (document.body.classList.contains('auth-page')) return;
        if (document.querySelector('.qcoin-mini')) return;
        const chip = document.createElement('div');
        chip.className = 'qcoin-mini';
        chip.innerHTML = 'Q币 <strong data-qcoin-balance>0</strong>';
        document.body.prepend(chip);
        syncBalanceTargets();
    }

    function notify(message, type = 'info') {
        window.showAppToast?.(message, type);
    }

    function getBackgroundOptions() {
        return Array.isArray(window.BACKGROUND_OPTIONS) ? window.BACKGROUND_OPTIONS : [];
    }

    function normalizeBackgroundItem(option) {
        const id = String(option?.id || '').trim();
        const rawMeta = String(option?.meta || '');
        const title = rawMeta && !rawMeta.includes('<') ? rawMeta : String(option?.label || id);
        return {
            id,
            title,
            label: String(option?.label || id),
            category: String(option?.category || '其他'),
            description: '',
            cost: Number(BACKGROUND_COSTS[id]) || 0,
            preview: option?.preview || '',
            image: option?.image || '',
            type: 'background'
        };
    }

    function getBackgroundItems() {
        return getBackgroundOptions()
            .map(normalizeBackgroundItem)
            .filter((item) => item.id);
    }

    function ownsBackground(backgroundId) {
        return backgroundId === 'default' || currentState.ownedBackgroundIds.includes(backgroundId);
    }

    window.QcoinState = {
        get shopItems() {
            return getBackgroundItems();
        },
        getState() {
            return clone(currentState);
        },
        subscribe(listener) {
            if (typeof listener !== 'function') return () => { };
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        getBalance() {
            return currentState.balance;
        },
        addCoins(amount, reason = 'earn') {
            const safeAmount = Number(amount);
            if (!Number.isFinite(safeAmount) || safeAmount <= 0) return false;
            currentState.balance += safeAmount;
            emitChange(reason, { amount: safeAmount });
            return true;
        },
        spendCoins(amount, reason = 'spend') {
            const safeAmount = Number(amount);
            if (!Number.isFinite(safeAmount) || safeAmount <= 0) return false;
            if (currentState.balance < safeAmount) return false;
            currentState.balance -= safeAmount;
            emitChange(reason, { amount: safeAmount });
            return true;
        },
        getBackgroundCost(backgroundId) {
            return Number(BACKGROUND_COSTS[backgroundId]) || 0;
        },
        ownsBackground,
        purchaseBackground(backgroundId) {
            const item = getBackgroundItems().find((entry) => entry.id === backgroundId);
            if (!item) return false;
            if (ownsBackground(item.id)) {
                notify('已经拥有该背景。', 'info');
                return true;
            }
            if (!this.spendCoins(item.cost, 'background-spend')) {
                notify(`Q币不足，还需要 ${Math.max(0, item.cost - currentState.balance)}。`, 'error');
                return false;
            }
            currentState.ownedBackgroundIds = [...new Set([...currentState.ownedBackgroundIds, item.id])];
            emitChange('background-purchase', { backgroundId: item.id, cost: item.cost });
            notify(`已购买背景：${item.title}。`, 'success');
            return true;
        },
        hasPurchase(itemId) {
            return ownsBackground(itemId);
        },
        purchaseItem(itemId) {
            return this.purchaseBackground(itemId);
        },
        recordQuizResult(isCorrect) {
            currentState.quiz.answered += 1;
            if (isCorrect) currentState.quiz.correct += 1;
            emitChange('quiz-result', { isCorrect });
        }
    };

    window.addEventListener('storage', (event) => {
        if (event.key !== STORAGE_KEY) return;
        currentState = readState();
        syncBalanceTargets();
    });

    document.addEventListener('DOMContentLoaded', () => {
        ensureBalanceChip();
        syncBalanceTargets();
    }, { once: true });
    window.QcoinState.subscribe(syncBalanceTargets);

    window.ClassRecordUserState?.getQcoinState?.().then((remoteState) => {
        if (!remoteState || !Object.keys(remoteState).length) {
            window.ClassRecordUserState?.saveQcoinState?.(currentState);
            return;
        }
        currentState = mergeState(remoteState);
        syncBalanceTargets();
        emitChange("remote-sync");
    }).catch((error) => console.warn("账号 Q币状态加载失败：", error));
})();


