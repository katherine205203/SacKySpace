import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CompletionModal } from '../components/CheckinModals'
import { CheckinPageIntro, CheckinTabs, ContextCard, EmotionCard, EmotionFilters, FlowFooter, GroupFilters, NeedCard, NoteField, SummaryRail } from '../components/CheckinComponents'
import { useCheckinFlow } from '../CheckinFlowContext'
import { ReferenceState, useReferenceData } from '../hooks/useReferenceData'
import { canSelect, MAX_CONTEXTS, MAX_NEEDS, MAX_SECONDARY_EMOTIONS, toggleSelection } from '../utils/selectionRules'

type DeepDiveStep = 'secondary' | 'needs' | 'contexts'

const stepInfo: Record<DeepDiveStep, { eyebrow: string; title: string; copy: string; next: string; path: string }> = {
  secondary: { eyebrow: 'Đào sâu · 2/4', title: 'Còn cảm xúc nào đang đi cùng?', copy: 'Bạn có thể chọn tối đa 2 cảm xúc phụ, hoặc bỏ qua.', next: 'Thêm nhu cầu', path: 'needs' },
  needs: { eyebrow: 'Đào sâu · 3/4', title: 'Điều gì đang cần được lắng nghe?', copy: 'Chọn tối đa 3 nhu cầu đang hiện diện phía sau cảm xúc.', next: 'Thêm bối cảnh', path: 'contexts' },
  contexts: { eyebrow: 'Đào sâu · 4/4', title: 'Điều gì đang góp phần tạo nên hôm nay?', copy: 'Chọn tối đa 2 bối cảnh. Không có câu trả lời đúng hay sai.', next: 'Xem lại', path: 'review' },
}

export function DeepDiveScreen({ step }: { step: DeepDiveStep }) {
  const navigate = useNavigate()
  const { id } = useParams()
  const { draft, updateDraft, saveDraft, isSaving, error } = useCheckinFlow()
  const { reference, error: referenceError } = useReferenceData()
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('all')
  const [modal, setModal] = useState(false)
  const info = stepInfo[step]

  const normalized = query.trim().toLocaleLowerCase()
  const visibleEmotions = useMemo(() => reference?.emotions.filter((emotion) => emotion.emotion_id !== draft.primaryEmotionId && (group === 'all' || emotion.emotion_family_id === group) && (!normalized || `${emotion.emotion_name_vn} ${emotion.emotion_name_en}`.toLocaleLowerCase().includes(normalized))) ?? [], [draft.primaryEmotionId, group, normalized, reference])
  const visibleNeeds = useMemo(() => reference?.needs.filter((need) => (group === 'all' || need.need_group_id === group) && (!normalized || `${need.need_name_vn} ${need.need_name_en}`.toLocaleLowerCase().includes(normalized))) ?? [], [group, normalized, reference])
  const visibleContexts = useMemo(() => reference?.contexts.filter((context) => (group === 'all' || context.context_group === group) && (!normalized || context.context_name_vn.toLocaleLowerCase().includes(normalized))) ?? [], [group, normalized, reference])
  const selected = step === 'secondary' ? draft.secondaryEmotionIds : step === 'needs' ? draft.needIds : draft.contextIds
  const limit = step === 'secondary' ? MAX_SECONDARY_EMOTIONS : step === 'needs' ? MAX_NEEDS : MAX_CONTEXTS

  if (!reference) return <div className="page-stack checkin-page"><CheckinTabs active="create" /><ReferenceState error={referenceError} /></div>

  const toggle = (value: string) => {
    if (!canSelect(selected, value, limit)) return
    const next = toggleSelection(selected, value, limit)
    updateDraft(step === 'secondary' ? { secondaryEmotionIds: next } : step === 'needs' ? { needIds: next } : { contextIds: next })
  }
  const saveAndContinue = async () => {
    if (!draft.id && !id) return
    try {
      const saved = await saveDraft()
      if (step === 'contexts') navigate(`/checkin/${saved.id}/review`)
      else navigate(`/checkin/${saved.id}/${info.path}`)
    } catch { /* surfaced by context */ }
  }
  const quickSave = async () => { try { await saveDraft(); setModal(true) } catch { /* surfaced by context */ } }
  const nextSelection = () => {
    if (step === 'secondary') return <div className="inventory-grid inventory-grid--emotions">{visibleEmotions.map((emotion) => <EmotionCard key={emotion.emotion_id} emotion={emotion} multi selected={selected.includes(emotion.emotion_id)} disabled={!selected.includes(emotion.emotion_id) && selected.length >= limit} onClick={() => toggle(emotion.emotion_id)} />)}</div>
    if (step === 'needs') return <div className="inventory-grid inventory-grid--needs">{visibleNeeds.map((need) => <NeedCard key={need.need_id} need={need} selected={selected.includes(need.need_id)} disabled={!selected.includes(need.need_id) && selected.length >= limit} onClick={() => toggle(need.need_id)} />)}</div>
    return <div className="inventory-grid inventory-grid--contexts">{visibleContexts.map((context) => <ContextCard key={context.context_id} context={context} selected={selected.includes(context.context_id)} disabled={!selected.includes(context.context_id) && selected.length >= limit} onClick={() => toggle(context.context_id)} />)}</div>
  }

  return (
    <div className="page-stack checkin-page">
      <CheckinTabs active="create" />
      <CheckinPageIntro eyebrow={info.eyebrow} title={info.title} copy={info.copy} />
      <div className="split-workspace">
        <main className="flow-main">
          <div className="toolbar-row"><label className="search-field"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm kiếm…" aria-label="Tìm kiếm" /></label><span className="selection-counter">{selected.length}/{limit}</span></div>
          {step === 'secondary' && <EmotionFilters families={reference.emotionFamilies} activeFamily={group} onFamilyChange={setGroup} />}
          {step === 'needs' && <GroupFilters groups={reference.needGroups} activeGroup={group} onGroupChange={setGroup} />}
          {step === 'contexts' && <div className="filter-row">{['all', ...Array.from(new Set(reference.contexts.map((context) => context.context_group)))].map((item) => <button key={item} className={`filter-chip ${group === item ? 'is-active' : ''}`} type="button" onClick={() => setGroup(item)}>{item === 'all' ? 'Tất cả' : item}</button>)}</div>}
          {nextSelection()}
          {selected.length === 0 && <p className="empty-state">Bạn có thể bỏ qua bước này.</p>}
          <NoteField value={draft.note} onChange={(note) => updateDraft({ note })} />
          {error && <p className="form-error" role="alert">{error}</p>}
        </main>
        <SummaryRail draft={draft} reference={reference} />
      </div>
      <FlowFooter onBack={() => navigate(step === 'secondary' ? '/checkin/emotion' : `/checkin/${draft.id}/${step === 'needs' ? 'secondary-emotions' : 'needs'}`)} onQuickSave={() => void quickSave()} onContinue={() => void saveAndContinue()} isSaving={isSaving} continueLabel={info.next} />
      {modal && <CompletionModal onClose={() => setModal(false)} onFinish={() => navigate('/')} onAction={() => navigate(`/checkin/${draft.id}/review`)} />}
    </div>
  )
}
