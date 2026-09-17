import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { AppSidebar } from '../components/AppSidebar'
import { MobileAppShell } from '../components/mobile/MobileAppShell'

type AppShellProps = { children: ReactNode }

export function AppShell({ children }: AppShellProps) {
  const { pathname, search } = useLocation()
  const isCheckin = pathname.startsWith('/checkin')
  const isDiary = pathname.startsWith('/diary')
  const isJourney = pathname.startsWith('/journey')
  const diaryView = new URLSearchParams(search).get('view')
  const isDiaryHistory = isDiary && diaryView === 'history'
  const isFocusedFlow = (pathname.startsWith('/checkin/') && !pathname.endsWith('/history')) || ((isDiary || isJourney) && ['editor', 'journey-editor', 'journey-read', 'setup', 'read'].includes(diaryView ?? '')) || (pathname === '/future-letter' && ['write', 'trigger', 'decorate', 'preview', 'available', 'read'].includes(diaryView ?? ''))
  return (
    <div className={`app-shell ${isFocusedFlow ? 'app-shell--focused' : ''}`}>
      <AppSidebar />
      <div className="app-main">
        <MobileAppShell />
        <main className={`app-content ${isCheckin ? 'app-content--checkin' : ''} ${isDiary || isJourney ? 'app-content--diary' : ''} ${isDiaryHistory ? 'app-content--diary-history' : ''}`}>{children}</main>
      </div>
    </div>
  )
}
