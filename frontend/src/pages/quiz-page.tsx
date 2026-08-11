import { BrainCircuit, Check, RefreshCw, RotateCcw, X } from 'lucide-react'
import {
  type FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { EmptyState, ErrorState, PageSkeleton } from '@/components/archive/async-state'
import { QuizMarkupContent } from '@/components/archive/markup-content'
import { PageHeading } from '@/components/archive/page-heading'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { useArchive } from '@/features/archive/archive-context'
import {
  buildQuestions,
  filteredQuestions,
  normalizeSecretQuestion,
  type PlayQuestion,
  pickQuestion,
} from '@/features/quiz/quiz-engine'
import { useAsyncData } from '@/hooks/use-async-data'
import { useSignedAsset } from '@/hooks/use-signed-asset'
import { normalizeText } from '@/lib/archive'
import { stripMarkup } from '@/lib/markup'
import { cn } from '@/lib/utils'
import {
  hasAdminAccess,
  loadPageMessages,
  loadPageSupplements,
  loadQuizQuestions,
  signAssetUrl,
} from '@/services/data'
import {
  getImageDimensions,
  preloadImageDimensionList,
  rememberImageDimensions,
} from '@/services/image-metadata'
import type { RecordItem } from '@/types/domain'

const TYPE_LABELS: Record<PlayQuestion['type'], string> = {
  choice: '选择题',
  fill: '填空题',
  judge: '判断题',
}

const CONTENT_LABELS: Record<PlayQuestion['content'], string> = {
  author: '记录人',
  date: '记录时间',
  person: '人名',
  quote: '名言',
  secret: '???',
}

function normalizeSecretAnswer(value: string) {
  return String(value || '')
    .normalize('NFC')
    .trim()
}

function splitAnswerCharacters(value: string) {
  const normalized = normalizeSecretAnswer(value)
  if (typeof Intl.Segmenter === 'function') {
    return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(normalized)].map(
      (item) => item.segment,
    )
  }
  return Array.from(normalized)
}

function QuestionSource({ question, revealed }: { question: PlayQuestion; revealed: boolean }) {
  if (!question.body && !question.sideText) return null
  return (
    <div className="mt-5 grid gap-3">
      {question.body && (
        <blockquote className="quiz-question-source text-foreground/90">
          <QuizMarkupContent
            content={question.markupBody || question.body}
            blankAnswer={question.blankAnswer}
            blankReference={question.blankReference}
            corrections={question.corrections}
            revealed={revealed}
          />
        </blockquote>
      )}
      {question.sideText && (
        <div className="quiz-question-side">
          <span className="quiz-question-side-label">{question.sideLabel}</span>
          {revealed && question.sideCorrection ? (
            <span className="quiz-judge-correction">
              <span className="quiz-judge-wrong">{question.sideText}</span>
              <span className="quiz-judge-answer">{question.sideCorrection.correctText}</span>
            </span>
          ) : (
            <span className="quiz-question-side-value">{question.sideText}</span>
          )}
        </div>
      )}
    </div>
  )
}

const quizImagePreloadCache = new Map<string, Promise<void>>()

function preloadQuizImage(path: string) {
  const existing = quizImagePreloadCache.get(path)
  if (existing) return existing
  const promise = (async () => {
    const src = await signAssetUrl(path)
    if (!src) return
    await new Promise<void>((resolve) => {
      const image = new Image()
      image.decoding = 'async'
      image.fetchPriority = 'low'
      image.onload = () => resolve()
      image.onerror = () => resolve()
      image.src = src
      if (image.complete) resolve()
    })
  })()
  quizImagePreloadCache.set(path, promise)
  promise.catch(() => quizImagePreloadCache.delete(path))
  return promise
}

function SecretImage({ path }: { path: string }) {
  const resource = useSignedAsset(path)
  const [frameDimensions] = useState(() => getImageDimensions(path) || { width: 4, height: 3 })
  const [ready, setReady] = useState(false)
  const [decodeFailed, setDecodeFailed] = useState(false)
  const ratio = frameDimensions.width / frameDimensions.height

  return (
    <div
      className="relative mx-auto grid w-full place-items-center overflow-hidden rounded-xl bg-muted/60 text-sm text-muted-foreground"
      style={{
        aspectRatio: `${frameDimensions.width} / ${frameDimensions.height}`,
        maxWidth: `min(48rem, calc(52svh * ${ratio}))`,
      }}
      aria-busy={!ready && !decodeFailed}
    >
      {!ready && !decodeFailed && (
        <span className="flex items-center gap-2" role="status" aria-live="polite">
          <Spinner aria-hidden="true" />
          正在加载题图
        </span>
      )}
      {(decodeFailed || (!resource.loading && !resource.src)) && (
        <div className="grid gap-3 px-5 text-center">
          <p>题图加载失败，请检查网络后重试。</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setDecodeFailed(false)
              void resource.retry()
            }}
          >
            重试
          </Button>
        </div>
      )}
      {resource.src && !decodeFailed && (
        <img
          src={resource.src}
          width={frameDimensions.width}
          height={frameDimensions.height}
          alt="题目插图"
          decoding="async"
          fetchPriority="high"
          onLoad={(event) => {
            rememberImageDimensions(path, {
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            })
            setReady(true)
          }}
          onError={() => {
            setReady(false)
            setDecodeFailed(true)
          }}
          className={`absolute inset-0 size-full object-contain transition-opacity duration-200 ${ready ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  )
}

export function QuizPage() {
  const resource = useArchive()
  const adminResource = useAsyncData(() => hasAdminAccess())
  const supplementalResource = useAsyncData(async () => {
    const [messages, supplements] = await Promise.all([
      loadPageMessages().catch(() => []),
      loadPageSupplements({ hidden: false }).catch(() => []),
    ])
    const records: RecordItem[] = [
      ...messages.map((item, index) => ({
        id: `message-${item.page || index + 1}`,
        fileName: `message-${item.page || index + 1}`,
        recordIndex: index,
        date: '',
        time: '',
        author: item.author,
        recorder: item.author,
        content: item.content,
        text: item.content,
        importance: 'normal',
        attachments: [],
        hidden: false,
        recordType: 'message' as const,
      })),
      ...supplements.map((item) => ({
        id: item.id,
        fileName: item.fileName || item.id,
        recordIndex: item.supplementIndex,
        date: item.date,
        time: item.time,
        author: item.author,
        recorder: item.author,
        content: item.content,
        text: item.content,
        importance: item.importance,
        attachments: [],
        hidden: false,
        recordType: 'supplement' as const,
      })),
    ]
    return records.filter((record) => record.content)
  })
  const [enabledTypes, setEnabledTypes] = useState<Set<PlayQuestion['type']>>(
    new Set(['choice', 'fill', 'judge']),
  )
  const [enabledContent, setEnabledContent] = useState<Set<PlayQuestion['content']>>(
    new Set(['author', 'date', 'person', 'quote']),
  )
  const [secret, setSecret] = useState<PlayQuestion[]>([])
  const [current, setCurrent] = useState<PlayQuestion | null>(null)
  const [input, setInput] = useState('')
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null)
  const [secretProgress, setSecretProgress] = useState<string[]>([])
  const [secretHint, setSecretHint] = useState('')
  const [secretError, setSecretError] = useState('')
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const questionAnchorRef = useRef<HTMLDivElement>(null)
  const pendingQuestionTop = useRef<number | null>(null)
  const secretUnlocking = useRef(false)
  const questions = useMemo(
    () =>
      resource.data
        ? buildQuestions(
            resource.data.records.concat(supplementalResource.data || []),
            resource.data.people,
            resource.data.quotes,
          ).concat(secret)
        : [],
    [resource.data, secret, supplementalResource.data],
  )
  const candidates = useMemo(
    () => filteredQuestions(questions, enabledTypes, enabledContent),
    [enabledContent, enabledTypes, questions],
  )

  const captureQuestionPosition = useCallback(() => {
    if (current && questionAnchorRef.current) {
      pendingQuestionTop.current = questionAnchorRef.current.getBoundingClientRect().top
    }
  }, [current])

  const next = useCallback(() => {
    captureQuestionPosition()
    setCurrent(pickQuestion(candidates))
    setInput('')
    setResult(null)
    setSecretProgress([])
    setSecretHint('')
  }, [candidates, captureQuestionPosition])

  useLayoutEffect(() => {
    const previousTop = pendingQuestionTop.current
    const anchor = questionAnchorRef.current
    if (previousTop === null || !anchor) return
    pendingQuestionTop.current = null
    const offset = anchor.getBoundingClientRect().top - previousTop
    if (Math.abs(offset) > 0.5) window.scrollBy({ top: offset, left: 0, behavior: 'auto' })
  })

  useEffect(() => {
    document.title = '答题 · 编日史'
  }, [])
  useEffect(() => {
    if (!current && candidates.length) next()
  }, [candidates, current, next])
  useEffect(() => {
    let buffer = ''
    let active = true
    const listener = async (event: KeyboardEvent) => {
      if (
        !adminResource.data ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        event.key.length !== 1
      )
        return
      buffer = (buffer + event.key.toLowerCase()).slice(-6)
      if (buffer !== 'lamian' || secret.length || secretUnlocking.current) return
      secretUnlocking.current = true
      try {
        const rows = await loadQuizQuestions(true)
        const extra = rows.filter((item) => item.answer).map(normalizeSecretQuestion)
        if (!extra.length) throw new Error('题库为空')
        const imagePaths = [
          ...new Set(
            extra.map((question) => question.image).filter((path): path is string => Boolean(path)),
          ),
        ]
        await preloadImageDimensionList(imagePaths)
        if (!active) return
        setSecret(extra)
      } catch {
        if (active) setSecretError('隐藏题库暂时无法加载，请稍后重试。')
      } finally {
        secretUnlocking.current = false
      }
    }
    window.addEventListener('keydown', listener)
    return () => {
      active = false
      window.removeEventListener('keydown', listener)
    }
  }, [adminResource.data, secret.length])
  useEffect(() => {
    const paths = [
      ...new Set(
        secret.map((question) => question.image).filter((path): path is string => Boolean(path)),
      ),
    ].slice(0, 12)
    if (!paths.length) return
    let cancelled = false
    const warm = async () => {
      for (const path of paths) {
        if (cancelled) return
        await preloadQuizImage(path).catch(() => undefined)
      }
    }
    const schedule = () => void warm()
    const timeoutId = globalThis.setTimeout(schedule, 250)
    return () => {
      cancelled = true
      globalThis.clearTimeout(timeoutId)
    }
  }, [secret])

  const answer = (value: string) => {
    if (!current || result) return
    if (current.content === 'secret') {
      const answerChars = splitAnswerCharacters(current.answer)
      const inputChars = splitAnswerCharacters(value)
      if (inputChars.length !== answerChars.length) {
        setSecretHint(`答案应为 ${answerChars.length} 个字符。`)
        return
      }
      const nextProgress = answerChars.map((character, index) =>
        inputChars[index] === character ? character : secretProgress[index] || '',
      )
      setSecretProgress(nextProgress)
      const correct = inputChars.every((character, index) => character === answerChars[index])
      if (!correct) {
        setSecretHint(
          nextProgress.some(Boolean)
            ? '部分字符正确，已保留在方框中，请继续。'
            : '本次没有新增正确字符，请重试。',
        )
        setInput('')
        return
      }
      setSecretHint('')
      setResult('correct')
      setScore((score) => ({ correct: score.correct + 1, total: score.total + 1 }))
      return
    }
    const correct = normalizeText(stripMarkup(value)) === normalizeText(stripMarkup(current.answer))
    setResult(correct ? 'correct' : 'wrong')
    setScore((score) => ({ correct: score.correct + Number(correct), total: score.total + 1 }))
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    answer(input)
  }
  const toggleType = (type: PlayQuestion['type']) => {
    const next = new Set(enabledTypes)
    if (next.has(type)) next.delete(type)
    else next.add(type)
    if (!filteredQuestions(questions, next, enabledContent).length) return
    captureQuestionPosition()
    setEnabledTypes(next)
    setCurrent(null)
  }
  const toggleContent = (content: PlayQuestion['content']) => {
    const next = new Set(enabledContent)
    if (next.has(content)) next.delete(content)
    else next.add(content)
    if (!filteredQuestions(questions, enabledTypes, next).length) return
    captureQuestionPosition()
    setEnabledContent(next)
    setCurrent(null)
  }
  const secretBoxes =
    current?.content === 'secret'
      ? splitAnswerCharacters(current.answer).map((character, index) => ({
          character,
          key: `${current.id}-${character}-${index}`,
        }))
      : []
  const typeCannotBeRemoved = (type: PlayQuestion['type']) => {
    if (!enabledTypes.has(type)) return false
    const next = new Set(enabledTypes)
    next.delete(type)
    return !filteredQuestions(questions, next, enabledContent).length
  }
  const contentCannotBeRemoved = (content: PlayQuestion['content']) => {
    if (!enabledContent.has(content)) return false
    const next = new Set(enabledContent)
    next.delete(content)
    return !filteredQuestions(questions, enabledTypes, next).length
  }
  const allAvailableSelected =
    enabledTypes.size === 3 &&
    enabledContent.size === (secret.length ? 5 : 4) &&
    (!secret.length || enabledContent.has('secret'))
  const selectAllAvailable = () => {
    if (allAvailableSelected) return
    captureQuestionPosition()
    setEnabledTypes(new Set(['choice', 'fill', 'judge']))
    setEnabledContent(
      new Set([
        'author',
        'date',
        'person',
        'quote',
        ...(secret.length ? (['secret'] as const) : []),
      ]),
    )
    setCurrent(null)
  }
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageHeading
        eyebrow={null}
        title="档案答题"
        description="题目从记录、人物与名言实时生成；筛选题型和内容后开始挑战。"
        className="shrink-0"
        compact
        actions={
          <Button variant="outline" onClick={next} disabled={!candidates.length}>
            <RefreshCw data-icon="inline-start" />
            换一题
          </Button>
        }
      />
      {resource.loading && <PageSkeleton rows={3} />}
      {resource.error && <ErrorState title="题库加载失败" onRetry={resource.retry} />}
      {resource.data && (
        <div className="flex min-h-0 flex-1 flex-col">
          {secretError && (
            <Alert variant="destructive" className="mb-3 shrink-0">
              <AlertTitle>隐藏题库加载失败</AlertTitle>
              <AlertDescription>{secretError}</AlertDescription>
            </Alert>
          )}
          <section
            aria-label="答题筛选"
            className="mb-3 flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-b border-border/70 pb-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-sm font-medium text-muted-foreground">题型</span>
              {(['choice', 'fill', 'judge'] as const).map((type) => (
                <Button
                  key={type}
                  size="sm"
                  variant={enabledTypes.has(type) ? 'default' : 'outline'}
                  aria-pressed={enabledTypes.has(type)}
                  disabled={typeCannotBeRemoved(type)}
                  onClick={() => toggleType(type)}
                >
                  {enabledTypes.has(type) && <Check data-icon="inline-start" />}
                  {TYPE_LABELS[type]}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-sm font-medium text-muted-foreground">内容</span>
              {(
                [
                  'author',
                  'date',
                  'person',
                  'quote',
                  ...(secret.length ? ['secret' as const] : []),
                ] as const
              ).map((content) => (
                <Button
                  key={content}
                  size="sm"
                  variant={enabledContent.has(content) ? 'default' : 'outline'}
                  aria-pressed={enabledContent.has(content)}
                  disabled={contentCannotBeRemoved(content)}
                  onClick={() => toggleContent(content)}
                >
                  {enabledContent.has(content) && <Check data-icon="inline-start" />}
                  {CONTENT_LABELS[content]}
                </Button>
              ))}
              <Button
                className="ml-auto"
                size="sm"
                variant="ghost"
                disabled={allAvailableSelected}
                onClick={selectAllAvailable}
              >
                <RotateCcw data-icon="inline-start" />
                全选可用
              </Button>
            </div>
          </section>
          <Card
            className="quiz-question-card min-h-0 flex-1 gap-0 overflow-hidden bg-card/88 py-0 shadow-sm backdrop-blur-md"
            data-question-type={current?.type || 'choice'}
          >
            <CardHeader className="quiz-question-header shrink-0 rounded-none border-b py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="quiz-question-type-icon grid size-9 shrink-0 place-items-center rounded-lg">
                    <BrainCircuit className="size-4" />
                  </span>
                  {current && (
                    <>
                      <Badge className="quiz-question-type-badge" variant="outline">
                        {TYPE_LABELS[current.type]}
                      </Badge>
                      <Badge variant="secondary">{CONTENT_LABELS[current.content]}</Badge>
                    </>
                  )}
                </div>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  正确 {score.correct} / {score.total}
                </span>
              </div>
              <Progress
                value={score.total ? (score.correct / score.total) * 100 : 0}
                aria-label="答题正确率"
              />
              {current && (
                <span className="truncate text-xs text-muted-foreground sm:text-sm">
                  条目 {current.entryId}
                </span>
              )}
            </CardHeader>
            <CardContent className="min-h-0 flex-1 p-0">
              {current ? (
                <ScrollArea key={current.id} className="h-full">
                  <div
                    ref={questionAnchorRef}
                    key={current.id}
                    className="min-h-full px-4 py-4 pr-7 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200 sm:px-6 sm:py-5 sm:pr-9"
                  >
                    <h2 className="quiz-question-prompt font-heading text-section-title font-semibold text-foreground">
                      {current.prompt}
                    </h2>
                    <QuestionSource question={current} revealed={Boolean(result)} />
                    {current.image && (
                      <div className="my-5">
                        <SecretImage path={current.image} />
                      </div>
                    )}
                    {current.content === 'secret' && (
                      <fieldset className="my-5 flex flex-wrap justify-center gap-2">
                        <legend className="sr-only">答案字数 {secretBoxes.length}</legend>
                        {secretBoxes.map((box, index) => (
                          <span
                            key={box.key}
                            className="quiz-secret-answer-box grid size-10 place-items-center rounded-md border bg-muted font-heading text-lg font-semibold"
                          >
                            {secretProgress[index] || ''}
                          </span>
                        ))}
                      </fieldset>
                    )}
                    {current.type === 'fill' ? (
                      <form onSubmit={submit} className="mt-6">
                        <Field>
                          <FieldLabel htmlFor="quiz-answer">填入完整答案（需完全相同）</FieldLabel>
                          <div className="flex gap-2">
                            <Input
                              id="quiz-answer"
                              className="disabled:opacity-75"
                              value={input}
                              onChange={(event) => setInput(event.target.value)}
                              disabled={Boolean(result)}
                              autoComplete="off"
                              autoFocus
                              placeholder="请输入挖空内容"
                            />
                            <Button type="submit" disabled={!input.trim() || Boolean(result)}>
                              提交
                            </Button>
                          </div>
                        </Field>
                      </form>
                    ) : (
                      <div className="mt-6 grid gap-2 sm:grid-cols-2">
                        {current.choices.map((choice, index) => {
                          const isAnswer = normalizeText(choice) === normalizeText(current.answer)
                          const isSelected = normalizeText(choice) === normalizeText(input)
                          return (
                            <Button
                              key={choice}
                              size="lg"
                              variant="outline"
                              className={cn(
                                'quiz-option h-auto min-h-16 justify-start whitespace-normal px-4 py-3 text-left disabled:opacity-100',
                                result && isAnswer && 'is-correct',
                                result && isSelected && !isAnswer && 'is-wrong',
                              )}
                              disabled={Boolean(result)}
                              onClick={() => {
                                setInput(choice)
                                answer(choice)
                              }}
                            >
                              <span className="quiz-option-label">
                                {current.type === 'judge' ? (
                                  index === 0 ? (
                                    <Check />
                                  ) : (
                                    <X />
                                  )
                                ) : (
                                  String.fromCharCode(65 + index)
                                )}
                              </span>
                              <span>{choice}</span>
                            </Button>
                          )
                        })}
                      </div>
                    )}
                    {secretHint && (
                      <Alert className="mt-5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
                        <AlertTitle>继续尝试</AlertTitle>
                        <AlertDescription>{secretHint}</AlertDescription>
                      </Alert>
                    )}
                  </div>
                </ScrollArea>
              ) : (
                <div className="grid h-full place-items-center p-5">
                  <EmptyState
                    title="当前筛选下没有可生成的题目"
                    description="请重新选择题型或题目内容；至少保留一个可生成组合。"
                  />
                </div>
              )}
            </CardContent>
            {current && (
              <CardFooter className="min-h-16 shrink-0 justify-between gap-4 bg-muted/38 px-4 py-3 sm:px-5">
                <div
                  className={cn(
                    'min-w-0 flex-1 text-sm leading-6',
                    !result && 'text-muted-foreground',
                    result === 'correct' && 'quiz-result-correct',
                    result === 'wrong' && 'quiz-result-wrong',
                  )}
                  role="status"
                  aria-live="polite"
                >
                  {result ? (
                    <>
                      <strong>{result === 'correct' ? '回答正确' : '回答错误'}</strong>
                      {result === 'wrong' && <> · 正确答案：{current.answer}。</>}
                      {current.explanation && ` ${current.explanation}`}
                    </>
                  ) : (
                    '选择答案或填写完整内容后提交。'
                  )}
                </div>
                {result && <Button onClick={next}>下一题</Button>}
              </CardFooter>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
