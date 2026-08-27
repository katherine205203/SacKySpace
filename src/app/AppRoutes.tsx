import { Route, Routes } from 'react-router-dom'
import { CheckinFlowProvider } from '../features/checkin/CheckinFlowContext'
import { CheckinLandingScreen } from '../features/checkin/screens/CheckinLandingScreen'
import { EmotionCoreScreen } from '../features/checkin/screens/EmotionCoreScreen'
import { DeepDiveScreen } from '../features/checkin/screens/DeepDiveScreen'
import { HistoryScreen } from '../features/checkin/screens/HistoryScreen'
import { ReviewScreen } from '../features/checkin/screens/ReviewScreen'
import { UnknownScreen } from '../features/checkin/screens/UnknownScreen'
import { HomePage } from '../features/home/HomePage'

const PlaceholderScreen = ({ title }: { title: string }) => (
  <section className="placeholder-screen">
    <p className="eyebrow">Coming later</p>
    <h2>{title}</h2>
    <p>This area remains a placeholder while Check-in v2 is built.</p>
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
        <Route path="/checkin/:id/secondary-emotions" element={<DeepDiveScreen step="secondary" />} />
        <Route path="/checkin/:id/needs" element={<DeepDiveScreen step="needs" />} />
        <Route path="/checkin/:id/contexts" element={<DeepDiveScreen step="contexts" />} />
        <Route path="/checkin/:id/review" element={<ReviewScreen />} />
        <Route path="/checkin/history" element={<HistoryScreen />} />
        <Route path="/diary" element={<PlaceholderScreen title="Diary" />} />
        <Route path="/reminder" element={<PlaceholderScreen title="Reminder" />} />
        <Route path="/future-letter" element={<PlaceholderScreen title="Future Letter" />} />
        <Route path="/gift-for-tmr" element={<PlaceholderScreen title="Gift for Tmr" />} />
        <Route path="/admin-studio" element={<PlaceholderScreen title="Admin Studio" />} />
        <Route path="*" element={<PlaceholderScreen title="Page not found" />} />
      </Routes>
    </CheckinFlowProvider>
  )
}
