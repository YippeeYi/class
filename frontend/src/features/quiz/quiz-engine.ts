import { unique } from '@/lib/archive'
import { extractMarkupReferences, stripMarkup } from '@/lib/markup'
import type { Person, QuizQuestion, Quote, RecordItem } from '@/types/domain'

export type PlayQuestion = {
  id: string
  sourceId: string
  type: 'choice' | 'fill' | 'judge'
  content: 'author' | 'date' | 'person' | 'quote' | 'secret'
  prompt: string
  body: string
  answer: string
  choices: string[]
  explanation?: string
  image?: string
}

function shuffle<T>(items: T[]) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    const current = copy[index]
    const other = copy[swap]
    if (current === undefined || other === undefined) continue
    copy[index] = other
    copy[swap] = current
  }
  return copy
}

function choicePool(answer: string, pool: string[]) {
  return shuffle(unique(pool.filter(Boolean).filter((item) => item !== answer)))
    .slice(0, 3)
    .concat(answer)
    .sort(() => Math.random() - 0.5)
}

function addJudge(
  questions: PlayQuestion[],
  base: Omit<PlayQuestion, 'id' | 'type' | 'answer' | 'choices' | 'prompt'>,
  answer: string,
  pool: string[],
  label: string,
) {
  const alternatives = unique(pool.filter((item) => item && item !== answer))
  if (!alternatives.length) return
  const correct = Math.random() >= 0.5
  const proposed = correct
    ? answer
    : alternatives[Math.floor(Math.random() * alternatives.length)] || answer
  questions.push({
    ...base,
    id: `${base.content}-judge-${base.sourceId}`,
    type: 'judge',
    prompt: `判断：${label}是“${proposed}”。`,
    answer: correct ? '正确' : '错误',
    choices: ['正确', '错误'],
    explanation: correct ? '' : `正确答案应为“${answer}”。`,
  })
}

export function buildQuestions(records: RecordItem[], people: Person[], quotes: Quote[]) {
  const ordinary = records.filter((record) => !record.recordType || record.recordType === 'record')
  const authors = unique(ordinary.map((record) => record.author).filter(Boolean))
  const dates = unique(ordinary.map((record) => record.date).filter(Boolean))
  const personNames = new Map(
    people.map((person) => [person.id, stripMarkup(person.name || person.id)]),
  )
  const allPersonNames = [...personNames.values()]
  const quoteText = new Map(quotes.map((quote) => [quote.id, stripMarkup(quote.quote)]))
  const allQuotes = [...quoteText.values()].filter(Boolean)
  const questions: PlayQuestion[] = []

  for (const record of records.filter(
    (item) => item.content && !item.fileName.replace(/\.json$/i, '').endsWith('-00'),
  )) {
    const sourceId = `${record.recordType || 'record'}:${record.fileName || record.id}`
    const body = stripMarkup(record.content).trim()
    const source = { sourceId, body }
    if (!record.recordType || record.recordType === 'record') {
      if (record.author && authors.length >= 4) {
        questions.push({
          ...source,
          id: `author-choice-${sourceId}`,
          type: 'choice',
          content: 'author',
          prompt: '请选择这条记录的记录人。',
          answer: record.author,
          choices: choicePool(record.author, authors),
        })
        questions.push({
          ...source,
          id: `author-fill-${sourceId}`,
          type: 'fill',
          content: 'author',
          prompt: '请填写这条记录的记录人。',
          answer: record.author,
          choices: [],
        })
        addJudge(
          questions,
          { ...source, content: 'author' },
          record.author,
          authors,
          '这条记录的记录人',
        )
      }
      if (record.date && dates.length >= 4)
        questions.push({
          ...source,
          id: `date-choice-${sourceId}`,
          type: 'choice',
          content: 'date',
          prompt: '请选择这条记录的记录时间。',
          answer: record.date,
          choices: choicePool(record.date, dates),
        })
    }

    const references = extractMarkupReferences(record.content)
    const participantId = references.participantIds.find((id) => personNames.has(id))
    const participant = participantId ? personNames.get(participantId) || '' : ''
    if (participant && allPersonNames.length >= 4) {
      const blanked = body.replaceAll(participant, '____')
      questions.push({
        sourceId,
        body: blanked,
        id: `person-choice-${sourceId}`,
        type: 'choice',
        content: 'person',
        prompt: '空白处提到的是谁？',
        answer: participant,
        choices: choicePool(participant, allPersonNames),
      })
      questions.push({
        sourceId,
        body: blanked,
        id: `person-fill-${sourceId}`,
        type: 'fill',
        content: 'person',
        prompt: '请填写空白处的人名。',
        answer: participant,
        choices: [],
      })
      addJudge(
        questions,
        { ...source, content: 'person' },
        participant,
        allPersonNames,
        '记录中提到的人物',
      )
    }

    const linkedQuote = quotes.find(
      (quote) =>
        quote.recordFile.replace(/\.json$/i, '') === record.fileName.replace(/\.json$/i, ''),
    )
    const quoteId = linkedQuote?.id || references.quoteIds.find((id) => quoteText.has(id))
    const answerQuote = linkedQuote
      ? stripMarkup(linkedQuote.quote)
      : quoteId
        ? quoteText.get(quoteId) || ''
        : ''
    if (answerQuote && allQuotes.length >= 4) {
      const blanked = body.replaceAll(answerQuote, '____')
      questions.push({
        sourceId,
        body: blanked,
        id: `quote-choice-${sourceId}`,
        type: 'choice',
        content: 'quote',
        prompt: '空白处是哪句原话？',
        answer: answerQuote,
        choices: choicePool(answerQuote, allQuotes),
      })
      questions.push({
        sourceId,
        body: blanked,
        id: `quote-fill-${sourceId}`,
        type: 'fill',
        content: 'quote',
        prompt: '请补全记录中的原话。',
        answer: answerQuote,
        choices: [],
      })
      addJudge(questions, { ...source, content: 'quote' }, answerQuote, allQuotes, '记录中的原话')
    }
  }
  return questions
}

export function filteredQuestions(
  questions: PlayQuestion[],
  types: Set<PlayQuestion['type']>,
  contents: Set<PlayQuestion['content']>,
) {
  return questions.filter((question) => types.has(question.type) && contents.has(question.content))
}

export function pickQuestion(questions: PlayQuestion[], previousId = '') {
  const usable = questions.filter((question) => question.id !== previousId)
  const pool = usable.length ? usable : questions
  const sources = unique(pool.map((question) => question.sourceId))
  const source = sources[Math.floor(Math.random() * sources.length)]
  const sourceQuestions = pool.filter((question) => question.sourceId === source)
  const contents = unique(sourceQuestions.map((question) => question.content))
  const content = contents[Math.floor(Math.random() * contents.length)]
  const contentQuestions = sourceQuestions.filter((question) => question.content === content)
  return contentQuestions[Math.floor(Math.random() * contentQuestions.length)] || null
}

export function normalizeSecretQuestion(question: QuizQuestion): PlayQuestion {
  return {
    id: `secret-${question.id}`,
    sourceId: `secret:${question.id}`,
    type: 'fill',
    content: 'secret',
    prompt: question.prompt || '请完成这道题。',
    body: '',
    answer: question.answer,
    choices: [],
    explanation: question.explanation,
    image: question.image,
  }
}
