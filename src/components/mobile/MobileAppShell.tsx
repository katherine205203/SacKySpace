import { NavLink, useLocation, useNavigate } from 'react-router-dom'

const routeLabels: Array<{ match: (pathname: string) => boolean; label: string }> = [
  { match: (pathname) => pathname.startsWith('/checkin'), label: 'Check-in' },
  { match: (pathname) => pathname.startsWith('/diary'), label: 'Diary' },
  { match: (pathname) => pathname.startsWith('/journey'), label: 'Journey' },
  { match: (pathname) => pathname.startsWith('/action-space') || pathname.startsWith('/reminder'), label: 'Action Space' },
  { match: (pathname) => pathname.startsWith('/future-letter'), label: 'Future Letter' },
  { match: (pathname) => pathname.startsWith('/gift-for-tmr'), label: 'Gift for Tomorrow' },
  { match: (pathname) => pathname.startsWith('/admin-studio'), label: 'Admin Studio' },
  { match: (pathname) => pathname.startsWith('/more'), label: 'Thêm' },
]

const focusedRoute = (pathname: string, search: string): boolean => {
  if (pathname.startsWith('/checkin/') && !pathname.endsWith('/history')) return true
  if (pathname === '/diary' && ['editor', 'read'].includes(new URLSearchParams(search).get('view') ?? '')) return true
  if (pathname.startsWith('/journey') && ['editor', 'read', 'setup', 'journey-editor', 'journey-read', 'journey-setup'].includes(new URLSearchParams(search).get('view') ?? '')) return true
  if (pathname === '/future-letter') return ['write', 'trigger', 'decorate', 'preview', 'available', 'read'].includes(new URLSearchParams(search).get('view') ?? '')
  return false
}

const fallbackFor = (pathname: string): string => {
  if (pathname.startsWith('/checkin/')) return '/checkin'
  if (pathname.startsWith('/diary')) return '/diary'
  if (pathname.startsWith('/journey')) return '/journey'
  if (pathname.startsWith('/future-letter')) return '/future-letter'
  return '/'
}

export function MobileTopBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const isFocused = focusedRoute(location.pathname, location.search)
  const label = routeLabels.find((item) => item.match(location.pathname))?.label ?? 'SacKy'
  return (
    <header className={`mobile-topbar ${isFocused ? 'mobile-topbar--focused' : ''}`}>
      <div className="mobile-topbar__inner">
        {isFocused ? <button className="mobile-topbar__back" type="button" onClick={() => navigate(fallbackFor(location.pathname))} aria-label="Quay lại"><span aria-hidden="true">←</span></button> : <span className="mobile-topbar__mark" aria-hidden="true">S</span>}
        <div className="mobile-topbar__title"><strong>{isFocused ? label : 'SacKy'}</strong>{!isFocused && <span>Lắng nghe mình, từng ngày</span>}</div>
        {isFocused ? <span className="mobile-topbar__step" aria-hidden="true">✦</span> : <NavLink className="mobile-topbar__profile" to="/more" aria-label="Mở thêm">•••</NavLink>}
      </div>
    </header>
  )
}

const mobileNavigation = [
  { label: 'Home', to: '/', end: true, icon: '⌂' },
  { label: 'Check-in', to: '/checkin', icon: '◉' },
  { label: 'Diary', to: '/diary', icon: '▤' },
  { label: 'Action', to: '/action-space', icon: '↗' },
  { label: 'More', to: '/more', icon: '•••' },
]

export function MobileBottomNav() {
  return <nav className="mobile-bottom-nav" aria-label="Điều hướng chính trên mobile">{mobileNavigation.map((item) => <NavLink key={item.to} to={item.to} end={item.end}><span className="mobile-bottom-nav__icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span></NavLink>)}</nav>
}

export function MobileAppShell() {
  return <><MobileTopBar /><MobileBottomNav /></>
}
