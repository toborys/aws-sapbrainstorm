import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { Input } from '../../components/ui/Input'
import { useAuthStore } from '../../stores/authStore'
import { useUiStore } from '../../stores/uiStore'
import { cognitoLogin, cognitoRespondNewPassword, parseJwt } from '../../lib/cognito-auth'
import { scheduleTokenRefresh } from '../../lib/token-refresh'

const TEAM_POOL_ID = import.meta.env.VITE_TEAM_POOL_ID || ''
const TEAM_CLIENT_ID = import.meta.env.VITE_TEAM_CLIENT_ID || ''
const CHALLENGE_KEY = 'apx-team-challenge-session'
const CHALLENGE_EMAIL_KEY = 'apx-team-challenge-email'

export default function TeamLogin() {
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
        company: 'APX Team',
        role: (claims['custom:role'] as string) || 'team-member',
      },
      idToken,
      'team',
    )
    scheduleTokenRefresh()
    addToast({ type: 'success', message: 'Zalogowano pomyslnie!' })
    navigate('/team/dashboard')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const result = await cognitoLogin(TEAM_POOL_ID, TEAM_CLIENT_ID, email, password)

      if (result.challengeName === 'NEW_PASSWORD_REQUIRED') {
        setChallengeSession(result.session!)
        // Persist challenge session to sessionStorage
        try {
          sessionStorage.setItem(CHALLENGE_KEY, result.session!)
          sessionStorage.setItem(CHALLENGE_EMAIL_KEY, email)
        } catch {
          // Ignore
        }
        addToast({ type: 'info', message: 'Musisz ustawic nowe haslo.' })
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
        TEAM_CLIENT_ID,
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
      <div className="absolute inset-0 gradient-mesh" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(167,139,250,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(167,139,250,0.3) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-purple/8 rounded-full blur-[128px] animate-float" />
      <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-accent/6 rounded-full blur-[128px]" />

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-accent to-purple rounded-2xl flex items-center justify-center shadow-lg shadow-accent/20">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <div className="text-3xl font-display text-text tracking-tight">
              SAP <span className="text-accent">&times;</span> AWS
            </div>
          </div>
          <h1 className="font-display text-2xl text-text mb-2">Portal Zespolu</h1>
          <p className="text-text-muted text-sm">
            Zarzadzaj pomyslami, klientami i wynikami
          </p>
        </div>

        <div className="glass rounded-2xl p-8 shadow-2xl">
          {!challengeSession ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Email"
                type="email"
                placeholder="admin@sapteam.pl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                label="Haslo"
                type="password"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-white font-semibold transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-accent via-purple to-accent bg-[length:200%_100%] hover:bg-[position:100%_0] shadow-lg shadow-accent/20 hover:shadow-accent/30 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Zaloguj sie'
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleNewPassword} className="space-y-5">
              <div className="text-center mb-4">
                <p className="text-sm text-warning">
                  Ustaw nowe haslo aby kontynuowac
                </p>
              </div>
              <Input
                label="Nowe haslo"
                type="password"
                placeholder="Min. 12 znakow, wielkie litery, cyfry, znaki specjalne"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <button
                type="submit"
                disabled={loading || newPassword.length < 12}
                className="w-full py-3 rounded-xl text-white font-semibold transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-accent via-purple to-accent bg-[length:200%_100%] hover:bg-[position:100%_0] shadow-lg shadow-accent/20 hover:shadow-accent/30 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Ustaw haslo i zaloguj'
                )}
              </button>
            </form>
          )}

          <div className="mt-6 flex items-center gap-2 text-xs text-text-muted justify-center">
            <Shield className="w-3.5 h-3.5" />
            <span>Dostep tylko dla czlonkow zespolu SAP</span>
          </div>
        </div>
      </div>
    </div>
  )
}
