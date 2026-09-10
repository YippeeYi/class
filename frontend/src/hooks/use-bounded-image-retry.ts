import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Allows one automatic signed-URL refresh after an image decode failure.
 * Further failures remain visible until the user explicitly retries, which
 * prevents a missing object from creating an unbounded request loop.
 */
export function useBoundedImageRetry(identity: string, retry: () => Promise<string>) {
  const retryRef = useRef(retry)
  const automaticRetryUsed = useRef(false)
  const generation = useRef(0)
  const [failed, setFailed] = useState(false)
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    retryRef.current = retry
  }, [retry])

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new asset identity must reset the per-image retry budget.
  useEffect(() => {
    generation.current += 1
    automaticRetryUsed.current = false
    setFailed(false)
    setRetrying(false)
    return () => {
      generation.current += 1
    }
  }, [identity])

  const markLoaded = useCallback(() => {
    setFailed(false)
    setRetrying(false)
  }, [])

  const markFailed = useCallback(() => {
    if (automaticRetryUsed.current) {
      setRetrying(false)
      setFailed(true)
      return
    }
    automaticRetryUsed.current = true
    const requestGeneration = generation.current
    setRetrying(true)
    void retryRef
      .current()
      .then((src) => {
        if (requestGeneration === generation.current && !src) setFailed(true)
      })
      .catch(() => {
        if (requestGeneration === generation.current) setFailed(true)
      })
      .finally(() => {
        if (requestGeneration === generation.current) setRetrying(false)
      })
  }, [])

  const retryManually = useCallback(async () => {
    const requestGeneration = generation.current
    automaticRetryUsed.current = true
    setFailed(false)
    setRetrying(true)
    try {
      const src = await retryRef.current()
      if (requestGeneration !== generation.current) return ''
      if (!src) setFailed(true)
      return src
    } catch {
      if (requestGeneration === generation.current) setFailed(true)
      return ''
    } finally {
      if (requestGeneration === generation.current) setRetrying(false)
    }
  }, [])

  return { failed, retrying, markLoaded, markFailed, retryManually }
}
