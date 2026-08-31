import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ActionModal, DecisionModal } from '../components/CheckinModals'
import { CheckinWorkspaceHeader, FlowFooter, NoteField, SummaryRail } from '../components/CheckinComponents'
import { useCheckinFlow } from '../useCheckinFlow'
import { useReferenceData } from '../hooks/useReferenceData'
import { ReferenceState } from '../hooks/ReferenceState'
import { convertUnknownToEmotion } from '../utils/unknownConversion'

export function UnknownScreen() {
  const navigate = useNavigate()
  const { draft, updateDraft, saveDraft, completeCheckin, isSaving, error } = useCheckinFlow()
  const { reference, error: referenceError } = useReferenceData()
  const [modal, setModal] = useState<'decision' | 'action' | null>(null)

  useEffect(() => {
    if (reference && !draft.unknownPromptId && reference.unknownPrompts.length > 0) updateDraft({ unknownPromptId: reference.unknownPrompts[0].prompt_id })
  }, [draft.unknownPromptId, reference, updateDraft])

  if (!reference) return <div className="page-stack checkin-page"><ReferenceState error={referenceError} /></div>

  const persist = async () => {
    if (!draft.unknownPromptId || !draft.note.trim()) return
    try { await saveDraft(); setModal('decision') } catch { /* surfaced by context */ }
  }
  const deepDive = () => {
    updateDraft(convertUnknownToEmotion(draft))
    navigate('/checkin/emotion')
  }
  const selectedPrompt = reference.unknownPrompts.find((prompt) => prompt.prompt_id === draft.unknownPromptId)
  const canSave = Boolean(draft.unknownPromptId && draft.note.trim())
  const changePrompt = () => {
    if (!selectedPrompt || reference.unknownPrompts.length < 2) return
    const index = reference.unknownPrompts.findIndex((prompt) => prompt.prompt_id === selectedPrompt.prompt_id)
    const next = reference.unknownPrompts[(index + 1) % reference.unknownPrompts.length]
    updateDraft({ unknownPromptId: next.prompt_id })
  }
  const completeAndGo = async (nextDraft = draft) => {
    try { await completeCheckin(nextDraft); navigate('/') } catch { /* surfaced by context */ }
  }

  return (
    <div className="page-stack checkin-page checkin-workspace">
      <CheckinWorkspaceHeader active="create" eyebrow="Sắc Ký" title="Mình chưa rõ điều gì đang có mặt." copy="Hãy chọn một prompt và viết ra trước, rồi mình có thể dừng tại đây hoặc đi sâu hơn sau đó." />
      <div className="split-workspace">
        <main className="flow-main">
          {selectedPrompt && <section className="unknown-prompt-workspace" aria-labelledby="unknown-prompt-title"><span className="unknown-prompt-workspace__eyebrow">Câu hỏi gợi mở</span><div className="unknown-prompt-workspace__mark" aria-hidden="true">{selectedPrompt.emoji}</div><h2 id="unknown-prompt-title">{selectedPrompt.prompt_text_vn}</h2><button className="text-button" type="button" onClick={changePrompt}>↻ Đổi prompt</button></section>}
          <div className="unknown-note-field"><NoteField value={draft.note} onChange={(note) => updateDraft({ note })} required /></div>
          {!canSave && <p className="form-hint">Chọn một câu hỏi và viết vài dòng trước khi lưu.</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
        </main>
        <SummaryRail draft={draft} reference={reference} title="Unknown Check-in" />
      </div>
      <FlowFooter onBack={() => navigate('/checkin')} onQuickSave={() => void persist()} onContinue={() => void persist()} isSaving={isSaving} continueLabel="Lưu check-in" />
      {modal === 'decision' && <DecisionModal draft={draft} reference={reference} onClose={() => setModal(null)} onFinish={() => completeAndGo()} onDeepDive={deepDive} onAction={() => setModal('action')} />}
      {modal === 'action' && <ActionModal reference={reference} onClose={() => setModal('decision')} onSaved={(actions) => { const nextDraft = { ...draft, actions }; updateDraft({ actions }); void completeAndGo(nextDraft) }} />}
    </div>
  )
}
