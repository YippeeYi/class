import type { MarkupNode } from './markup'

export type MarkupBlock =
  | { type: 'inline'; nodes: MarkupNode[]; key: string }
  | {
      type: 'block'
      node: MarkupNode
      key: string
      styles?: Extract<MarkupNode, { type: 'style' }>['style'][]
      decoratedLatex?: boolean
    }

function isBlock(node: MarkupNode) {
  return (
    node.type === 'table' ||
    (node.type === 'media' && node.mediaType === 'video') ||
    (node.type === 'latex' && node.displayMode === 'block')
  )
}

/** Split block nodes out of inline wrappers before React creates DOM. */
export function normalizeMarkup(nodes: MarkupNode[]): MarkupBlock[] {
  const output: MarkupBlock[] = []
  let inline: MarkupNode[] = []
  let inlineKey = ''
  const flush = () => {
    if (inline.length) output.push({ type: 'inline', nodes: inline, key: inlineKey })
    inline = []
  }
  const append = (node: MarkupNode, key: string) => {
    if (!inline.length) inlineKey = key
    inline.push(node)
  }
  const visit = (node: MarkupNode, key: string) => {
    if (isBlock(node)) {
      flush()
      output.push({ type: 'block', node, key })
      return
    }
    if (node.type === 'style' || node.type === 'reference' || node.type === 'annotation') {
      const nested = normalizeMarkup(node.children)
      for (const part of nested) {
        if (part.type === 'block') {
          flush()
          const decoratedLatex = part.decoratedLatex || part.node.type === 'latex'
          output.push({
            ...part,
            key: `${key}/${part.key}`,
            node: decoratedLatex ? { ...node, children: [part.node] } : part.node,
            decoratedLatex,
            styles: decoratedLatex
              ? part.styles
              : node.type === 'style'
                ? [node.style, ...(part.styles || [])]
                : part.styles,
          })
        } else if (part.nodes.length) {
          append({ ...node, children: part.nodes }, `${key}/${part.key}`)
        }
      }
      return
    }
    append(node, key)
  }
  nodes.forEach((node, index) => {
    visit(node, `${index}:${node.type}`)
  })
  flush()
  return output
}
