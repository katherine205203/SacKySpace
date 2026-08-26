import type { NavigationItem } from '../types/navigation'

type PlaceholderSidebarProps = {
  items: readonly NavigationItem[]
}

export function PlaceholderSidebar({ items }: PlaceholderSidebarProps) {
  return (
    <aside className="app-sidebar" aria-label="Primary navigation placeholder">
      <div className="sidebar-brand" aria-label="SacKy">
        <span className="sidebar-brand__mark" aria-hidden="true">
          S
        </span>
        <span className="sidebar-brand__name">SacKy</span>
      </div>

      <nav className="sidebar-nav" aria-label="Primary">
        <ul>
          {items.map((item) => (
            <li key={item.label}>
              <a href={item.href} aria-current="page">
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
