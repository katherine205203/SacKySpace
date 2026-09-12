import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import './richText.css'

export const RICH_TEXT_PREFIX = 'sacky-richtext:v1:'

export type RichTextLineSpacing = 'compact' | 'normal' | 'airy'
export type RichTextParagraphSpacing = 'small' | 'normal' | 'large'
export type RichTextMark = 'bold' | 'italic'

export type RichTextText = {
  text: string
  marks?: RichTextMark[]
}

export type RichTextListItem = {
  children: RichTextText[]
}

export type RichTextBlock =
  | { type: 'paragraph'; children: RichTextText[] }
  | { type: 'bullet_list'; items: RichTextListItem[] }
  | { type: 'numbered_list'; items: RichTextListItem[] }
  | { type: 'quote'; children: RichTextText[] }

export type RichTextDocument = {
  type: 'doc'
  version: 1
  lineSpacing: RichTextLineSpacing
  paragraphSpacing: RichTextParagraphSpacing
  blocks: RichTextBlock[]
}

const defaultDocument = (text = ''): RichTextDocument => ({
  type: 'doc',
  version: 1,
  lineSpacing: 'normal',
  paragraphSpacing: 'normal',
  blocks: [{ type: 'paragraph', children: text ? [{ text }] : [] }],
})

const isMark = (value: unknown): value is RichTextMark => value === 'bold' || value === 'italic'
const isLineSpacing = (value: unknown): value is RichTextLineSpacing => value === 'compact' || value === 'normal' || value === 'airy'
const isParagraphSpacing = (value: unknown): value is RichTextParagraphSpacing => value === 'small' || value === 'normal' || value === 'large'

const sanitizeText = (value: unknown): RichTextText => {
  if (!value || typeof value !== 'object') return { text: '' }
  const item = value as { text?: unknown; marks?: unknown }
  return {
    text: typeof item.text === 'string' ? item.text : '',
    ...(Array.isArray(item.marks) ? { marks: item.marks.filter(isMark) } : {}),
  }
}

const parseInlineChildren = (value: unknown): RichTextText[] => {
  if (!Array.isArray(value)) return []
  return value.map(sanitizeText).filter((item) => item.text.length > 0 || Boolean(item.marks?.length))
}

const parseBlock = (value: unknown): RichTextBlock | null => {
  if (!value || typeof value !== 'object') return null
  const block = value as { type?: unknown; children?: unknown; items?: unknown }
  if (block.type === 'paragraph' || block.type === 'quote') return { type: block.type, children: parseInlineChildren(block.children) }
  if (block.type === 'bullet_list' || block.type === 'numbered_list') {
    const items = Array.isArray(block.items)
      ? block.items.map((item) => item && typeof item === 'object' ? { children: parseInlineChildren((item as { children?: unknown }).children) } : { children: [] })
      : []
    return { type: block.type, items }
  }
  return null
}

export const parseRichText = (value: string | null | undefined): RichTextDocument => {
  if (!value) return defaultDocument()
  if (!value.startsWith(RICH_TEXT_PREFIX)) return defaultDocument(value)
  try {
    const parsed = JSON.parse(value.slice(RICH_TEXT_PREFIX.length)) as Partial<RichTextDocument>
    const blocks = Array.isArray(parsed.blocks) ? parsed.blocks.map(parseBlock).filter((block): block is RichTextBlock => Boolean(block)) : []
    return {
      type: 'doc',
      version: 1,
      lineSpacing: isLineSpacing(parsed.lineSpacing) ? parsed.lineSpacing : 'normal',
      paragraphSpacing: isParagraphSpacing(parsed.paragraphSpacing) ? parsed.paragraphSpacing : 'normal',
      blocks: blocks.length ? blocks : defaultDocument().blocks,
    }
  } catch {
    return defaultDocument(value)
  }
}

export const serializeRichText = (document: RichTextDocument): string => `${RICH_TEXT_PREFIX}${JSON.stringify(document)}`

const inlineText = (children: RichTextText[]): string => children.map((child) => child.text).join('')

const documentToPlainText = (document: RichTextDocument): string => document.blocks.map((block) => {
  if (block.type === 'bullet_list' || block.type === 'numbered_list') return block.items.map((item) => inlineText(item.children)).join('\n')
  return inlineText(block.children)
}).join('\n')

export const richTextToPlainText = (value: string | null | undefined): string => {
  return documentToPlainText(parseRichText(value))
}

export const richTextWordCount = (value: string | null | undefined): number => {
  const plainText = richTextToPlainText(value).trim()
  return plainText ? plainText.split(/\s+/u).length : 0
}

export const isRichTextEmpty = (value: string | null | undefined): boolean => !richTextToPlainText(value).trim()

const truncateDocument = (document: RichTextDocument, maxLength: number): RichTextDocument => {
  let remaining = Math.max(0, maxLength)
  const truncateChildren = (children: RichTextText[]): RichTextText[] => children.flatMap((child) => {
    if (remaining <= 0) return []
    const text = child.text.slice(0, remaining)
    remaining -= text.length
    return text ? [{ ...child, text }] : []
  })
  return {
    ...document,
    blocks: document.blocks.map((block) => {
      if (block.type === 'bullet_list' || block.type === 'numbered_list') return { ...block, items: block.items.map((item) => ({ children: truncateChildren(item.children) })) }
      return { ...block, children: truncateChildren(block.children) }
    }),
  }
}

const sameMarks = (left: RichTextMark[] | undefined, right: RichTextMark[]): boolean => JSON.stringify(left ?? []) === JSON.stringify(right)

const pushInlineText = (target: RichTextText[], text: string, marks: RichTextMark[]): void => {
  if (!text) return
  const previous = target[target.length - 1]
  if (previous && sameMarks(previous.marks, marks)) previous.text += text
  else target.push({ text, ...(marks.length ? { marks } : {}) })
}

const collectInline = (node: Node, inheritedMarks: RichTextMark[] = []): RichTextText[] => {
  const children: RichTextText[] = []
  if (node.nodeType === Node.TEXT_NODE) {
    pushInlineText(children, node.textContent ?? '', inheritedMarks)
    return children
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return children
  const element = node as HTMLElement
  const marks = [...inheritedMarks]
  if (element.tagName === 'STRONG' || element.tagName === 'B') {
    if (!marks.includes('bold')) marks.push('bold')
  }
  if (element.tagName === 'EM' || element.tagName === 'I') {
    if (!marks.includes('italic')) marks.push('italic')
  }
  if (element.tagName === 'BR') {
    pushInlineText(children, '\n', marks)
    return children
  }
  element.childNodes.forEach((child) => collectInline(child, marks).forEach((item) => pushInlineText(children, item.text, item.marks ?? [])))
  return children
}

const collectListItem = (item: Element): RichTextListItem => ({ children: collectInline(item) })

const serializeEditorDom = (root: HTMLElement, document: RichTextDocument): RichTextDocument => {
  const blocks: RichTextBlock[] = []
  root.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const children = collectInline(node)
      if (children.length) blocks.push({ type: 'paragraph', children })
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const element = node as HTMLElement
    if (element.tagName === 'UL' || element.tagName === 'OL') {
      const items = Array.from(element.children).filter((child) => child.tagName === 'LI').map(collectListItem)
      blocks.push({ type: element.tagName === 'UL' ? 'bullet_list' : 'numbered_list', items })
    } else if (element.tagName === 'BLOCKQUOTE') {
      blocks.push({ type: 'quote', children: collectInline(element) })
    } else if (element.tagName === 'P' || element.tagName === 'DIV' || element.tagName === 'LI') {
      blocks.push({ type: 'paragraph', children: collectInline(element) })
    } else {
      blocks.push({ type: 'paragraph', children: collectInline(element) })
    }
  })
  return { ...document, blocks: blocks.length ? blocks : defaultDocument().blocks }
}

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character)

const textToHtml = (value: string): string => escapeHtml(value).replace(/\n/g, '<br />')
const inlineToHtml = (children: RichTextText[]): string => children.map((child) => {
  let content = textToHtml(child.text)
  if (child.marks?.includes('italic')) content = `<em>${content}</em>`
  if (child.marks?.includes('bold')) content = `<strong>${content}</strong>`
  return content
}).join('') || '<br />'

const documentToEditorHtml = (document: RichTextDocument): string => document.blocks.map((block) => {
  if (block.type === 'bullet_list' || block.type === 'numbered_list') {
    const tag = block.type === 'bullet_list' ? 'ul' : 'ol'
    return `<${tag}>${block.items.map((item) => `<li>${inlineToHtml(item.children)}</li>`).join('')}</${tag}>`
  }
  if (block.type === 'quote') return `<blockquote>${inlineToHtml(block.children)}</blockquote>`
  return `<p>${inlineToHtml(block.children)}</p>`
}).join('')

const renderInline = (children: RichTextText[]): ReactNode[] => children.map((child, index) => {
  let content: ReactNode = child.text.replace(/\n/g, '\n')
  if (child.marks?.includes('italic')) content = <em>{content}</em>
  if (child.marks?.includes('bold')) content = <strong>{content}</strong>
  return <span key={`${child.text}-${index}`}>{content}</span>
})

export function RichTextRenderer({ value, className = '' }: { value: string | null | undefined; className?: string }) {
  const document = parseRichText(value)
  const lineHeight = document.lineSpacing === 'compact' ? 1.45 : document.lineSpacing === 'airy' ? 2 : 1.7
  const style = { '--rich-line-height': lineHeight, '--rich-paragraph-gap': document.paragraphSpacing === 'small' ? '0.45rem' : document.paragraphSpacing === 'large' ? '1.35rem' : '0.85rem', lineHeight } as CSSProperties
  return <div className={`rich-text-renderer ${className}`.trim()} style={style}>{document.blocks.map((block, index) => {
    if (block.type === 'bullet_list') return <ul key={`bullet-${index}`}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item.children)}</li>)}</ul>
    if (block.type === 'numbered_list') return <ol key={`numbered-${index}`}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item.children)}</li>)}</ol>
    if (block.type === 'quote') return <blockquote key={`quote-${index}`}>{renderInline(block.children)}</blockquote>
    return <p key={`paragraph-${index}`}>{renderInline(block.children)}</p>
  })}</div>
}

type RichTextCommand = 'bold' | 'italic' | 'insertUnorderedList' | 'insertOrderedList' | 'quote'

const toolbarButton = (label: string, ariaLabel: string, onMouseDown: (event: React.MouseEvent<HTMLButtonElement>) => void, active = false) => <button className={active ? 'is-active' : undefined} type="button" title={ariaLabel} aria-label={ariaLabel} onMouseDown={onMouseDown}>{label}</button>

export function RichTextEditor({ value, onChange, placeholder, ariaLabel, className = '', minHeight, maxLength }: { value: string; onChange: (value: string) => void; placeholder: string; ariaLabel: string; className?: string; minHeight?: number; maxLength?: number }) {
  const editorRef = useRef<HTMLDivElement>(null)
  const syncFrameRef = useRef<number | null>(null)
  const modelRef = useRef<RichTextDocument | null>(null)
  const onChangeRef = useRef(onChange)
  const maxLengthRef = useRef(maxLength)
  const [isFocused, setIsFocused] = useState(false)
  const [showSpacing, setShowSpacing] = useState(false)
  const model = parseRichText(value)
  const isEmpty = !documentToPlainText(model).trim()
  const active = isFocused || showSpacing
  const editorStyle = { '--rich-line-height': model.lineSpacing === 'compact' ? 1.45 : model.lineSpacing === 'airy' ? 2 : 1.7, '--rich-paragraph-gap': model.paragraphSpacing === 'small' ? '.45rem' : model.paragraphSpacing === 'large' ? '1.35rem' : '.85rem' } as CSSProperties

  useEffect(() => {
    modelRef.current = model
    onChangeRef.current = onChange
    maxLengthRef.current = maxLength
  }, [maxLength, model, onChange])

  useEffect(() => {
    if (!editorRef.current || isFocused) return
    editorRef.current.innerHTML = documentToEditorHtml(parseRichText(value))
  }, [isFocused, value])

  useEffect(() => () => {
    if (syncFrameRef.current !== null) window.cancelAnimationFrame(syncFrameRef.current)
  }, [])

  const syncFromDom = () => {
    if (!editorRef.current) return
    const nextDocument = serializeEditorDom(editorRef.current, modelRef.current ?? model)
    const limitedDocument = maxLengthRef.current === undefined ? nextDocument : truncateDocument(nextDocument, maxLengthRef.current)
    const nextValue = serializeRichText(limitedDocument)
    if (nextValue !== serializeRichText(nextDocument)) editorRef.current.innerHTML = documentToEditorHtml(limitedDocument)
    onChangeRef.current(nextValue)
  }

  const scheduleSyncFromDom = () => {
    if (syncFrameRef.current !== null) return
    syncFrameRef.current = window.requestAnimationFrame(() => {
      syncFrameRef.current = null
      syncFromDom()
    })
  }

  const flushScheduledSync = () => {
    if (syncFrameRef.current !== null) {
      window.cancelAnimationFrame(syncFrameRef.current)
      syncFrameRef.current = null
    }
    syncFromDom()
  }

  const runCommand = (command: RichTextCommand) => {
    editorRef.current?.focus()
    if (command === 'quote') window.document.execCommand('formatBlock', false, 'blockquote')
    else window.document.execCommand(command, false)
    syncFromDom()
  }

  const undo = (event: React.MouseEvent<HTMLButtonElement>) => {
    preventToolbarBlur(event)
    editorRef.current?.focus()
    window.document.execCommand('undo', false)
    syncFromDom()
  }

  const redo = (event: React.MouseEvent<HTMLButtonElement>) => {
    preventToolbarBlur(event)
    editorRef.current?.focus()
    window.document.execCommand('redo', false)
    syncFromDom()
  }

  const updateSpacing = (key: 'lineSpacing' | 'paragraphSpacing', nextValue: string) => {
    const nextDocument = { ...model, [key]: nextValue } as RichTextDocument
    onChange(serializeRichText(nextDocument))
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const modifier = event.metaKey || event.ctrlKey
    if (!modifier) return
    if (event.key.toLowerCase() === 'b' || event.key.toLowerCase() === 'i') {
      event.preventDefault()
      runCommand(event.key.toLowerCase() === 'b' ? 'bold' : 'italic')
    } else if (event.key.toLowerCase() === 'z') {
      event.preventDefault()
      if (event.shiftKey) window.document.execCommand('redo', false)
      else window.document.execCommand('undo', false)
      syncFromDom()
    }
  }

  const preventToolbarBlur = (event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault()
  const commandMouseDown = (command: RichTextCommand) => (event: React.MouseEvent<HTMLButtonElement>) => {
    preventToolbarBlur(event)
    runCommand(command)
  }

  return <div className={`rich-text-editor ${active ? 'is-active' : ''} ${className}`.trim()} style={editorStyle}>
    <div className="rich-text-toolbar" role="toolbar" aria-label="Định dạng văn bản">
      {toolbarButton('B', 'Đậm', commandMouseDown('bold'))}
      {toolbarButton('I', 'Nghiêng', commandMouseDown('italic'))}
      {toolbarButton('• List', 'Danh sách bullet', commandMouseDown('insertUnorderedList'))}
      {toolbarButton('1. List', 'Danh sách đánh số', commandMouseDown('insertOrderedList'))}
      {toolbarButton('Quote', 'Trích dẫn', commandMouseDown('quote'))}
      <button className={`rich-text-spacing-trigger ${showSpacing ? 'is-active' : ''}`} type="button" title="Khoảng cách" aria-label="Khoảng cách" aria-expanded={showSpacing} onMouseDown={(event) => { preventToolbarBlur(event); setShowSpacing((current) => !current) }}>Spacing</button>
      {toolbarButton('↶', 'Hoàn tác', undo)}
      {toolbarButton('↷', 'Làm lại', redo)}
    </div>
    {showSpacing && <div className="rich-text-spacing-popover" role="dialog" aria-label="Thiết lập khoảng cách"><label><span>Line spacing</span><select value={model.lineSpacing} onChange={(event) => updateSpacing('lineSpacing', event.target.value)}><option value="compact">Compact</option><option value="normal">Normal</option><option value="airy">Airy</option></select></label><label><span>Paragraph spacing</span><select value={model.paragraphSpacing} onChange={(event) => updateSpacing('paragraphSpacing', event.target.value)}><option value="small">Small</option><option value="normal">Normal</option><option value="large">Large</option></select></label></div>}
    <div ref={editorRef} className="rich-text-content" contentEditable role="textbox" aria-multiline="true" aria-label={ariaLabel} data-placeholder={placeholder} data-empty={isEmpty} style={minHeight ? { minHeight } : undefined} suppressContentEditableWarning onFocus={() => setIsFocused(true)} onBlur={(event) => { flushScheduledSync(); if (event.relatedTarget instanceof Node && event.currentTarget.parentElement?.contains(event.relatedTarget)) return; setIsFocused(false); setShowSpacing(false) }} onInput={scheduleSyncFromDom} onKeyDown={handleKeyDown} />
  </div>
}
