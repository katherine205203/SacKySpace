import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useReferenceData } from '../checkin/hooks/useReferenceData'
import type { CheckinRecord } from '../checkin/types'
import { createEmptyFutureLetterDraft, deleteFutureLetter, archiveFutureLetter, getContextOptions, getFutureLetterLibrary, openFutureLetter, saveFutureLetterDraft, sealFutureLetter } from './services/futureLetterRepository'
import { ENVELOPE_ASSETS, SEAL_ASSETS, TRIGGER_OPTIONS, formatFutureLetterDate, formatFutureLetterDateTime, getFutureLetterLocalDate, stateLabel, triggerLabel } from './utils'
import type { Comparator, FutureLetter, FutureLetterDraft, FutureLetterRule, FutureLetterRuleConfig, FutureLetterRuleGroup, FutureLetterTriggerEvent, GroupOperator } from './types'
import './futureLetter.css'

type PageView = 'library' | 'write' | 'trigger' | 'decorate' | 'preview' | 'waiting' | 'available' | 'read' | 'history'

const PAGE_VIEWS = new Set<PageView>(['library', 'write', 'trigger', 'decorate', 'preview', 'waiting', 'available', 'read', 'history'])
const getView = (value: string | null): PageView => value && PAGE_VIEWS.has(value as PageView) ? value as PageView : 'library'

const cloneDraft = (letter: FutureLetter): FutureLetterDraft => ({
  ...letter,
  id: letter.id,
  userId: letter.userId,
  createdAt: letter.createdAt,
  updatedAt: letter.updatedAt,
  sealedAt: letter.sealedAt,
  firstOpenedAt: letter.firstOpenedAt,
  lastOpenedAt: letter.lastOpenedAt,
  openedCount: letter.openedCount,
  archivedAt: letter.archivedAt,
  triggerEvents: letter.triggerEvents,
  groups: letter.groups.map((group) => ({ ...group, rules: group.rules.map((rule) => ({ ...rule, config: { ...rule.config } })) })),
  attachments: letter.attachments.map((attachment) => ({ ...attachment, snapshot: attachment.snapshot ? { ...attachment.snapshot } : null })),
})

const newRule = (type: FutureLetterRule['type'], groupId: string): FutureLetter => {
  const defaults: Record<FutureLetterRule['type'], { comparator: Comparator | null; threshold: number | null; config: FutureLetterRuleConfig }> = {
    random_date: { comparator: null, threshold: null, config: { dailyChance: 0.3 } },
    specific_date: { comparator: null, threshold: null, config: { date: getFutureLetterLocalDate() } },
    checkin_streak: { comparator: '>=', threshold: 7, config: {} },
    diary_streak: { comparator: '>=', threshold: 7, config: {} },
    emotion_frequency: { comparator: '>=', threshold: 3, config: { scope: 'primary' } },
    done_action: { comparator: '>=', threshold: 5, config: { mode: 'window', window: 'last_30_days' } },
  }
  const selected = defaults[type]
  return { id: '', userId: '', title: '', body: '', state: 'writing', groupOperator: 'OR', groups: [{ id: groupId, operator: 'AND', position: 1, rules: [{ id: '', groupId, type, comparator: selected.comparator, threshold: selected.threshold, config: selected.config, position: 1 }] }], attachments: [], envelopeAssetId: null, sealAssetId: null, decorationSnapshot: null, createdAt: '', updatedAt: '', sealedAt: null, firstOpenedAt: null, lastOpenedAt: null, openedCount: 0, archivedAt: null, triggerEvents: [] }
}

const makeRule = (type: FutureLetterRule['type'], groupId: string, position: number): FutureLetterRule => {
  const letter = newRule(type, groupId)
  return { ...letter.groups[0].rules[0], position }
}

const contextLabel = (record: CheckinRecord): string => {
  const date = formatFutureLetterDate(record.createdAt)
  return `${record.primaryEmotion?.emoji ?? record.unknownPrompt?.emoji ?? '◌'} ${record.primaryEmotion?.emotion_name_vn ?? 'Mình còn đang mơ hồ'} · ${date}`
}

const ruleSummary = (rule: FutureLetterRule, emotionNames: Map<string, string>): string => {
  const comparatorText = ({ '>': 'nhiều hơn', '>=': 'ít nhất', '=': 'đúng', '<=': 'không quá', '<': 'ít hơn' } as Record<Comparator, string>)[rule.comparator ?? '>=']
  if (rule.type === 'random_date') return 'Mỗi ngày có 30% cơ hội một lá thư trở về'
  if (rule.type === 'specific_date') return rule.config.date ? `Mở từ ${formatFutureLetterDate(rule.config.date)} nếu mình chưa mở` : 'Chưa chọn ngày'
  if (rule.type === 'checkin_streak') return `Giữ nhịp Check-in ${comparatorText} ${rule.threshold ?? '—'} ngày liên tiếp`
  if (rule.type === 'diary_streak') return `Viết Diary ${comparatorText} ${rule.threshold ?? '—'} ngày liên tiếp`
  if (rule.type === 'emotion_frequency') return `${emotionNames.get(rule.config.emotionId ?? '') ?? 'Cảm xúc đã chọn'} xuất hiện ${comparatorText} ${rule.threshold ?? '—'} lần trong 30 ngày`
  const windowLabel = rule.config.mode === 'lifetime' ? 'từ trước đến nay' : rule.config.window === 'last_7_days' ? '7 ngày gần nhất' : '30 ngày gần nhất'
  return `Hoàn thành ${comparatorText} ${rule.threshold ?? '—'} lần trong ${windowLabel}`
}

const triggerEvidence = (event?: FutureLetterTriggerEvent): string => {
  if (!event) return 'Những điều đã chọn cho lá thư nay đã đủ đúng.'
  const values = event.observedValues
  if (event.triggerType === 'random_date') return 'Một ngày bất chợt đã đưa lá thư này trở về với mình.'
  if (event.triggerType === 'specific_date') return values.date ? `Ngày trở về đã đến: ${formatFutureLetterDate(String(values.date))}.` : 'Ngày trở về đã đến.'
  if (event.triggerType === 'checkin_streak') return `Mình đã giữ nhịp Check-in ${String(values.checkin_streak ?? values.value ?? '')} ngày liên tiếp.`
  if (event.triggerType === 'diary_streak') return `Mình đã viết Diary đều đặn trong ${String(values.diary_streak ?? values.value ?? '')} ngày liên tiếp.`
  if (event.triggerType === 'emotion_frequency') return `Một cảm xúc đã xuất hiện ${String(values.observed_count ?? values.value ?? '')} lần trong khoảng thời gian này.`
  return `Mình đã hoàn thành ${String(values.completed_actions ?? values.value ?? '')} bước trong khoảng thời gian đã chọn.`
}

function Envelope({ envelopeId, sealId, large = false, interactive = false, onClick }: { envelopeId?: string | null; sealId?: string | null; large?: boolean; interactive?: boolean; onClick?: () => void }) {
  const envelopeIndex = Math.max(0, ENVELOPE_ASSETS.findIndex((asset) => asset.id === envelopeId))
  const sealIndex = Math.max(0, SEAL_ASSETS.findIndex((asset) => asset.id === sealId))
  const content = <>
    <span className="future-envelope__paper" aria-hidden="true" />
    <span className="future-envelope__flap" aria-hidden="true" />
    <span className="future-envelope__fold future-envelope__fold--left" aria-hidden="true" />
    <span className="future-envelope__fold future-envelope__fold--right" aria-hidden="true" />
    <span className="future-envelope__seal" aria-hidden="true">S</span>
  </>
  const className = `future-envelope future-envelope--e${envelopeIndex} future-envelope--s${sealIndex} ${large ? 'future-envelope--large' : ''} ${interactive ? 'future-envelope--interactive' : ''}`
  return interactive ? <button type="button" className={className} aria-label="Mở lá thư" onClick={onClick}>{content}</button> : <div className={className}>{content}</div>
}

function FutureHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <header className="future-page-header"><div><p className="eyebrow">FutureMe / Future Letter</p><h1>{title}</h1><p>{description}</p></div>{action}</header>
}

function StateMessage({ message, error, onRetry }: { message: string; error?: boolean; onRetry?: () => void }) {
  return <div className={`future-state ${error ? 'future-state--error' : ''}`} role={error ? 'alert' : 'status'}><span aria-hidden="true">{error ? '!' : '✦'}</span><p>{message}</p>{onRetry && <button className="button button--secondary button--small" type="button" onClick={onRetry}>Thử lại</button>}</div>
}

function StageNav({ view, onNavigate }: { view: PageView; onNavigate: (view: PageView) => void }) {
  const stages: Array<{ view: PageView; label: string }> = [{ view: 'write', label: '1 · Viết' }, { view: 'trigger', label: '2 · Điều kiện' }, { view: 'decorate', label: '3 · Trang trí' }, { view: 'preview', label: '4 · Xem lại & Niêm phong' }]
  return <nav className="future-stage-nav" aria-label="Các bước viết thư">{stages.map((stage) => <button className={view === stage.view ? 'is-active' : undefined} key={stage.view} type="button" onClick={() => onNavigate(stage.view)}>{stage.label}</button>)}</nav>
}

function LibraryView({ letters, counts, onNew, onOpen }: { letters: FutureLetter[]; counts: { draft: number; waiting: number; available: number; opened: number; archived: number }; onNew: () => void; onOpen: (letter: FutureLetter) => void }) {
  const available = letters.filter((letter) => letter.state === 'available_unopened')
  const drafts = letters.filter((letter) => ['draft', 'writing', 'decorating', 'preview'].includes(letter.state))
  const waiting = letters.filter((letter) => letter.state === 'sealed_waiting')
  const opened = letters.filter((letter) => letter.state === 'opened').slice(0, 3)
  if (!letters.length) return <><FutureHeader title="Những điều mình gửi về sau" description="Viết từ hôm nay, để một phiên bản tương lai của mình gặp được những lời này." action={<button className="button button--primary" type="button" onClick={onNew}>＋ Viết thư mới</button>} /><section className="future-empty"><Envelope large /><div><p className="eyebrow">Viết → Trang trí → Xem lại → Niêm phong</p><h2>Chưa có lá thư nào ở đây</h2><p>Một lá thư không phải lời nhắc. Nó là một điều mình muốn gửi tới chính mình vào một thời điểm có ý nghĩa.</p><button className="button button--primary" type="button" onClick={onNew}>Viết lá thư đầu tiên</button></div></section><div className="future-ritual-steps"><RitualStep index="01" title="Viết" copy="Một điều thật lòng từ hiện tại." /><RitualStep index="02" title="Trang trí" copy="Chọn một phong bì và một dấu ấn." /><RitualStep index="03" title="Niêm phong" copy="Để nó trở lại khi điều kiện đủ đầy." /></div></>
  return <><FutureHeader title="Những điều mình gửi về sau" description="Một thư viện nhỏ cho những lời cần thêm thời gian để trở về." action={<button className="button button--primary" type="button" onClick={onNew}>＋ Viết thư mới</button>} /><div className="future-library-summary"><span><strong>{counts.available}</strong> đang chờ mở</span><span><strong>{counts.waiting}</strong> đang chờ ngày trở về</span><span><strong>{counts.draft}</strong> bản nháp</span><Link to="/future-letter?view=history">Lịch sử & lưu giữ →</Link></div>{available.length > 0 && <section className="future-available-hero"><div><p className="eyebrow">Đã trở về · Chưa mở</p><h2>Một lá thư đã trở về.</h2><p>{available[0].title || 'Có điều gì đó mình từng muốn nói.'}</p><button className="future-text-link" type="button" onClick={() => onOpen(available[0])}>Mở lá thư <span aria-hidden="true">→</span></button></div><Envelope envelopeId={available[0].envelopeAssetId} sealId={available[0].sealAssetId} large interactive onClick={() => onOpen(available[0])} /></section>}<LibrarySection title="Bản nháp" count={drafts.length} empty="Những lá thư chưa niêm phong sẽ nằm ở đây.">{drafts.map((letter) => <LetterRow key={letter.id} letter={letter} actionLabel="Tiếp tục viết" onClick={() => onOpen(letter)} />)}</LibrarySection><LibrarySection title="Đang chờ" count={waiting.length} empty="Những lá thư đã niêm phong sẽ chờ đến lúc thích hợp.">{waiting.map((letter) => <LetterRow key={letter.id} letter={letter} actionLabel="Xem thư" onClick={() => onOpen(letter)} />)}</LibrarySection><LibrarySection title="Mới mở gần đây" count={opened.length} empty="Những lá thư đã mở sẽ xuất hiện ở đây.">{opened.map((letter) => <LetterRow key={letter.id} letter={letter} actionLabel="Đọc lại" onClick={() => onOpen(letter)} />)}</LibrarySection></>
}

function RitualStep({ index, title, copy }: { index: string; title: string; copy: string }) { return <div className="future-ritual-step"><span>{index}</span><strong>{title}</strong><p>{copy}</p></div> }

function LibrarySection({ title, count, empty, children }: { title: string; count: number; empty: string; children: ReactNode }) {
  return <section className="future-library-section"><div className="future-section-heading"><div><p className="eyebrow">Future Letter</p><h2>{title}</h2></div><span>{count}</span></div>{count ? <div className="future-letter-list">{children}</div> : <p className="future-section-empty">{empty}</p>}</section>
}

function LetterRow({ letter, actionLabel, onClick }: { letter: FutureLetter; actionLabel: string; onClick: () => void }) {
  return <article className="future-letter-row"><Envelope envelopeId={letter.envelopeAssetId} sealId={letter.sealAssetId} /><div className="future-letter-row__copy"><div><span className={`future-state-pill future-state-pill--${letter.state}`}>{stateLabel(letter.state)}</span><time>{formatFutureLetterDate(letter.createdAt)}</time></div><h3>{letter.title || 'Chưa đặt tiêu đề'}</h3><p>{letter.state === 'sealed_waiting' ? letter.groups.flatMap((group) => group.rules).map((rule) => ruleSummary(rule, new Map())).join(' · ') : `${letter.openedCount} lần mở · ${letter.body.slice(0, 90)}${letter.body.length > 90 ? '…' : ''}`}</p></div><button className="button button--secondary button--small" type="button" onClick={onClick}>{actionLabel}</button></article>
}

function WriteView({ draft, checkins, onChange, onSave }: { draft: FutureLetterDraft; checkins: CheckinRecord[]; onChange: (next: FutureLetterDraft) => void; onSave: (view: PageView) => void }) {
  const { reference } = useReferenceData()
  const emotions = reference?.emotions ?? []
  const toggleAttachment = (attachmentType: 'emotion' | 'checkin', refId: string) => {
    const exists = draft.attachments.some((attachment) => attachment.attachmentType === attachmentType && attachment.refId === refId)
    if (exists) onChange({ ...draft, attachments: draft.attachments.filter((attachment) => !(attachment.attachmentType === attachmentType && attachment.refId === refId)) })
    else {
      const checkin = attachmentType === 'checkin' ? checkins.find((record) => record.id === refId) : null
      const emotion = attachmentType === 'emotion' ? emotions.find((item) => item.emotion_id === refId) : null
      const snapshot = checkin ? { id: checkin.id, created_at: checkin.createdAt, emoji: checkin.primaryEmotion?.emoji ?? checkin.unknownPrompt?.emoji ?? '◌', emotion_name_vn: checkin.primaryEmotion?.emotion_name_vn ?? 'Mình còn đang mơ hồ' } : emotion ? { emotion_id: emotion.emotion_id, emotion_name_vn: emotion.emotion_name_vn, emoji: emotion.emoji, color_hex: emotion.color_hex } : null
      onChange({ ...draft, attachments: [...draft.attachments, { id: '', attachmentType, refId, snapshot, position: draft.attachments.length + 1 }] })
    }
  }
  return <AuthoringShell view="write" onNavigate={onSave}><div className="future-writing-layout"><section className="future-writing-surface"><p className="eyebrow">Bước 1 · Viết thư</p><h2>Viết điều chỉ mình của tương lai cần đọc.</h2><p className="future-form-hint">Viết tự do, nhiều dòng. Không cần làm cho nó hoàn hảo.</p><label className="future-field"><span>Tiêu đề <small>Bắt buộc</small></span><input autoFocus value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} placeholder="Ví dụ: Gửi mình của những ngày bình tĩnh hơn" maxLength={140} /></label><label className="future-field"><span>Nội dung <small>Bắt buộc</small></span><textarea value={draft.body} onChange={(event) => onChange({ ...draft, body: event.target.value })} placeholder="Này, mình của sau này…" rows={15} /></label><div className="future-writing-footer"><span>{draft.body.length} ký tự</span><div><button className="button button--secondary" type="button" onClick={() => onSave('library')}>Lưu bản nháp</button><button className="button button--primary" type="button" onClick={() => onSave('trigger')}>Tiếp tục <span aria-hidden="true">→</span></button></div></div></section><aside className="future-summary-rail"><SummaryRail draft={draft} /><ContextAttachmentPanel draft={draft} checkins={checkins} emotions={emotions} onToggle={toggleAttachment} /></aside></div></AuthoringShell>
}

function AuthoringShell({ view, onNavigate, children }: { view: PageView; onNavigate: (view: PageView) => void; children: ReactNode }) { return <><div className="future-authoring-top"><Link className="future-back-link" to="/future-letter">← Thư viện</Link><StageNav view={view} onNavigate={onNavigate} /></div>{children}</> }

function SummaryRail({ draft }: { draft: FutureLetterDraft }) { return <div className="future-summary-rail__block"><p className="eyebrow">Bức thư</p><h3>{draft.title || 'Chưa đặt tiêu đề'}</h3><div className="future-summary-list"><span><b>✎</b> Nội dung <strong>{draft.body.trim() ? 'Đã viết' : 'Chưa viết'}</strong></span><span><b>◌</b> Điều kiện <strong>{draft.groups.reduce((total, group) => total + group.rules.length, 0)}</strong></span><span><b>⌂</b> Trang trí <strong>{draft.envelopeAssetId && draft.sealAssetId ? 'Đã chọn' : 'Chưa chọn'}</strong></span></div></div> }

function ContextAttachmentPanel({ draft, checkins, emotions, onToggle }: { draft: FutureLetterDraft; checkins: CheckinRecord[]; emotions: Array<{ emotion_id: string; emotion_name_vn: string; emoji: string }>; onToggle: (type: 'emotion' | 'checkin', id: string) => void }) {
  return <div className="future-summary-rail__block"><div className="future-block-heading"><span className="eyebrow">Ký ức đi cùng</span><small>Tùy chọn</small></div><p className="future-form-hint">Đính kèm một cảm xúc hoặc một ngày mình muốn nhớ. Điều này chỉ đi cùng lá thư.</p><div className="future-context-options">{emotions.slice(0, 8).map((emotion) => <button className={draft.attachments.some((item) => item.attachmentType === 'emotion' && item.refId === emotion.emotion_id) ? 'is-selected' : undefined} key={emotion.emotion_id} type="button" onClick={() => onToggle('emotion', emotion.emotion_id)}>{emotion.emoji} {emotion.emotion_name_vn}</button>)}{checkins.slice(0, 8).map((record) => <button className={draft.attachments.some((item) => item.attachmentType === 'checkin' && item.refId === record.id) ? 'is-selected' : undefined} key={record.id} type="button" onClick={() => onToggle('checkin', record.id)}>{contextLabel(record)}</button>)}</div></div>
}

function TriggerView({ draft, emotions, onChange, onSave }: { draft: FutureLetterDraft; emotions: Array<{ emotion_id: string; emotion_name_vn: string }>; onChange: (next: FutureLetterDraft) => void; onSave: (view: PageView) => void }) {
  const emotionNames = useMemo(() => new Map(emotions.map((emotion) => [emotion.emotion_id, emotion.emotion_name_vn])), [emotions])
  const updateGroup = (groupId: string, update: Partial<FutureLetterRuleGroup>) => onChange({ ...draft, groups: draft.groups.map((group) => group.id === groupId ? { ...group, ...update } : group) })
  const updateRule = (groupId: string, ruleId: string, update: Partial<FutureLetterRule> & { config?: FutureLetterRuleConfig }) => onChange({ ...draft, groups: draft.groups.map((group) => group.id === groupId ? { ...group, rules: group.rules.map((rule) => rule.id === ruleId ? { ...rule, ...update, config: update.config ? { ...rule.config, ...update.config } : rule.config } : rule) } : group) })
  const addRule = (type: FutureLetterRule['type']) => {
    const group = draft.groups[0]
    if (!group) return
    const rule = makeRule(type, group.id, group.rules.length + 1)
    updateGroup(group.id, { rules: [...group.rules, rule] })
  }
  const removeRule = (groupId: string, ruleId: string) => onChange({ ...draft, groups: draft.groups.map((group) => group.id === groupId ? { ...group, rules: group.rules.filter((rule) => rule.id !== ruleId) } : group) })
  const addGroup = () => { const id = `group-${Date.now()}`; onChange({ ...draft, groups: [...draft.groups, { id, operator: 'AND', position: draft.groups.length + 1, rules: [makeRule('checkin_streak', id, 1)] }] }) }
  return <AuthoringShell view="trigger" onNavigate={onSave}><div className="future-trigger-workspace"><div className="future-trigger-main"><div className="future-workspace-heading"><div><p className="eyebrow">Bước 2 · Điều kiện trở về</p><h2>Khi nào lá thư có lý do để trở về?</h2><p>Chọn những dấu mốc có ý nghĩa với mình. Khi đủ điều kiện, lá thư sẽ tìm về.</p></div><label className="future-inline-select"><span>Ghép các nhóm điều kiện</span><select aria-label="Cách ghép các nhóm điều kiện" value={draft.groupOperator} onChange={(event) => onChange({ ...draft, groupOperator: event.target.value as GroupOperator })}><option value="OR">Chỉ cần một nhóm đúng</option><option value="AND">Tất cả các nhóm đều đúng</option></select></label></div><div className="future-trigger-types"><span className="future-subheading">Thêm một điều kiện</span><div>{TRIGGER_OPTIONS.map((option) => <button key={option.type} type="button" onClick={() => addRule(option.type)}><b>{option.icon}</b><strong>{option.label}</strong><small>{option.description}</small></button>)}</div></div><div className="future-rule-groups">{draft.groups.map((group, groupIndex) => <section className="future-rule-group" key={group.id}><div className="future-rule-group__header"><div><span>Nhóm điều kiện {groupIndex + 1}</span><strong>{group.operator === 'AND' ? 'Tất cả điều này cần xảy ra' : 'Chỉ cần một trong những điều này xảy ra'}</strong></div><select aria-label={`Cách ghép của nhóm điều kiện ${groupIndex + 1}`} value={group.operator} onChange={(event) => updateGroup(group.id, { operator: event.target.value as GroupOperator })}><option value="AND">Tất cả điều này cần xảy ra</option><option value="OR">Chỉ cần một điều xảy ra</option></select></div>{group.rules.map((rule) => <RuleEditor key={rule.id || `${rule.type}-${rule.position}`} rule={rule} emotions={emotions} emotionNames={emotionNames} onChange={(update) => updateRule(group.id, rule.id, update)} onRemove={() => removeRule(group.id, rule.id)} />)}{!group.rules.length && <p className="future-section-empty">Nhóm này chưa có điều kiện.</p>}</section>)}</div><button className="future-add-group" type="button" onClick={addGroup}>＋ Thêm một nhóm điều kiện</button></div><aside className="future-trigger-aside"><SummaryRail draft={draft} /><div className="future-trigger-callout"><span>30%</span><div><strong>Một ngày bất chợt</strong><p>Mỗi ngày, một lá thư có thể trở về với xác suất 30%. Khi đó, chỉ một lá thư được chọn.</p></div></div></aside></div><div className="future-flow-footer"><button className="button button--secondary" type="button" onClick={() => onSave('write')}>← Quay lại</button><button className="button button--primary" type="button" onClick={() => onSave('decorate')}>Đến trang trí →</button></div></AuthoringShell>
}

function RuleEditor({ rule, emotions, emotionNames, onChange, onRemove }: { rule: FutureLetterRule; emotions: Array<{ emotion_id: string; emotion_name_vn: string }>; emotionNames: Map<string, string>; onChange: (update: Partial<FutureLetterRule> & { config?: FutureLetterRuleConfig }) => void; onRemove: () => void }) {
  return <div className="future-rule"><div className="future-rule__top"><span className="future-rule__icon">{TRIGGER_OPTIONS.find((option) => option.type === rule.type)?.icon}</span><div><strong>{triggerLabel(rule.type)}</strong><p>{ruleSummary(rule, emotionNames)}</p></div><button className="future-icon-button" type="button" aria-label="Xóa điều kiện" onClick={onRemove}>×</button></div>{rule.type === 'random_date' && <div className="future-rule__note"><b>Một ngày bất chợt</b><span>Mỗi ngày có 30% cơ hội để một lá thư trở về và chờ mình mở.</span></div>}{rule.type === 'specific_date' && <label className="future-control"><span>Ngày trở về</span><input type="date" value={rule.config.date ?? ''} onChange={(event) => onChange({ config: { date: event.target.value } })} /></label>}{(rule.type === 'checkin_streak' || rule.type === 'diary_streak') && <div className="future-rule-controls"><label className="future-control"><span>Điều kiện so sánh</span><select value={rule.comparator ?? '>='} onChange={(event) => onChange({ comparator: event.target.value as Comparator })}><ComparatorOptions /></select></label><label className="future-control"><span>Ngày liên tiếp</span><input type="number" min="0" value={rule.threshold ?? 0} onChange={(event) => onChange({ threshold: Number(event.target.value) })} /></label></div>}{rule.type === 'emotion_frequency' && <div className="future-rule-controls future-rule-controls--emotion"><label className="future-control"><span>Cảm xúc</span><select value={rule.config.emotionId ?? ''} onChange={(event) => onChange({ config: { emotionId: event.target.value } })}><option value="">Chọn cảm xúc</option>{emotions.map((emotion) => <option key={emotion.emotion_id} value={emotion.emotion_id}>{emotion.emotion_name_vn}</option>)}</select></label><label className="future-control"><span>Số lần xuất hiện</span><div className="future-control-pair"><select aria-label="Điều kiện so sánh số lần" value={rule.comparator ?? '>='} onChange={(event) => onChange({ comparator: event.target.value as Comparator })}><ComparatorOptions /></select><input type="number" min="0" value={rule.threshold ?? 0} onChange={(event) => onChange({ threshold: Number(event.target.value) })} /></div></label><label className="future-control"><span>Phạm vi</span><select value={rule.config.scope ?? 'primary'} onChange={(event) => onChange({ config: { scope: event.target.value as 'primary' | 'primary_secondary' } })}><option value="primary">Cảm xúc chính</option><option value="primary_secondary">Cảm xúc chính và phụ</option></select></label></div>}{rule.type === 'done_action' && <div className="future-rule-controls"><label className="future-control"><span>Cách tính</span><select value={rule.config.mode ?? 'window'} onChange={(event) => onChange({ config: { mode: event.target.value as 'lifetime' | 'window' } })}><option value="window">Trong một khoảng thời gian</option><option value="lifetime">Từ trước đến nay</option></select></label><label className="future-control"><span>Số lần hoàn thành</span><div className="future-control-pair"><select aria-label="Điều kiện so sánh số lần hoàn thành" value={rule.comparator ?? '>='} onChange={(event) => onChange({ comparator: event.target.value as Comparator })}><ComparatorOptions /></select><input type="number" min="0" value={rule.threshold ?? 0} onChange={(event) => onChange({ threshold: Number(event.target.value) })} /></div></label>{rule.config.mode !== 'lifetime' && <label className="future-control"><span>Khoảng thời gian</span><select value={rule.config.window ?? 'last_30_days'} onChange={(event) => onChange({ config: { window: event.target.value as 'last_7_days' | 'last_30_days' } })}><option value="last_7_days">7 ngày gần nhất</option><option value="last_30_days">30 ngày gần nhất</option></select></label>}</div>}</div>
}

function ComparatorOptions() { return <>{['>', '>=', '=', '<=', '<'].map((value) => <option key={value} value={value}>{value}</option>)}</> }

function DecorateView({ draft, onChange, onSave }: { draft: FutureLetterDraft; onChange: (next: FutureLetterDraft) => void; onSave: (view: PageView) => void }) {
  return <AuthoringShell view="decorate" onNavigate={onSave}><div className="future-decorate-workspace"><div className="future-decorate-main"><p className="eyebrow">Bước 3 · Trang trí</p><h2>Chọn cách lá thư sẽ được giữ lại.</h2><p className="future-form-hint">Chọn một phong bì và một dấu ấn để lá thư có cảm giác riêng của mình.</p><div className="future-asset-section"><div className="future-block-heading"><h3>Phong bì</h3><small>Chọn 1</small></div><div className="future-asset-grid">{ENVELOPE_ASSETS.map((asset) => <button className={draft.envelopeAssetId === asset.id ? 'is-selected' : undefined} key={asset.id} type="button" onClick={() => onChange({ ...draft, envelopeAssetId: asset.id })}><Envelope envelopeId={asset.id} sealId={draft.sealAssetId} /><strong>{asset.label}</strong><span>{asset.caption}</span></button>)}</div></div><div className="future-asset-section"><div className="future-block-heading"><h3>Dấu niêm phong</h3><small>Chọn 1</small></div><div className="future-seal-grid">{SEAL_ASSETS.map((asset) => <button className={draft.sealAssetId === asset.id ? 'is-selected' : undefined} key={asset.id} type="button" onClick={() => onChange({ ...draft, sealAssetId: asset.id })}><span className={`future-seal-mark future-seal-mark--${asset.id.replace('seal-', '')}`}>S</span><strong>{asset.label}</strong><span>{asset.caption}</span></button>)}</div></div></div><aside className="future-live-preview"><p className="eyebrow">Xem trước</p><Envelope envelopeId={draft.envelopeAssetId} sealId={draft.sealAssetId} large /><strong>{draft.title || 'Lá thư của mình'}</strong><span>Phong bì và dấu ấn sẽ đi cùng lá thư.</span></aside></div><div className="future-flow-footer"><button className="button button--secondary" type="button" onClick={() => onSave('trigger')}>← Điều kiện</button><button className="button button--primary" type="button" onClick={() => onSave('preview')}>Xem lại →</button></div></AuthoringShell>
}

function PreviewView({ draft, emotions, onSave, onSeal }: { draft: FutureLetterDraft; emotions: Array<{ emotion_id: string; emotion_name_vn: string }>; onSave: (view: PageView) => void; onSeal: () => void }) {
  const emotionNames = useMemo(() => new Map(emotions.map((emotion) => [emotion.emotion_id, emotion.emotion_name_vn])), [emotions])
  const rules = draft.groups.flatMap((group) => group.rules)
  const rulesReady = rules.length > 0 && rules.every((rule) => rule.type === 'random_date' || (rule.type === 'specific_date' ? Boolean(rule.config.date) : rule.comparator !== null && rule.threshold !== null && (rule.type !== 'emotion_frequency' || Boolean(rule.config.emotionId))))
  const canSeal = Boolean(draft.title.trim() && draft.body.trim() && rulesReady && draft.envelopeAssetId && draft.sealAssetId)
  return <AuthoringShell view="preview" onNavigate={onSave}><div className="future-preview-workspace"><article className="future-letter-preview"><div className="future-letter-preview__meta"><span>Xem lại lá thư</span><span>{getFutureLetterLocalDate()}</span></div><Envelope envelopeId={draft.envelopeAssetId} sealId={draft.sealAssetId} /><h2>{draft.title || 'Chưa đặt tiêu đề'}</h2><div className="future-letter-preview__body">{draft.body ? draft.body.split('\n').map((line, index) => <p key={`${line}-${index}`}>{line || '\u00a0'}</p>) : <p className="future-placeholder-copy">Nội dung lá thư sẽ xuất hiện ở đây.</p>}</div>{draft.attachments.length > 0 && <div className="future-preview-context"><span className="section-label">Ký ức đi cùng</span><div>{draft.attachments.map((attachment) => <span key={`${attachment.attachmentType}-${attachment.refId}`}>{attachment.snapshot?.emoji as string ?? '◌'} {attachment.snapshot?.emotion_name_vn as string ?? 'Ký ức đã đính kèm'}</span>)}</div></div>}</article><aside className="future-preview-aside"><div className="future-preview-card"><p className="eyebrow">Lá thư sẽ trở về khi...</p>{draft.groups.map((group) => <div className="future-preview-group" key={group.id}><span>{group.operator === 'AND' ? 'Tất cả điều này cần xảy ra' : 'Chỉ cần một trong những điều này xảy ra'}</span>{group.rules.map((rule) => <strong key={rule.id || rule.position}>{ruleSummary(rule, emotionNames)}</strong>)}</div>)}</div><div className="future-preview-card"><p className="eyebrow">Phong bì & dấu niêm phong</p><span className="future-preview-decoration"><b>Phong bì</b>{ENVELOPE_ASSETS.find((asset) => asset.id === draft.envelopeAssetId)?.label ?? 'Chưa chọn'}<b>Dấu ấn</b>{SEAL_ASSETS.find((asset) => asset.id === draft.sealAssetId)?.label ?? 'Chưa chọn'}</span><p>Khi bạn niêm phong, nội dung và những điều đã chọn sẽ được giữ nguyên cho ngày lá thư trở về.</p></div><button className="button button--primary future-seal-button" type="button" disabled={!canSeal} onClick={onSeal}>Niêm phong thư <span aria-hidden="true">✦</span></button>{!canSeal && <p className="future-validation-note">Cần có tiêu đề, nội dung, một điều kiện, phong bì và dấu niêm phong.</p>}</aside></div><div className="future-flow-footer"><button className="button button--secondary" type="button" onClick={() => onSave('decorate')}>← Trang trí</button><button className="button button--ghost" type="button" onClick={() => onSave('write')}>Chỉnh sửa nội dung</button></div></AuthoringShell>
}

function WaitingView({ letters, onOpen, onDelete, onArchive }: { letters: FutureLetter[]; onOpen: (letter: FutureLetter) => void; onDelete: (letter: FutureLetter) => void; onArchive: (letter: FutureLetter) => void }) {
  const waiting = letters.filter((letter) => letter.state === 'sealed_waiting')
  return <><FutureHeader title="Đang chờ ngày trở về" description="Những lá thư đã niêm phong, giữ nguyên nội dung và điều kiện từ lúc bạn gửi đi." action={<Link className="button button--secondary" to="/future-letter">← Thư viện</Link>} />{waiting.length ? <div className="future-waiting-grid">{waiting.map((letter) => <article className="future-waiting-card" key={letter.id}><Envelope envelopeId={letter.envelopeAssetId} sealId={letter.sealAssetId} large /><div><span className="future-state-pill future-state-pill--sealed_waiting">Đang chờ</span><h2>{letter.title}</h2><p>Đã viết {formatFutureLetterDate(letter.createdAt)}</p><ul>{letter.groups.flatMap((group) => group.rules).map((rule) => <li key={rule.id || rule.position}>{triggerLabel(rule.type)} · {ruleSummary(rule, new Map())}</li>)}</ul></div><div className="future-card-actions"><button className="button button--secondary button--small" type="button" onClick={() => onOpen(letter)}>Xem thư</button><button className="future-text-link" type="button" onClick={() => onArchive(letter)}>Lưu giữ</button><button className="future-danger-link" type="button" onClick={() => onDelete(letter)}>Xóa</button></div></article>)}</div> : <section className="future-section-empty future-section-empty--large">Chưa có lá thư nào đang chờ. Những thư đã niêm phong sẽ xuất hiện ở đây.</section>}</>
}

function AvailableView({ letters, onOpen }: { letters: FutureLetter[]; onOpen: (letter: FutureLetter) => void }) {
  const available = letters.filter((letter) => letter.state === 'available_unopened')
  return <><FutureHeader title="Một lá thư đã trở về" description="Chạm vào phong bì hoặc dấu ấn để mở lá thư khi bạn sẵn sàng." action={<Link className="button button--secondary" to="/future-letter">← Thư viện</Link>} />{available.length ? <div className="future-available-workspace"><div className="future-available-stage"><p className="eyebrow">Đã trở về · Chưa mở</p><Envelope envelopeId={available[0].envelopeAssetId} sealId={available[0].sealAssetId} large interactive onClick={() => onOpen(available[0])} /><h2>{available[0].title}</h2><p>Lá thư đã ở đây từ {formatFutureLetterDateTime(available[0].triggerEvents[0]?.availableSince ?? available[0].updatedAt)}.</p><button className="future-text-link" type="button" onClick={() => onOpen(available[0])}>Mở bằng phong bì <span aria-hidden="true">→</span></button></div><aside className="future-available-rail"><p className="eyebrow">Cũng đang chờ</p>{available.slice(1).map((letter) => <button key={letter.id} type="button" onClick={() => onOpen(letter)}><Envelope envelopeId={letter.envelopeAssetId} sealId={letter.sealAssetId} /><span><strong>{letter.title}</strong><small>{letter.triggerEvents[0]?.triggerType ? triggerLabel(letter.triggerEvents[0].triggerType) : 'Đã trở về'}</small></span></button>)}</aside></div> : <section className="future-section-empty future-section-empty--large">Hiện chưa có lá thư nào đang chờ mở. Bạn sẽ thấy nó ở đây khi một điều kiện đủ đúng.</section>}</>
}

function OpeningState({ letter, onFinish }: { letter: FutureLetter; onFinish: () => void }) {
  useEffect(() => { const timer = window.setTimeout(onFinish, 1250); return () => window.clearTimeout(timer) }, [onFinish])
  return <section className="future-opening-state" aria-live="polite"><div className="future-opening-state__backdrop" /><Envelope envelopeId={letter.envelopeAssetId} sealId={letter.sealAssetId} large /><p>Đang mở một điều mình từng gửi đi…</p><span className="future-opening-state__steps">phong bì · dấu ấn · trang giấy</span></section>
}

function SealingState() {
  return <section className="future-sealing-state" aria-live="polite"><div className="future-sealing-state__mark">✦</div><h2>Lá thư đã được niêm phong.</h2><p>Mình sẽ gặp lại những lời này khi thời điểm phù hợp đến.</p></section>
}

function ReadView({ letter, onArchive, onDelete, onClose }: { letter: FutureLetter; onArchive: () => void; onDelete: () => void; onClose: () => void }) {
  const trigger = letter.triggerEvents[0]
  return <><FutureHeader title="Gửi mình của một ngày khác" description="Một khoảng lặng từ hiện tại, được giữ lại để mình gặp vào lúc phù hợp." action={<button className="button button--secondary" type="button" onClick={onClose}>Đóng</button>} /><div className="future-read-layout"><article className="future-read-surface"><div className="future-read-meta"><span>Viết {formatFutureLetterDate(letter.createdAt)}</span><span>Đã mở {letter.openedCount} lần</span></div><Envelope envelopeId={letter.envelopeAssetId} sealId={letter.sealAssetId} /><h2>{letter.title}</h2><div className="future-read-body">{letter.body.split('\n').map((line, index) => <p key={`${line}-${index}`}>{line || '\u00a0'}</p>)}</div>{letter.attachments.length > 0 && <section className="future-read-section"><span className="section-label">Ký ức đi cùng</span><div className="future-read-chips">{letter.attachments.map((attachment) => <span key={`${attachment.attachmentType}-${attachment.refId}`}>{attachment.snapshot?.emoji as string ?? '◌'} {attachment.snapshot?.emotion_name_vn as string ?? 'Ký ức đã đính kèm'}</span>)}</div></section>}<div className="future-read-actions"><button className="button button--secondary" type="button" onClick={onArchive}>Lưu giữ lá thư</button><button className="future-danger-link" type="button" onClick={onDelete}>Xóa hoàn toàn</button></div></article><aside className="future-read-aside"><div className="future-read-evidence"><p className="eyebrow">Vì sao lá thư trở về</p><h3>{trigger ? triggerLabel(trigger.triggerType) : 'Một lần trở về'}</h3><p>{triggerEvidence(trigger)}</p>{trigger?.windowStart && <small>Khoảng thời gian: {formatFutureLetterDate(trigger.windowStart)} - {formatFutureLetterDate(trigger.windowEnd ?? trigger.windowStart)}</small>}</div><div className="future-read-evidence"><p className="eyebrow">Phong bì & dấu ấn</p><span>{letter.decorationSnapshot?.envelopeLabel ?? 'Phong bì'} · {letter.decorationSnapshot?.sealLabel ?? 'Dấu niêm phong'}</span><small>Được giữ lại từ {formatFutureLetterDate(letter.sealedAt ?? letter.createdAt)}.</small></div></aside></div></>
}

function HistoryView({ letters, selectedId, onSelect, onDelete, onArchive }: { letters: FutureLetter[]; selectedId: string | null; onSelect: (letter: FutureLetter) => void; onDelete: (letter: FutureLetter) => void; onArchive: (letter: FutureLetter) => void }) {
  const history = letters.filter((letter) => letter.state === 'opened' || letter.state === 'archived')
  const selected = history.find((letter) => letter.id === selectedId) ?? history[0]
  return <><FutureHeader title="Lịch sử & lưu giữ" description="Những lá thư đã đọc vẫn có thể trở lại. Những lá thư đã lưu giữ sẽ nằm yên ở đây." action={<Link className="button button--secondary" to="/future-letter">← Thư viện</Link>} /><div className="future-history-layout"><div className="future-history-list"><div className="future-history-tabs"><span>Đã mở / Lưu giữ</span><strong>{history.length}</strong></div>{history.map((letter) => <button className={selected?.id === letter.id ? 'is-selected' : undefined} key={letter.id} type="button" onClick={() => onSelect(letter)}><Envelope envelopeId={letter.envelopeAssetId} sealId={letter.sealAssetId} /><span><strong>{letter.title}</strong><small>{letter.state === 'archived' ? 'Đã lưu giữ' : `Đã mở ${letter.openedCount} lần`}</small></span></button>)}{!history.length && <p className="future-section-empty">Chưa có lịch sử để xem.</p>}</div>{selected ? <article className="future-history-detail"><div className="future-history-detail__head"><span className={`future-state-pill future-state-pill--${selected.state}`}>{stateLabel(selected.state)}</span><time>{formatFutureLetterDate(selected.createdAt)}</time></div><h2>{selected.title}</h2><p>{selected.body}</p><div className="future-history-detail__footer"><span>Đã mở {selected.openedCount} lần · lần cuối {selected.lastOpenedAt ? formatFutureLetterDateTime(selected.lastOpenedAt) : 'chưa mở'}</span><div>{selected.state !== 'archived' && <button className="button button--secondary button--small" type="button" onClick={() => onArchive(selected)}>Lưu giữ</button>}<button className="future-danger-link" type="button" onClick={() => onDelete(selected)}>Xóa</button></div></div></article> : <div className="future-history-detail future-history-detail--empty">Chọn một lá thư để xem lại.</div>}</div></>
}

export function FutureLetterPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const view = getView(searchParams.get('view'))
  const letterId = searchParams.get('letter')
  const [letters, setLetters] = useState<FutureLetter[]>([])
  const [counts, setCounts] = useState({ draft: 0, waiting: 0, available: 0, opened: 0, archived: 0 })
  const [draft, setDraft] = useState<FutureLetterDraft | null>(null)
  const [checkins, setCheckins] = useState<CheckinRecord[]>([])
  const [emotions, setEmotions] = useState<Array<{ emotion_id: string; emotion_name_vn: string; emoji: string; color_hex?: string }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [isSealing, setIsSealing] = useState(false)
  const draftSaveTimerRef = useRef<number | null>(null)
  const pendingDraftRef = useRef<FutureLetterDraft | null>(null)
  const draftSaveInFlightRef = useRef(false)
  const draftRevisionRef = useRef(0)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const [library, context] = await Promise.all([getFutureLetterLibrary(), getContextOptions()])
      setLetters(library.letters)
      setCounts(library.counts)
      setCheckins(context.checkins)
      setEmotions(context.emotions)
      setError(null)
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'Không thể tải FutureMe.') } finally { setIsLoading(false) }
  }, [])

  useEffect(() => { void Promise.resolve().then(() => refresh()) }, [refresh])
  useEffect(() => {
    if (!isSealing) return
    const timer = window.setTimeout(() => setIsSealing(false), 950)
    return () => window.clearTimeout(timer)
  }, [isSealing])

  const flushDraftSave = async () => {
    if (draftSaveInFlightRef.current) return
    const nextDraft = pendingDraftRef.current
    if (!nextDraft?.title.trim() || !nextDraft.body.trim()) return
    pendingDraftRef.current = null
    draftSaveInFlightRef.current = true
    const revision = draftRevisionRef.current
    try {
      const saved = await saveFutureLetterDraft(nextDraft)
      setLetters((current) => [saved, ...current.filter((letter) => letter.id !== saved.id)].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)))
      if (revision === draftRevisionRef.current) setDraft((current) => current ? cloneDraft(saved) : current)
    } catch (reason: unknown) {
      if (revision === draftRevisionRef.current) setError(reason instanceof Error ? reason.message : 'Chưa lưu được bản nháp — nội dung vẫn còn ở đây.')
    } finally {
      draftSaveInFlightRef.current = false
      if (pendingDraftRef.current) void flushDraftSave()
    }
  }

  const queueDraftSave = (nextDraft: FutureLetterDraft, immediate = false) => {
    pendingDraftRef.current = nextDraft
    if (draftSaveTimerRef.current !== null) window.clearTimeout(draftSaveTimerRef.current)
    if (immediate) { void flushDraftSave(); return }
    draftSaveTimerRef.current = window.setTimeout(() => {
      draftSaveTimerRef.current = null
      void flushDraftSave()
    }, 650)
  }

  const updateDraft = (nextDraft: FutureLetterDraft) => {
    draftRevisionRef.current += 1
    setDraft(nextDraft)
    setIsSealing(false)
    queueDraftSave(nextDraft)
  }

  const selectedLetter = letterId ? letters.find((letter) => letter.id === letterId) ?? null : null
  const setView = (nextView: PageView, id?: string) => {
    const next = new URLSearchParams(searchParams)
    if (nextView === 'library') { next.delete('view'); next.delete('letter') } else next.set('view', nextView)
    if (id) next.set('letter', id)
    else if (nextView !== 'read') next.delete('letter')
    setSearchParams(next)
  }

  const startNew = () => {
    const nextDraft = createEmptyFutureLetterDraft()
    draftRevisionRef.current += 1
    pendingDraftRef.current = null
    setDraft(nextDraft)
    setIsSealing(false)
    setView('write')
  }
  const openLetter = (letter: FutureLetter) => {
    if (['draft', 'writing', 'decorating', 'preview'].includes(letter.state)) {
      const nextDraft = cloneDraft(letter)
      draftRevisionRef.current += 1
      pendingDraftRef.current = null
      setDraft(nextDraft)
      const editView: PageView = letter.state === 'decorating' ? 'decorate' : letter.state === 'preview' ? 'preview' : 'write'
      setView(editView)
      return
    }
    if (letter.state === 'available_unopened') { setView('available'); return }
    setView('read', letter.id)
  }
  const startOpening = (letter: FutureLetter) => { setOpeningId(letter.id); setView('read', letter.id) }
  const saveAt = (nextView: PageView) => {
    if (!draft) return
    if (nextView !== 'library' && (view === 'write' || nextView === 'trigger') && (!draft.title.trim() || !draft.body.trim())) { setError('Hãy thêm tiêu đề và nội dung trước khi đi tiếp.'); return }
    const nextDraft = { ...draft, state: nextView === 'write' || nextView === 'trigger' ? 'writing' : nextView === 'decorate' ? 'decorating' : nextView === 'preview' ? 'preview' : draft.state }
    draftRevisionRef.current += 1
    pendingDraftRef.current = nextDraft
    queueDraftSave(nextDraft, true)
    setError(null)
    if (nextView === 'library') { setDraft(null); setView('library') }
    else setView(nextView, nextDraft.id)
  }
  const seal = async () => {
    if (!draft) return
    pendingDraftRef.current = draft
    await flushDraftSave()
    try {
      const saved = await sealFutureLetter(draft)
      setDraft(null)
      setLetters((current) => [saved, ...current.filter((letter) => letter.id !== saved.id)])
      setIsSealing(true)
      setView('waiting', saved.id)
      setError(null)
      void refresh()
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'Không thể niêm phong lá thư.') }
  }
  const finishOpening = () => {
    if (!openingId || !selectedLetter) return
    const now = new Date().toISOString()
    const localOpened: FutureLetter = { ...selectedLetter, state: 'opened', openedCount: selectedLetter.openedCount + 1, firstOpenedAt: selectedLetter.firstOpenedAt ?? now, lastOpenedAt: now, updatedAt: now, triggerEvents: selectedLetter.triggerEvents.map((event, index) => index === 0 && !event.openedAt ? { ...event, openedAt: now } : event) }
    setLetters((current) => current.map((letter) => letter.id === localOpened.id ? localOpened : letter))
    setOpeningId(null)
    setError(null)
    void openFutureLetter(openingId).then((opened) => { setLetters((current) => current.map((letter) => letter.id === opened.id ? opened : letter)); void refresh() }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Chưa đồng bộ được trạng thái đã mở; nội dung vẫn hiển thị.'))
  }
  const remove = async (letter: FutureLetter) => { if (!window.confirm(`Xóa vĩnh viễn “${letter.title}”?`)) return; await deleteFutureLetter(letter.id); await refresh(); setView('library') }
  const archive = async (letter: FutureLetter) => { await archiveFutureLetter(letter.id); await refresh(); setView('history', letter.id) }

  if (isLoading) return <section className="future-page"><StateMessage message="Đang mở thư viện FutureMe…" /></section>
  if (error && !letters.length && view === 'library') return <section className="future-page"><StateMessage error message={error} onRetry={() => void refresh()} /></section>

  let content: ReactNode
  if (view === 'write' && draft) content = <WriteView draft={draft} checkins={checkins} onChange={updateDraft} onSave={(next) => saveAt(next)} />
  else if (view === 'trigger' && draft) content = <TriggerView draft={draft} emotions={emotions} onChange={updateDraft} onSave={(next) => saveAt(next)} />
  else if (view === 'decorate' && draft) content = <DecorateView draft={draft} onChange={updateDraft} onSave={(next) => saveAt(next)} />
  else if (view === 'preview' && draft) content = <PreviewView draft={draft} emotions={emotions} onSave={(next) => void saveAt(next)} onSeal={() => void seal()} />
  else if (view === 'waiting') content = isSealing ? <SealingState /> : <WaitingView letters={letters} onOpen={openLetter} onDelete={(letter) => void remove(letter)} onArchive={(letter) => void archive(letter)} />
  else if (view === 'available') content = <AvailableView letters={letters} onOpen={startOpening} />
  else if (view === 'read' && selectedLetter) content = openingId ? <OpeningState letter={selectedLetter} onFinish={() => void finishOpening()} /> : <ReadView letter={selectedLetter} onArchive={() => void archive(selectedLetter)} onDelete={() => void remove(selectedLetter)} onClose={() => setView('library')} />
  else if (view === 'history') content = <HistoryView letters={letters} selectedId={letterId} onSelect={(letter) => setView('history', letter.id)} onDelete={(letter) => void remove(letter)} onArchive={(letter) => void archive(letter)} />
  else content = <LibraryView letters={letters} counts={counts} onNew={startNew} onOpen={openLetter} />
  return <section className={`future-page future-page--${view}`}>{error && <div className="future-inline-error" role="alert">{error}<button type="button" onClick={() => setError(null)}>×</button></div>}{content}</section>
}
