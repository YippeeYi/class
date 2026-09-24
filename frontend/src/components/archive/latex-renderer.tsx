import katex from 'katex'
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import 'katex/contrib/mhchem'
import 'katex/dist/katex.min.css'
import type { LatexMarker } from '@/lib/markup'

type MathSlot = { marker: LatexMarker; element: Element; content: Node[] }

function MathContent({ content }: { content: Node[] }) {
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const element = ref.current
    if (element) for (const node of content) element.appendChild(node)
  }, [content])
  return <span ref={ref} />
}

export function LatexRenderer({
  source,
  displayMode = false,
  mathSource,
  markers,
  renderMarker,
}: {
  source: string
  displayMode?: boolean
  mathSource?: string
  markers?: LatexMarker[]
  renderMarker?: (marker: LatexMarker['node'], content: ReactNode) => ReactNode
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [failed, setFailed] = useState(false)
  const [slots, setSlots] = useState<MathSlot[]>([])
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    try {
      const trustedClasses = new Set(markers?.map((marker) => marker.className))
      katex.render(mathSource || source, element, {
        displayMode,
        throwOnError: true,
        trust: (context) => context.command === '\\htmlClass' && trustedClasses.has(context.class),
        strict: (code) =>
          code === 'htmlExtension' && trustedClasses.size > 0 ? 'ignore' : 'error',
        maxExpand: 1000,
        maxSize: 10,
        output: 'htmlAndMathml',
        // Keep fraction text at the formula's base size while retaining native script sizes.
        macros: {
          '\\frac':
            '\\mathchoice{\\dfrac{#1}{#2}}{\\dfrac{#1}{#2}}{\\tfrac{#1}{#2}}{\\tfrac{#1}{#2}}',
        },
      })
      const html = element.querySelector('.katex-html')
      if (markers?.length && html) {
        html.removeAttribute('aria-hidden')
        element.querySelector('.katex-mathml')?.setAttribute('aria-hidden', 'true')
      }
      const nextSlots =
        markers?.map((marker) => {
          const target = html?.querySelector(`.${marker.className}`)
          if (!target) throw new Error('LaTeX marker was not rendered')
          const content = [...target.childNodes]
          target.replaceChildren()
          return { marker, element: target, content }
        }) || []
      setSlots(nextSlots)
      setFailed(false)
    } catch {
      element.replaceChildren()
      setSlots([])
      setFailed(true)
    }
  }, [displayMode, markers, mathSource, source])
  return (
    <span
      className={`record-latex${displayMode ? ' record-latex--block' : ''}`}
      title={failed ? '公式格式错误' : undefined}
    >
      <span ref={ref} />
      {renderMarker &&
        slots.map((slot) =>
          createPortal(
            renderMarker(slot.marker.node, <MathContent content={slot.content} />),
            slot.element,
            slot.marker.className,
          ),
        )}
      {failed && <span className="record-latex-error">公式格式错误</span>}
    </span>
  )
}
