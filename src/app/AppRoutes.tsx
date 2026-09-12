import { Route, Routes } from 'react-router-dom'
import { CheckinFlowProvider } from '../features/checkin/CheckinFlowContext'
import { CheckinLandingScreen } from '../features/checkin/screens/CheckinLandingScreen'
import { EmotionCoreScreen } from '../features/checkin/screens/EmotionCoreScreen'
import { DeepDiveScreen } from '../features/checkin/screens/DeepDiveScreen'
import { HistoryScreen } from '../features/checkin/screens/HistoryScreen'
import { ReviewScreen } from '../features/checkin/screens/ReviewScreen'
import { UnknownScreen } from '../features/checkin/screens/UnknownScreen'
import { HomePage } from '../features/home/HomePage'
import { ActionSpacePage } from '../features/actionspace/ActionSpacePage'
import { DiaryPage } from '../features/diary/DiaryPage'
import { JourneyPage } from '../features/diary/JourneyPage'
import { FutureLetterPage } from '../features/futureletter/FutureLetterPage'
import { GiftPage } from '../features/gift/GiftPage'
import { MorePage } from '../features/more/MorePage'

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
    </CheckinFlowProvider>
  )
}
