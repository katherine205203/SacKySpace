import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ActionModal, DecisionModal } from '../components/CheckinModals'
import { CheckinWorkspaceHeader, ContextCard, EmotionCard, EmotionFilters, FlowFooter, GroupFilters, NeedCard, NoteField, PickerControlShelf, ReferenceDetailModal, SelectionStatus, SummaryRail, type ReferenceDetail } from '../components/CheckinComponents'
import { useCheckinFlow } from '../useCheckinFlow'
import { useReferenceData } from '../hooks/useReferenceData'
import { ReferenceState } from '../hooks/ReferenceState'
import { canSelect, MAX_CONTEXTS, MAX_NEEDS, MAX_SECONDARY_EMOTIONS, toggleSelection } from '../utils/selectionRules'

type DeepDiveStep = 'secondary' | 'needs' | 'contexts'

const stepInfo: Record<DeepDiveStep, { eyebrow: string; title: string; copy: string; next: string; path: string }> = {
  secondary: { eyebrow: 'Đào sâu hơn · 2/5', title: 'Cảm xúc phụ nào đang hiện diện?', copy: 'Chọn tối đa 2 cảm xúc phụ, hoặc tiếp tục nếu chưa cần.', next: 'Tiếp tục', path: 'needs' },
  needs: { eyebrow: 'Đào sâu hơn · 3/5', title: 'Điều mình đang cần là gì?', copy: 'Chọn tối đa 3 nhu cầu, hoặc tiếp tục nếu chưa cần.', next: 'Tiếp tục', path: 'contexts' },
  contexts: { eyebrow: 'Đào sâu hơn · 4/5', title: 'Bối cảnh nào đang liên quan?', copy: 'Chọn tối đa 2 bối cảnh, hoặc tiếp tục nếu chưa cần.', next: 'Xem lại', path: 'review' },
}

export function DeepDiveScreen({ step }: { step: DeepDiveStep }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()
  const { draft, updateDraft, saveDraft, completeCheckin, loadExistingDraft, isSaving, error } = useCheckinFlow()
  const { reference, error: referenceError } = useReferenceData()
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('all')
  const [modal, setModal] = useState<'decision' | 'action' | null>(null)
  const [detail, setDetail] = useState<ReferenceDetail | null>(null)
  const emotionViewportRef = useRef<HTMLDivElement>(null)
  const info = stepInfo[step]
  const returnToReview = Boolean((location.state as { returnToReview?: boolean } | null)?.returnToReview)

  useEffect(() => {
    if (id && draft.id !== id) void loadExistingDraft(id).catch(() => undefined)
  }, [draft.id, id, loadExistingDraft])

  const normalized = query.trim().toLocaleLowerCase()
  const visibleEmotions = useMemo(() => reference?.emotions.filter((emotion) => emotion.emotion_id !== draft.primaryEmotionId && (group === 'all' || emotion.emotion_family_id === group) && (!normalized || `${emotion.emotion_name_vn} ${emotion.emotion_name_en} ${emotion.description_vn} ${emotion.description_en}`.toLocaleLowerCase().includes(normalized))) ?? [], [draft.primaryEmotionId, group, normalized, reference])
  const visibleNeeds = useMemo(() => reference?.needs.filter((need) => (group === 'all' || need.need_group_id === group) && (!normalized || `${need.need_name_vn} ${need.need_name_en} ${need.description_vn} ${need.description_en}`.toLocaleLowerCase().includes(normalized))) ?? [], [group, normalized, reference])
  const visibleContexts = useMemo(() => reference?.contexts.filter((context) => (group === 'all' || context.context_group === group) && (!normalized || `${context.context_name_vn} ${context.context_group} ${context.description_vn}`.toLocaleLowerCase().includes(normalized))) ?? [], [group, normalized, reference])
  const selected = step === 'secondary' ? draft.secondaryEmotionIds : step === 'needs' ? draft.needIds : draft.contextIds
  const limit = step === 'secondary' ? MAX_SECONDARY_EMOTIONS : step === 'needs' ? MAX_NEEDS : MAX_CONTEXTS

  useEffect(() => {
    if (step === 'secondary') emotionViewportRef.current?.scrollTo({ top: 0 })
  }, [group, query, step])

  if (!reference) return <div className="page-stack checkin-page"><ReferenceState error={referenceError} /></div>

  const toggle = (value: string) => {
    if (!canSelect(selected, value, limit)) return
    const next = toggleSelection(selected, value, limit)
    updateDraft(step === 'secondary' ? { secondaryEmotionIds: next } : step === 'needs' ? { needIds: next } : { contextIds: next })
  }
  const saveAndContinue = async () => {
    try {
      await saveDraft()
      const routeId = draft.id ?? id
      if (returnToReview || step === 'contexts') navigate(routeId ? `/checkin/${routeId}/review` : '/checkin/review')
      else navigate(routeId ? `/checkin/${routeId}/${info.path}` : `/checkin/${info.path}`)
    } catch { /* surfaced by context */ }
  }
  const quickSave = async () => { try { await saveDraft(); setModal('decision') } catch { /* surfaced by context */ } }
  const completeAndGo = async (nextDraft = draft) => {
    try { await completeCheckin(nextDraft); navigate('/') } catch { /* surfaced by context */ }
  }
  const routeFor = (path: string) => (draft.id ?? id) ? `/checkin/${draft.id ?? id}/${path}` : `/checkin/${path}`
  const nextSelection = () => {
    if (step === 'secondary') return <section className="selection-panel" aria-labelledby="secondary-selection-title"><div className="selection-panel__header"><span id="secondary-selection-title" className="section-label">Cảm xúc phụ</span><SelectionStatus selected={selected.length} limit={limit} label="cảm xúc phụ" /></div><div ref={emotionViewportRef} className="emotion-selection-viewport"><div className="inventory-grid inventory-grid--emotions">{visibleEmotions.map((emotion) => <EmotionCard key={emotion.emotion_id} emotion={emotion} multi selected={selected.includes(emotion.emotion_id)} disabled={!selected.includes(emotion.emotion_id) && selected.length >= limit} onClick={() => toggle(emotion.emotion_id)} />)}</div></div></section>
    if (step === 'needs') return <section className="selection-panel" aria-labelledby="need-selection-title"><div className="selection-panel__header"><span id="need-selection-title" className="section-label">Điều mình đang cần</span><SelectionStatus selected={selected.length} limit={limit} label="nhu cầu" /></div><div className="inventory-grid inventory-grid--needs">{visibleNeeds.map((need) => <NeedCard key={need.need_id} need={need} selected={selected.includes(need.need_id)} disabled={!selected.includes(need.need_id) && selected.length >= limit} onClick={() => toggle(need.need_id)} onInfo={() => setDetail({ emoji: need.emoji, typeLabel: 'Nhu cầu', nameVn: need.need_name_vn, nameEn: need.need_name_en, groupVn: reference.needGroups.find((groupItem) => groupItem.need_group_id === need.need_group_id)?.group_name_vn, groupEn: reference.needGroups.find((groupItem) => groupItem.need_group_id === need.need_group_id)?.group_name_en, descriptionVn: need.description_vn, descriptionEn: need.description_en, color: need.color_hex })} />)}</div></section>
    return <section className="selection-panel" aria-labelledby="context-selection-title"><div className="selection-panel__header"><span id="context-selection-title" className="section-label">Điều gì đang liên quan?</span><SelectionStatus selected={selected.length} limit={limit} label="bối cảnh" /></div><div className="inventory-grid inventory-grid--contexts">{visibleContexts.map((context) => <ContextCard key={context.context_id} context={context} selected={selected.includes(context.context_id)} disabled={!selected.includes(context.context_id) && selected.length >= limit} onClick={() => toggle(context.context_id)} onInfo={() => setDetail({ emoji: context.emoji, typeLabel: 'Bối cảnh', nameVn: context.context_name_vn, groupVn: context.context_group, descriptionVn: context.description_vn, color: context.color_hex })} />)}</div></section>
  }

  return (
    <div className="page-stack checkin-page checkin-workspace">
      <CheckinWorkspaceHeader active="create" eyebrow={info.eyebrow} title={info.title} copy={info.copy} />
      <div className="split-workspace">
        <main className="flow-main">
          <PickerControlShelf query={query} onQueryChange={setQuery} onClear={() => setQuery('')} label={step === 'secondary' ? 'Nhóm cảm xúc' : step === 'needs' ? 'Nhóm nhu cầu' : 'Nhóm bối cảnh'} resultCount={step === 'secondary' ? visibleEmotions.length : step === 'needs' ? visibleNeeds.length : visibleContexts.length} resultLabel={step === 'secondary' ? 'cảm xúc' : step === 'needs' ? 'nhu cầu' : 'bối cảnh'}>
            {step === 'secondary' && <EmotionFilters families={reference.emotionFamilies} activeFamily={group} onFamilyChange={setGroup} />}
            {step === 'needs' && <GroupFilters groups={reference.needGroups} activeGroup={group} onGroupChange={setGroup} />}
            {step === 'contexts' && <><button className={`filter-chip filter-chip--all ${group === 'all' ? 'is-active' : ''}`} type="button" onClick={() => setGroup('all')}>Tất cả</button>{Array.from(new Set(reference.contexts.map((context) => context.context_group))).map((item) => <button key={item} className={`filter-chip ${group === item ? 'is-active' : ''}`} type="button" onClick={() => setGroup(item)}>{item}</button>)}</>}
          </PickerControlShelf>
          <section className="selection-context-strip" aria-label="Thông tin đã chọn"><div><span className="section-label">Cảm xúc chính</span><strong>{reference.emotions.find((emotion) => emotion.emotion_id === draft.primaryEmotionId)?.emoji} {reference.emotions.find((emotion) => emotion.emotion_id === draft.primaryEmotionId)?.emotion_name_vn ?? 'Chưa chọn'}</strong></div><div><span className="section-label">Cường độ</span><strong>{draft.intensity ? `${draft.intensity}/5` : 'Chưa chọn'}</strong></div><div><span className="section-label">Ghi chú của bạn</span><strong>{draft.note || 'Chưa có ghi chú'}</strong></div></section>
          {nextSelection()}
          {selected.length === 0 && <p className="empty-state">Bạn có thể bỏ qua bước này.</p>}
          <NoteField value={draft.note} onChange={(note) => updateDraft({ note })} />
          {error && <p className="form-error" role="alert">{error}</p>}
        </main>
        <SummaryRail draft={draft} reference={reference} showPrimaryDetails />
      </div>
      <FlowFooter onBack={() => navigate(step === 'secondary' ? '/checkin/emotion' : routeFor(step === 'needs' ? 'secondary-emotions' : 'needs'))} onQuickSave={() => void quickSave()} onContinue={() => void saveAndContinue()} isSaving={isSaving} continueLabel={info.next} />
      {modal === 'decision' && <DecisionModal draft={draft} reference={reference} onClose={() => setModal(null)} onFinish={() => completeAndGo()} onDeepDive={() => setModal(null)} onAction={() => setModal('action')} />}
      {modal === 'action' && <ActionModal reference={reference} context={{ emotion: reference.emotions.find((emotion) => emotion.emotion_id === draft.primaryEmotionId), checkinType: draft.checkinType }} onClose={() => setModal('decision')} onSaved={(actions) => { const nextDraft = { ...draft, actions }; updateDraft({ actions }); void completeAndGo(nextDraft) }} />}
      {detail && <ReferenceDetailModal detail={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}
