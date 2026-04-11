import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'

export function ProtectedRoute({ children, requiredPool }: { children: React.ReactNode, requiredPool?: 'team' | 'customer' }) {
  const { isAuthenticated, poolType } = useAuthStore()
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    // Check if the store has already hydrated from persist middleware
    // The persist middleware fires onRehydrateStorage synchronously,
    // but we use a brief check to be safe
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true)
    })

    // If already hydrated (e.g. on subsequent renders), set immediately
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true)
    }

    return unsub
  }, [])

  // Show minimal spinner while hydrating
  if (!hydrated) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="inline-block w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to={requiredPool === 'customer' ? '/login' : '/team/login'} replace />
  }

  if (requiredPool && poolType !== requiredPool) {
    return <Navigate to={poolType === 'team' ? '/team/dashboard' : '/vote/ideas'} replace />
  }

  return <>{children}</>
}
