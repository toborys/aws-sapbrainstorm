import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Lightbulb,
  BarChart3,
  Users,
} from 'lucide-react'

const navItems = [
  { to: '/team/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/team/ideas', label: 'Pomysly', icon: Lightbulb },
  { to: '/team/results', label: 'Wyniki', icon: BarChart3 },
  { to: '/team/customers', label: 'Klienci', icon: Users },
]

export function Sidebar() {
  return (
    <aside className="w-64 min-h-[calc(100vh-64px)] bg-surface border-r border-border p-4 flex flex-col gap-1">
      <nav className="flex flex-col gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent/10 text-accent border border-accent/20'
                  : 'text-text-muted hover:text-text hover:bg-surface-2'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
