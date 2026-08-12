import { unique } from '@/lib/archive'
import { extractMarkupReferences, stripMarkup } from '@/lib/markup'
import { recordDisplayNumber, recordStableKey } from '@/lib/record-identity'
import type { Person, QuizQuestion, Quote, RecordItem } from '@/types/domain'

export type QuizCorrection = {
  index: number
  wrongText: string
  correctText: string
}

type TokenMarker = { id: string; label: string }
type ReplacementPerson = { id: string; labels: string[] }

type JudgeTemplate =
  | {
      kind: 'author'
      answer: string
      alternatives: string[]
    }
  | {
      kind: 'token'
      content: 'person' | 'quote'
      originalBody: string
      originalMarkup: string
      markers: TokenMarker[]
      replacementPeople: ReplacementPerson[]
      replacementPool: string[]
    }

export type PlayQuestion = {
  id: string
  entryId: string
  sourceId: string
  type: 'choice' | 'fill' | 'judge'
  content: 'author' | 'date' | 'person' | 'quote' | 'secret'
  prompt: string
  body: string
  markupBody?: string
  answer: string
  choices: string[]
  explanation?: string
  image?: string
  blankReference?: { kind: 'person' | 'quote'; id: string; label: string }
  corrections?: QuizCorrection[]
  sideLabel?: string
  sideText?: string
  sideCorrection?: QuizCorrection
  judgeTemplate?: JudgeTemplate
}

function randomIndex(length: number, random = Math.random) {
  if (!length) return -1
  const value = Number(random())
  const normalized = Number.isFinite(value) ? Math.min(Math.max(value, 0), 0.9999999999999999) : 0
  return Math.floor(normalized * length)
}

function pickRandom<T>(items: T[], random = Math.random) {
  const index = randomIndex(items.length, random)
  return index < 0 ? undefined : items[index]
}

function shuffle<T>(items: T[], random = Math.random) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = randomIndex(index + 1, random)
    const current = copy[index]
    const other = copy[swap]
    if (current === undefined || other === undefined) continue
    copy[index] = other
    copy[swap] = current
  }
  return copy
}

function normalizedUnique(items: string[]) {
  const seen = new Set<string>()
  const output: string[] = []
  for (const item of items) {
    const value = String(item || '').trim()
    const key = stripMarkup(value).replace(/\s+/g, ' ').trim().toLocaleLowerCase('zh-CN')
    if (!value || !key || seen.has(key)) continue
    seen.add(key)
    output.push(value)
  }
  return output
}

function choicePool(answer: string, pool: string[], random = Math.random) {
  const distractors = shuffle(
    normalizedUnique(pool.filter((item) => item && item !== answer)),
    random,
  ).slice(0, 3)
  return distractors.length === 3 ? shuffle(normalizedUnique([answer, ...distractors]), random) : []
}

function dayNumber(date: string) {
  const time = new Date(`${date}T00:00:00`).getTime()
  return Number.isFinite(time) ? Math.floor(time / 86_400_000) : 0
}

function dateChoicePool(answer: string, dates: string[], random = Math.random) {
  const distantDates = dates
    .filter((date) => date !== answer)
    .map((date) => ({ date, distance: Math.abs(dayNumber(date) - dayNumber(answer)) }))
    .sort((a, b) => b.distance - a.distance)
    .slice(0, 8)
    .map((item) => item.date)
  return choicePool(answer, distantDates, random)
}

function addLabel(map: Map<string, string[]>, id: string, label: string) {
  const value = String(label || '').trim()
  if (!id || !value) return
  const labels = map.get(id) || []
  if (!labels.includes(value)) labels.push(value)
  map.set(id, labels)
}

function buildPersonLabels(records: RecordItem[], people: Person[]) {
  const labels = new Map<string, string[]>()
  for (const person of people) {
    addLabel(labels, person.id, person.id)
    addLabel(labels, person.id, stripMarkup(person.name || person.id))
    addLabel(labels, person.id, stripMarkup(person.alias || ''))
    for (const alias of person.aliases || []) addLabel(labels, person.id, stripMarkup(alias))
  }
  for (const record of records) {
    for (const marker of extractMarkupReferences(record.content).personMarkers) {
      addLabel(labels, marker.id, stripMarkup(marker.label))
    }
  }
  return labels
}

function personChoicePool(
  answer: TokenMarker,
  labels: Map<string, string[]>,
  random = Math.random,
) {
  const answerAliases = shuffle(
    (labels.get(answer.id) || []).filter((label) => label !== answer.label),
    random,
  )
  const otherPeople = shuffle(
    [...labels.entries()]
      .filter(([id, values]) => id !== answer.id && values.length)
      .map(([id, values]) => ({ id, labels: shuffle(values, random) })),
    random,
  )
  const candidates: string[][] = []
  if (answerAliases.length >= 3) candidates.push([answer.label, ...answerAliases.slice(0, 3)])
  const twoLabelPerson = otherPeople.find((person) => person.labels.length >= 2)
  if (answerAliases.length && twoLabelPerson)
    candidates.push([answer.label, answerAliases[0] || '', ...twoLabelPerson.labels.slice(0, 2)])
  if (otherPeople.length >= 3)
    candidates.push([
      answer.label,
      ...otherPeople.slice(0, 3).map((person) => person.labels[0] || ''),
    ])
  const usable = candidates.filter((items) => normalizedUnique(items).length === 4)
  const selected = pickRandom(usable, random)
  return selected ? shuffle(normalizedUnique(selected), random) : []
}

function questionId(
  sourceId: string,
  content: PlayQuestion['content'],
  type: PlayQuestion['type'],
) {
  return `${sourceId}:${content}:${type}`
}

function baseQuestion(
  record: RecordItem,
  sourceType: NonNullable<RecordItem['recordType']>,
  content: PlayQuestion['content'],
  type: PlayQuestion['type'],
) {
  const entryId = recordDisplayNumber(record)
  const sourceKey = recordStableKey(record)
  const sourceId = `${sourceType}:${sourceKey}`
  return {
    id: questionId(sourceId, content, type),
    entryId,
    sourceId,
    content,
    type,
    body: stripMarkup(record.content).trim(),
    markupBody: record.content.trim(),
  }
}

function markerFor(
  record: RecordItem,
  content: 'person' | 'quote',
  random = Math.random,
): TokenMarker | undefined {
  const references = extractMarkupReferences(record.content)
  const markers = content === 'person' ? references.personMarkers : references.quoteMarkers
  return pickRandom(
    markers
      .map((marker) => ({ id: marker.id, label: stripMarkup(marker.label).trim() }))
      .filter((marker) => marker.id && marker.label),
    random,
  )
}

function replaceRandomOccurrence(
  source: string,
  target: string,
  replacement: string,
  random = Math.random,
) {
  if (!target || !source.includes(target)) return null
  const indexes: number[] = []
  for (let start = 0; start <= source.length - target.length; ) {
    const index = source.indexOf(target, start)
    if (index < 0) break
    indexes.push(index)
    start = index + target.length
  }
  const index = pickRandom(indexes, random)
  if (index === undefined) return null
  return {
    text: `${source.slice(0, index)}${replacement}${source.slice(index + target.length)}`,
    correction: { index, wrongText: replacement, correctText: target },
    change: { index, oldLength: target.length, newLength: replacement.length },
    occurrence: indexes.indexOf(index),
  }
}

function replaceOccurrence(
  source: string,
  target: string,
  replacement: string,
  occurrence: number,
) {
  let seen = 0
  return source.replaceAll(target, (value) => {
    if (seen !== occurrence) {
      seen += 1
      return value
    }
    seen += 1
    return replacement
  })
}

function shiftCorrections(
  corrections: QuizCorrection[],
  change: { index: number; oldLength: number; newLength: number },
) {
  for (const correction of corrections) {
    if (change.index < correction.index) correction.index += change.newLength - change.oldLength
  }
}

function randomizeTokenJudge(
  question: PlayQuestion,
  template: Extract<JudgeTemplate, { kind: 'token' }>,
) {
  if (Math.random() >= 0.5) {
    return {
      ...question,
      body: template.originalBody,
      markupBody: template.originalMarkup,
      answer: '正确',
      corrections: [],
      explanation: '',
    }
  }
  let body = template.originalBody
  let markupBody = template.originalMarkup
  const corrections: QuizCorrection[] = []

  if (template.content === 'person') {
    const markerGroups = [
      ...template.markers.reduce((map, marker) => {
        const group = map.get(marker.id) || { id: marker.id, labels: [] as string[] }
        if (!group.labels.includes(marker.label)) group.labels.push(marker.label)
        map.set(marker.id, group)
        return map
      }, new Map<string, ReplacementPerson>()),
    ].map(([, value]) => value)
    const targetCount = markerGroups.length ? 1 + randomIndex(markerGroups.length) : 0
    for (const group of shuffle(markerGroups).slice(0, targetCount)) {
      const replacementPerson = pickRandom(
        shuffle(template.replacementPeople).filter(
          (person) =>
            person.id !== group.id && person.labels.some((label) => label && !body.includes(label)),
        ),
      )
      if (!replacementPerson) continue
      const replacementLabels = replacementPerson.labels.filter(
        (label) => label && !body.includes(label),
      )
      if (!replacementLabels.length) continue
      const labelsToReplace = Math.random() < 0.76 ? group.labels : [pickRandom(group.labels) || '']
      for (const label of labelsToReplace.sort((a, b) => b.length - a.length)) {
        if (!label || !body.includes(label)) continue
        const replacement = pickRandom(replacementLabels.filter((item) => item !== label))
        if (!replacement) continue
        const replaced = replaceRandomOccurrence(body, label, replacement)
        if (!replaced) continue
        shiftCorrections(corrections, replaced.change)
        body = replaced.text
        markupBody = replaceOccurrence(markupBody, label, replacement, replaced.occurrence)
        corrections.push(replaced.correction)
      }
    }
  } else {
    const marker = pickRandom(template.markers)
    const replacement = marker
      ? pickRandom(
          shuffle(template.replacementPool).filter(
            (item) => item !== marker.label && item !== marker.id && !body.includes(item),
          ),
        )
      : undefined
    const replaced =
      marker && replacement ? replaceRandomOccurrence(body, marker.label, replacement) : null
    if (replaced && marker && replacement) {
      body = replaced.text
      markupBody = replaceOccurrence(markupBody, marker.label, replacement, replaced.occurrence)
      corrections.push(replaced.correction)
    }
  }

  if (!corrections.length) {
    return {
      ...question,
      body: template.originalBody,
      markupBody: template.originalMarkup,
      answer: '正确',
      corrections: [],
      explanation: '',
    }
  }
  return {
    ...question,
    body,
    markupBody,
    answer: '错误',
    corrections,
    explanation: '标出的内容与原记录不符。',
  }
}

function randomizeQuestion(question: PlayQuestion) {
  const template = question.judgeTemplate
  if (!template) return question
  if (template.kind === 'author') {
    const wrongAuthor = pickRandom(shuffle(template.alternatives))
    const correct = Math.random() >= 0.5 || !wrongAuthor
    const sideText = correct ? template.answer : wrongAuthor || template.answer
    return {
      ...question,
      answer: correct ? '正确' : '错误',
      sideText,
      sideCorrection: correct
        ? undefined
        : { index: 0, wrongText: sideText, correctText: template.answer },
      explanation: correct ? '' : `正确的记录人是“${template.answer}”。`,
    }
  }
  return randomizeTokenJudge(question, template)
}

export function buildQuestions(records: RecordItem[], people: Person[], quotes: Quote[]) {
  const eligible = records.filter(
    (record) =>
      record.content &&
      !String(record.fileName || record.id)
        .replace(/\.json$/i, '')
        .endsWith('-00'),
  )
  const ordinary = eligible.filter((record) => !record.recordType || record.recordType === 'record')
  const authors = normalizedUnique(ordinary.map((record) => record.author).filter(Boolean))
  const dates = normalizedUnique(ordinary.map((record) => record.date).filter(Boolean))
  const personLabels = buildPersonLabels(eligible, people)
  const replacementPeople = [...personLabels.entries()].map(([id, labels]) => ({ id, labels }))
  const quoteOptions = normalizedUnique([
    ...quotes.map((quote) => stripMarkup(quote.quote)),
    ...eligible.flatMap((record) =>
      extractMarkupReferences(record.content).quoteMarkers.map((marker) =>
        stripMarkup(marker.label),
      ),
    ),
  ])
  const questions: PlayQuestion[] = []

  for (const record of eligible) {
    const sourceType = record.recordType || 'record'
    const body = stripMarkup(record.content).trim()
    if (!body) continue

    for (const content of ['person', 'quote'] as const) {
      const marker = markerFor(record, content)
      if (!marker || !body.includes(marker.label)) continue
      const options =
        content === 'person'
          ? personChoicePool(marker, personLabels)
          : choicePool(
              marker.label,
              quoteOptions.filter((item) => !body.includes(item)),
            )
      if (options.length === 4) {
        questions.push({
          ...baseQuestion(record, sourceType, content, 'choice'),
          prompt:
            content === 'person'
              ? '请根据记录内容选择被挖空的人名。'
              : '请根据记录内容选择被挖空的术语。',
          answer: marker.label,
          choices: options,
          blankReference: { kind: content, id: marker.id, label: marker.label },
        })
      }
      questions.push({
        ...baseQuestion(record, sourceType, content, 'fill'),
        prompt: content === 'person' ? '请填写记录中被挖空的人名。' : '请填写记录中被挖空的术语。',
        answer: marker.label,
        choices: [],
        blankReference: { kind: content, id: marker.id, label: marker.label },
      })

      const markers = (
        content === 'person'
          ? extractMarkupReferences(record.content).personMarkers
          : extractMarkupReferences(record.content).quoteMarkers
      )
        .map((item) => ({ id: item.id, label: stripMarkup(item.label).trim() }))
        .filter((item) => item.id && item.label && body.includes(item.label))
      if (markers.length) {
        questions.push({
          ...baseQuestion(record, sourceType, content, 'judge'),
          type: 'judge',
          prompt: '请判断下方记录内容是否正确。',
          answer: '正确',
          choices: ['正确', '错误'],
          judgeTemplate: {
            kind: 'token',
            content,
            originalBody: body,
            originalMarkup: record.content.trim(),
            markers,
            replacementPeople,
            replacementPool:
              content === 'person' ? [...personLabels.values()].flat() : quoteOptions,
          },
        })
      }
    }

    if (sourceType !== 'record') continue
    if (record.author) {
      if (authors.length >= 4) {
        const choices = choicePool(record.author, authors)
        if (choices.length === 4)
          questions.push({
            ...baseQuestion(record, sourceType, 'author', 'choice'),
            prompt: '请选择这条记录的记录人。',
            answer: record.author,
            choices,
          })
      }
      questions.push({
        ...baseQuestion(record, sourceType, 'author', 'fill'),
        prompt: '请填写这条记录的记录人姓名拼音首字母。',
        answer: record.author.toLocaleLowerCase('zh-CN'),
        choices: [],
      })
      questions.push({
        ...baseQuestion(record, sourceType, 'author', 'judge'),
        type: 'judge',
        prompt: '请判断下方记录人与记录内容是否匹配。',
        answer: '正确',
        choices: ['正确', '错误'],
        sideLabel: '记录人',
        sideText: record.author,
        judgeTemplate: {
          kind: 'author',
          answer: record.author,
          alternatives: authors.filter((author) => author !== record.author),
        },
      })
    }
    if (record.date && dates.length >= 4) {
      const choices = dateChoicePool(record.date, dates)
      if (choices.length === 4)
        questions.push({
          ...baseQuestion(record, sourceType, 'date', 'choice'),
          prompt: '请选择这条记录的记录时间。',
          answer: record.date,
          choices,
        })
    }
  }
  return [...new Map(questions.map((question) => [question.id, question])).values()]
}

export function filteredQuestions(
  questions: PlayQuestion[],
  types: Set<PlayQuestion['type']>,
  contents: Set<PlayQuestion['content']>,
) {
  return questions.filter((question) => types.has(question.type) && contents.has(question.content))
}

export function pickQuestion(questions: PlayQuestion[], random = Math.random) {
  const sources = unique(questions.map((question) => question.sourceId))
  const source = pickRandom(sources, random)
  const sourceQuestions = questions.filter((question) => question.sourceId === source)
  const contents = unique(sourceQuestions.map((question) => question.content))
  const content = pickRandom(contents, random)
  const contentQuestions = sourceQuestions.filter((question) => question.content === content)
  const question = pickRandom(contentQuestions, random)
  return question ? randomizeQuestion(question) : null
}

export function normalizeSecretQuestion(question: QuizQuestion): PlayQuestion {
  return {
    id: `secret:${question.id}:secret:fill`,
    entryId: question.id,
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
