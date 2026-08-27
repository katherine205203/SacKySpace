import { NavLink } from 'react-router-dom'
import { signOut } from '../services/supabase/auth'

const navigation = [
  { label: 'Home', to: '/', icon: '⌂', end: true },
  { label: 'Check-in', to: '/checkin', icon: '◉' },
  { label: 'Diary', to: '/diary', icon: '▤' },
  { label: 'Reminder', to: '/reminder', icon: '♧' },
  { label: 'Future Letter', to: '/future-letter', icon: '✉' },
  { label: 'Gift for Tmr', to: '/gift-for-tmr', icon: '◇' },
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
                <span className="sidebar-nav__icon" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <NavLink className="admin-link" to="/admin-studio">
          <span aria-hidden="true">⚙</span>
          <span>Admin Studio</span>
        </NavLink>
        <button className="sidebar-signout" type="button" onClick={() => void signOut()}>
          Đăng xuất
        </button>
      </div>
    </aside>
  )
}
