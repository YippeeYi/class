import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Allows one automatic signed-URL refresh after an image decode failure.
 * Further failures remain visible until the user explicitly retries, which
 * prevents a missing object from creating an unbounded request loop.
 */
export function useBoundedImageRetry(identity: string, retry: () => Promise<string>) {
  const retryRef = useRef(retry)
  const automaticRetryUsed = useRef(false)
  const [failed, setFailed] = useState(false)
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    retryRef.current = retry
  }, [retry])

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new asset identity must reset the per-image retry budget.
  useEffect(() => {
    automaticRetryUsed.current = false
    setFailed(false)
    setRetrying(false)
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
    setRetrying(true)
    void retryRef
      .current()
      .then((src) => {
        if (!src) setFailed(true)
      })
      .catch(() => setFailed(true))
      .finally(() => setRetrying(false))
  }, [])

  const retryManually = useCallback(async () => {
    automaticRetryUsed.current = true
    setFailed(false)
    setRetrying(true)
    try {
      const src = await retryRef.current()
      if (!src) setFailed(true)
      return src
    } catch {
      setFailed(true)
      return ''
    } finally {
      setRetrying(false)
    }
  }, [])

  return { failed, retrying, markLoaded, markFailed, retryManually }
}
