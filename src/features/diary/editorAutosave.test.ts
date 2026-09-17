import { describe, expect, it } from 'vitest'
import { createEmptyDiaryDraft } from './services/diaryRepository'
import { getDiaryDraftSignature, hasDiaryDraftContent, parseDiaryEditorCache } from './editorAutosave'

describe('diary editor autosave helpers', () => {
  it('reads the timestamped cache envelope and normalizes legacy statuses', () => {
    const draft = { ...createEmptyDiaryDraft('2026-09-17'), status: 'day_locked' as const }
    const cached = parseDiaryEditorCache({ draft, cachedAt: '2026-09-17T10:00:00.000Z' }, '2026-09-17')

    expect(cached?.cachedAt).toBe('2026-09-17T10:00:00.000Z')
    expect(cached?.draft.status).toBe('done')
    expect(cached?.draft.completionSource).toBe('system')
  })

  it('still reads the old raw-draft cache shape', () => {
    const draft = createEmptyDiaryDraft('2026-09-17')
    const cached = parseDiaryEditorCache(draft, '2026-09-17')

    expect(cached?.draft.localDate).toBe('2026-09-17')
    expect(cached?.cachedAt).toBe('1970-01-01T00:00:00.000Z')
  })

  it('changes the signature when a prompt response changes', () => {
    const draft = createEmptyDiaryDraft('2026-09-17')
    const updated = { ...draft, overallText: '<p>Điều đang ở cùng mình</p>' }

    expect(getDiaryDraftSignature(updated)).not.toBe(getDiaryDraftSignature(draft))
  })

  it('does not remote-autosave a completely untouched new editor', () => {
    expect(hasDiaryDraftContent(createEmptyDiaryDraft('2026-09-17'))).toBe(false)
  })
})
