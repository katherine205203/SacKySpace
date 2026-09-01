import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ActionModal, CompletionModal, DecisionModal } from '../components/CheckinModals'
import { CheckinWorkspaceHeader, EmotionCard, EmotionFilters, IntensityPicker, NoteField, PickerControlShelf, SelectionStatus, SummaryRail } from '../components/CheckinComponents'
import { useCheckinFlow } from '../useCheckinFlow'
import { useReferenceData } from '../hooks/useReferenceData'
import { ReferenceState } from '../hooks/ReferenceState'

export function EmotionCoreScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const { draft, updateDraft, saveDraft, completeCheckin, isSaving, error } = useCheckinFlow()
  const { reference, error: referenceError } = useReferenceData()
  const [family, setFamily] = useState('all')
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState<'decision' | 'completion' | 'action' | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const emotionViewportRef = useRef<HTMLDivElement>(null)
  const returnToReview = Boolean((location.state as { returnToReview?: boolean } | null)?.returnToReview)

  const emotions = useMemo(() => {
    if (!reference) return []
    const normalized = query.trim().toLocaleLowerCase()
    return reference.emotions.filter((emotion) => {
      const familyMatch = family === 'all' || emotion.emotion_family_id === family
      const queryMatch = !normalized || [emotion.emotion_name_vn, emotion.emotion_name_en, emotion.description_vn, emotion.description_en].some((value) => value.toLocaleLowerCase().includes(normalized))
      return familyMatch && queryMatch
    })
  }, [family, query, reference])

  useEffect(() => {
    emotionViewportRef.current?.scrollTo({ top: 0 })
  }, [family, query])

  if (!reference) return <div className="page-stack checkin-page"><ReferenceState error={referenceError} /></div>

  const primary = reference.emotions.find((emotion) => emotion.emotion_id === draft.primaryEmotionId)
  const validate = () => {
    if (!draft.primaryEmotionId) return 'Hãy chọn một cảm xúc chính.'
    if (!draft.intensity) return 'Hãy chọn cường độ của cảm xúc.'
    return null
  }

  const persist = async (nextModal: 'decision' | 'completion') => {
    const validation = validate()
    if (validation) { setFormError(validation); return false }
    try {
      const saved = await saveDraft()
      setFormError(null)
      if (returnToReview) {
        navigate(saved.id ? `/checkin/${saved.id}/review` : '/checkin/review')
        return true
      }
      setModal(nextModal)
      return true
    } catch { return false }
  }

  const completeAndGo = async (nextDraft = draft) => {
    try {
      const saved = await completeCheckin(nextDraft)
      if (returnToReview) navigate(`/checkin/${saved.id}/review`)
      else navigate('/')
    } catch {
      // The flow context keeps the save error visible without navigating away.
    }
  }

  const openDeepDive = () => {
    navigate(draft.id ? `/checkin/${draft.id}/secondary-emotions` : '/checkin/secondary-emotions')
  }

  const selectEmotion = (emotionId: string) => {
    updateDraft({ primaryEmotionId: emotionId, checkinType: 'emotion' })
    setFormError(null)
  }

  return (
    <div className="page-stack checkin-page checkin-workspace">
      <CheckinWorkspaceHeader active="create" eyebrow="Đang ở đây · 1/5" title="Cảm xúc chính đang hiện diện là gì?" copy="Chọn một cảm xúc đang rõ nhất với bạn lúc này." />
      <div className="split-workspace">
        <main className="flow-main">
          <PickerControlShelf query={query} onQueryChange={setQuery} onClear={() => setQuery('')} label="Nhóm cảm xúc" resultCount={emotions.length}>
            <EmotionFilters families={reference.emotionFamilies} activeFamily={family} onFamilyChange={setFamily} />
          </PickerControlShelf>
          <section className="selection-panel" aria-labelledby="emotion-collection-title"><div className="selection-panel__header"><span id="emotion-collection-title" className="section-label">Chọn một cảm xúc</span><SelectionStatus selected={primary ? 1 : 0} limit={1} label="cảm xúc chính" /></div><div ref={emotionViewportRef} className="emotion-selection-viewport"><div className="inventory-grid inventory-grid--emotions">{emotions.map((emotion) => <EmotionCard key={emotion.emotion_id} emotion={emotion} selected={emotion.emotion_id === draft.primaryEmotionId} onClick={() => selectEmotion(emotion.emotion_id)} />)}</div></div></section>
          {!emotions.length && <p className="empty-state">Không tìm thấy cảm xúc phù hợp.</p>}
          <IntensityPicker value={draft.intensity} onChange={(intensity) => updateDraft({ intensity })} />
          <NoteField value={draft.note} onChange={(note) => updateDraft({ note })} />
          {(formError || error) && <p className="form-error" role="alert">{formError ?? error}</p>}
          {primary && <p className="selection-hint"><span style={{ background: primary.color_hex }} />Đang chọn: <strong>{primary.emotion_name_vn}</strong></p>}
        </main>
        <SummaryRail draft={draft} reference={reference} showPrimaryDetails />
      </div>
      <footer className="flow-footer"><button className="button button--secondary" type="button" onClick={() => navigate('/checkin')}>← Quay lại</button><button className="button button--primary" type="button" onClick={() => void persist('decision')} disabled={isSaving}>{isSaving ? 'Đang lưu…' : 'Lưu'}</button></footer>
      {modal === 'decision' && <DecisionModal draft={draft} reference={reference} onClose={() => setModal(null)} onFinish={() => completeAndGo()} onDeepDive={openDeepDive} onAction={() => setModal('action')} />}
      {modal === 'completion' && <CompletionModal onClose={() => setModal(null)} onFinish={() => completeAndGo()} onAction={() => setModal('action')} />}
      {modal === 'action' && <ActionModal reference={reference} context={{ emotion: primary, checkinType: draft.checkinType }} onClose={() => setModal('decision')} onSaved={(actions) => { const nextDraft = { ...draft, actions }; updateDraft({ actions }); void completeAndGo(nextDraft) }} />}
    </div>
  )
}
