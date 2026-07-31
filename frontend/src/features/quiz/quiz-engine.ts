import { unique } from '@/lib/archive'
import { extractParticipantIds, stripMarkup } from '@/lib/markup'
import type { Person, QuizQuestion, Quote, RecordItem } from '@/types/domain'

export type PlayQuestion = {
  id: string
  type: 'choice' | 'fill' | 'judge'
  content: 'author' | 'date' | 'person' | 'quote' | 'secret'
  prompt: string
  body: string
  answer: string
  choices: string[]
  explanation?: string
  image?: string
}

function sample<T>(items: T[], count: number) {
  return [...items].sort(() => Math.random() - 0.5).slice(0, count)
}

function choicePool(answer: string, pool: string[]) {
  return sample(unique(pool.filter(Boolean).filter((item) => item !== answer)), 3)
    .concat(answer)
    .sort(() => Math.random() - 0.5)
}

export function buildQuestions(
  records: RecordItem[],
  people: Person[],
  quotes: Quote[],
): PlayQuestion[] {
  const authors = unique(records.map((record) => record.author).filter(Boolean))
  const dates = unique(records.map((record) => record.date).filter(Boolean))
  const personNames = new Map(
    people.map((person) => [person.id, stripMarkup(person.name || person.id)]),
  )
  const questions: PlayQuestion[] = []
  records
    .filter((record) => record.content && !record.fileName.replace(/\.json$/i, '').endsWith('-00'))
    .forEach((record, index) => {
      const body = stripMarkup(record.content).slice(0, 220)
      if (record.author && authors.length > 1)
        questions.push({
          id: `author-${record.id}`,
          type: index % 4 === 0 ? 'fill' : 'choice',
          content: 'author',
          prompt: '这条记录由谁写下？',
          body,
          answer: record.author,
          choices: choicePool(record.author, authors),
        })
      if (record.date && dates.length > 1)
        questions.push({
          id: `date-${record.id}`,
          type: index % 5 === 0 ? 'judge' : 'choice',
          content: 'date',
          prompt:
            index % 5 === 0 ? `判断：这条记录发生在 ${record.date}` : '这条记录发生在哪一天？',
          body,
          answer: index % 5 === 0 ? '正确' : record.date,
          choices: index % 5 === 0 ? ['正确', '错误'] : choicePool(record.date, dates),
        })
      const participant = extractParticipantIds(record.content)[0]
      const participantName = participant ? personNames.get(participant) : ''
      if (participantName && people.length > 3)
        questions.push({
          id: `person-${record.id}`,
          type: 'choice',
          content: 'person',
          prompt: '这条记录中提到了谁？',
          body,
          answer: participantName,
          choices: choicePool(participantName, [...personNames.values()]),
        })
      const recordQuote = quotes.find(
        (quote) =>
          quote.recordFile.replace(/\.json$/i, '') === record.fileName.replace(/\.json$/i, ''),
      )
      if (recordQuote && quotes.length > 3)
        questions.push({
          id: `quote-${record.id}`,
          type: 'choice',
          content: 'quote',
          prompt: '哪句话来自这条记录？',
          body: `${record.date} · ${record.author || '匿名记录'}`,
          answer: stripMarkup(recordQuote.quote),
          choices: choicePool(
            stripMarkup(recordQuote.quote),
            quotes.map((quote) => stripMarkup(quote.quote)),
          ),
        })
    })
  return questions
}

export function normalizeSecretQuestion(question: QuizQuestion): PlayQuestion {
  return {
    id: `secret-${question.id}`,
    type: ['choice', 'fill', 'judge'].includes(question.type)
      ? (question.type as PlayQuestion['type'])
      : 'choice',
    content: 'secret',
    prompt: question.prompt || '请完成这道题。',
    body: '',
    answer: question.answer,
    choices: question.choices,
    explanation: question.explanation,
    image: question.image,
  }
}
