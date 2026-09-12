import { Fragment, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { FutureLetterDraft, FutureLetterRule, FutureLetterRuleConfig, GroupOperator, Comparator } from './types'
import { getFutureLetterLocalDate } from './utils'

type EmotionOption = { emotion_id: string; emotion_name_vn: string; emoji?: string }
type CategoryId = 'time' | 'checkin' | 'diary' | 'emotion' | 'random' | 'other'
type Category = { id: CategoryId; label: string; description: string; icon: string; types: FutureLetterRule['type'][] }

const CATEGORIES: Category[] = [
  { id: 'time', label: 'Thời gian', description: 'Khoảng chờ, ngày cụ thể, lịch đặc biệt', icon: '◷', types: ['minimum_wait', 'specific_date', 'time_window'] },
  { id: 'checkin', label: 'Check-in', description: 'Chuỗi, tổng số, tần suất, quay lại', icon: '◉', types: ['checkin_streak', 'checkin_total', 'checkin_frequency', 'checkin_return_after_inactivity'] },
  { id: 'diary', label: 'Diary & Journey', description: 'Chuỗi Diary, tổng Diary, tổng Journey', icon: '▤', types: ['diary_streak', 'diary_total', 'journey_total'] },
  { id: 'emotion', label: 'Cảm xúc', description: 'Xuất hiện, số lần, cửa sổ, vắng mặt', icon: '♡', types: ['emotion_condition', 'emotion_frequency'] },
  { id: 'random', label: 'Bất chợt', description: 'Xác suất theo ngày hoặc theo cửa sổ', icon: '✦', types: ['random_condition', 'random_date'] },
  { id: 'other', label: 'Khác', description: 'Giữ lại các điều kiện đã có và loại tương lai', icon: '＋', types: ['done_action'] },
]

const LABELS: Record<FutureLetterRule['type'], string> = {
  random_date: 'Một ngày bất chợt', random_condition: 'Xác suất bất chợt', specific_date: 'Một ngày cụ thể', minimum_wait: 'Khoảng chờ tối thiểu', time_window: 'Lịch thời gian đặc biệt',
  checkin_streak: 'Chuỗi Check-in', checkin_total: 'Tổng Check-in', checkin_frequency: 'Tần suất Check-in', checkin_return_after_inactivity: 'Quay lại sau một khoảng nghỉ',
  diary_streak: 'Chuỗi Diary', diary_total: 'Tổng Diary', journey_total: 'Tổng Journey', emotion_frequency: 'Cảm xúc lặp lại', emotion_condition: 'Điều kiện cảm xúc', done_action: 'Đã làm đủ Action',
}

const ICONS: Record<FutureLetterRule['type'], string> = {
  random_date: '✦', random_condition: '✧', specific_date: '◷', minimum_wait: '⌛', time_window: '▦', checkin_streak: '◉', checkin_total: '◌', checkin_frequency: '≋', checkin_return_after_inactivity: '↩', diary_streak: '▤', diary_total: '▥', journey_total: '⌁', emotion_frequency: '◌', emotion_condition: '♡', done_action: '↳',
}

const createId = (): string => `future-condition-${Date.now()}-${Math.random().toString(16).slice(2)}`

const defaultConfig = (type: FutureLetterRule['type']): { comparator: Comparator | null; threshold: number | null; config: FutureLetterRuleConfig } => {
  if (type === 'random_date') return { comparator: null, threshold: null, config: { dailyChance: .3 } }
  if (type === 'random_condition') return { comparator: null, threshold: null, config: { probability: .2, evaluationPeriod: 'daily', randomMode: 'after_prerequisites' } }
  if (type === 'specific_date') return { comparator: null, threshold: null, config: { date: getFutureLetterLocalDate() } }
  if (type === 'minimum_wait') return { comparator: '>=', threshold: 30, config: { amount: 30, unit: 'day', anchor: 'letter_sent_at' } }
  if (type === 'time_window') return { comparator: '>=', threshold: 1, config: { timeWindowMode: 'date_range', startDate: getFutureLetterLocalDate(), endDate: getFutureLetterLocalDate() } }
  if (type === 'checkin_frequency') return { comparator: '>=', threshold: 4, config: { metric: 'frequency', minimumOccurrences: 4, period: 'week', periodCount: 4 } }
  if (type === 'checkin_return_after_inactivity') return { comparator: '>=', threshold: 1, config: { metric: 'return_after_inactivity', inactiveDays: 30 } }
  if (type === 'checkin_total') return { comparator: '>=', threshold: 100, config: { metric: 'total' } }
  if (type === 'diary_total' || type === 'journey_total') return { comparator: '>=', threshold: type === 'diary_total' ? 20 : 3, config: { metric: 'total' } }
  if (type === 'emotion_condition') return { comparator: null, threshold: null, config: { emotionOperator: 'exists', windowType: 'since_sent', scope: 'primary' } }
  if (type === 'emotion_frequency') return { comparator: '>=', threshold: 3, config: { scope: 'primary' } }
  if (type === 'done_action') return { comparator: '>=', threshold: 5, config: { mode: 'window', window: 'last_30_days' } }
  return { comparator: '>=', threshold: 7, config: {} }
}

const createRule = (type: FutureLetterRule['type'], groupId: string, position: number): FutureLetterRule => {
  const selected = defaultConfig(type)
  return { id: '', groupId, type, comparator: selected.comparator, threshold: selected.threshold, config: selected.config, position }
}

const comparatorOptions = ['>', '>=', '=', '<=', '<'] as const

function EmotionCombobox({ emotions, value, onChange }: { emotions: EmotionOption[]; value: string; onChange: (value: string) => void }) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listboxId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 280, maxHeight: 320 })
  const selectedEmotion = emotions.find((emotion) => emotion.emotion_id === value)
  const normalizedQuery = query.trim().toLocaleLowerCase('vi-VN')
  const filteredEmotions = emotions.filter((emotion) => `${emotion.emoji ?? ''} ${emotion.emotion_name_vn} ${emotion.emotion_id}`.toLocaleLowerCase('vi-VN').includes(normalizedQuery))
  const safeActiveIndex = Math.min(activeIndex, filteredEmotions.length)

  useEffect(() => {
    if (!isOpen) return
    const updatePosition = () => {
      const trigger = triggerRef.current
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const width = Math.min(360, Math.max(rect.width, Math.min(320, Math.max(0, viewportWidth - 24))))
      const maxHeight = Math.min(320, Math.max(140, viewportHeight - 24))
      const opensUp = rect.bottom + maxHeight + 8 > viewportHeight && rect.top > maxHeight + 8
      const top = opensUp ? Math.max(12, rect.top - maxHeight - 8) : Math.min(Math.max(12, viewportHeight - maxHeight - 12), rect.bottom + 8)
      const left = Math.min(Math.max(12, rect.left), Math.max(12, viewportWidth - width - 12))
      setPosition({ top, left, width, maxHeight })
    }
    updatePosition()
    const focusSearch = window.setTimeout(() => searchRef.current?.focus(), 0)
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setIsOpen(false)
      }
    }
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => {
      window.clearTimeout(focusSearch)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      document.removeEventListener('pointerdown', handlePointerDown, true)
    }
  }, [isOpen])

  const closeMenu = () => {
    setIsOpen(false)
    setQuery('')
    setActiveIndex(0)
  }
  const openMenu = () => {
    const selectedIndex = value ? emotions.findIndex((emotion) => emotion.emotion_id === value) : -1
    setActiveIndex(selectedIndex >= 0 ? selectedIndex + 1 : 0)
    setIsOpen(true)
  }
  const selectEmotion = (emotionId: string) => {
    onChange(emotionId)
    closeMenu()
    triggerRef.current?.focus()
  }
  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault()
      if (!isOpen) openMenu()
    }
    if (event.key === 'Escape' && isOpen) {
      event.preventDefault()
      closeMenu()
    }
  }
  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, filteredEmotions.length))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setActiveIndex(filteredEmotions.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const emotion = safeActiveIndex === 0 ? undefined : filteredEmotions[safeActiveIndex - 1]
      selectEmotion(emotion?.emotion_id ?? '')
    } else if (event.key === 'Escape') {
      event.preventDefault()
      closeMenu()
      triggerRef.current?.focus()
    }
  }

  const menu = isOpen && typeof document !== 'undefined' ? createPortal(
    <div className="future-emotion-combobox__menu" ref={menuRef} role="dialog" aria-label="Chọn cảm xúc" style={{ top: position.top, left: position.left, width: position.width, maxHeight: position.maxHeight }}>
      <input ref={searchRef} className="future-emotion-combobox__search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={handleSearchKeyDown} placeholder="Tìm theo tên hoặc emoji..." aria-label="Tìm cảm xúc" autoComplete="off" />
      <div className="future-emotion-combobox__options" id={listboxId} role="listbox" aria-label="Danh sách cảm xúc">
        <button className={safeActiveIndex === 0 ? 'is-active' : undefined} type="button" role="option" aria-selected={!value} onMouseEnter={() => setActiveIndex(0)} onClick={() => selectEmotion('')}>Chọn cảm xúc</button>
        {filteredEmotions.map((emotion, index) => <button className={`${safeActiveIndex === index + 1 ? 'is-active ' : ''}${value === emotion.emotion_id ? 'is-selected' : ''}`} type="button" role="option" aria-selected={value === emotion.emotion_id} key={emotion.emotion_id} onMouseEnter={() => setActiveIndex(index + 1)} onClick={() => selectEmotion(emotion.emotion_id)}>{emotion.emoji ?? '◌'} {emotion.emotion_name_vn}</button>)}
        {!filteredEmotions.length && <p className="future-emotion-combobox__empty">Không tìm thấy cảm xúc.</p>}
      </div>
    </div>,
    document.body,
  ) : null

  return <div className="future-emotion-combobox"><button ref={triggerRef} className="future-emotion-combobox__trigger" type="button" aria-haspopup="listbox" aria-expanded={isOpen} aria-controls={listboxId} onClick={() => (isOpen ? closeMenu() : openMenu())} onKeyDown={handleTriggerKeyDown}><span>{selectedEmotion ? `${selectedEmotion.emoji ?? '◌'} ${selectedEmotion.emotion_name_vn}` : 'Chọn cảm xúc'}</span><span aria-hidden="true">⌄</span></button>{menu}</div>
}

function NumericRuleFields({ rule, onChange, label = 'Giá trị' }: { rule: FutureLetterRule; onChange: (update: Partial<FutureLetterRule> & { config?: FutureLetterRuleConfig }) => void; label?: string }) {
  return <div className="future-condition-form__grid"><label className="future-control"><span>So sánh</span><select value={rule.comparator ?? '>='} onChange={(event) => onChange({ comparator: event.target.value as Comparator })}>{comparatorOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label className="future-control"><span>{label}</span><input type="number" min="1" value={rule.threshold ?? 1} onChange={(event) => onChange({ threshold: Number(event.target.value) })} /></label></div>
}

function RuleForm({ rule, emotions, onChange }: { rule: FutureLetterRule; emotions: EmotionOption[]; onChange: (update: Partial<FutureLetterRule> & { config?: FutureLetterRuleConfig }) => void }) {
  const config = rule.config
  const patchConfig = (update: FutureLetterRuleConfig) => onChange({ config: update })
  if (rule.type === 'minimum_wait') return <div className="future-condition-form__grid"><label className="future-control"><span>Khoảng chờ</span><input type="number" min="1" value={config.amount ?? 30} onChange={(event) => patchConfig({ amount: Number(event.target.value) })} /></label><label className="future-control"><span>Đơn vị</span><select value={config.unit ?? 'day'} onChange={(event) => patchConfig({ unit: event.target.value as FutureLetterRuleConfig['unit'] })}><option value="day">Ngày</option><option value="week">Tuần</option><option value="month">Tháng</option><option value="year">Năm</option></select></label><label className="future-control"><span>Tính từ</span><select value={config.anchor ?? 'letter_sent_at'} disabled><option value="letter_sent_at">Ngày gửi thư</option></select></label></div>
  if (rule.type === 'specific_date') return <label className="future-control"><span>Ngày lá thư có thể trở về</span><input type="date" value={config.date ?? ''} onChange={(event) => patchConfig({ date: event.target.value })} /></label>
  if (rule.type === 'time_window') return <div className="future-condition-form__stack"><label className="future-control"><span>Kiểu lịch</span><select value={config.timeWindowMode ?? 'date_range'} onChange={(event) => patchConfig({ timeWindowMode: event.target.value as FutureLetterRuleConfig['timeWindowMode'] })}><option value="day_of_month">Một ngày trong tháng</option><option value="month">Một tháng cụ thể</option><option value="weekday">Một ngày trong tuần</option><option value="date_range">Một khoảng ngày</option></select></label>{config.timeWindowMode === 'day_of_month' && <label className="future-control"><span>Ngày trong tháng</span><input type="number" min="1" max="31" value={config.dayOfMonth ?? 30} onChange={(event) => patchConfig({ dayOfMonth: Number(event.target.value) })} /></label>}{config.timeWindowMode === 'month' && <label className="future-control"><span>Tháng</span><select value={config.month ?? 12} onChange={(event) => patchConfig({ month: Number(event.target.value) })}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>Tháng {index + 1}</option>)}</select></label>}{config.timeWindowMode === 'weekday' && <label className="future-control"><span>Ngày trong tuần</span><select value={config.weekday ?? 1} onChange={(event) => patchConfig({ weekday: Number(event.target.value) })}>{['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'].map((label, index) => <option key={label} value={index}>{label}</option>)}</select></label>}{config.timeWindowMode === 'date_range' && <div className="future-condition-form__grid"><label className="future-control"><span>Từ ngày</span><input type="date" value={config.startDate ?? ''} onChange={(event) => patchConfig({ startDate: event.target.value })} /></label><label className="future-control"><span>Đến ngày</span><input type="date" value={config.endDate ?? ''} onChange={(event) => patchConfig({ endDate: event.target.value })} /></label></div>}</div>
  if (rule.type === 'checkin_frequency') return <div className="future-condition-form__grid"><label className="future-control"><span>Số ngày tối thiểu</span><input type="number" min="1" value={config.minimumOccurrences ?? 4} onChange={(event) => onChange({ threshold: Number(event.target.value), config: { minimumOccurrences: Number(event.target.value) } })} /></label><label className="future-control"><span>Đơn vị</span><select value={config.period ?? 'week'} onChange={(event) => patchConfig({ period: event.target.value as FutureLetterRuleConfig['period'] })}><option value="week">mỗi tuần</option><option value="month">mỗi tháng</option><option value="day">mỗi ngày</option></select></label><label className="future-control"><span>Số chu kỳ</span><input type="number" min="1" value={config.periodCount ?? 4} onChange={(event) => patchConfig({ periodCount: Number(event.target.value) })} /></label></div>
  if (rule.type === 'checkin_return_after_inactivity') return <label className="future-control"><span>Không Check-in ít nhất</span><input type="number" min="1" value={config.inactiveDays ?? 30} onChange={(event) => patchConfig({ inactiveDays: Number(event.target.value) })} /></label>
  if (rule.type === 'checkin_streak' || rule.type === 'checkin_total' || rule.type === 'diary_streak' || rule.type === 'diary_total' || rule.type === 'journey_total') return <NumericRuleFields rule={rule} onChange={onChange} label={rule.type.includes('streak') ? 'Ngày liên tiếp' : 'Số lượng'} />
  if (rule.type === 'emotion_frequency') return <div className="future-condition-form__grid"><label className="future-control"><span>Cảm xúc</span><EmotionCombobox emotions={emotions} value={config.emotionId ?? ''} onChange={(emotionId) => patchConfig({ emotionId })} /></label><NumericRuleFields rule={rule} onChange={onChange} label="Số lần" /><label className="future-control"><span>Phạm vi</span><select value={config.scope ?? 'primary'} onChange={(event) => patchConfig({ scope: event.target.value as FutureLetterRuleConfig['scope'] })}><option value="primary">Cảm xúc chính</option><option value="primary_secondary">Cảm xúc chính và phụ</option></select></label></div>
  if (rule.type === 'emotion_condition') return <div className="future-condition-form__stack"><div className="future-condition-form__grid"><label className="future-control"><span>Cảm xúc</span><EmotionCombobox emotions={emotions} value={config.emotionId ?? ''} onChange={(emotionId) => patchConfig({ emotionId })} /></label><label className="future-control"><span>Điều kiện</span><select value={config.emotionOperator ?? 'exists'} onChange={(event) => patchConfig({ emotionOperator: event.target.value as FutureLetterRuleConfig['emotionOperator'] })}><option value="exists">Xuất hiện</option><option value="count_gte">Xuất hiện ít nhất</option><option value="absent">Không xuất hiện</option></select></label>{config.emotionOperator === 'count_gte' && <label className="future-control"><span>Số lần</span><input type="number" min="1" value={config.count ?? 5} onChange={(event) => patchConfig({ count: Number(event.target.value) })} /></label>}</div><div className="future-condition-form__grid"><label className="future-control"><span>Cửa sổ thời gian</span><select value={config.windowType ?? 'since_sent'} onChange={(event) => patchConfig({ windowType: event.target.value as FutureLetterRuleConfig['windowType'] })}><option value="since_sent">Từ khi gửi</option><option value="last_days">X ngày gần nhất</option><option value="consecutive_days">X ngày liên tiếp</option><option value="custom_range">Khoảng tùy chọn</option></select></label>{(config.windowType === 'last_days' || config.windowType === 'consecutive_days') && <label className="future-control"><span>Số ngày</span><input type="number" min="1" value={config.windowValue ?? 30} onChange={(event) => patchConfig({ windowValue: Number(event.target.value) })} /></label>}{config.windowType === 'custom_range' && <><label className="future-control"><span>Từ ngày</span><input type="date" value={config.customWindowStart ?? ''} onChange={(event) => patchConfig({ customWindowStart: event.target.value })} /></label><label className="future-control"><span>Đến ngày</span><input type="date" value={config.customWindowEnd ?? ''} onChange={(event) => patchConfig({ customWindowEnd: event.target.value })} /></label></>}</div></div>
  if (rule.type === 'random_condition') return <div className="future-condition-form__grid"><label className="future-control"><span>Xác suất mỗi lần kiểm tra (%)</span><input type="number" min="1" max="100" value={Math.round((config.probability ?? .2) * 100)} onChange={(event) => patchConfig({ probability: Number(event.target.value) / 100 })} /></label><label className="future-control"><span>Tần suất kiểm tra</span><select value={config.evaluationPeriod ?? 'daily'} onChange={(event) => patchConfig({ evaluationPeriod: event.target.value as FutureLetterRuleConfig['evaluationPeriod'] })}><option value="daily">Mỗi ngày</option><option value="weekly">Mỗi tuần</option></select></label><label className="future-control"><span>Bắt đầu khi</span><select value={config.randomMode ?? 'after_prerequisites'} onChange={(event) => patchConfig({ randomMode: event.target.value as FutureLetterRuleConfig['randomMode'] })}><option value="always">Luôn có thể xảy ra</option><option value="after_prerequisites">Đủ các điều kiện khác</option><option value="window">Trong cửa sổ thời gian</option></select></label>{config.randomMode === 'window' && <><label className="future-control"><span>Từ ngày</span><input type="date" value={config.windowStart ?? ''} onChange={(event) => patchConfig({ windowStart: event.target.value })} /></label><label className="future-control"><span>Đến ngày</span><input type="date" value={config.windowEnd ?? ''} onChange={(event) => patchConfig({ windowEnd: event.target.value })} /></label></>}</div>
  if (rule.type === 'random_date') return <div className="future-condition-form__grid"><label className="future-control"><span>Xác suất mỗi ngày (%)</span><input type="number" min="1" max="100" value={Math.round((config.dailyChance ?? .3) * 100)} onChange={(event) => patchConfig({ dailyChance: Number(event.target.value) / 100 })} /></label><p className="future-condition-form__hint">Một lần kiểm tra mỗi ngày. Nếu có nhiều thư cùng đủ điều kiện, hệ thống sẽ chọn một lá thư.</p></div>
  return <div className="future-condition-form__grid"><label className="future-control"><span>Cách tính</span><select value={config.mode ?? 'window'} onChange={(event) => patchConfig({ mode: event.target.value as FutureLetterRuleConfig['mode'] })}><option value="window">Trong một khoảng thời gian</option><option value="lifetime">Từ trước đến nay</option></select></label><NumericRuleFields rule={rule} onChange={onChange} label="Số lần hoàn thành" />{config.mode !== 'lifetime' && <label className="future-control"><span>Khoảng thời gian</span><select value={config.window ?? 'last_30_days'} onChange={(event) => patchConfig({ window: event.target.value as FutureLetterRuleConfig['window'] })}><option value="last_7_days">7 ngày gần nhất</option><option value="last_30_days">30 ngày gần nhất</option></select></label>}</div>
}

export function ConditionBuilder({ draft, emotions, onChange, summary }: { draft: FutureLetterDraft; emotions: EmotionOption[]; onChange: (draft: FutureLetterDraft) => void; summary: (rule: FutureLetterRule) => string }) {
  const [editor, setEditor] = useState<{ groupId: string; rule: FutureLetterRule; categoryId: CategoryId } | null>(null)
  const [categoryPickerGroupId, setCategoryPickerGroupId] = useState<string | null>(null)
  const updateGroups = (groups: FutureLetterDraft['groups']) => onChange({ ...draft, groups: groups.map((group, index) => ({ ...group, position: index + 1, rules: group.rules.map((rule, ruleIndex) => ({ ...rule, position: ruleIndex + 1, groupId: group.id })) })) })
  const openNew = (category: Category, type = category.types[0]) => {
    const group = draft.groups[0]
    if (!group) return
    setEditor({ groupId: group.id, rule: createRule(type, group.id, group.rules.length + 1), categoryId: category.id })
  }
  const commitEditor = () => {
    if (!editor) return
    const groups = draft.groups.map((group) => {
      if (group.id !== editor.groupId) return group
      const exists = group.rules.some((rule) => rule.id && rule.id === editor.rule.id)
      return { ...group, rules: exists ? group.rules.map((rule) => rule.id === editor.rule.id ? editor.rule : rule) : [...group.rules, { ...editor.rule, id: editor.rule.id || createId() }] }
    })
    updateGroups(groups)
    setEditor(null)
  }
  const addGroup = () => updateGroups([...draft.groups, { id: createId(), operator: 'AND', position: draft.groups.length + 1, rules: [] }])
  const removeGroup = (groupId: string) => updateGroups(draft.groups.length === 1 ? draft.groups.map((group) => group.id === groupId ? { ...group, rules: [] } : group) : draft.groups.filter((group) => group.id !== groupId))
  const removeRule = (groupId: string, ruleId: string) => updateGroups(draft.groups.map((group) => group.id === groupId ? { ...group, rules: group.rules.filter((rule) => rule.id !== ruleId) } : group))
  const moveRule = (groupId: string, index: number, direction: -1 | 1) => updateGroups(draft.groups.map((group) => { if (group.id !== groupId) return group; const next = [...group.rules]; const target = index + direction; if (target < 0 || target >= next.length) return group; [next[index], next[target]] = [next[target], next[index]]; return { ...group, rules: next } }))
  return <>
    <section className="future-condition-library"><div className="future-condition-library__intro"><div><span className="future-subheading">Thư viện điều kiện</span><h3>Chọn một dấu mốc để lá thư nhớ đến.</h3></div><span>{draft.groups.reduce((total, group) => total + group.rules.length, 0)} điều kiện</span></div><div className="future-condition-library__grid">{CATEGORIES.map((category) => <button key={category.id} type="button" onClick={() => openNew(category)}><b>{category.icon}</b><span><strong>{category.label}</strong><small>{category.description}</small></span><i aria-hidden="true">→</i></button>)}</div></section>
    <div className="future-rule-groups">{draft.groups.map((group, groupIndex) => <Fragment key={group.id}>{groupIndex > 0 && <div className="future-group-join" aria-label={draft.groupOperator === 'AND' ? 'Các nhóm kết hợp bằng và' : 'Các nhóm kết hợp bằng hoặc'}><span>{draft.groupOperator === 'AND' ? 'VÀ' : 'HOẶC'}</span></div>}<section className="future-rule-group"><div className="future-rule-group__header"><div><span>Nhóm điều kiện {groupIndex + 1}</span><strong>{group.operator === 'AND' ? 'Tất cả điều kiện này cần xảy ra' : 'Chỉ cần một điều kiện xảy ra'}</strong><small>{group.rules.length ? `${group.rules.length} điều kiện` : 'Đang trống — thêm một điều kiện để tiếp tục'}</small></div><div className="future-rule-group__actions"><select aria-label={`Cách ghép nhóm ${groupIndex + 1}`} value={group.operator} onChange={(event) => updateGroups(draft.groups.map((item) => item.id === group.id ? { ...item, operator: event.target.value as GroupOperator } : item))}><option value="AND">Tất cả điều này cần xảy ra</option><option value="OR">Chỉ cần một điều này xảy ra</option></select><button className="future-text-link" type="button" onClick={() => removeGroup(group.id)} disabled={draft.groups.length === 1}>Xóa nhóm</button></div></div>{group.rules.map((rule, index) => <article className="future-condition-row" key={rule.id || `${rule.type}-${index}`}><span className="future-rule__icon">{ICONS[rule.type]}</span><div className="future-condition-row__copy"><strong>{LABELS[rule.type]}</strong><p>{summary(rule)}</p></div><div className="future-condition-row__actions"><button type="button" aria-label="Đưa điều kiện lên" disabled={index === 0} onClick={() => moveRule(group.id, index, -1)}>↑</button><button type="button" aria-label="Đưa điều kiện xuống" disabled={index === group.rules.length - 1} onClick={() => moveRule(group.id, index, 1)}>↓</button><button type="button" onClick={() => setEditor({ groupId: group.id, rule: { ...rule, config: { ...rule.config } }, categoryId: CATEGORIES.find((item) => item.types.includes(rule.type))?.id ?? 'other' })}>Sửa</button><button className="future-danger-link" type="button" onClick={() => removeRule(group.id, rule.id)}>Xóa</button></div></article>)}<button className="future-empty-condition" type="button" onClick={() => setCategoryPickerGroupId(group.id)}>＋ Thêm điều kiện vào nhóm này</button></section></Fragment>)}</div><button className="future-add-group" type="button" onClick={addGroup}>＋ Thêm một nhóm điều kiện</button>
    {categoryPickerGroupId && <div className="future-condition-modal" role="presentation" onClick={() => setCategoryPickerGroupId(null)}><section className="future-condition-modal__panel" role="dialog" aria-modal="true" aria-labelledby="future-condition-library-title" onClick={(event) => event.stopPropagation()}><button className="future-icon-button future-condition-modal__close" type="button" onClick={() => setCategoryPickerGroupId(null)} aria-label="Đóng">×</button><span className="future-subheading">Thư viện điều kiện</span><h3 id="future-condition-library-title">Chọn nhóm điều kiện</h3><div className="future-condition-category-list">{CATEGORIES.map((category) => <button key={category.id} type="button" onClick={() => { setCategoryPickerGroupId(null); setEditor({ groupId: categoryPickerGroupId, rule: createRule(category.types[0], categoryPickerGroupId, (draft.groups.find((group) => group.id === categoryPickerGroupId)?.rules.length ?? 0) + 1), categoryId: category.id }) }}><b>{category.icon}</b><span><strong>{category.label}</strong><small>{category.description}</small></span></button>)}</div></section></div>}
    {editor && <div className="future-condition-modal" role="presentation" onClick={() => setEditor(null)}><section className="future-condition-modal__panel" role="dialog" aria-modal="true" aria-labelledby="future-condition-editor-title" onClick={(event) => event.stopPropagation()}><button className="future-icon-button future-condition-modal__close" type="button" onClick={() => setEditor(null)} aria-label="Đóng">×</button><span className="future-subheading">Cấu hình điều kiện</span><h3 id="future-condition-editor-title">{LABELS[editor.rule.type]}</h3><div className="future-condition-type-tabs">{(CATEGORIES.find((category) => category.id === editor.categoryId)?.types ?? [editor.rule.type]).map((type) => <button className={editor.rule.type === type ? 'is-selected' : undefined} type="button" key={type} onClick={() => { const defaults = createRule(type, editor.groupId, editor.rule.position); setEditor({ ...editor, rule: { ...defaults, id: editor.rule.id } }) }}>{ICONS[type]} {LABELS[type]}</button>)}</div><label className="future-control future-condition-target"><span>Thêm vào nhóm</span><select value={editor.groupId} onChange={(event) => setEditor({ ...editor, groupId: event.target.value, rule: { ...editor.rule, groupId: event.target.value } })}>{draft.groups.map((group, index) => <option key={group.id} value={group.id}>Nhóm {index + 1}</option>)}</select></label><RuleForm rule={editor.rule} emotions={emotions} onChange={(update) => setEditor({ ...editor, rule: { ...editor.rule, ...update, config: update.config ? { ...editor.rule.config, ...update.config } : editor.rule.config } })} /><div className="future-condition-modal__footer"><button className="button button--secondary" type="button" onClick={() => setEditor(null)}>Hủy</button><button className="button button--primary" type="button" onClick={commitEditor}>Lưu điều kiện</button></div></section></div>}
  </>
}
