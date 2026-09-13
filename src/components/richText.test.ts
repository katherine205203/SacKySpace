import { describe, expect, it } from 'vitest'
import { isRichTextEmpty, parseRichText, RICH_TEXT_PREFIX, richTextToPlainText, richTextWordCount, serializeRichText, type RichTextDocument } from './richText'

describe('rich text document compatibility', () => {
  it('treats legacy plain text as one normal paragraph', () => {
    const document = parseRichText('Dòng một\nDòng hai')
    expect(document).toMatchObject({ type: 'doc', version: 1, lineSpacing: 'normal', paragraphSpacing: 'normal' })
    expect(document.blocks).toEqual([{ type: 'paragraph', children: [{ text: 'Dòng một\nDòng hai' }] }])
    expect(richTextToPlainText('Dòng một\nDòng hai')).toBe('Dòng một\nDòng hai')
  })

  it('keeps supported marks, lists, quotes and spacing in structured JSON', () => {
    const document: RichTextDocument = {
      type: 'doc',
      version: 1,
      lineSpacing: 'airy',
      paragraphSpacing: 'large',
      blocks: [
        { type: 'paragraph', children: [{ text: 'Đậm', marks: ['bold'] }, { text: ' và nghiêng', marks: ['italic'] }] },
        { type: 'bullet_list', items: [{ children: [{ text: 'Một' }] }, { children: [{ text: 'Hai' }] }] },
        { type: 'numbered_list', items: [{ children: [{ text: 'Ba' }] }] },
        { type: 'quote', children: [{ text: 'Một câu trích dẫn' }] },
      ],
    }
    const serialized = serializeRichText(document)
    expect(serialized.startsWith(RICH_TEXT_PREFIX)).toBe(true)
    expect(parseRichText(serialized)).toEqual(document)
    expect(richTextToPlainText(serialized)).toBe('Đậm và nghiêng\nMột\nHai\nBa\nMột câu trích dẫn')
  })

  it('recognizes empty structured documents without confusing the storage marker for content', () => {
    const empty = serializeRichText({ type: 'doc', version: 1, lineSpacing: 'normal', paragraphSpacing: 'normal', blocks: [{ type: 'paragraph', children: [] }] })
    expect(empty).not.toBe('')
    expect(isRichTextEmpty(empty)).toBe(true)
    expect(isRichTextEmpty('')).toBe(true)
    expect(isRichTextEmpty('Nội dung')).toBe(false)
  })

  it('counts words from plain and structured rich text', () => {
    expect(richTextWordCount('Một   ngày\nnhẹ nhàng')).toBe(4)
    expect(richTextWordCount(serializeRichText({ type: 'doc', version: 1, lineSpacing: 'normal', paragraphSpacing: 'normal', blocks: [{ type: 'paragraph', children: [{ text: 'Viết điều này' }] }, { type: 'quote', children: [{ text: 'cho mình' }] }] }))).toBe(5)
    expect(richTextWordCount('   ')).toBe(0)
  })

  it('round-trips the Focus writing structure and keeps only supported styling', () => {
    const document: RichTextDocument = {
      type: 'doc',
      version: 1,
      lineSpacing: 'compact',
      paragraphSpacing: 'normal',
      blocks: [
        { type: 'heading_2', indent: 1, children: [{ text: 'Một tiêu đề', marks: ['bold', 'underline'], color: 'violet', fontSize: 'xl' }] },
        { type: 'divider' },
        { type: 'bullet_list', items: [{ children: [{ text: 'Một dòng' }], indent: 2 }] },
      ],
    }
    const serialized = serializeRichText(document)
    expect(parseRichText(serialized)).toEqual(document)
    expect(richTextToPlainText(serialized)).toBe('Một tiêu đề\n\nMột dòng')

    const unsafe = `${RICH_TEXT_PREFIX}${JSON.stringify({ ...document, blocks: [{ type: 'paragraph', indent: 99, children: [{ text: 'Safe', marks: ['bold', 'blink'], color: 'hot-pink', fontSize: 'giant' }] }] })}`
    expect(parseRichText(unsafe).blocks).toEqual([{ type: 'paragraph', indent: 3, children: [{ text: 'Safe', marks: ['bold'] }] }])
  })
})
