import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { CheckinFlowProvider } from '../features/checkin/CheckinFlowContext'
import { HomePage } from '../features/home/HomePage'

const CheckinLandingScreen = lazy(() => import('../features/checkin/screens/CheckinLandingScreen').then((module) => ({ default: module.CheckinLandingScreen })))
const EmotionCoreScreen = lazy(() => import('../features/checkin/screens/EmotionCoreScreen').then((module) => ({ default: module.EmotionCoreScreen })))
const DeepDiveScreen = lazy(() => import('../features/checkin/screens/DeepDiveScreen').then((module) => ({ default: module.DeepDiveScreen })))
const HistoryScreen = lazy(() => import('../features/checkin/screens/HistoryScreen').then((module) => ({ default: module.HistoryScreen })))
const ReviewScreen = lazy(() => import('../features/checkin/screens/ReviewScreen').then((module) => ({ default: module.ReviewScreen })))
const UnknownScreen = lazy(() => import('../features/checkin/screens/UnknownScreen').then((module) => ({ default: module.UnknownScreen })))
const ActionSpacePage = lazy(() => import('../features/actionspace/ActionSpacePage').then((module) => ({ default: module.ActionSpacePage })))
const DiaryPage = lazy(() => import('../features/diary/DiaryPage').then((module) => ({ default: module.DiaryPage })))
const JourneyPage = lazy(() => import('../features/diary/JourneyPage').then((module) => ({ default: module.JourneyPage })))
const FutureLetterPage = lazy(() => import('../features/futureletter/FutureLetterPage').then((module) => ({ default: module.FutureLetterPage })))
const GiftPage = lazy(() => import('../features/gift/GiftPage').then((module) => ({ default: module.GiftPage })))
const MorePage = lazy(() => import('../features/more/MorePage').then((module) => ({ default: module.MorePage })))

const PlaceholderScreen = ({ title }: { title: string }) => (
  <section className="placeholder-screen">
    <p className="eyebrow">Sắc Ký</p>
    <h2>{title}</h2>
    <p>Không gian này sẽ được mở rộng sau.</p>
  </section>
)

export function AppRoutes() {
  return (
    <CheckinFlowProvider>
      <Suspense fallback={<section className="placeholder-screen" role="status"><p className="eyebrow">Sắc Ký</p><h2>Đang mở không gian của bạn…</h2></section>}>
        <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/checkin" element={<CheckinLandingScreen />} />
        <Route path="/checkin/emotion" element={<EmotionCoreScreen />} />
        <Route path="/checkin/unknown" element={<UnknownScreen />} />
        <Route path="/checkin/secondary-emotions" element={<DeepDiveScreen step="secondary" />} />
        <Route path="/checkin/needs" element={<DeepDiveScreen step="needs" />} />
        <Route path="/checkin/contexts" element={<DeepDiveScreen step="contexts" />} />
        <Route path="/checkin/review" element={<ReviewScreen />} />
        <Route path="/checkin/:id/secondary-emotions" element={<DeepDiveScreen step="secondary" />} />
        <Route path="/checkin/:id/needs" element={<DeepDiveScreen step="needs" />} />
        <Route path="/checkin/:id/contexts" element={<DeepDiveScreen step="contexts" />} />
        <Route path="/checkin/:id/review" element={<ReviewScreen />} />
        <Route path="/checkin/history" element={<HistoryScreen />} />
        <Route path="/diary" element={<DiaryPage />} />
        <Route path="/journey" element={<JourneyPage />} />
        <Route path="/action-space" element={<ActionSpacePage />} />
        <Route path="/reminder" element={<ActionSpacePage />} />
        <Route path="/future-letter" element={<FutureLetterPage />} />
        <Route path="/gift-for-tmr" element={<GiftPage />} />
        <Route path="/more" element={<MorePage />} />
        <Route path="*" element={<PlaceholderScreen title="Page not found" />} />
        </Routes>
      </Suspense>
    </CheckinFlowProvider>
  )
}
