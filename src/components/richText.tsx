import { useEffect, useRef, useState, type CSSProperties, type ClipboardEvent, type MouseEvent, type ReactNode } from 'react'
import './richText.css'

export const RICH_TEXT_PREFIX = 'sacky-richtext:v1:'

export type RichTextLineSpacing = 'compact' | 'normal' | 'airy'
export type RichTextParagraphSpacing = 'small' | 'normal' | 'large'
export type RichTextMark = 'bold' | 'italic' | 'underline' | 'strike'
export type RichTextColor = 'default' | 'violet' | 'mauve' | 'mango' | 'green' | 'coral' | 'blue' | 'teal' | 'rose' | 'indigo' | 'slate'
export type RichTextFontSize = 'small' | 'normal' | 'large' | 'xl'

export type RichTextText = {
  text: string
  marks?: RichTextMark[]
  color?: RichTextColor
  fontSize?: RichTextFontSize
}

export type RichTextListItem = {
  children: RichTextText[]
  indent?: number
}

type RichTextTextBlockType = 'paragraph' | 'heading_1' | 'heading_2' | 'heading_3' | 'heading_4' | 'quote'

export type RichTextBlock =
  | { type: RichTextTextBlockType; children: RichTextText[]; indent?: number }
  | { type: 'bullet_list'; items: RichTextListItem[]; indent?: number }
  | { type: 'numbered_list'; items: RichTextListItem[]; indent?: number }
  | { type: 'divider' }

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

const COLOR_VALUES: Record<RichTextColor, string> = {
  default: '#242040',
  violet: '#743cff',
  mauve: '#a84d9f',
  mango: '#bd7600',
  green: '#16815f',
  coral: '#d1545b',
  blue: '#2f6fcb',
  teal: '#008f8c',
  rose: '#c43d6a',
  indigo: '#5548c8',
  slate: '#5e6476',
}

const FONT_SIZE_VALUES: Record<RichTextFontSize, string> = {
  small: '.88em',
  normal: '1em',
  large: '1.18em',
  xl: '1.42em',
}

const isMark = (value: unknown): value is RichTextMark => value === 'bold' || value === 'italic' || value === 'underline' || value === 'strike'
const isLineSpacing = (value: unknown): value is RichTextLineSpacing => value === 'compact' || value === 'normal' || value === 'airy'
const isParagraphSpacing = (value: unknown): value is RichTextParagraphSpacing => value === 'small' || value === 'normal' || value === 'large'
const isColor = (value: unknown): value is RichTextColor => value === 'default' || value === 'violet' || value === 'mauve' || value === 'mango' || value === 'green' || value === 'coral' || value === 'blue' || value === 'teal' || value === 'rose' || value === 'indigo' || value === 'slate'
const isFontSize = (value: unknown): value is RichTextFontSize => value === 'small' || value === 'normal' || value === 'large' || value === 'xl'
const clampIndent = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  const indent = Math.min(3, Math.max(0, Math.round(value)))
  return indent > 0 ? indent : undefined
}

const sanitizeText = (value: unknown): RichTextText => {
  if (!value || typeof value !== 'object') return { text: '' }
  const item = value as { text?: unknown; marks?: unknown; color?: unknown; fontSize?: unknown }
  const color = isColor(item.color) && item.color !== 'default' ? item.color : undefined
  const fontSize = isFontSize(item.fontSize) && item.fontSize !== 'normal' ? item.fontSize : undefined
  return {
    text: typeof item.text === 'string' ? item.text : '',
    ...(Array.isArray(item.marks) ? { marks: item.marks.filter(isMark) } : {}),
    ...(color ? { color } : {}),
    ...(fontSize ? { fontSize } : {}),
  }
}

const parseInlineChildren = (value: unknown): RichTextText[] => {
  if (!Array.isArray(value)) return []
  return value.map(sanitizeText).filter((item) => item.text.length > 0 || Boolean(item.marks?.length) || Boolean(item.color) || Boolean(item.fontSize))
}

const parseIndent = (value: unknown): number | undefined => clampIndent(value)

const parseBlock = (value: unknown): RichTextBlock | null => {
  if (!value || typeof value !== 'object') return null
  const block = value as { type?: unknown; children?: unknown; items?: unknown; indent?: unknown }
  if (block.type === 'divider') return { type: 'divider' }
  if (block.type === 'paragraph' || block.type === 'heading_1' || block.type === 'heading_2' || block.type === 'heading_3' || block.type === 'heading_4' || block.type === 'quote') {
    const indent = parseIndent(block.indent)
    return { type: block.type, children: parseInlineChildren(block.children), ...(indent ? { indent } : {}) }
  }
  if (block.type === 'bullet_list' || block.type === 'numbered_list') {
    const indent = parseIndent(block.indent)
    const items = Array.isArray(block.items)
      ? block.items.map((item) => {
        if (!item || typeof item !== 'object') return { children: [] }
        const listItem = item as { children?: unknown; indent?: unknown }
        const itemIndent = parseIndent(listItem.indent)
        return { children: parseInlineChildren(listItem.children), ...(itemIndent ? { indent: itemIndent } : {}) }
      })
      : []
    return { type: block.type, items, ...(indent ? { indent } : {}) }
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
  if (block.type === 'divider') return ''
  if (block.type === 'bullet_list' || block.type === 'numbered_list') return block.items.map((item) => inlineText(item.children)).join('\n')
  return inlineText(block.children)
}).join('\n')

const isListBlock = (block: RichTextBlock): block is Extract<RichTextBlock, { type: 'bullet_list' | 'numbered_list' }> => block.type === 'bullet_list' || block.type === 'numbered_list'
const normalizedPlainText = (document: RichTextDocument): string => documentToPlainText(document).replace(/\s+/gu, '')

export const stabilizeListStructure = (previous: RichTextDocument, next: RichTextDocument): RichTextDocument => {
  const previousHasList = previous.blocks.some(isListBlock)
  const nextHasList = next.blocks.some(isListBlock)
  if (!previousHasList || nextHasList || normalizedPlainText(previous) !== normalizedPlainText(next)) return next
  return { ...next, blocks: previous.blocks }
}

export const richTextToPlainText = (value: string | null | undefined): string => documentToPlainText(parseRichText(value))

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
      if (block.type === 'divider') return block
      if (block.type === 'bullet_list' || block.type === 'numbered_list') return { ...block, items: block.items.map((item) => ({ ...item, children: truncateChildren(item.children) })) }
      return { ...block, children: truncateChildren(block.children) }
    }),
  }
}

type InlineStyle = Pick<RichTextText, 'marks' | 'color' | 'fontSize'>

const sameInlineStyle = (left: InlineStyle | undefined, right: InlineStyle): boolean => JSON.stringify({ marks: left?.marks ?? [], color: left?.color, fontSize: left?.fontSize }) === JSON.stringify({ marks: right.marks ?? [], color: right.color, fontSize: right.fontSize })

const pushInlineText = (target: RichTextText[], text: string, style: InlineStyle): void => {
  if (!text) return
  const previous = target[target.length - 1]
  if (previous && sameInlineStyle(previous, style)) previous.text += text
  else target.push({ text, ...(style.marks?.length ? { marks: style.marks } : {}), ...(style.color ? { color: style.color } : {}), ...(style.fontSize ? { fontSize: style.fontSize } : {}) })
}

const colorFromValue = (value: string | null | undefined): RichTextColor | undefined => {
  if (!value) return undefined
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '')
  const aliases: Record<string, RichTextColor> = {
    '#743cff': 'violet',
    'rgb(116,60,255)': 'violet',
    '#a84d9f': 'mauve',
    'rgb(168,77,159)': 'mauve',
    '#bd7600': 'mango',
    'rgb(189,118,0)': 'mango',
    '#16815f': 'green',
    'rgb(22,129,95)': 'green',
    '#d1545b': 'coral',
    'rgb(209,84,91)': 'coral',
    '#2f6fcb': 'blue',
    'rgb(47,111,203)': 'blue',
    '#008f8c': 'teal',
    'rgb(0,143,140)': 'teal',
    '#c43d6a': 'rose',
    'rgb(196,61,106)': 'rose',
    '#5548c8': 'indigo',
    'rgb(85,72,200)': 'indigo',
    '#5e6476': 'slate',
    'rgb(94,100,118)': 'slate',
  }
  return aliases[normalized] ?? Object.entries(COLOR_VALUES).find(([, color]) => color === normalized)?.[0] as RichTextColor | undefined
}

const fontSizeFromValue = (value: string | null | undefined): RichTextFontSize | undefined => {
  if (!value) return undefined
  const normalized = value.trim().toLowerCase()
  if (normalized === '2' || normalized === '12px') return 'small'
  if (normalized === '3' || normalized === '16px') return 'normal'
  if (normalized === '5' || normalized === '20px') return 'large'
  if (normalized === '7' || normalized === '26px') return 'xl'
  return undefined
}

const indentFromElement = (element: HTMLElement): number | undefined => element.dataset.richIndent ? clampIndent(Number(element.dataset.richIndent)) : undefined

const collectInline = (node: Node, inherited: InlineStyle = {}): RichTextText[] => {
  const children: RichTextText[] = []
  if (node.nodeType === Node.TEXT_NODE) {
    pushInlineText(children, node.textContent ?? '', inherited)
    return children
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return children
  const element = node as HTMLElement
  const marks = [...(inherited.marks ?? [])]
  if (element.tagName === 'STRONG' || element.tagName === 'B') {
    if (!marks.includes('bold')) marks.push('bold')
  }
  if (element.tagName === 'EM' || element.tagName === 'I') {
    if (!marks.includes('italic')) marks.push('italic')
  }
  if (element.tagName === 'U') {
    if (!marks.includes('underline')) marks.push('underline')
  }
  if (element.tagName === 'S' || element.tagName === 'STRIKE' || element.tagName === 'DEL') {
    if (!marks.includes('strike')) marks.push('strike')
  }
  const decoration = element.style.textDecorationLine || element.style.textDecoration
  if (decoration.includes('underline') && !marks.includes('underline')) marks.push('underline')
  if (decoration.includes('line-through') && !marks.includes('strike')) marks.push('strike')
  const color = colorFromValue(element.dataset.richColor) ?? colorFromValue(element.getAttribute('color')) ?? colorFromValue(element.style.color) ?? inherited.color
  const fontSize = isFontSize(element.dataset.richFontSize) && element.dataset.richFontSize !== 'normal'
    ? element.dataset.richFontSize
    : fontSizeFromValue(element.getAttribute('size')) ?? fontSizeFromValue(element.style.fontSize) ?? inherited.fontSize
  const style = { marks, ...(color && color !== 'default' ? { color } : {}), ...(fontSize && fontSize !== 'normal' ? { fontSize } : {}) }
  if (element.tagName === 'BR') {
    pushInlineText(children, '\n', style)
    return children
  }
  element.childNodes.forEach((child) => collectInline(child, style).forEach((item) => pushInlineText(children, item.text, item)))
  return children
}

const isListElement = (node: Node): node is HTMLElement => node.nodeType === Node.ELEMENT_NODE && ['UL', 'OL'].includes((node as HTMLElement).tagName)

const collectListItem = (item: Element): RichTextListItem => {
  const indent = indentFromElement(item as HTMLElement)
  const children: RichTextText[] = []
  item.childNodes.forEach((node) => {
    if (isListElement(node)) return
    collectInline(node).forEach((child) => pushInlineText(children, child.text, child))
  })
  return { children, ...(indent ? { indent } : {}) }
}

const headingTypeFromTag = (tagName: string): RichTextTextBlockType | undefined => {
  if (tagName === 'H1') return 'heading_1'
  if (tagName === 'H2') return 'heading_2'
  if (tagName === 'H3') return 'heading_3'
  if (tagName === 'H4') return 'heading_4'
  return undefined
}

const blockTags = new Set(['BLOCKQUOTE', 'DIV', 'H1', 'H2', 'H3', 'H4', 'LI', 'OL', 'P', 'UL', 'HR'])
const isBlockElement = (node: Node): node is HTMLElement => node.nodeType === Node.ELEMENT_NODE && blockTags.has((node as HTMLElement).tagName)

const hasBlockChildren = (element: Element): boolean => Array.from(element.childNodes).some(isBlockElement)

const serializeEditorNodes = (nodes: ArrayLike<Node>): RichTextBlock[] => {
  const blocks: RichTextBlock[] = []
  Array.from(nodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const children = collectInline(node)
      if (children.some((child) => child.text.trim())) blocks.push({ type: 'paragraph', children })
      return
    }
    if (!isBlockElement(node)) return
    const element = node as HTMLElement
    const indent = indentFromElement(element)
    if (element.tagName === 'HR') {
      blocks.push({ type: 'divider' })
    } else if (element.tagName === 'UL' || element.tagName === 'OL') {
      const items = Array.from(element.children).filter((child) => child.tagName === 'LI').map(collectListItem)
      blocks.push({ type: element.tagName === 'UL' ? 'bullet_list' : 'numbered_list', items, ...(indent ? { indent } : {}) })
    } else if (element.tagName === 'BLOCKQUOTE') {
      blocks.push({ type: 'quote', children: collectInline(element), ...(indent ? { indent } : {}) })
    } else if (headingTypeFromTag(element.tagName) || element.tagName === 'P' || element.tagName === 'LI') {
      blocks.push({ type: headingTypeFromTag(element.tagName) ?? 'paragraph', children: collectInline(element), ...(indent ? { indent } : {}) })
    } else if (hasBlockChildren(element)) {
      blocks.push(...serializeEditorNodes(element.childNodes))
    } else {
      const children = collectInline(element)
      if (children.some((child) => child.text.trim())) blocks.push({ type: 'paragraph', children, ...(indent ? { indent } : {}) })
    }
  })
  return blocks
}

const serializeEditorDom = (root: HTMLElement, document: RichTextDocument): RichTextDocument => {
  const blocks = serializeEditorNodes(root.childNodes)
  return { ...document, blocks: blocks.length ? blocks : defaultDocument().blocks }
}

const editorListAncestor = (node: Node | null, root: HTMLElement): HTMLOListElement | HTMLUListElement | null => {
  let current = node?.nodeType === Node.ELEMENT_NODE ? node as HTMLElement : node?.parentElement ?? null
  while (current && current !== root) {
    if (current.tagName === 'UL' || current.tagName === 'OL') return current as HTMLOListElement | HTMLUListElement
    current = current.parentElement
  }
  return null
}

const setCaretAtEnd = (element: HTMLElement): void => {
  const selection = window.getSelection()
  if (!selection) return
  const range = window.document.createRange()
  range.selectNodeContents(element)
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
}

const listItemFromBlock = (block: HTMLElement): HTMLLIElement => {
  const item = window.document.createElement('li')
  const indent = indentFromElement(block)
  if (indent) item.dataset.richIndent = String(indent)
  while (block.firstChild) item.appendChild(block.firstChild)
  if (!item.childNodes.length) item.appendChild(window.document.createElement('br'))
  return item
}

const unwrapEditorList = (list: HTMLOListElement | HTMLUListElement): void => {
  const replacement = window.document.createDocumentFragment()
  const paragraphs: HTMLParagraphElement[] = []
  Array.from(list.children).filter((child) => child.tagName === 'LI').forEach((child) => {
    const paragraph = window.document.createElement('p')
    const indent = indentFromElement(child as HTMLElement)
    if (indent) paragraph.dataset.richIndent = String(indent)
    Array.from(child.childNodes).filter((node) => !isListElement(node)).forEach((node) => paragraph.appendChild(node))
    if (!paragraph.childNodes.length) paragraph.appendChild(window.document.createElement('br'))
    paragraphs.push(paragraph)
    replacement.appendChild(paragraph)
  })
  if (!paragraphs.length) {
    const paragraph = window.document.createElement('p')
    paragraph.appendChild(window.document.createElement('br'))
    paragraphs.push(paragraph)
    replacement.appendChild(paragraph)
  }
  list.replaceWith(replacement)
  setCaretAtEnd(paragraphs[paragraphs.length - 1])
}

const toggleEditorList = (root: HTMLElement, tagName: 'UL' | 'OL'): boolean => {
  const selection = window.getSelection()
  if (!selection?.rangeCount || !selection.anchorNode) return false
  const range = selection.getRangeAt(0)
  const list = editorListAncestor(selection.anchorNode, root)
  const focusList = editorListAncestor(selection.focusNode, root)

  if (list && list === focusList) {
    if (list.tagName === tagName) unwrapEditorList(list)
    else {
      const replacement = window.document.createElement(tagName.toLowerCase()) as HTMLOListElement | HTMLUListElement
      if (list.dataset.richIndent) replacement.dataset.richIndent = list.dataset.richIndent
      while (list.firstChild) replacement.appendChild(list.firstChild)
      list.replaceWith(replacement)
    }
    return true
  }

  const blocks = Array.from(root.children).filter((child) => {
    if (child.tagName === 'UL' || child.tagName === 'OL' || child.tagName === 'HR') return false
    try {
      return selection.isCollapsed ? child.contains(range.startContainer) : range.intersectsNode(child)
    } catch {
      return false
    }
  }) as HTMLElement[]
  if (!blocks.length) return false

  const listElement = window.document.createElement(tagName.toLowerCase()) as HTMLOListElement | HTMLUListElement
  blocks.forEach((block) => listElement.appendChild(listItemFromBlock(block)))
  blocks[0].before(listElement)
  blocks.forEach((block) => block.remove())
  setCaretAtEnd(listElement.lastElementChild as HTMLElement)
  return true
}

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character)
const textToHtml = (value: string): string => escapeHtml(value).replace(/\n/g, '<br />')

const inlineToHtml = (children: RichTextText[]): string => children.map((child) => {
  let content = textToHtml(child.text)
  if (child.marks?.includes('strike')) content = `<s>${content}</s>`
  if (child.marks?.includes('underline')) content = `<u>${content}</u>`
  if (child.marks?.includes('italic')) content = `<em>${content}</em>`
  if (child.marks?.includes('bold')) content = `<strong>${content}</strong>`
  if (child.fontSize) content = `<span data-rich-font-size="${child.fontSize}" style="font-size:${FONT_SIZE_VALUES[child.fontSize]}">${content}</span>`
  if (child.color) content = `<span data-rich-color="${child.color}" style="color:${COLOR_VALUES[child.color]}">${content}</span>`
  return content
}).join('') || '<br />'

const blockAttributes = (indent: number | undefined): string => indent ? ` data-rich-indent="${indent}"` : ''

const documentToEditorHtml = (document: RichTextDocument): string => document.blocks.map((block) => {
  if (block.type === 'divider') return '<hr />'
  if (block.type === 'bullet_list' || block.type === 'numbered_list') {
    const tag = block.type === 'bullet_list' ? 'ul' : 'ol'
    return `<${tag}${blockAttributes(block.indent)}>${block.items.map((item) => `<li${blockAttributes(item.indent)}>${inlineToHtml(item.children)}</li>`).join('')}</${tag}>`
  }
  if (block.type === 'quote') return `<blockquote${blockAttributes(block.indent)}>${inlineToHtml(block.children)}</blockquote>`
  if (block.type.startsWith('heading_')) return `<h${block.type.slice(-1)}${blockAttributes(block.indent)}>${inlineToHtml(block.children)}</h${block.type.slice(-1)}>`
  return `<p${blockAttributes(block.indent)}>${inlineToHtml(block.children)}</p>`
}).join('')

const renderInline = (children: RichTextText[]): ReactNode[] => children.map((child, index) => {
  let content: ReactNode = child.text.replace(/\n/g, '\n')
  if (child.marks?.includes('strike')) content = <s>{content}</s>
  if (child.marks?.includes('underline')) content = <u>{content}</u>
  if (child.marks?.includes('italic')) content = <em>{content}</em>
  if (child.marks?.includes('bold')) content = <strong>{content}</strong>
  const style: CSSProperties = { ...(child.color ? { color: COLOR_VALUES[child.color] } : {}), ...(child.fontSize ? { fontSize: FONT_SIZE_VALUES[child.fontSize] } : {}) }
  return <span key={`${child.text}-${index}`} style={style}>{content}</span>
})

const blockStyle = (indent: number | undefined): CSSProperties | undefined => indent ? { marginLeft: `${indent * 1.5}rem` } : undefined

export function RichTextRenderer({ value, className = '' }: { value: string | null | undefined; className?: string }) {
  const document = parseRichText(value)
  const lineHeight = document.lineSpacing === 'compact' ? 1.25 : document.lineSpacing === 'airy' ? 1.8 : 1.5
  const style = { '--rich-line-height': lineHeight, '--rich-paragraph-gap': document.paragraphSpacing === 'small' ? '0.45rem' : document.paragraphSpacing === 'large' ? '1.35rem' : '0.85rem', lineHeight } as CSSProperties
  return <div className={`rich-text-renderer ${className}`.trim()} style={style}>{document.blocks.map((block, index) => {
    if (block.type === 'divider') return <hr key={`divider-${index}`} />
    if (block.type === 'bullet_list') return <ul key={`bullet-${index}`} style={blockStyle(block.indent)}>{block.items.map((item, itemIndex) => <li key={itemIndex} style={blockStyle(item.indent)}>{renderInline(item.children)}</li>)}</ul>
    if (block.type === 'numbered_list') return <ol key={`numbered-${index}`} style={blockStyle(block.indent)}>{block.items.map((item, itemIndex) => <li key={itemIndex} style={blockStyle(item.indent)}>{renderInline(item.children)}</li>)}</ol>
    if (block.type === 'quote') return <blockquote key={`quote-${index}`} style={blockStyle(block.indent)}>{renderInline(block.children)}</blockquote>
    if (block.type.startsWith('heading_')) {
      const Heading = `h${block.type.slice(-1)}` as 'h1' | 'h2' | 'h3' | 'h4'
      return <Heading key={`${block.type}-${index}`} style={blockStyle(block.indent)}>{renderInline(block.children)}</Heading>
    }
    return <p key={`paragraph-${index}`} style={blockStyle(block.indent)}>{renderInline(block.children)}</p>
  })}</div>
}

type RichTextCommand = 'bold' | 'italic' | 'underline' | 'strikeThrough' | 'insertUnorderedList' | 'insertOrderedList' | 'quote' | 'heading_1' | 'heading_2' | 'heading_3' | 'heading_4' | 'divider' | 'indent' | 'outdent'
type RichTextPopoverKind = 'colors' | 'fontSizes' | 'emoji' | 'spacing'

type RichTextPopoverPosition = {
  left: number
  top: number
}

type SlashCommand = {
  key: string
  label: string
  description: string
  aliases: string[]
  command: RichTextCommand | 'emoji'
}

const SLASH_COMMANDS: SlashCommand[] = [
  { key: '/h1', label: 'Tiêu đề 1', description: 'Heading lớn', aliases: ['head', 'heading', 'title'], command: 'heading_1' },
  { key: '/h2', label: 'Tiêu đề 2', description: 'Heading vừa', aliases: ['head', 'heading'], command: 'heading_2' },
  { key: '/h3', label: 'Tiêu đề 3', description: 'Heading nhỏ', aliases: ['head', 'heading'], command: 'heading_3' },
  { key: '/h4', label: 'Tiêu đề 4', description: 'Heading phụ', aliases: ['head', 'heading'], command: 'heading_4' },
  { key: '/bullet', label: 'Danh sách bullet', description: 'Danh sách chấm', aliases: ['bul', 'list'], command: 'insertUnorderedList' },
  { key: '/number', label: 'Danh sách số', description: 'Danh sách đánh số', aliases: ['num', 'list'], command: 'insertOrderedList' },
  { key: '/quote', label: 'Trích dẫn', description: 'Một đoạn trích dẫn', aliases: ['quot'], command: 'quote' },
  { key: '/divider', label: 'Đường phân cách', description: 'Ngăn cách nội dung', aliases: ['line', 'rule'], command: 'divider' },
  { key: '/emoji', label: 'Emoji', description: 'Chọn emoji nhanh', aliases: ['emo', 'icon'], command: 'emoji' },
  { key: '/indent', label: 'Thụt vào', description: 'Tăng cấp thụt lề', aliases: ['in'], command: 'indent' },
  { key: '/outdent', label: 'Thụt ra', description: 'Giảm cấp thụt lề', aliases: ['out'], command: 'outdent' },
]

const EMOJI_OPTIONS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '☺️', '😚', '😙', '🥲',
  '😋', '😛', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤗', '🤭', '🫢', '🫣', '🤫', '🤔', '🫡', '🤐', '😐', '😑', '😶', '🫥',
  '😏', '😒', '🙄', '😬', '😮‍💨', '🤥', '😌', '😔', '😪', '🤤', '😴', '🫩', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵',
  '🤯', '🤠', '🥳', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '😳', '🥱', '😱', '😨', '😰', '😥', '😓', '🫠', '🫨', '😶‍🌫️',
  '🤍', '🩷', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤎', '🩶', '🩵', '💔', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘',
  '💝', '💟', '✨', '💫', '⭐', '🌟', '🔥', '💥', '🌈', '☀️', '🌤️', '🌙', '🌿', '🌱', '🌲', '🌳', '🪴', '🍀', '🌻', '🌷', '🌹', '🌼',
  '🕯️', '☁️', '🌊', '🫧', '🪞', '🧸', '🫶', '🤝', '👏', '🙌', '👐', '🤲', '🤞', '✌️', '🤟', '🤘', '👌', '🤌', '🤏', '👋', '💪', '🙏',
  '✍️', '🫂', '👀', '🧠', '🫀', '💡', '📖', '📝', '☕', '🍵', '🎧', '🎵', '🎶', '🎨', '🎈', '🎁', '🧩', '🌌', '🪐', '🪽', '🦋', '🐣',
]
const FONT_SIZE_COMMANDS: Array<{ value: RichTextFontSize; label: string }> = [{ value: 'small', label: 'Small' }, { value: 'normal', label: 'Normal' }, { value: 'large', label: 'Large' }, { value: 'xl', label: 'XL' }]
const COLOR_COMMANDS: Array<{ value: RichTextColor; label: string }> = [
  { value: 'violet', label: 'Tím' }, { value: 'mauve', label: 'Mauve' }, { value: 'mango', label: 'Mango' }, { value: 'green', label: 'Xanh lá' }, { value: 'coral', label: 'Coral' },
  { value: 'blue', label: 'Xanh dương' }, { value: 'teal', label: 'Xanh ngọc' }, { value: 'rose', label: 'Hồng đậm' }, { value: 'indigo', label: 'Chàm' }, { value: 'slate', label: 'Xám xanh' },
]

const toolbarButton = (label: string, ariaLabel: string, onMouseDown: (event: MouseEvent<HTMLButtonElement>) => void, active = false) => <button className={active ? 'is-active' : undefined} type="button" title={ariaLabel} aria-label={ariaLabel} onMouseDown={onMouseDown}>{label}</button>
const preventToolbarBlur = (event: MouseEvent<HTMLButtonElement>) => event.preventDefault()
const headingTag = (command: RichTextCommand): string | undefined => command.startsWith('heading_') ? `h${command.slice(-1)}` : undefined
const RICH_TEXT_POPOVER_METRICS: Record<RichTextPopoverKind, { width: number; height: number }> = {
  colors: { width: 420, height: 130 },
  fontSizes: { width: 180, height: 80 },
  emoji: { width: 416, height: 380 },
  spacing: { width: 272, height: 150 },
}

const getRichTextPopoverPosition = (anchor: HTMLElement, kind: RichTextPopoverKind): RichTextPopoverPosition => {
  const margin = 8
  const metrics = RICH_TEXT_POPOVER_METRICS[kind]
  const width = Math.min(metrics.width, Math.max(160, window.innerWidth - margin * 2))
  const height = Math.min(metrics.height, Math.max(80, window.innerHeight - margin * 2))
  const rect = anchor.getBoundingClientRect()
  const maxLeft = Math.max(margin, window.innerWidth - width - margin)
  const left = Math.min(Math.max(margin, rect.left), maxLeft)
  const below = rect.bottom + margin
  const top = below + height <= window.innerHeight - margin
    ? below
    : Math.max(margin, rect.top - height - margin)
  return { left, top }
}

export function RichTextEditor({ value, onChange, placeholder, ariaLabel, className = '', minHeight, maxLength, autoFocus = false, focusMode = false }: { value: string; onChange: (value: string) => void; placeholder: string; ariaLabel: string; className?: string; minHeight?: number; maxLength?: number; autoFocus?: boolean; focusMode?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const modelRef = useRef<RichTextDocument | null>(null)
  const onChangeRef = useRef(onChange)
  const maxLengthRef = useRef(maxLength)
  const slashRangeRef = useRef<Range | null>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [showSpacing, setShowSpacing] = useState(false)
  const [showColors, setShowColors] = useState(false)
  const [showFontSizes, setShowFontSizes] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [slashMenu, setSlashMenu] = useState<{ query: string; left: number; top: number } | null>(null)
  const [slashIndex, setSlashIndex] = useState(0)
  const popoverAnchorRef = useRef<HTMLElement | null>(null)
  const [popoverPosition, setPopoverPosition] = useState<RichTextPopoverPosition | null>(null)
  const model = parseRichText(value)
  const isEmpty = !documentToPlainText(model).trim()
  const active = isFocused || showSpacing || showColors || showFontSizes || showEmoji || Boolean(slashMenu)
  const activePopover: RichTextPopoverKind | null = showColors ? 'colors' : showFontSizes ? 'fontSizes' : showEmoji ? 'emoji' : showSpacing ? 'spacing' : null
  const editorStyle = { '--rich-line-height': model.lineSpacing === 'compact' ? 1.25 : model.lineSpacing === 'airy' ? 1.8 : 1.5, '--rich-paragraph-gap': model.paragraphSpacing === 'small' ? '.45rem' : model.paragraphSpacing === 'large' ? '1.35rem' : '.85rem' } as CSSProperties

  useEffect(() => {
    modelRef.current = model
    onChangeRef.current = onChange
    maxLengthRef.current = maxLength
  }, [maxLength, model, onChange])

  useEffect(() => {
    if (!editorRef.current || isFocused) return
    editorRef.current.innerHTML = documentToEditorHtml(parseRichText(value))
  }, [isFocused, value])

  useEffect(() => {
    if (!autoFocus) return
    const timer = window.setTimeout(() => editorRef.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [autoFocus])

  useEffect(() => {
    const closeMenus = (event: PointerEvent) => {
      if (containerRef.current && event.target instanceof Node && !containerRef.current.contains(event.target)) {
        setSlashMenu(null)
        slashRangeRef.current = null
        setShowColors(false)
        setShowFontSizes(false)
        setShowEmoji(false)
        setShowSpacing(false)
        popoverAnchorRef.current = null
        setPopoverPosition(null)
      }
    }
    window.document.addEventListener('pointerdown', closeMenus)
    return () => window.document.removeEventListener('pointerdown', closeMenus)
  }, [])

  useEffect(() => {
    if (!activePopover || !popoverAnchorRef.current) return
    const reposition = () => {
      if (popoverAnchorRef.current) setPopoverPosition(getRichTextPopoverPosition(popoverAnchorRef.current, activePopover))
    }
    reposition()
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [activePopover])

  const syncFromDom = (options: { preserveExistingLists?: boolean } = {}) => {
    if (!editorRef.current) return
    const currentDocument = modelRef.current ?? model
    const serializedDocument = serializeEditorDom(editorRef.current, currentDocument)
    const nextDocument = options.preserveExistingLists === false ? serializedDocument : stabilizeListStructure(currentDocument, serializedDocument)
    const limitedDocument = maxLengthRef.current === undefined ? nextDocument : truncateDocument(nextDocument, maxLengthRef.current)
    const nextValue = serializeRichText(limitedDocument)
    if (nextValue !== serializeRichText(nextDocument) || nextDocument !== serializedDocument) editorRef.current.innerHTML = documentToEditorHtml(limitedDocument)
    onChangeRef.current(nextValue)
  }

  const closeSlashMenu = () => {
    setSlashMenu(null)
    slashRangeRef.current = null
    setSlashIndex(0)
  }

  const syncSlashMenu = () => {
    const root = editorRef.current
    const selection = window.getSelection()
    if (!root || !selection || !selection.isCollapsed || !selection.anchorNode || !root.contains(selection.anchorNode) || selection.anchorNode.nodeType !== Node.TEXT_NODE) {
      closeSlashMenu()
      return
    }
    const text = selection.anchorNode.textContent?.slice(0, selection.anchorOffset) ?? ''
    const match = text.match(/(?:^|\s)\/([a-z0-9-]*)$/i)
    if (!match) {
      closeSlashMenu()
      return
    }
    const slashStart = selection.anchorOffset - match[0].length + (match[0].startsWith(' ') ? 1 : 0)
    const range = window.document.createRange()
    range.setStart(selection.anchorNode, slashStart)
    range.setEnd(selection.anchorNode, selection.anchorOffset)
    slashRangeRef.current = range.cloneRange()
    const rect = range.getBoundingClientRect()
    const rootRect = root.getBoundingClientRect()
    setSlashMenu({ query: match[1], left: Math.max(8, rect.left - rootRect.left), top: Math.max(8, rect.bottom - rootRect.top + 8) })
    setSlashIndex(0)
  }

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault()
    const clipboardHtml = event.clipboardData.getData('text/html')
    const clipboardText = event.clipboardData.getData('text/plain')
    const fragment = window.document.createElement('div')
    fragment.innerHTML = clipboardHtml || `<p>${escapeHtml(clipboardText).replace(/\n/g, '<br />')}</p>`
    const sanitized = serializeEditorDom(fragment, modelRef.current ?? model)
    window.document.execCommand('insertHTML', false, documentToEditorHtml(sanitized))
    syncFromDom()
    syncSlashMenu()
  }

  const applyIndent = (direction: 1 | -1) => {
    const root = editorRef.current
    const selection = window.getSelection()
    if (!root || !selection?.rangeCount || !selection.anchorNode) return
    const range = selection.getRangeAt(0)
    const blockSelector = 'p,h1,h2,h3,h4,blockquote,li,div'
    const blocks = Array.from(root.querySelectorAll<HTMLElement>(blockSelector)).filter((element) => {
      try {
        return selection.isCollapsed ? element.contains(range.startContainer) : range.intersectsNode(element)
      } catch {
        return false
      }
    })
    let fallback: HTMLElement | null = selection.anchorNode.nodeType === Node.ELEMENT_NODE ? selection.anchorNode as HTMLElement : selection.anchorNode.parentElement
    while (fallback && fallback !== root && !blockSelector.split(',').includes(fallback.tagName.toLowerCase())) fallback = fallback.parentElement
    const targets = blocks.length ? blocks.filter((element) => !blocks.some((other) => other !== element && other.contains(element))) : fallback && fallback !== root ? [fallback] : []
    targets.forEach((element) => {
      const current = clampIndent(Number(element.dataset.richIndent)) ?? 0
      const next = Math.min(3, Math.max(0, current + direction))
      if (next) element.dataset.richIndent = String(next)
      else delete element.dataset.richIndent
    })
    syncFromDom()
  }

  const runCommand = (command: RichTextCommand) => {
    if (command === 'indent' || command === 'outdent') {
      applyIndent(command === 'indent' ? 1 : -1)
      return
    }
    editorRef.current?.focus()
    if ((command === 'insertUnorderedList' || command === 'insertOrderedList') && editorRef.current) {
      const handled = toggleEditorList(editorRef.current, command === 'insertUnorderedList' ? 'UL' : 'OL')
      if (handled) {
        syncFromDom({ preserveExistingLists: false })
        return
      }
    }
    const tag = headingTag(command)
    if (tag) window.document.execCommand('formatBlock', false, tag)
    else if (command === 'quote') window.document.execCommand('formatBlock', false, 'blockquote')
    else if (command === 'divider') window.document.execCommand('insertHorizontalRule', false)
    else window.document.execCommand(command, false)
    syncFromDom({ preserveExistingLists: command !== 'insertUnorderedList' && command !== 'insertOrderedList' })
  }

  const applyColor = (color: RichTextColor) => {
    editorRef.current?.focus()
    window.document.execCommand('foreColor', false, COLOR_VALUES[color])
    syncFromDom()
    setShowColors(false)
    popoverAnchorRef.current = null
    setPopoverPosition(null)
  }

  const applyFontSize = (fontSize: RichTextFontSize) => {
    editorRef.current?.focus()
    const commandValue = fontSize === 'small' ? '2' : fontSize === 'large' ? '5' : fontSize === 'xl' ? '7' : '3'
    window.document.execCommand('fontSize', false, commandValue)
    syncFromDom()
    setShowFontSizes(false)
    popoverAnchorRef.current = null
    setPopoverPosition(null)
  }

  const insertEmoji = (emoji: string) => {
    editorRef.current?.focus()
    window.document.execCommand('insertText', false, emoji)
    syncFromDom()
    setShowEmoji(false)
    popoverAnchorRef.current = null
    setPopoverPosition(null)
    closeSlashMenu()
  }

  const applySlashCommand = (command: SlashCommand) => {
    const range = slashRangeRef.current
    if (!range || !editorRef.current) return
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    window.document.execCommand('delete', false)
    closeSlashMenu()
    if (command.command === 'emoji') {
      editorRef.current.focus()
      setShowColors(false)
      setShowFontSizes(false)
      setShowSpacing(false)
      popoverAnchorRef.current = null
      setPopoverPosition(null)
      setShowEmoji(true)
      return
    }
    runCommand(command.command)
  }

  const undo = (event: MouseEvent<HTMLButtonElement>) => {
    preventToolbarBlur(event)
    editorRef.current?.focus()
    window.document.execCommand('undo', false)
    syncFromDom()
  }

  const redo = (event: MouseEvent<HTMLButtonElement>) => {
    preventToolbarBlur(event)
    editorRef.current?.focus()
    window.document.execCommand('redo', false)
    syncFromDom()
  }

  const updateSpacing = (key: 'lineSpacing' | 'paragraphSpacing', nextValue: RichTextLineSpacing | RichTextParagraphSpacing) => {
    const nextDocument = { ...model, [key]: nextValue } as RichTextDocument
    onChange(serializeRichText(nextDocument))
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (slashMenu) {
      const filteredCommands = SLASH_COMMANDS.filter((command) => `${command.key} ${command.label} ${command.description} ${command.aliases.join(' ')}`.toLowerCase().includes(slashMenu.query.toLowerCase()))
      if (event.key === 'ArrowDown') { event.preventDefault(); setSlashIndex((current) => Math.min(current + 1, Math.max(0, filteredCommands.length - 1))); return }
      if (event.key === 'ArrowUp') { event.preventDefault(); setSlashIndex((current) => Math.max(0, current - 1)); return }
      if (event.key === 'Escape') { event.preventDefault(); closeSlashMenu(); return }
      if (event.key === 'Enter' && filteredCommands[slashIndex]) { event.preventDefault(); applySlashCommand(filteredCommands[slashIndex]); return }
    }
    const modifier = event.metaKey || event.ctrlKey
    if (!modifier) return
    if (event.key.toLowerCase() === 'b' || event.key.toLowerCase() === 'i' || event.key.toLowerCase() === 'u') {
      event.preventDefault()
      runCommand(event.key.toLowerCase() === 'b' ? 'bold' : event.key.toLowerCase() === 'i' ? 'italic' : 'underline')
    } else if (event.key.toLowerCase() === 'z') {
      event.preventDefault()
      if (event.shiftKey) window.document.execCommand('redo', false)
      else window.document.execCommand('undo', false)
      syncFromDom()
    }
  }

  const filteredSlashCommands = slashMenu ? SLASH_COMMANDS.filter((command) => `${command.key} ${command.label} ${command.description} ${command.aliases.join(' ')}`.toLowerCase().includes(slashMenu.query.toLowerCase())) : []
  const commandMouseDown = (command: RichTextCommand) => (event: MouseEvent<HTMLButtonElement>) => { preventToolbarBlur(event); runCommand(command) }
  const togglePopover = (kind: RichTextPopoverKind, event: MouseEvent<HTMLButtonElement>) => {
    preventToolbarBlur(event)
    const isOpen = activePopover === kind && popoverPosition !== null
    if (isOpen) {
      setShowColors(false)
      setShowFontSizes(false)
      setShowEmoji(false)
      setShowSpacing(false)
      popoverAnchorRef.current = null
      setPopoverPosition(null)
      return
    }
    popoverAnchorRef.current = event.currentTarget
    setShowColors(kind === 'colors')
    setShowFontSizes(kind === 'fontSizes')
    setShowEmoji(kind === 'emoji')
    setShowSpacing(kind === 'spacing')
    setPopoverPosition(getRichTextPopoverPosition(event.currentTarget, kind))
  }
  const popoverClass = (baseClass: string): string => `${baseClass}${popoverPosition ? ' is-floating' : ''}`
  const popoverStyle = popoverPosition ? { left: popoverPosition.left, top: popoverPosition.top } : undefined

  return <div ref={containerRef} className={`rich-text-editor ${active ? 'is-active' : ''} ${className}`.trim()} style={editorStyle}>
    <div className="rich-text-toolbar" role="toolbar" aria-label="Định dạng văn bản">
      <div className="rich-text-toolbar__group" aria-label="Kiểu chữ">
        {toolbarButton('B', 'Đậm', commandMouseDown('bold'))}
        {toolbarButton('I', 'Nghiêng', commandMouseDown('italic'))}
        {focusMode && toolbarButton('U', 'Gạch chân', commandMouseDown('underline'))}
        {focusMode && toolbarButton('S', 'Gạch ngang', commandMouseDown('strikeThrough'))}
      </div>
      {focusMode && <div className="rich-text-toolbar__group" aria-label="Tiêu đề">
        {toolbarButton('H1', 'Tiêu đề 1', commandMouseDown('heading_1'))}
        {toolbarButton('H2', 'Tiêu đề 2', commandMouseDown('heading_2'))}
        {toolbarButton('H3', 'Tiêu đề 3', commandMouseDown('heading_3'))}
        {toolbarButton('H4', 'Tiêu đề 4', commandMouseDown('heading_4'))}
      </div>}
      <div className="rich-text-toolbar__group" aria-label="Danh sách và bố cục">
        {toolbarButton('• List', 'Danh sách bullet', commandMouseDown('insertUnorderedList'))}
        {toolbarButton('1. List', 'Danh sách đánh số', commandMouseDown('insertOrderedList'))}
        {toolbarButton('Quote', 'Trích dẫn', commandMouseDown('quote'))}
        {focusMode && toolbarButton('⇤', 'Thụt ra', commandMouseDown('outdent'))}
        {focusMode && toolbarButton('⇥', 'Thụt vào', commandMouseDown('indent'))}
        {focusMode && toolbarButton('—', 'Đường phân cách', commandMouseDown('divider'))}
      </div>
      {focusMode && <div className="rich-text-toolbar__group" aria-label="Trang trí">
        <button className={`rich-text-toolbar__swatch ${showColors ? 'is-active' : ''}`} type="button" title="Màu chữ" aria-label="Màu chữ" aria-expanded={showColors} onMouseDown={(event) => togglePopover('colors', event)}>A</button>
        <button className={`rich-text-toolbar__text-trigger ${showFontSizes ? 'is-active' : ''}`} type="button" title="Cỡ chữ" aria-label="Cỡ chữ" aria-expanded={showFontSizes} onMouseDown={(event) => togglePopover('fontSizes', event)}>Size</button>
        <button className={`rich-text-toolbar__text-trigger ${showEmoji ? 'is-active' : ''}`} type="button" title="Emoji" aria-label="Emoji" aria-expanded={showEmoji} onMouseDown={(event) => togglePopover('emoji', event)}>☺</button>
      </div>}
      <button className={`rich-text-spacing-trigger ${showSpacing ? 'is-active' : ''}`} type="button" title="Khoảng cách" aria-label="Khoảng cách" aria-expanded={showSpacing} onMouseDown={(event) => togglePopover('spacing', event)}>Spacing</button>
      <div className="rich-text-toolbar__group rich-text-toolbar__history" aria-label="Lịch sử chỉnh sửa">
        {toolbarButton('↶', 'Hoàn tác', undo)}
        {toolbarButton('↷', 'Làm lại', redo)}
      </div>
    </div>
    {showColors && <div className={popoverClass('rich-text-inline-popover rich-text-color-popover')} style={popoverStyle} role="dialog" aria-label="Màu chữ">{COLOR_COMMANDS.map((color) => <button key={color.value} type="button" title={color.label} onMouseDown={(event) => { preventToolbarBlur(event); applyColor(color.value) }}><i style={{ background: COLOR_VALUES[color.value] }} />{color.label}</button>)}</div>}
    {showFontSizes && <div className={popoverClass('rich-text-inline-popover rich-text-font-size-popover')} style={popoverStyle} role="dialog" aria-label="Cỡ chữ">{FONT_SIZE_COMMANDS.map((size) => <button key={size.value} type="button" onMouseDown={(event) => { preventToolbarBlur(event); applyFontSize(size.value) }}>{size.label}</button>)}</div>}
    {showEmoji && <div className={popoverClass('rich-text-inline-popover rich-text-emoji-popover')} style={popoverStyle} role="dialog" aria-label="Chọn emoji">{EMOJI_OPTIONS.map((emoji) => <button key={emoji} type="button" onMouseDown={(event) => { preventToolbarBlur(event); insertEmoji(emoji) }}>{emoji}</button>)}</div>}
    {showSpacing && <div className={popoverClass('rich-text-spacing-popover')} style={popoverStyle} role="dialog" aria-label="Thiết lập khoảng cách"><label><span>Line spacing</span><select value={model.lineSpacing} onChange={(event) => updateSpacing('lineSpacing', event.target.value as RichTextLineSpacing)}><option value="compact">Compact · 1.25</option><option value="normal">Normal · 1.5</option><option value="airy">Relaxed · 1.8</option></select></label><label><span>Paragraph spacing</span><select value={model.paragraphSpacing} onChange={(event) => updateSpacing('paragraphSpacing', event.target.value as RichTextParagraphSpacing)}><option value="small">Tight</option><option value="normal">Normal</option><option value="large">Spacious</option></select></label></div>}
    {slashMenu && <div className="rich-text-slash-menu" role="listbox" aria-label="Quick Insert" style={{ left: slashMenu.left, top: slashMenu.top }}>{filteredSlashCommands.length ? filteredSlashCommands.map((command, index) => <button key={command.key} className={index === slashIndex ? 'is-highlighted' : ''} type="button" role="option" aria-selected={index === slashIndex} onMouseDown={(event) => { preventToolbarBlur(event); applySlashCommand(command) }}><strong>{command.key}</strong><span><b>{command.label}</b><small>{command.description}</small></span></button>) : <p>Không tìm thấy lệnh</p>}</div>}
    <div ref={editorRef} className="rich-text-content" contentEditable role="textbox" aria-multiline="true" aria-label={ariaLabel} data-placeholder={placeholder} data-empty={isEmpty} style={minHeight ? { minHeight } : undefined} suppressContentEditableWarning onFocus={() => setIsFocused(true)} onBlur={(event) => { syncFromDom(); if (event.relatedTarget instanceof Node && event.currentTarget.parentElement?.contains(event.relatedTarget)) return; setIsFocused(false); setShowSpacing(false) }} onInput={() => { syncFromDom(); syncSlashMenu() }} onPaste={handlePaste} onKeyDown={handleKeyDown} />
  </div>
}
