(() => {
  const CHOICE_REWARD = 100;
  const FILL_REWARD = 500;
  const JUDGE_REWARD = 100;
  const SECRET_SEQUENCE = 'lamian';
  const SECRET_CONTENT = 'lamian';
  const questionText = document.getElementById('quiz-question-text');
  const questionMeta = document.getElementById('quiz-question-meta');
  const optionsWrap = document.getElementById('quiz-options');
  const fillForm = document.getElementById('quiz-fill-form');
  const fillInput = document.getElementById('quiz-fill-input');
  const feedback = document.getElementById('quiz-feedback');
  const nextButton = document.getElementById('quiz-next-btn');
  const filterWrap = document.getElementById('quiz-filter');
  const quizCard = document.querySelector('.quiz-card');
  const typeLabels = { choice: '选择题', fill: '填空题', judge: '判断题' };
  const contentLabels = { person: '人名', term: '术语', author: '记录人', date: '记录时间' };
  const secretContentLabels = { [SECRET_CONTENT]: '???' };
  const contentByType = {
    choice: ['person', 'term', 'author', 'date'],
    fill: ['person', 'term', 'author', SECRET_CONTENT],
    judge: ['person', 'term', 'author']
  };

  let allQuestions = [];
  let questionBank = [];
  let currentQuestion = null;
  let answeredCurrent = false;
  let recentQuestionIds = [];
  let secretProgress = [];
  let secretUnlocked = false;
  let secretBuffer = '';
  let activeFilters = {
    types: new Set(Object.keys(typeLabels)),
    contents: new Set(Object.keys(contentLabels))
  };

  function setQuizLoading(isLoading) {
    quizCard?.classList.toggle('is-loading', Boolean(isLoading));
  }

  function shuffle(list) {
    const copy = [...list];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
  }

  function pickRandom(list) {
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

  function normalizeAnswer(text) {
    return stripOptionMarkup(text).toLowerCase();
  }

  function blankHtml(answer, revealed = false) {
    const width = Math.max(2, Array.from(String(answer || '')).length);
    return `<span class="quiz-answer-blank${revealed ? ' is-revealed' : ''}" style="--blank-chars:${width}"><span>${escapeHtml(answer)}</span></span>`;
  }

  function renderRecordWithBlank(recordText, answer, revealed = false) {
    if (recordText.includes(answer)) {
      return recordText.replace(answer, blankHtml(answer, revealed));
    }
    return recordText;
  }

  function renderSecretAnswerBoxes() {
    if (!currentQuestion || currentQuestion.content !== SECRET_CONTENT) return '';
    const answerChars = Array.from(String(currentQuestion.answer || ''));
    const boxes = answerChars.map((_, index) => `<span class="quiz-secret-answer-box">${escapeHtml(secretProgress[index] || '')}</span>`).join('');
    return `<span class="quiz-secret-answer-boxes" aria-label="答案字数 ${answerChars.length}">${boxes}</span>`;
  }

  function renderJudgeCorrection(text, wrongText, correctText, revealed = false) {
    const source = String(text || '');
    if (!revealed || !wrongText) return source;
    return source.replace(wrongText, `<span class="quiz-judge-correction"><span class="quiz-judge-wrong">${escapeHtml(wrongText)}</span><span class="quiz-judge-answer">${escapeHtml(correctText)}</span></span>`);
  }

  function renderJudgeCorrections(text, corrections, revealed = false) {
    if (!revealed || !Array.isArray(corrections) || !corrections.length) return String(text || '');
    const source = String(text || '');
    const positionedCorrections = corrections
      .map((correction, order) => {
        const index = Number(correction.index);
        const wrongText = String(correction.wrongText || '');
        const hasIndexedMatch = Number.isInteger(index)
          && index >= 0
          && source.slice(index, index + wrongText.length) === wrongText;
        return { ...correction, index, order, resolvedIndex: hasIndexedMatch ? index : Number.MAX_SAFE_INTEGER };
      })
      .filter((correction) => correction.wrongText)
      .sort((a, b) => (a.resolvedIndex - b.resolvedIndex) || (a.order - b.order));
    if (!positionedCorrections.length) {
      return corrections.reduce((html, correction) => html.replace(correction.wrongText, `<span class="quiz-judge-correction"><span class="quiz-judge-wrong">${escapeHtml(correction.wrongText)}</span><span class="quiz-judge-answer">${escapeHtml(correction.correctText)}</span></span>`), source);
    }

    let cursor = 0;
    let html = '';
    positionedCorrections.forEach((correction) => {
      const wrongText = String(correction.wrongText || '');
      const indexedMatch = correction.resolvedIndex !== Number.MAX_SAFE_INTEGER
        && correction.resolvedIndex >= cursor;
      const index = indexedMatch ? correction.resolvedIndex : source.indexOf(wrongText, cursor);
      if (!wrongText || index < cursor) return;
      html += source.slice(cursor, index);
      html += `<span class="quiz-judge-correction"><span class="quiz-judge-wrong">${escapeHtml(wrongText)}</span><span class="quiz-judge-answer">${escapeHtml(correction.correctText)}</span></span>`;
      cursor = index + wrongText.length;
    });
    return html + source.slice(cursor);
  }

  function renderJudgeRecord(question, revealed = false) {
    if (question.answer === '\u6b63\u786e' || question.correctionTarget === 'side') {
      return question.recordText || '';
    }
    return renderJudgeCorrections(question.recordText || '', question.corrections || [{ wrongText: question.wrongText, correctText: question.correctText }], revealed);
  }

  function renderSideBox(question, revealed = false) {
    if (!question.sideText) return '';
    const shouldCorrectSide = question.correctionTarget === 'side' && question.answer !== '\u6b63\u786e';
    const valueHtml = shouldCorrectSide
      ? renderJudgeCorrection(question.sideText, question.wrongText, question.correctText, revealed)
      : question.sideText;
    const sideClass = question.content === 'author' ? ' quiz-question-side--author' : '';
    return `<span class="quiz-question-side${sideClass}"><span class="quiz-side-label">${escapeHtml(question.sideLabel || '')}</span><span class="quiz-side-value">${formatContent(valueHtml)}</span></span>`;
  }

  function renderQuestionBody(revealed = false) {
    if (!currentQuestion) return;
    if (currentQuestion.content === SECRET_CONTENT) {
      questionText.innerHTML = `
        <span class="quiz-question-prompt quiz-question-prompt--secret">${escapeHtml(currentQuestion.prompt)}</span>
        <span class="quiz-secret-visual">
          ${currentQuestion.image ? `<img src="${escapeHtml(currentQuestion.image)}" alt="题目图片" loading="eager" decoding="async">` : '<span class="quiz-image-missing">题目图片资源缺失</span>'}
          ${currentQuestion.type === 'fill' ? renderSecretAnswerBoxes() : ''}
        </span>
      `;
      return;
    }

    const shouldBlankRecord = (currentQuestion.type === 'choice' || currentQuestion.type === 'fill') && ['person', 'term'].includes(currentQuestion.content);
    let recordHtml = currentQuestion.recordText || '';
    if (shouldBlankRecord) {
      recordHtml = renderRecordWithBlank(currentQuestion.recordText || '', currentQuestion.answer, revealed);
    } else if (currentQuestion.type === 'judge') {
      recordHtml = renderJudgeRecord(currentQuestion, revealed);
    }
    questionText.innerHTML = `
      <span class="quiz-question-prompt">${escapeHtml(currentQuestion.prompt)}</span>
      <span class="quiz-question-record${shouldBlankRecord ? ' has-answer-blank' : ''}">${formatContent(recordHtml)}</span>
      ${renderSideBox(currentQuestion, revealed)}
    `;
  }

  function stripOptionMarkup(text) {
    return window.stripRecordMarkup(text || '')
      .replace(/\^(.+?)\^/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function buildPlainText(record) {
    return String(record.content || '')
      .replace(/\{\{([a-zA-Z0-9_-]+)\|(.+?)\}\}/g, '$2')
      .replace(/\[\[([a-zA-Z0-9_-]+)\|(.+?)\]\]/g, '$2')
      .replace(/\(\((.+?)\)\)/g, '$1')
      .replace(/>>(.+?)<</g, '$1')
      .replace(/\^(.+?)\^/g, '$1')
      .replace(/_(.+?)_/g, '$1');
  }

  function buildDisplayText(record) {
    return String(record.content || '')
      .replace(/\{\{([a-zA-Z0-9_-]+)\|(.+?)\}\}/g, '$2')
      .replace(/\[\[([a-zA-Z0-9_-]+)\|(.+?)\]\]/g, '$2');
  }

  function extractTokenRefs(text, kind) {
    const pattern = kind === 'person'
      ? /\[\[([a-zA-Z0-9_-]+)\|(.+?)\]\]/g
      : /\{\{([a-zA-Z0-9_-]+)\|(.+?)\}\}/g;
    const refs = [];
    let match = pattern.exec(text || '');
    while (match) {
      const label = stripOptionMarkup(match[2]);
      if (match[1] && label) refs.push({ id: match[1], label });
      match = pattern.exec(text || '');
    }
    return refs;
  }

  function uniqueValues(list) {
    return [...new Set(list.filter(Boolean))];
  }

  function uniqueOptions(list) {
    const seen = new Set();
    const result = [];
    list.forEach((item) => {
      const value = String(item || '').trim();
      const key = normalizeAnswer(value);
      if (!value || !key || seen.has(key)) return;
      seen.add(key);
      result.push(value);
    });
    return result;
  }

  function normalizeQuestion(item, index = 0) {
    const raw = item && typeof item === 'object' ? item : {};
    const type = ['choice', 'fill', 'judge'].includes(raw.type) ? raw.type : 'fill';
    const content = raw.content || raw.category || raw.group || SECRET_CONTENT;
    const answer = String(raw.answer ?? raw.correctAnswer ?? '').trim();
    const options = uniqueOptions(raw.options || raw.choices || raw.answers || []);
    const imagePath = raw.image || raw.imagePath || raw.image_url || '';
    const reward = Number(raw.reward) || (type === 'choice' ? CHOICE_REWARD : type === 'judge' ? JUDGE_REWARD : FILL_REWARD);
    return {
      ...raw,
      id: String(raw.id || `${content || 'question'}-${index + 1}`),
      type,
      content,
      category: raw.category || content,
      difficulty: raw.difficulty || raw.level || '',
      prompt: String(raw.prompt || raw.question || raw.title || '请完成这道题。').trim(),
      answer,
      explanation: String(raw.explanation || raw.analysis || '').trim(),
      image: imagePath,
      imagePath,
      recordText: String(raw.recordText || raw.record_text || raw.text || '').trim(),
      sideLabel: raw.sideLabel || raw.side_label || '',
      sideText: raw.sideText || raw.side_text || '',
      options: type === 'choice' ? uniqueOptionsWithAnswer(answer, options) : options,
      choices: type === 'choice' ? uniqueOptionsWithAnswer(answer, options) : options,
      reward
    };
  }

  function uniqueOptionsWithAnswer(answer, options) {
    const answerKey = normalizeAnswer(answer);
    return uniqueOptions([
      answer,
      ...(options || []).filter((item) => normalizeAnswer(item) !== answerKey)
    ]);
  }

  function buildLabelMap(records, people) {
    const map = new Map();
    const add = (id, label) => {
      if (!id || !label) return;
      const values = map.get(id) || [];
      if (!values.includes(label)) values.push(label);
      map.set(id, values);
    };

    people.forEach((person) => {
      add(person.id, person.id);
      extractTokenRefs(`[[${person.id}|${person.alias || ''}]]`, 'person').forEach((ref) => add(person.id, ref.label));
    });
    records.filter((record) => !String(record.fileName || record.id || '').replace(/\.json$/i, '').endsWith('-00')).forEach((record) => {
      extractTokenRefs(record.content || '', 'person').forEach((ref) => add(ref.id, ref.label));
    });
    return map;
  }

  function getQuestionBase(record, kind) {
    const plainText = buildPlainText(record).trim();
    const displayText = buildDisplayText(record).trim();
    if (!plainText || !displayText) return null;

    const tokens = extractTokenRefs(record.content || '', kind)
      .filter((ref) => ref.label && plainText.includes(ref.label) && displayText.includes(ref.label));
    if (!tokens.length) return null;

    const answerRef = pickRandom(tokens);
    if (!plainText.includes(answerRef.label) || !displayText.includes(answerRef.label)) return null;

    return {
      id: record.id,
      recordKey: record.fileName || record.id,
      type: '',
      content: kind,
      answer: answerRef.label,
      answerId: answerRef.id,
      plainText,
      recordText: displayText,
      prompt: kind === 'person' ? '\u8bf7\u6839\u636e\u8bb0\u5f55\u5185\u5bb9\u9009\u62e9\u88ab\u6316\u7a7a\u7684\u4eba\u540d\u3002' : '\u8bf7\u6839\u636e\u8bb0\u5f55\u5185\u5bb9\u9009\u62e9\u88ab\u6316\u7a7a\u7684\u672f\u8bed\u3002'
    };
  }

  function getPersonChoiceOptions(base, pools) {
    const answerLabels = shuffle((pools.personLabels.get(base.answerId) || []).filter((item) => item !== base.answer));
    const otherPeople = shuffle([...pools.personLabels.entries()]
      .filter(([id, labels]) => id !== base.answerId && labels.length)
      .map(([id, labels]) => ({ id, labels: shuffle(labels) })));
    const forms = [];

    if (answerLabels.length >= 3) {
      forms.push([base.answer, ...answerLabels.slice(0, 3)]);
    }
    const twoLabelPerson = otherPeople.find((person) => person.labels.length >= 2);
    if (answerLabels.length >= 1 && twoLabelPerson) {
      forms.push([base.answer, answerLabels[0], ...twoLabelPerson.labels.slice(0, 2)]);
    }
    if (otherPeople.length >= 3) {
      forms.push([base.answer, ...otherPeople.slice(0, 3).map((person) => person.labels[0])]);
    }

    const options = pickRandom(shuffle(forms).filter((form) => uniqueValues(form).length === 4));
    return options ? shuffle(options) : null;
  }

  function buildChoiceQuestion(record, kind, pools) {
    const base = getQuestionBase(record, kind);
    if (!base) return null;

    const options = kind === 'person'
      ? getPersonChoiceOptions(base, pools)
      : shuffle(uniqueValues([
        base.answer,
        ...shuffle(pools.termOptions.filter((item) => item !== base.answer && !base.plainText.includes(item))).slice(0, 3)
      ]));
    const finalOptions = uniqueOptionsWithAnswer(base.answer, options);
    if (finalOptions.length < 4) return null;

    return {
      ...base,
      type: 'choice',
      reward: CHOICE_REWARD,
      prompt: kind === 'person' ? '\u8bf7\u6839\u636e\u8bb0\u5f55\u5185\u5bb9\u9009\u62e9\u88ab\u6316\u7a7a\u7684\u4eba\u540d\u3002' : '\u8bf7\u6839\u636e\u8bb0\u5f55\u5185\u5bb9\u9009\u62e9\u88ab\u6316\u7a7a\u7684\u672f\u8bed\u3002',
      options: shuffle(finalOptions.slice(0, 4))
    };
  }

  function buildFillQuestion(record, kind) {
    const base = getQuestionBase(record, kind);
    if (!base) return null;

    return {
      ...base,
      type: 'fill',
      reward: FILL_REWARD,
      prompt: kind === 'person' ? '\u8bf7\u586b\u5199\u8bb0\u5f55\u4e2d\u88ab\u6316\u7a7a\u7684\u4eba\u540d\u3002' : '\u8bf7\u586b\u5199\u8bb0\u5f55\u4e2d\u88ab\u6316\u7a7a\u7684\u672f\u8bed\u3002',
      options: []
    };
  }

  function buildJudgeQuestion(record, kind, pools) {
    const refs = extractTokenRefs(record.content || '', kind);
    const availableRefs = refs.filter((ref) => ref.label);
    if (!availableRefs.length) return null;

    const text = buildPlainText(record).trim();
    const displayText = buildDisplayText(record).trim();
    if (!text || !displayText) return null;

    const replacementPool = kind === 'person'
      ? [...pools.personLabels.entries()].flatMap(([, labels]) => labels)
      : pools.termOptions;
    const replacementPeople = kind === 'person'
      ? [...pools.personLabels.entries()]
        .map(([id, labels]) => ({ id, labels: uniqueOptions(labels) }))
        .filter((person) => person.id && person.labels.length)
      : [];

    return {
      id: record.id,
      recordKey: record.fileName || record.id,
      type: 'judge',
      content: kind,
      answer: '\u6b63\u786e',
      prompt: '\u8bf7\u5224\u65ad\u4e0b\u65b9\u8bb0\u5f55\u5185\u5bb9\u662f\u5426\u6b63\u786e\u3002',
      recordText: displayText,
      sourceRecordText: displayText,
      availableRefs,
      replacementPool: uniqueValues(replacementPool),
      replacementPeople,
      reward: JUDGE_REWARD,
      options: ['\u6b63\u786e', '\u9519\u8bef'],
      randomizeOnPick: true
    };
  }

  function replaceRandomOccurrence(text, target, replacement) {
    const source = String(text || '');
    const targetText = String(target || '');
    if (!targetText || !source.includes(targetText)) return null;
    const occurrences = source.split(targetText).length - 1;
    const replaceIndex = Math.floor(Math.random() * Math.max(1, occurrences));
    let seen = 0;
    let replacementIndex = -1;
    const output = source.replaceAll(targetText, (value, offset) => {
      if (seen === replaceIndex) {
        seen += 1;
        replacementIndex = offset;
        return replacement;
      }
      seen += 1;
      return value;
    });
    return replacementIndex >= 0
      ? { text: output, correction: { index: replacementIndex, wrongText: replacement, correctText: targetText }, changes: [{ index: replacementIndex, oldLength: targetText.length, newLength: String(replacement || '').length }] }
      : null;
  }

  function shiftCorrections(corrections, changes) {
    if (!Array.isArray(corrections) || !Array.isArray(changes) || !changes.length) return;
    corrections.forEach((correction) => {
      changes.forEach((change) => {
        if (change.index < correction.index) {
          correction.index += change.newLength - change.oldLength;
        }
      });
    });
  }

  function replaceAllPersonLabels(text, labels, replacementForLabel) {
    const source = String(text || '');
    const sortedLabels = uniqueOptions(labels).sort((a, b) => b.length - a.length);
    if (!source || !sortedLabels.length) return null;

    let index = 0;
    let output = '';
    const corrections = [];
    const changes = [];
    while (index < source.length) {
      const label = sortedLabels.find((item) => source.startsWith(item, index));
      if (!label) {
        output += source[index];
        index += 1;
        continue;
      }

      const replacement = replacementForLabel(label);
      if (!replacement) {
        output += label;
      } else {
        const replacementIndex = output.length;
        output += replacement;
        corrections.push({ index: replacementIndex, wrongText: replacement, correctText: label });
        changes.push({ index, oldLength: label.length, newLength: replacement.length });
      }
      index += label.length;
    }

    return corrections.length ? { text: output, corrections, changes } : null;
  }

  function randomizeTokenJudgeQuestion(question) {
    const shouldBeCorrect = Math.random() >= 0.5;
    if (shouldBeCorrect) {
      return {
        ...question,
        answer: '\u6b63\u786e',
        recordText: question.sourceRecordText,
        corrections: [],
        wrongText: '',
        correctText: ''
      };
    }

    let recordText = question.sourceRecordText || question.recordText || '';
    const corrections = [];
    const usedReplacements = new Set();

    if (question.content === 'person') {
      const personGroups = [...(question.availableRefs || []).reduce((map, ref) => {
        if (!ref.id || !ref.label) return map;
        const group = map.get(ref.id) || { id: ref.id, labels: [] };
        if (!group.labels.includes(ref.label)) group.labels.push(ref.label);
        map.set(ref.id, group);
        return map;
      }, new Map()).values()].filter((group) => group.labels.some((label) => recordText.includes(label)));
      const targetCount = personGroups.length ? 1 + Math.floor(Math.random() * personGroups.length) : 0;
      const targetGroups = shuffle(personGroups).slice(0, targetCount);

      targetGroups.forEach((group) => {
        const candidates = shuffle(question.replacementPeople || [])
          .filter((person) => person.id !== group.id && person.labels.some((label) => label && !recordText.includes(label)));
        const replacementPerson = pickRandom(candidates);
        if (!replacementPerson) return;

        const replacementLabels = uniqueOptions(replacementPerson.labels.filter((label) => label && !recordText.includes(label)));
        if (!replacementLabels.length) return;

        const replaceAllLabels = Math.random() < 0.76;
        if (replaceAllLabels) {
          const result = replaceAllPersonLabels(recordText, group.labels, (correctLabel) => {
            const availableLabels = replacementLabels.filter((label) => label !== correctLabel);
            const unusedLabels = availableLabels.filter((label) => !usedReplacements.has(label));
            const replacement = pickRandom(unusedLabels.length ? unusedLabels : availableLabels);
            if (replacement) usedReplacements.add(replacement);
            return replacement || '';
          });
          if (result) {
            shiftCorrections(corrections, result.changes);
            recordText = result.text;
            corrections.push(...result.corrections);
          }
          return;
        }

        const targetLabel = pickRandom(shuffle(group.labels).filter((label) => recordText.includes(label)));
        const replacement = pickRandom(replacementLabels.filter((label) => label !== targetLabel)) || '';
        const result = replaceRandomOccurrence(recordText, targetLabel, replacement);
        if (!result) return;
        shiftCorrections(corrections, result.changes);
        recordText = result.text;
        usedReplacements.add(replacement);
        corrections.push(result.correction);
      });
    } else {
      const target = pickRandom(question.availableRefs || []);
      const replacement = target && pickRandom(uniqueOptions(shuffle(question.replacementPool || [])
        .filter((item) => item !== target.label && item !== target.id && !usedReplacements.has(item) && !recordText.includes(item))));
      const result = replacement ? replaceRandomOccurrence(recordText, target.label, replacement) : null;
      if (result) {
        shiftCorrections(corrections, result.changes);
        recordText = result.text;
        usedReplacements.add(replacement);
        corrections.push(result.correction);
      }
    }
    if (!corrections.length) {
      return {
        ...question,
        answer: '\u6b63\u786e',
        recordText: question.sourceRecordText,
        corrections: []
      };
    }

    return {
      ...question,
      type: 'judge',
      answer: '\u9519\u8bef',
      recordText,
      corrections,
      wrongText: corrections[0].wrongText,
      correctText: corrections[0].correctText,
    };
  }

  function buildAuthorChoiceQuestion(record, authorPool) {
    if (!record.author || !record.content) return null;
    const distractors = shuffle(uniqueOptions(authorPool.filter((author) => author !== record.author))).slice(0, 3);
    if (distractors.length < 3) return null;
    const options = uniqueOptionsWithAnswer(record.author, distractors);
    if (options.length < 4) return null;

    return {
      id: record.id,
      recordKey: record.fileName || record.id,
      type: 'choice',
      content: 'author',
      answer: record.author,
      prompt: '\u8bf7\u9009\u62e9\u8fd9\u6761\u8bb0\u5f55\u7684\u8bb0\u5f55\u4eba',
      recordText: buildDisplayText(record).trim(),
      reward: CHOICE_REWARD,
      options: shuffle(options)
    };
  }

  function buildAuthorFillQuestion(record) {
    if (!record.author || !record.content) return null;
    return {
      id: record.id,
      recordKey: record.fileName || record.id,
      type: 'fill',
      content: 'author',
      answer: String(record.author).toLowerCase(),
      prompt: '\u8bf7\u586b\u5199\u8fd9\u6761\u8bb0\u5f55\u7684\u8bb0\u5f55\u4eba\u59d3\u540d\u62fc\u97f3\u9996\u5b57\u6bcd\u3002',
      recordText: buildDisplayText(record).trim(),
      reward: FILL_REWARD,
      options: []
    };
  }

  function buildAuthorJudgeQuestion(record, authorPool) {
    if (!record.author || !record.content) return null;

    return {
      id: record.id,
      recordKey: record.fileName || record.id,
      type: 'judge',
      content: 'author',
      answer: '\u6b63\u786e',
      prompt: '\u8bf7\u5224\u65ad\u4e0b\u65b9\u8bb0\u5f55\u4eba\u4e0e\u8bb0\u5f55\u5185\u5bb9\u662f\u5426\u5339\u914d\u3002',
      recordText: buildDisplayText(record).trim(),
      author: record.author,
      authorPool,
      sideLabel: '\u8bb0\u5f55\u4eba',
      sideText: record.author,
      correctionTarget: 'side',
      wrongText: '',
      correctText: record.author,
      reward: JUDGE_REWARD,
      options: ['\u6b63\u786e', '\u9519\u8bef'],
      randomizeOnPick: true
    };
  }

  function randomizeAuthorJudgeQuestion(question) {
    const shouldBeCorrect = Math.random() >= 0.5;
    const wrongAuthor = pickRandom(shuffle(question.authorPool || []).filter((author) => author !== question.author));
    if (shouldBeCorrect || !wrongAuthor) {
      return {
        ...question,
        answer: '\u6b63\u786e',
        sideText: question.author,
        wrongText: '',
        correctText: question.author
      };
    }

    return {
      ...question,
      answer: '\u9519\u8bef',
      sideText: wrongAuthor,
      wrongText: wrongAuthor,
      correctText: question.author
    };
  }

  function dayNumber(date) {
    const time = new Date(`${date}T00:00:00`).getTime();
    return Number.isFinite(time) ? Math.floor(time / 86400000) : 0;
  }

  function buildDateChoiceQuestion(record, datePool) {
    if (!record.date || !record.content) return null;
    const sortedDistractors = datePool
      .filter((date) => date !== record.date)
      .map((date) => ({ date, distance: Math.abs(dayNumber(date) - dayNumber(record.date)) }))
      .sort((a, b) => b.distance - a.distance)
      .map((item) => item.date);
    const distractors = shuffle(uniqueOptions(sortedDistractors.slice(0, Math.max(8, 3)))).slice(0, 3);
    if (distractors.length < 3) return null;
    const options = uniqueOptionsWithAnswer(record.date, distractors);
    if (options.length < 4) return null;

    return {
      id: record.id,
      recordKey: record.fileName || record.id,
      type: 'choice',
      content: 'date',
      answer: record.date,
      prompt: '\u8bf7\u9009\u62e9\u8fd9\u6761\u8bb0\u5f55\u7684\u8bb0\u5f55\u65f6\u95f4',
      recordText: buildDisplayText(record).trim(),
      reward: CHOICE_REWARD,
      options: shuffle(options)
    };
  }

  async function loadSecretQuestions() {
    if (window.ClassRecordData?.isEnabled?.()) {
      try {
        const rows = await window.ClassRecordData.loadQuizQuestions(SECRET_CONTENT);
        const existingImagePaths = new Set(
          (await window.ClassRecordData.listAssetPaths?.(`images/quiz/${SECRET_CONTENT}`).catch(() => [])) || []
        );
        const settled = await Promise.allSettled(rows.map(async (item, index) => {
          const imagePath = item.image || item.imagePath || '';
          const normalizedImagePath = window.ClassRecordData.normalizePrivateStoragePath?.(imagePath) || imagePath;
          const shouldSignImage = normalizedImagePath && (
            /^https?:\/\//i.test(normalizedImagePath)
            || !normalizedImagePath.startsWith(`images/quiz/${SECRET_CONTENT}/`)
            || existingImagePaths.has(normalizedImagePath)
          );
          const image = shouldSignImage ? await window.ClassRecordData.signAssetUrl(normalizedImagePath, { quiet: true }).catch(() => '') : '';
          return normalizeQuestion({
            id: item.id || `${SECRET_CONTENT}-${index + 1}`,
            type: item.type || 'choice',
            content: SECRET_CONTENT,
            prompt: item.prompt || 'Hidden question',
            answer: item.answer || '',
            options: item.options || item.choices || [],
            choices: item.choices || item.options || [],
            explanation: item.explanation || '',
            image
          }, index);
        }));
        return settled
          .filter((result) => result.status === 'fulfilled')
          .map((result) => result.value)
          .filter((question) => question.answer);
      } catch (error) {
        console.warn('Supabase secret questions load failed:', error);
      }
    }
    return [];
  }

  function setFeedback(message, type) {
    feedback.textContent = message;
    feedback.className = 'quiz-feedback';
    quizCard?.classList.remove('is-answer-success', 'is-answer-error');
    void feedback.offsetWidth;
    feedback.className = `quiz-feedback is-${type} is-animated`;
    quizCard?.classList.add(`is-answer-${type}`);
  }

  function hasQuestionFor(types, contents) {
    return allQuestions.some((question) => types.has(question.type) && contents.has(question.content));
  }

  function hasAnyQuestionInGroup(group, value) {
    return allQuestions.some((question) => question[group === 'types' ? 'type' : 'content'] === value);
  }

  function hasQuestionWhenSelected(group, value) {
    const selectedTypes = group === 'types' ? new Set([value]) : activeFilters.types;
    const selectedContents = group === 'contents' ? new Set([value]) : activeFilters.contents;
    return hasQuestionFor(selectedTypes, selectedContents);
  }


  function pruneFilters() {
    let changed = true;
    while (changed) {
      changed = false;
      const nextTypes = new Set([...activeFilters.types].filter((type) => allQuestions.some((question) => question.type === type && activeFilters.contents.has(question.content))));
      if (nextTypes.size && nextTypes.size !== activeFilters.types.size) {
        activeFilters.types = nextTypes;
        changed = true;
      }
      const nextContents = new Set([...activeFilters.contents].filter((content) => allQuestions.some((question) => activeFilters.types.has(question.type) && question.content === content)));
      if (nextContents.size && nextContents.size !== activeFilters.contents.size) {
        activeFilters.contents = nextContents;
        changed = true;
      }
    }
  }

  function updateQuestionBank() {
    pruneFilters();
    if (!hasQuestionFor(activeFilters.types, activeFilters.contents)) {
      const firstQuestion = allQuestions[0];
      if (firstQuestion) {
        activeFilters.types = new Set([firstQuestion.type]);
        activeFilters.contents = new Set([firstQuestion.content]);
      }
    }
    questionBank = allQuestions.filter((question) => activeFilters.types.has(question.type) && activeFilters.contents.has(question.content));
    renderFilter();
  }

  function questionRecordKey(question) {
    return question?.recordKey || question?.id || '';
  }

  function randomizeQuestion(question) {
    if (!question?.randomizeOnPick) return question;
    if (question.content === 'author') return randomizeAuthorJudgeQuestion(question);
    if (question.type === 'judge') return randomizeTokenJudgeQuestion(question);
    return question;
  }

  function pickNextQuestion() {
    const avoidSet = new Set(recentQuestionIds);
    const freshPool = questionBank.filter((question) => !avoidSet.has(questionRecordKey(question)));
    const pool = freshPool.length ? freshPool : questionBank;
    const picked = randomizeQuestion(pickRandom(pool));
    const key = questionRecordKey(picked);
    if (key) {
      recentQuestionIds = [key, ...recentQuestionIds.filter((item) => item !== key)].slice(0, 6);
    }
    return picked;
  }

  function getAvailableTypesForContent(content) {
    return Object.keys(typeLabels).filter((type) => allQuestions.some((question) => question.content === content && question.type === type));
  }
  function renderFilter() {
    if (!filterWrap) return;
    const visibleContentLabels = secretUnlocked ? { ...contentLabels, ...secretContentLabels } : contentLabels;
    const secretSelected = activeFilters.contents.has(SECRET_CONTENT);
    const buildButton = (group, value, label) => {
      const currentSet = activeFilters[group];
      const nextSet = new Set(currentSet);
      if (nextSet.has(value)) nextSet.delete(value);
      else nextSet.add(value);
      const nextTypes = group === 'types' ? nextSet : activeFilters.types;
      const nextContents = group === 'contents' ? nextSet : activeFilters.contents;
      const unavailable = group === 'contents' && value === SECRET_CONTENT
        ? !hasAnyQuestionInGroup(group, value)
        : !hasAnyQuestionInGroup(group, value) || !hasQuestionWhenSelected(group, value);
      const availableSecretTypes = secretSelected ? getAvailableTypesForContent(SECRET_CONTENT) : [];
      const secretTypeBlocked = group === 'types' && secretSelected && !availableSecretTypes.includes(value);
      const disabled = secretTypeBlocked || (currentSet.has(value) ? nextSet.size === 0 || !hasQuestionFor(nextTypes, nextContents) : unavailable);
      return `
        <button type="button" class="btn-action filter-option${currentSet.has(value) ? ' is-active' : ''}${unavailable ? ' is-disabled' : ''}" data-group="${group}" data-value="${value}"${disabled ? ' disabled' : ''}>
          <span class="quiz-filter-check">${currentSet.has(value) ? '\u2713' : '+'}</span>${label}
        </button>
      `;
    };

    filterWrap.innerHTML = `
      <div class="filter-field quiz-filter-field">
        <label>\u9898\u578b</label>
        <div class="quiz-filter-options">
          ${Object.entries(typeLabels).map(([value, label]) => buildButton('types', value, label)).join('')}
        </div>
      </div>
      <div class="filter-field quiz-filter-field">
        <label>\u5185\u5bb9</label>
        <div class="quiz-filter-options">
          ${Object.entries(visibleContentLabels).map(([value, label]) => buildButton('contents', value, label)).join('')}
        </div>
      </div>
      <div class="filter-actions">
        <button type="button" class="btn-action quiz-filter-all">\u5168\u9009\u53ef\u7528</button>
      </div>
    `;
  }

  function renderQuestion() {
    setQuizLoading(false);
    updateQuestionBank();
    if (!questionBank.length) {
      questionText.textContent = '当前筛选条件下没有足够的条目可生成题目。';
      questionMeta.textContent = '请调整题型或题目内容筛选。';
      optionsWrap.innerHTML = '';
      optionsWrap.hidden = true;
      if (fillForm) fillForm.hidden = true;
      nextButton.disabled = true;
      return;
    }

    currentQuestion = pickNextQuestion();
    answeredCurrent = false;
    secretProgress = currentQuestion.content === SECRET_CONTENT && currentQuestion.type === 'fill' ? Array.from(String(currentQuestion.answer || '')).map(() => '') : [];
    feedback.textContent = '';
    feedback.className = 'quiz-feedback';
    quizCard?.classList.remove('is-answer-success', 'is-answer-error');
    nextButton.disabled = false;
    renderQuestionBody(false);
    const visibleContentLabels = secretUnlocked ? { ...contentLabels, ...secretContentLabels } : contentLabels;
    questionMeta.textContent = `条目 ${currentQuestion.id} · ${typeLabels[currentQuestion.type]} · ${visibleContentLabels[currentQuestion.content]} · 答对奖励 ${currentQuestion.reward} Q币`;

    const isFill = currentQuestion.type === 'fill';
    optionsWrap.hidden = isFill;
    if (fillForm) fillForm.hidden = !isFill;

    if (isFill) {
      optionsWrap.innerHTML = '';
      if (fillInput) {
        fillInput.value = '';
        fillInput.disabled = false;
        fillInput.focus();
      }
      return;
    }

    optionsWrap.innerHTML = currentQuestion.options.map((option, index) => `
            <button class="quiz-option" type="button" data-option="${escapeHtml(option)}">
                <span class="quiz-option-label">${currentQuestion.type === 'judge' ? (index === 0 ? '✓' : '×') : String.fromCharCode(65 + index)}</span>
                <span>${formatContent(String(option || ''))}</span>
            </button>
        `).join('');
  }

  function handleSecretAnswer(option) {
    if (!currentQuestion || currentQuestion.content !== SECRET_CONTENT || answeredCurrent) return;
    const answerChars = Array.from(String(currentQuestion.answer || ''));
    const inputChars = Array.from(String(option || '').trim());

    if (inputChars.length !== answerChars.length) {
      setFeedback(`字数不对，需要 ${answerChars.length} 个字，请重新回答。`, 'error');
      if (fillInput) {
        fillInput.value = '';
        fillInput.focus();
      }
      return;
    }

    let changed = false;
    answerChars.forEach((char, index) => {
      if (inputChars[index] === char && secretProgress[index] !== char) {
        secretProgress[index] = char;
        changed = true;
      }
    });

    renderQuestionBody(false);
    const complete = secretProgress.every((char, index) => char === answerChars[index]);
    if (!complete) {
      setFeedback(changed ? '字数正确，部分字已填入方框，请继续回答。' : '字数正确，但本次没有新的正确字，请重新回答。', 'error');
      if (fillInput) {
        fillInput.value = '';
        fillInput.focus();
      }
      return;
    }

    answeredCurrent = true;
    if (fillInput) fillInput.disabled = true;
    window.QcoinState.recordQuizResult(true);
    window.QcoinState.addCoins(currentQuestion.reward, 'quiz-reward');
    setFeedback(`\u2713 \u56de\u7b54\u6b63\u786e\uff0c\u83b7\u5f97 ${currentQuestion.reward} Q\u5e01\u3002`, 'success');
  }

  function handleAnswer(option) {
    if (!currentQuestion || answeredCurrent) return;
    if (currentQuestion.content === SECRET_CONTENT) {
      handleSecretAnswer(option);
      return;
    }
    answeredCurrent = true;
    const isCorrect = currentQuestion.type === 'fill'
      ? normalizeAnswer(option) === normalizeAnswer(currentQuestion.answer)
      : option === currentQuestion.answer;
    window.QcoinState.recordQuizResult(isCorrect);

    if (currentQuestion.type === 'fill') {
      if (fillInput) fillInput.disabled = true;
    } else {
      optionsWrap.querySelectorAll('.quiz-option').forEach((button) => {
        const value = button.dataset.option || '';
        button.disabled = true;
        if (value === currentQuestion.answer) {
          button.classList.add('is-correct');
        } else if (value === option) {
          button.classList.add('is-wrong');
        }
      });
    }

    renderQuestionBody(true);
    if (isCorrect) {
      window.QcoinState.addCoins(currentQuestion.reward, 'quiz-reward');
      setFeedback(`\u2713 \u56de\u7b54\u6b63\u786e\uff0c\u83b7\u5f97 ${currentQuestion.reward} Q\u5e01\u3002`, 'success');
    } else {
      setFeedback(`\u2715 \u56de\u7b54\u9519\u8bef\uff0c\u6b63\u786e\u7b54\u6848\u662f ${currentQuestion.answer}\u3002`, 'error');
    }
  }

  filterWrap?.addEventListener('click', (event) => {
    const button = event.target.closest('.filter-option');
    const allButton = event.target.closest('.quiz-filter-all');
    if (allButton) {
      activeFilters = {
        types: new Set(Object.keys(typeLabels).filter((type) => allQuestions.some((question) => question.type === type))),
        contents: new Set(Object.keys(contentLabels).filter((content) => allQuestions.some((question) => question.content === content)))
      };
      renderQuestion();
      return;
    }
    if (!button || button.disabled) return;

    const group = button.dataset.group;
    const value = button.dataset.value;
    if (group === 'contents' && value === SECRET_CONTENT) {
      activeFilters.types = new Set(getAvailableTypesForContent(SECRET_CONTENT).length ? getAvailableTypesForContent(SECRET_CONTENT) : ['choice']);
      activeFilters.contents = new Set([SECRET_CONTENT]);
      renderQuestion();
      return;
    }
    if (group === 'types' && activeFilters.contents.has(SECRET_CONTENT) && !getAvailableTypesForContent(SECRET_CONTENT).includes(value)) {
      return;
    }
    if (group === 'contents' && value !== SECRET_CONTENT && activeFilters.contents.has(SECRET_CONTENT)) {
      activeFilters.contents = new Set([value]);
      activeFilters.types = new Set(Object.keys(typeLabels).filter((type) => allQuestions.some((question) => question.type === type && question.content === value)));
      renderQuestion();
      return;
    }
    const values = activeFilters[group];
    if (values.has(value)) {
      if (values.size > 1) values.delete(value);
    } else {
      values.add(value);
    }
    renderQuestion();
  });

  optionsWrap?.addEventListener('click', (event) => {
    const button = event.target.closest('.quiz-option');
    if (button) handleAnswer(button.dataset.option || '');
  });

  fillForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!fillInput) return;
    handleAnswer(fillInput.value);
  });

  nextButton?.addEventListener('click', renderQuestion);

  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.altKey || event.metaKey || event.key.length !== 1) return;
    secretBuffer = (secretBuffer + event.key.toLowerCase()).slice(-SECRET_SEQUENCE.length);
    if (!secretUnlocked && secretBuffer === SECRET_SEQUENCE) {
      secretUnlocked = true;
      window.AchievementState?.record('secret', SECRET_CONTENT);
      renderFilter();
    }
  });

  (window.cacheReadyPromise || Promise.resolve())
    .then(() => Promise.all([window.loadAllRecords(), window.loadAllPeople(), window.loadAllGlossary(), loadSecretQuestions()]))
    .then(([records, people, glossary, secretQuestions]) => {
      const quizRecords = records.filter((record) => !String(record.fileName || record.id || '').replace(/\.json$/i, '').endsWith('-00'));
      const pools = {
        personLabels: buildLabelMap(records, people),
        personOptions: [],
        termOptions: uniqueValues(glossary.map((term) => stripOptionMarkup(term.term)))
      };
      pools.personOptions = uniqueValues([...pools.personLabels.values()].flat());
      pools.termOptions = uniqueValues([
        ...pools.termOptions,
        ...quizRecords.flatMap((record) => extractTokenRefs(record.content || '', 'term').map((ref) => ref.label))
      ]);

      const authorPool = uniqueValues(quizRecords.map((record) => record.author));
      const datePool = uniqueValues(quizRecords.map((record) => record.date));
      const questions = [];
      quizRecords.forEach((record) => {
        questions.push(buildChoiceQuestion(record, 'person', pools));
        questions.push(buildChoiceQuestion(record, 'term', pools));
        questions.push(buildFillQuestion(record, 'person'));
        questions.push(buildFillQuestion(record, 'term'));
        questions.push(buildJudgeQuestion(record, 'person', pools));
        questions.push(buildJudgeQuestion(record, 'term', pools));
        questions.push(buildAuthorChoiceQuestion(record, authorPool));
        questions.push(buildAuthorFillQuestion(record));
        questions.push(buildAuthorJudgeQuestion(record, authorPool));
        questions.push(buildDateChoiceQuestion(record, datePool));
      });

      allQuestions = shuffle([...questions.filter(Boolean), ...secretQuestions]);
      renderQuestion();
    });
})();
