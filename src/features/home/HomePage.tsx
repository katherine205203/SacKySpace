import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ActionPreview } from './components/ActionPreview'
import { CheckinDetailModal } from './components/CheckinDetailModal'
import { DiaryToday } from './components/DiaryToday'
import { HomeHero } from './components/HomeHero'
import { PersonalSurfaces } from './components/PersonalSurfaces'
import { RecentJourney } from './components/RecentJourney'
import { useHomeData } from './hooks/useHomeData'
import { useCheckinFlow } from '../checkin/useCheckinFlow'
import { deleteCheckin } from '../checkin/services/checkinRepository'
import { getCurrentStreak, getHomeActionSummary, getHomeOrbEntries, getHomeRecordsForRange, getRecentJourneyCheckins } from './services/homeAggregation'
import type { HomeDiaryPreview, HomeRange } from './types'
import type { DateRange } from '../checkin/utils/history'
import './home.css'

// Display-only fallback until the Diary module has a persistence/read model.
const DIARY_PREVIEW: HomeDiaryPreview = { status: 'empty' }

export function HomePage() {
  const navigate = useNavigate()
  const { loadExistingDraft } = useCheckinFlow()
  const { snapshot, isLoading, error, refresh } = useHomeData()
  const [range, setRange] = useState<HomeRange>('today')
  const [customRange, setCustomRange] = useState<DateRange>({ start: null, end: null })
  const [now] = useState(() => new Date())
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const [interactionError, setInteractionError] = useState<string | null>(null)
  const closeSelectedRecord = useCallback(() => setSelectedRecordId(null), [])
  const records = useMemo(() => snapshot?.records ?? [], [snapshot])
  const reminders = useMemo(() => snapshot?.reminders ?? [], [snapshot])
  const rangeRecords = useMemo(() => getHomeRecordsForRange(records, range, now, customRange), [customRange, now, range, records])
  const journeyCheckins = useMemo(() => getRecentJourneyCheckins(records, now), [now, records])
  const actionSummary = useMemo(() => getHomeActionSummary(reminders, now, range, customRange), [customRange, now, range, reminders])
  const selectedRecord = selectedRecordId ? records.find((record) => record.id === selectedRecordId) ?? null : null

  const editSelectedRecord = async () => {
    if (!selectedRecord) return
    try {
      await loadExistingDraft(selectedRecord.id)
      setSelectedRecordId(null)
      navigate(selectedRecord.checkinType === 'unknown' ? '/checkin/unknown' : '/checkin/emotion')
    } catch (reason: unknown) {
      setInteractionError(reason instanceof Error ? reason.message : 'Không thể mở Check-in để chỉnh sửa.')
    }
  }

  const deleteSelectedRecord = async () => {
    if (!selectedRecord) return
    await deleteCheckin(selectedRecord.id)
    setSelectedRecordId(null)
    await refresh()
  }

  return <section className="home-v2" aria-labelledby="home-v2-title">
    {!snapshot && isLoading && <div className="home-v2__data-panel" role="status"><h2 id="home-v2-title">Home</h2><p>Đang gom những mảnh màu của bạn…</p></div>}
    {!snapshot && !isLoading && <div className="home-v2__data-panel home-v2__data-panel--error" role="alert"><h2 id="home-v2-title">Chưa thể mở Home</h2><p>{error ?? 'Dữ liệu Home chưa sẵn sàng.'}</p><button className="button button--secondary" type="button" onClick={() => void refresh()}>Thử lại</button></div>}
    {snapshot && error && <div className="home-v2__data-state home-v2__data-state--error" role="alert"><span>Không thể làm mới dữ liệu Home: {error} · đang hiển thị dữ liệu gần nhất.</span><button className="text-button" type="button" onClick={() => void refresh()}>Thử lại</button></div>}
    {interactionError && <p className="home-v2__data-state home-v2__data-state--error" role="alert">{interactionError}</p>}
    {snapshot && <>
      <div className="home-v2__grid">
        <HomeHero displayName={snapshot.displayName} streak={getCurrentStreak(records, now)} orbEntries={getHomeOrbEntries(rangeRecords)} range={range} customRange={customRange} relevantCheckins={rangeRecords.length} completedActions={actionSummary.completed} remainingActions={actionSummary.remaining} onRangeChange={setRange} onCustomRangeChange={setCustomRange} />
        <div className="home-v2__right-column"><RecentJourney records={journeyCheckins} onSelectCheckin={(record) => { setInteractionError(null); setSelectedRecordId(record.id) }} /><ActionPreview reminders={reminders} /></div>
        <DiaryToday preview={DIARY_PREVIEW} />
        <PersonalSurfaces />
      </div>
      {selectedRecord && <CheckinDetailModal record={selectedRecord} linkedActions={reminders.filter((reminder) => reminder.sourceCheckinId === selectedRecord.id)} onClose={closeSelectedRecord} onEdit={() => void editSelectedRecord()} onDelete={deleteSelectedRecord} onActionChanged={refresh} />}
    </>}
  </section>
}
