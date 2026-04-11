import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'

export function ProtectedRoute({ children, requiredPool }: { children: React.ReactNode, requiredPool?: 'team' | 'customer' }) {
  const { isAuthenticated, poolType } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to={requiredPool === 'customer' ? '/login' : '/team/login'} replace />
  }

  if (requiredPool && poolType !== requiredPool) {
    return <Navigate to={poolType === 'team' ? '/team/dashboard' : '/vote/ideas'} replace />
  }

  return <>{children}</>
}
