import { LogOut, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'

export function TopNav() {
  const { user, logout, poolType } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate(poolType === 'team' ? '/team/login' : '/login')
  }

  return (
    <header className="h-16 bg-surface border-b border-border px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-accent/20 rounded-lg flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-accent" />
        </div>
        <span className="font-semibold text-text">
          SAP Innovation Platform
        </span>
      </div>

      {user && (
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-text">{user.email}</p>
            <p className="text-xs text-text-muted">{user.company}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
            title="Wyloguj"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      )}
    </header>
  )
}
