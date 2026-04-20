import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { Input } from '../../components/ui/Input'
import { useAuthStore } from '../../stores/authStore'
import { useUiStore } from '../../stores/uiStore'
import { cognitoLogin, cognitoRespondNewPassword, parseJwt } from '../../lib/cognito-auth'
import { scheduleTokenRefresh } from '../../lib/token-refresh'

const CUSTOMER_POOL_ID = import.meta.env.VITE_CUSTOMER_POOL_ID || ''
const CUSTOMER_CLIENT_ID = import.meta.env.VITE_CUSTOMER_CLIENT_ID || ''
const CHALLENGE_KEY = 'apx-customer-challenge-session'
const CHALLENGE_EMAIL_KEY = 'apx-customer-challenge-email'

export default function CustomerLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [challengeSession, setChallengeSession] = useState<string | null>(null)
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const addToast = useUiStore((s) => s.addToast)

  // Restore challenge session from sessionStorage on mount
  useEffect(() => {
    try {
      const savedSession = sessionStorage.getItem(CHALLENGE_KEY)
      const savedEmail = sessionStorage.getItem(CHALLENGE_EMAIL_KEY)
      if (savedSession) {
        setChallengeSession(savedSession)
        if (savedEmail) setEmail(savedEmail)
      }
    } catch {
      // Ignore storage errors
    }
  }, [])

  const completeLogin = (idToken: string) => {
    // Clear challenge session from storage
    try {
      sessionStorage.removeItem(CHALLENGE_KEY)
      sessionStorage.removeItem(CHALLENGE_EMAIL_KEY)
    } catch {
      // Ignore
    }
    const claims = parseJwt(idToken)
    login(
      {
        userId: claims.sub as string,
        email: claims.email as string,
        company: (claims['custom:company'] as string) || 'Partner',
        role: 'customer',
      },
      idToken,
      'customer',
    )
    scheduleTokenRefresh()
    addToast({ type: 'success', message: 'Signed in successfully!' })
    navigate('/vote/ideas')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const result = await cognitoLogin(CUSTOMER_POOL_ID, CUSTOMER_CLIENT_ID, email, password)

      if (result.challengeName === 'NEW_PASSWORD_REQUIRED') {
        setChallengeSession(result.session!)
        // Persist challenge session to sessionStorage
        try {
          sessionStorage.setItem(CHALLENGE_KEY, result.session!)
          sessionStorage.setItem(CHALLENGE_EMAIL_KEY, email)
        } catch {
          // Ignore
        }
        addToast({ type: 'info', message: 'You need to set a new password.' })
      } else {
        completeLogin(result.tokens.idToken)
      }
    } catch (err) {
      addToast({ type: 'error', message: (err as Error).message })
    } finally {
      setLoading(false)
    }
  }

  const handleNewPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const result = await cognitoRespondNewPassword(
        CUSTOMER_CLIENT_ID,
        email,
        newPassword,
        challengeSession!,
      )
      completeLogin(result.tokens.idToken)
    } catch (err) {
      addToast({ type: 'error', message: (err as Error).message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center relative overflow-hidden">
      {/* Grid pattern background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(74,158,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(74,158,255,0.3) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Gradient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-accent/8 rounded-full blur-[128px]" />
      <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-success/5 rounded-full blur-[100px]" />

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-accent to-accent/60 rounded-2xl mb-5 shadow-lg shadow-accent/20">
            <span className="text-3xl font-bold text-white">A</span>
          </div>
          <h1 className="font-display text-3xl text-text mb-2">
            APX Innovation Platform
          </h1>
          <p className="text-text-muted text-sm max-w-xs mx-auto">
            APX innovation and brainstorming platform
          </p>
        </div>

        <div className="glass rounded-2xl p-8 shadow-2xl">
          {!challengeSession ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Email"
                type="email"
                placeholder="john@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                label="Password"
                type="password"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-white font-semibold transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent shadow-lg shadow-accent/20 hover:shadow-accent/30 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleNewPassword} className="space-y-5">
              <div className="text-center mb-4">
                <p className="text-sm text-warning">
                  Set a new password to continue
                </p>
              </div>
              <Input
                label="New Password"
                type="password"
                placeholder="Min. 8 characters, uppercase, digits"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <button
                type="submit"
                disabled={loading || newPassword.length < 8}
                className="w-full py-3 rounded-xl text-white font-semibold transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent shadow-lg shadow-accent/20 hover:shadow-accent/30 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Set Password & Sign In'
                )}
              </button>
            </form>
          )}

          <div className="mt-4 text-center">
            <button className="text-xs text-accent hover:text-accent-hover transition-colors cursor-pointer">
              Forgot password
            </button>
          </div>

          <div className="mt-6 flex items-center gap-2 text-xs text-text-muted justify-center">
            <Lock className="w-3.5 h-3.5" />
            <span>Access restricted to invited partners</span>
          </div>
        </div>
      </div>
    </div>
  )
}
