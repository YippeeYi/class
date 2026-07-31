import { BrainCircuit, RefreshCw } from 'lucide-react'
import {
  type FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { ErrorState, PageSkeleton } from '@/components/archive/async-state'
import { PageHeading } from '@/components/archive/page-heading'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
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
    setCurrent(pickQuestion(candidates, current?.id || ''))
    setInput('')
    setResult(null)
    setSecretProgress([])
    setSecretHint('')
  }, [candidates, captureQuestionPosition, current?.id])

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
        setEnabledContent((value) => new Set([...value, 'secret']))
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
      const answerChars = Array.from(normalizeText(stripMarkup(current.answer)).replace(/\s+/g, ''))
      const inputChars = Array.from(normalizeText(stripMarkup(value)).replace(/\s+/g, ''))
      if (inputChars.length !== answerChars.length) {
        setSecretHint(`答案应为 ${answerChars.length} 个字符。`)
        return
      }
      const nextProgress = answerChars.map((character, index) =>
        inputChars[index] === character ? character : secretProgress[index] || '',
      )
      setSecretProgress(nextProgress)
      const correct = nextProgress.every((character, index) => character === answerChars[index])
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
  const labels = { author: '记录人', date: '日期', person: '人物', quote: '名言', secret: '???' }
  const secretBoxes =
    current?.content === 'secret'
      ? Array.from(normalizeText(stripMarkup(current.answer)).replace(/\s+/g, '')).map(
          (character, index) => ({ character, key: `${current.id}-${character}-${index}` }),
        )
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
  return (
    <div>
      <PageHeading
        title="档案答题"
        description="题目从记录、人物与名言实时生成；筛选题型和内容后开始挑战。"
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
        <>
          {secretError && (
            <Alert variant="destructive" className="mb-5">
              <AlertTitle>隐藏题库加载失败</AlertTitle>
              <AlertDescription>{secretError}</AlertDescription>
            </Alert>
          )}
          <Card className="mb-5">
            <CardContent>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="mr-1 text-xs font-medium text-muted-foreground">题型</span>
                {(['choice', 'fill', 'judge'] as const).map((type) => (
                  <Button
                    key={type}
                    size="sm"
                    variant={enabledTypes.has(type) ? 'default' : 'outline'}
                    aria-pressed={enabledTypes.has(type)}
                    disabled={typeCannotBeRemoved(type)}
                    onClick={() => toggleType(type)}
                  >
                    {type === 'choice' ? '选择题' : type === 'fill' ? '填空题' : '判断题'}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-xs font-medium text-muted-foreground">内容</span>
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
                    {labels[content]}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                    <BrainCircuit className="size-4" />
                  </span>
                  {current && (
                    <>
                      <Badge variant="outline">
                        {current.type === 'choice'
                          ? '选择题'
                          : current.type === 'fill'
                            ? '填空题'
                            : '判断题'}
                      </Badge>
                      <Badge variant="secondary">{labels[current.content]}</Badge>
                    </>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  正确 {score.correct} / {score.total}
                </span>
              </div>
              <Progress
                value={score.total ? (score.correct / score.total) * 100 : 0}
                aria-label="答题正确率"
              />
            </CardHeader>
            <CardContent>
              {current ? (
                <div
                  ref={questionAnchorRef}
                  key={current.id}
                  className="min-h-[30rem] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
                >
                  <h2 className="font-heading text-xl font-semibold leading-relaxed text-foreground">
                    {current.prompt}
                  </h2>
                  {current.body && (
                    <blockquote className="my-5 rounded-xl border-l-4 border-primary/50 bg-muted/45 px-5 py-4 text-base leading-8 text-foreground/90">
                      {current.body}
                    </blockquote>
                  )}
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
                          className="grid size-10 place-items-center rounded-md border bg-muted font-heading text-lg font-semibold"
                        >
                          {secretProgress[index] || ''}
                        </span>
                      ))}
                    </fieldset>
                  )}
                  {current.type === 'fill' ? (
                    <form onSubmit={submit} className="mt-6">
                      <Field>
                        <FieldLabel htmlFor="quiz-answer">完整答案</FieldLabel>
                        <div className="flex gap-2">
                          <Input
                            id="quiz-answer"
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            disabled={Boolean(result)}
                            autoComplete="off"
                          />
                          <Button type="submit" disabled={!input.trim() || Boolean(result)}>
                            提交
                          </Button>
                        </div>
                      </Field>
                    </form>
                  ) : (
                    <div className="mt-6 grid gap-2 sm:grid-cols-2">
                      {current.choices.map((choice) => (
                        <Button
                          key={choice}
                          size="lg"
                          variant={
                            result && normalizeText(choice) === normalizeText(current.answer)
                              ? 'default'
                              : result && normalizeText(choice) === normalizeText(input)
                                ? 'destructive'
                                : 'outline'
                          }
                          className="h-auto min-h-12 whitespace-normal py-3"
                          disabled={Boolean(result)}
                          onClick={() => {
                            setInput(choice)
                            answer(choice)
                          }}
                        >
                          {choice}
                        </Button>
                      ))}
                    </div>
                  )}
                  {secretHint && (
                    <Alert className="mt-5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
                      <AlertTitle>继续尝试</AlertTitle>
                      <AlertDescription>{secretHint}</AlertDescription>
                    </Alert>
                  )}
                  {result && (
                    <Alert
                      variant={result === 'wrong' ? 'destructive' : 'default'}
                      className="mt-5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
                    >
                      <AlertTitle>{result === 'correct' ? '回答正确' : '回答错误'}</AlertTitle>
                      <AlertDescription>
                        {result === 'wrong' && <>正确答案：{current.answer}。</>}
                        {current.explanation && ` ${current.explanation}`}
                      </AlertDescription>
                    </Alert>
                  )}
                  {result && (
                    <div className="mt-5 flex justify-end">
                      <Button onClick={next}>下一题</Button>
                    </div>
                  )}
                </div>
              ) : (
                <ErrorState title="当前筛选下没有可生成的题目" />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
