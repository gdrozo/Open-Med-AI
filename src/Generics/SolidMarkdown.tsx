import { Accessor, createResource } from 'solid-js'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

import './SolidMarkdown.css'

async function parseMarkdown(text: string) {
  // 1. Convert Markdown string to HTML string
  const rawHtml = await marked.parse(text || '')
  // 2. Sanitize to prevent XSS (Crucial for AI apps!)
  const safeHtml = DOMPurify.sanitize(rawHtml)
  return safeHtml
}

type SolidMarkdownProps = {
  text: Accessor<string>
  class?: string
}

const SolidMarkdown = (props: SolidMarkdownProps) => {
  const [safeHtml] = createResource(props.text, parseMarkdown)
  return (
    <div
      data-markdown={props.text()}
      class={`markdown-body ${props.class}`}
      innerHTML={safeHtml()}
    />
  )
}

export default SolidMarkdown
