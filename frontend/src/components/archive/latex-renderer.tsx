import katex from 'katex'
import { useEffect, useRef, useState } from 'react'
import 'katex/contrib/mhchem'
import 'katex/dist/katex.min.css'

export function LatexRenderer({ source }: { source: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    try {
      katex.render(source, element, {
        displayMode: false,
        throwOnError: true,
        trust: false,
        strict: 'error',
        maxExpand: 1000,
        maxSize: 10,
        output: 'htmlAndMathml',
      })
      setFailed(false)
    } catch {
      element.replaceChildren()
      setFailed(true)
    }
  }, [source])
  return (
    <span className="record-latex" title={failed ? '公式格式错误' : undefined}>
      <span ref={ref} />
      {failed && <span className="record-latex-error">{source}</span>}
    </span>
  )
}
