(() => {
    const QUESTION_REWARD = 100;
    const questionText = document.getElementById('quiz-question-text');
    const questionMeta = document.getElementById('quiz-question-meta');
    const optionsWrap = document.getElementById('quiz-options');
    const feedback = document.getElementById('quiz-feedback');
    const nextButton = document.getElementById('quiz-next-btn');

    let questionBank = [];
    let currentQuestion = null;
    let answeredCurrent = false;

    function shuffle(list) {
        const copy = [...list];
        for (let index = copy.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(Math.random() * (index + 1));
            [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
        }
        return copy;
    }

    function pickRandom(list) {
        if (!Array.isArray(list) || list.length === 0) {
            return null;
        }
        return list[Math.floor(Math.random() * list.length)];
    }

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function extractLabeledTokens(text) {
        const tokens = [];
        const patterns = [
            /\[\[([a-zA-Z0-9_-]+)\|(.+?)\]\]/g,
            /\{\{([a-zA-Z0-9_-]+)\|(.+?)\}\}/g
        ];

        patterns.forEach((pattern) => {
            let match = pattern.exec(text);
            while (match) {
                const label = String(match[2] || '').trim();
                if (label) {
                    tokens.push(label);
                }
                match = pattern.exec(text);
            }
        });

        return [...new Set(tokens)];
    }

    function buildQuestion(record, answerPool) {
        const text = window.stripRecordMarkup(record.content || '').replace(/\s+/g, ' ').trim();
        if (!text) {
            return null;
        }

        const tokens = extractLabeledTokens(record.content || '')
            .filter((label) => text.includes(label));
        if (!tokens.length) {
            return null;
        }

        const answer = pickRandom(tokens);
        const maskedText = text.replace(answer, '________________________');
        if (maskedText === text) {
            return null;
        }

        const distractors = shuffle(
            answerPool.filter((item) => item !== answer && !maskedText.includes(item))
        ).slice(0, 3);

        if (distractors.length < 3) {
            return null;
        }

        return {
            id: record.id,
            date: record.date,
            answer,
            maskedText,
            options: shuffle([answer, ...distractors])
        };
    }

    function renderQuestion() {
        if (!questionBank.length) {
            questionText.textContent = '当前没有足够的条目可生成题目。';
            questionMeta.textContent = '请先补充更多带人物或术语标记的记录。';
            optionsWrap.innerHTML = '';
            nextButton.disabled = true;
            return;
        }

        currentQuestion = pickRandom(questionBank);
        answeredCurrent = false;
        feedback.textContent = '';
        feedback.className = 'quiz-feedback';
        nextButton.disabled = false;

        questionText.textContent = currentQuestion.maskedText;
        questionMeta.textContent = `条目 ${currentQuestion.id} · ${currentQuestion.date} · 答对奖励 ${QUESTION_REWARD} Q币`;

        optionsWrap.innerHTML = currentQuestion.options.map((option, index) => `
            <button class="quiz-option" type="button" data-option="${escapeHtml(option)}">
                <span class="quiz-option-label">${String.fromCharCode(65 + index)}</span>
                <span>${escapeHtml(option)}</span>
            </button>
        `).join('');
    }

    function setFeedback(message, type) {
        feedback.textContent = message;
        feedback.className = `quiz-feedback is-${type}`;
    }

    function handleAnswer(option) {
        if (!currentQuestion || answeredCurrent) {
            return;
        }

        answeredCurrent = true;
        const isCorrect = option === currentQuestion.answer;
        window.QcoinState.recordQuizResult(isCorrect);

        optionsWrap.querySelectorAll('.quiz-option').forEach((button) => {
            const value = button.dataset.option || '';
            button.disabled = true;
            if (value === currentQuestion.answer) {
                button.classList.add('is-correct');
            } else if (value === option) {
                button.classList.add('is-wrong');
            }
        });

        if (isCorrect) {
            window.QcoinState.addCoins(QUESTION_REWARD, 'quiz-reward');
            setFeedback(`回答正确，获得 ${QUESTION_REWARD} Q币。`, 'success');
        } else {
            setFeedback(`回答错误，正确答案是 ${currentQuestion.answer}。`, 'error');
        }
    }

    optionsWrap?.addEventListener('click', (event) => {
        const button = event.target.closest('.quiz-option');
        if (!button) {
            return;
        }
        handleAnswer(button.dataset.option || '');
    });

    nextButton?.addEventListener('click', renderQuestion);

    const cacheReady = window.cacheReadyPromise || Promise.resolve();
    cacheReady
        .then(() => window.loadAllRecords())
        .then((records) => {
            const answerPool = [...new Set(records.flatMap((record) => extractLabeledTokens(record.content || '')))];
            questionBank = records
                .map((record) => buildQuestion(record, answerPool))
                .filter(Boolean);
            renderQuestion();
        });
})();
