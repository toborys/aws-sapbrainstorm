import { useState, useRef, useEffect } from 'react'
import { LogOut, Settings, ChevronDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'

export function TopNav() {
  const { user, logout, poolType } = useAuthStore()
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const handleLogout = () => {
    logout()
    navigate(poolType === 'team' ? '/team/login' : '/login')
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const initials = user?.email
    ? user.email
        .split('@')[0]
        .split('.')
        .map((p) => p[0]?.toUpperCase())
        .join('')
        .slice(0, 2)
    : '?'

  return (
    <header className="h-16 bg-bg border-b border-border relative z-40">
      <div className="h-full px-6 flex items-center justify-between">
        {/* Left: Brand */}
        <div className="flex items-center gap-3">
          {/* Logo mark */}
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-accent/20 to-purple/20 flex items-center justify-center border border-accent/10">
            <span className="text-sm font-bold gradient-text">A</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-text font-semibold tracking-tight text-sm">
              APX
            </span>
            <span className="text-text-muted font-medium text-sm hidden sm:inline">
              Innovation Platform
            </span>
          </div>
        </div>

        {/* Right: User */}
        {user && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-3 p-1.5 pr-3 rounded-xl hover:bg-surface-2/60 transition-all duration-200 cursor-pointer group"
            >
              {/* Avatar */}
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent/30 to-purple/30 flex items-center justify-center text-xs font-semibold text-text border border-border group-hover:border-border-hover transition-colors">
                {initials}
              </div>
              <div className="hidden sm:block text-right">
                <p className="text-xs font-medium text-text leading-tight">
                  {user.company}
                </p>
                <p className="text-[11px] text-text-muted leading-tight">
                  {user.email}
                </p>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Dropdown */}
            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-surface/95 backdrop-blur-2xl border border-border shadow-2xl shadow-black/40 overflow-hidden animate-scale-in">
                <div className="p-3 border-b border-border">
                  <p className="text-xs font-medium text-text">{user.email}</p>
                  <p className="text-[11px] text-text-muted">{user.company} &middot; {user.role}</p>
                </div>
                <div className="p-1">
                  <button
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-text-secondary hover:text-text hover:bg-surface-2/60 transition-all duration-200 cursor-pointer"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Settings
                  </button>
                  <button
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-danger/80 hover:text-danger hover:bg-danger/5 transition-all duration-200 cursor-pointer"
                    onClick={handleLogout}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
