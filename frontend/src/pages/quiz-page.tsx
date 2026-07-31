import { BrainCircuit, Image as ImageIcon, RefreshCw } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'

import { ErrorState, PageSkeleton } from '@/components/archive/async-state'
import { PageHeading } from '@/components/archive/page-heading'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { useArchive } from '@/features/archive/archive-context'
import {
  buildQuestions,
  normalizeSecretQuestion,
  type PlayQuestion,
} from '@/features/quiz/quiz-engine'
import { useAsyncData } from '@/hooks/use-async-data'
import { normalizeText } from '@/lib/archive'
import { stripMarkup } from '@/lib/markup'
import { hasAdminAccess, loadQuizQuestions, signAssetUrl } from '@/services/data'

function SecretImage({ path }: { path: string }) {
  const resource = useAsyncData(() => signAssetUrl(path), [path])
  if (resource.loading)
    return (
      <div className="grid h-56 place-items-center rounded-xl bg-muted text-sm text-muted-foreground">
        <ImageIcon className="mb-2 size-5" />
        正在加载题图
      </div>
    )
  if (!resource.data)
    return (
      <Alert variant="destructive">
        <AlertTitle>题图加载失败</AlertTitle>
        <AlertDescription>题图加载失败。</AlertDescription>
      </Alert>
    )
  return (
    <img
      src={resource.data}
      alt="题目插图"
      className="mx-auto max-h-[52vh] rounded-xl object-contain"
    />
  )
}

export function QuizPage() {
  const resource = useArchive()
  const adminResource = useAsyncData(() => hasAdminAccess())
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
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const questions = useMemo(
    () =>
      resource.data
        ? buildQuestions(resource.data.records, resource.data.people, resource.data.quotes).concat(
            secret,
          )
        : [],
    [resource.data, secret],
  )
  const candidates = useMemo(
    () =>
      questions.filter(
        (question) => enabledTypes.has(question.type) && enabledContent.has(question.content),
      ),
    [enabledContent, enabledTypes, questions],
  )

  const next = useCallback(() => {
    const pool = candidates.filter((question) => question.id !== current?.id)
    setCurrent(pool[Math.floor(Math.random() * pool.length)] || candidates[0] || null)
    setInput('')
    setResult(null)
  }, [candidates, current?.id])

  useEffect(() => {
    document.title = '答题 · 编日史'
  }, [])
  useEffect(() => {
    if (!current && candidates.length) next()
  }, [candidates, current, next])
  useEffect(() => {
    let buffer = ''
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
      if (buffer !== 'lamian' || secret.length) return
      const rows = await loadQuizQuestions(true)
      const extra = rows.filter((item) => item.answer).map(normalizeSecretQuestion)
      setSecret(extra)
      setEnabledContent((value) => new Set([...value, 'secret']))
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [adminResource.data, secret.length])

  const answer = (value: string) => {
    if (!current || result) return
    const correct = normalizeText(stripMarkup(value)) === normalizeText(stripMarkup(current.answer))
    setResult(correct ? 'correct' : 'wrong')
    setScore((score) => ({ correct: score.correct + Number(correct), total: score.total + 1 }))
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    answer(input)
  }
  const toggleType = (type: PlayQuestion['type']) =>
    setEnabledTypes((value) => {
      const next = new Set(value)
      if (next.has(type) && next.size > 1) next.delete(type)
      else next.add(type)
      setCurrent(null)
      return next
    })
  const toggleContent = (content: PlayQuestion['content']) =>
    setEnabledContent((value) => {
      const next = new Set(value)
      if (next.has(content) && next.size > 1) next.delete(content)
      else next.add(content)
      setCurrent(null)
      return next
    })
  const labels = { author: '记录人', date: '日期', person: '人物', quote: '名言', secret: '???' }
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
                    variant={enabledContent.has(content) ? 'secondary' : 'outline'}
                    aria-pressed={enabledContent.has(content)}
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
                <div>
                  <h2 className="font-heading text-xl font-semibold leading-relaxed">
                    {current.prompt}
                  </h2>
                  {current.body && (
                    <blockquote className="my-5 rounded-xl border-l-4 border-primary/40 bg-muted/65 px-5 py-4 text-sm leading-7 text-muted-foreground">
                      {current.body}
                    </blockquote>
                  )}
                  {current.image && (
                    <div className="my-5">
                      <SecretImage path={current.image} />
                    </div>
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
                  {result && (
                    <Alert
                      variant={result === 'wrong' ? 'destructive' : 'default'}
                      className="mt-5"
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
