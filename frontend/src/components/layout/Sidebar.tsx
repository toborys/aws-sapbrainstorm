import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Lightbulb,
  Sparkles,
  BarChart3,
  Users,
  HelpCircle,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react'

const navItems = [
  { to: '/team/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/team/ideas', label: 'Ideas', icon: Lightbulb },
  { to: '/team/brainstorm', label: 'Strategy Session', icon: Sparkles },
  { to: '/team/results', label: 'Results', icon: BarChart3 },
  { to: '/team/customers', label: 'Customers', icon: Users },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={`
        relative flex flex-col
        min-h-[calc(100vh-64px)]
        glass border-r border-border
        transition-all duration-300 ease-out
        ${collapsed ? 'w-16' : 'w-60'}
      `}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-6 z-10 w-6 h-6 rounded-full bg-surface-2 border border-border flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-3 transition-all duration-200 cursor-pointer shadow-lg"
      >
        {collapsed ? (
          <PanelLeft className="w-3 h-3" />
        ) : (
          <PanelLeftClose className="w-3 h-3" />
        )}
      </button>

      {/* Navigation */}
      <nav className="flex-1 p-3 pt-4 flex flex-col gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `
              relative flex items-center gap-3 rounded-xl text-sm font-medium
              transition-all duration-200 group
              ${collapsed ? 'justify-center px-3 py-3' : 'px-3 py-2.5'}
              ${isActive
                ? 'bg-accent/10 text-accent'
                : 'text-text-muted hover:text-text hover:bg-surface-2/60'
              }
              `
            }
          >
            {({ isActive }) => (
              <>
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-accent" />
                )}
                <item.icon className="w-[18px] h-[18px] shrink-0" />
                {!collapsed && (
                  <span className="truncate">{item.label}</span>
                )}
                {/* Tooltip when collapsed */}
                {collapsed && (
                  <div className="absolute left-full ml-2 px-2.5 py-1.5 rounded-lg bg-surface-2 text-text text-xs font-medium border border-border shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
                    {item.label}
                  </div>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom section */}
      <div className={`p-3 border-t border-border ${collapsed ? 'flex justify-center' : ''}`}>
        {collapsed ? (
          <div className="p-2 text-text-muted hover:text-text-secondary transition-colors cursor-pointer">
            <HelpCircle className="w-[18px] h-[18px]" />
          </div>
        ) : (
          <div className="px-3 py-2">
            <div className="flex items-center gap-2 text-text-muted mb-1">
              <HelpCircle className="w-3.5 h-3.5" />
              <span className="text-[11px]">Help</span>
            </div>
            <p className="text-[10px] text-text-muted/60">
              APX Innovation Platform v0.1.0
            </p>
          </div>
        )}
      </div>
    </aside>
  )
}
