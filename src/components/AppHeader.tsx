import { useLocation } from 'react-router-dom'

const titles: Record<string, string> = {
  '/': 'Home',
  '/checkin': 'Check-in',
  '/diary': 'Diary',
  '/reminder': 'Reminder',
  '/future-letter': 'Future Letter',
  '/gift-for-tmr': 'Gift for Tmr',
  '/admin-studio': 'Admin Studio',
}

export function AppHeader() {
  const { pathname } = useLocation()
  const title = pathname.startsWith('/checkin') ? 'Check-in' : titles[pathname] ?? 'SacKy'

  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">SacKy v2</p>
        <h1 className="app-header__title">{title}</h1>
      </div>
      <div className="app-header__meta">
        <span className="status-label">Web-first</span>
        <span className="avatar" aria-label="Owner">L</span>
      </div>
    </header>
  )
}
