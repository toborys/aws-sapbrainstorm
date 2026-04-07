import type { ReactNode } from 'react'

interface AppShellProps {
  children: ReactNode
  className?: string
  sidebar?: ReactNode
  topNav?: ReactNode
}

export function AppShell({ children, className = '', sidebar, topNav }: AppShellProps) {
  return (
    <div className="min-h-screen bg-bg text-text">
      {topNav}
      <div className="flex">
        {sidebar}
        <main className={`flex-1 ${className}`}>{children}</main>
      </div>
    </div>
  )
}
