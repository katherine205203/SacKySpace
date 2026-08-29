import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ActionModal, CompletionModal, DecisionModal } from '../components/CheckinModals'
import { CheckinWorkspaceHeader, FlowFooter, NoteField, SummaryRail } from '../components/CheckinComponents'
import { useCheckinFlow } from '../useCheckinFlow'
import { useReferenceData } from '../hooks/useReferenceData'
import { ReferenceState } from '../hooks/ReferenceState'
import { convertUnknownToEmotion } from '../utils/unknownConversion'

export function UnknownScreen() {
  const navigate = useNavigate()
  const { draft, updateDraft, saveDraft, isSaving, error } = useCheckinFlow()
  const { reference, error: referenceError } = useReferenceData()
  const [modal, setModal] = useState<'decision' | 'completion' | 'action' | null>(null)

  if (!reference) return <div className="page-stack checkin-page"><ReferenceState error={referenceError} /></div>

  const persist = async (nextModal: 'decision' | 'completion') => {
    if (!draft.unknownPromptId || !draft.note.trim()) return
    try { await saveDraft(); setModal(nextModal) } catch { /* surfaced by context */ }
  }
  const deepDive = () => {
    if (!draft.id) return
    updateDraft(convertUnknownToEmotion(draft))
    navigate(`/checkin/${draft.id}/secondary-emotions`)
  }
  const selectedPrompt = reference.unknownPrompts.find((prompt) => prompt.prompt_id === draft.unknownPromptId)
  const canSave = Boolean(draft.unknownPromptId && draft.note.trim())
  const finish = () => navigate('/')

  return (
    <div className="page-stack checkin-page checkin-workspace">
      <CheckinWorkspaceHeader active="create" eyebrow="Unknown check-in" title="Mình chưa rõ điều gì đang có mặt." copy="Hãy chọn một prompt và viết ra trước." />
      <div className="split-workspace">
        <main className="flow-main">
          <div className="prompt-grid">{reference.unknownPrompts.map((prompt) => <button key={prompt.prompt_id} className={`prompt-card ${prompt.prompt_id === draft.unknownPromptId ? 'is-selected' : ''}`} type="button" aria-pressed={prompt.prompt_id === draft.unknownPromptId} onClick={() => updateDraft({ unknownPromptId: prompt.prompt_id })}><span>{prompt.emoji}</span><strong>{prompt.prompt_text_vn}</strong><b>{prompt.prompt_id === draft.unknownPromptId ? '✓' : '→'}</b></button>)}</div>
          <NoteField value={draft.note} onChange={(note) => updateDraft({ note })} />
          {!canSave && <p className="form-hint">Chọn một câu hỏi và viết vài dòng trước khi lưu.</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          {selectedPrompt && <div className="selected-prompt"><span>{selectedPrompt.emoji}</span><div><small>Đang viết từ câu hỏi</small><strong>{selectedPrompt.prompt_text_vn}</strong></div></div>}
        </main>
        <SummaryRail draft={draft} reference={reference} title="Unknown Check-in" />
      </div>
      <FlowFooter onBack={() => navigate('/checkin')} onQuickSave={() => void persist('completion')} onContinue={() => void persist('decision')} isSaving={isSaving} continueLabel="Lưu check-in" />
      {modal === 'decision' && <DecisionModal draft={draft} reference={reference} onClose={() => setModal(null)} onFinish={finish} onDeepDive={deepDive} onAction={() => setModal('action')} />}
      {modal === 'completion' && <CompletionModal onClose={() => setModal(null)} onFinish={finish} onAction={() => setModal('action')} />}
      {modal === 'action' && <ActionModal reference={reference} onClose={() => setModal(null)} onSaved={(actions) => { const nextDraft = { ...draft, actions }; updateDraft({ actions }); void saveDraft(nextDraft).then(finish).catch(() => undefined) }} />}
    </div>
  )
}
