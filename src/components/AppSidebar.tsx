import { NavLink } from 'react-router-dom'
import { signOut } from '../services/supabase/auth'

const navigation = [
  { label: 'Home', to: '/', end: true },
  { label: 'Check-in', to: '/checkin' },
  { label: 'Diary', to: '/diary' },
  { label: 'Action Space', to: '/action-space' },
  { label: 'Future Letter', to: '/future-letter' },
  { label: 'Gift for Tomorrow', to: '/gift-for-tmr' },
]

export function AppSidebar() {
  return (
    <aside className="app-sidebar">
      <NavLink className="brand-lockup brand-lockup--sidebar" to="/" aria-label="SacKy home">
        <span className="brand-mark" aria-hidden="true">S</span>
        <span>SacKy</span>
      </NavLink>

      <nav className="sidebar-nav" aria-label="Primary">
        <ul>
          {navigation.map((item) => (
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
