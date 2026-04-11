import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from './components/ui/Toast'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import CustomerLogin from './pages/customer/Login'
import CustomerIdeas from './pages/customer/Ideas'
import CustomerSubmit from './pages/customer/Submit'
import CustomerThankyou from './pages/customer/Thankyou'
import TeamLogin from './pages/team/Login'
import TeamDashboard from './pages/team/Dashboard'
import TeamIdeas from './pages/team/Ideas'
import TeamResults from './pages/team/Results'
import TeamCustomers from './pages/team/Customers'

const BrainstormPanel = lazy(() => import('./components/team/BrainstormPanel'))

function BrainstormLoader() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="inline-block w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
    </div>
  )
}

function App() {
  return (
    <>
      <Toaster />
      <Routes>
        <Route path="/login" element={<CustomerLogin />} />
        <Route path="/vote/ideas" element={<ProtectedRoute requiredPool="customer"><CustomerIdeas /></ProtectedRoute>} />
        <Route path="/vote/submit" element={<ProtectedRoute requiredPool="customer"><CustomerSubmit /></ProtectedRoute>} />
        <Route path="/vote/thankyou" element={<ProtectedRoute requiredPool="customer"><CustomerThankyou /></ProtectedRoute>} />
        <Route path="/team/login" element={<TeamLogin />} />
        <Route path="/team/dashboard" element={<ProtectedRoute requiredPool="team"><TeamDashboard /></ProtectedRoute>} />
        <Route path="/team/ideas" element={<ProtectedRoute requiredPool="team"><TeamIdeas /></ProtectedRoute>} />
        <Route path="/team/brainstorm" element={<ProtectedRoute requiredPool="team"><Suspense fallback={<BrainstormLoader />}><BrainstormPanel /></Suspense></ProtectedRoute>} />
        <Route path="/team/results" element={<ProtectedRoute requiredPool="team"><TeamResults /></ProtectedRoute>} />
        <Route path="/team/customers" element={<ProtectedRoute requiredPool="team"><TeamCustomers /></ProtectedRoute>} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  )
}

export default App
