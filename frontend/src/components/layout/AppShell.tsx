import type { ReactNode } from 'react'

interface AppShellProps {
  children: ReactNode
  className?: string
  sidebar?: ReactNode
  topNav?: ReactNode
  gradientMesh?: boolean
}

export function AppShell({
  children,
  className = '',
  sidebar,
  topNav,
  gradientMesh = true,
}: AppShellProps) {
  return (
    <div className={`min-h-screen bg-bg text-text ${gradientMesh ? 'gradient-mesh' : ''}`}>
      {topNav}
      <div className="flex min-h-[calc(100vh-64px)]">
        {sidebar}
        <main className={`flex-1 overflow-x-hidden ${className}`}>
          {children}
        </main>
      </div>
    </div>
  )
}
