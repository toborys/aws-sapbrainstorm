import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from './components/ui/Toast'
import CustomerLogin from './pages/customer/Login'
import CustomerIdeas from './pages/customer/Ideas'
import CustomerSubmit from './pages/customer/Submit'
import CustomerThankyou from './pages/customer/Thankyou'
import TeamLogin from './pages/team/Login'
import TeamDashboard from './pages/team/Dashboard'
import TeamIdeas from './pages/team/Ideas'
import TeamResults from './pages/team/Results'
import TeamCustomers from './pages/team/Customers'

function App() {
  return (
    <>
      <Toaster />
      <Routes>
        <Route path="/login" element={<CustomerLogin />} />
        <Route path="/vote/ideas" element={<CustomerIdeas />} />
        <Route path="/vote/submit" element={<CustomerSubmit />} />
        <Route path="/vote/thankyou" element={<CustomerThankyou />} />
        <Route path="/team/login" element={<TeamLogin />} />
        <Route path="/team/dashboard" element={<TeamDashboard />} />
        <Route path="/team/ideas" element={<TeamIdeas />} />
        <Route path="/team/results" element={<TeamResults />} />
        <Route path="/team/customers" element={<TeamCustomers />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  )
}

export default App
