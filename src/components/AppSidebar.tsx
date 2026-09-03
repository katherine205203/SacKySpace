import { NavLink, useLocation } from 'react-router-dom'
import { signOut } from '../services/supabase/auth'

const navigation: Array<{ label: string; to: string; end?: boolean; kind?: 'diary' }> = [
  { label: 'Home', to: '/', end: true },
  { label: 'Check-in', to: '/checkin' },
  { label: 'Diary', to: '/diary', kind: 'diary' },
  { label: 'Action Space', to: '/action-space' },
  { label: 'Future Letter', to: '/future-letter' },
  { label: 'Gift for Tomorrow', to: '/gift-for-tmr' },
]

export function AppSidebar() {
  const location = useLocation()
  const diaryView = new URLSearchParams(location.search).get('view')
  const diaryActive = location.pathname.startsWith('/diary') || location.pathname.startsWith('/journey')
  const journeyView = ['journey-setup', 'journey-editor', 'journey-read', 'journey-history'].includes(diaryView ?? '')
  const dailyActive = location.pathname.startsWith('/diary') && !journeyView
  const journeyActive = location.pathname.startsWith('/journey') || (location.pathname.startsWith('/diary') && journeyView)

  return (
    <aside className="app-sidebar">
      <NavLink className="brand-lockup brand-lockup--sidebar" to="/" aria-label="SacKy home">
        <span className="brand-mark" aria-hidden="true">S</span>
        <span>SacKy</span>
      </NavLink>

      <nav className="sidebar-nav" aria-label="Primary">
        <ul>
          {navigation.map((item) => item.kind === 'diary' ? (
            <li className="sidebar-nav__parent" key={item.to}>
              <NavLink to="/diary" end className={diaryActive ? 'is-active' : undefined} aria-current={diaryActive ? 'page' : undefined}>
                <span>Diary</span>
              </NavLink>
              <ul className="sidebar-subnav" aria-label="Diary sections">
                <li><NavLink to="/diary" end={false} className={dailyActive ? 'is-active' : undefined} aria-current={dailyActive ? 'page' : undefined}>Diary</NavLink></li>
                <li><NavLink to="/journey" className={journeyActive ? 'is-active' : undefined} aria-current={journeyActive ? 'page' : undefined}>Journey</NavLink></li>
              </ul>
            </li>
          ) : (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end} className={({ isActive }) => isActive ? 'is-active' : undefined}>
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <NavLink className="admin-link" to="/admin-studio">
          <span>Admin Studio</span>
        </NavLink>
        <button className="sidebar-signout" type="button" onClick={() => void signOut()}>
          Đăng xuất
        </button>
      </div>
    </aside>
  )
}
