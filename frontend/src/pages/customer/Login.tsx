import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Lock } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card } from '../../components/ui/Card'
import { useAuthStore } from '../../stores/authStore'
import { useUiStore } from '../../stores/uiStore'

export default function CustomerLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const addToast = useUiStore((s) => s.addToast)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // TODO: Integrate with Cognito
      // Placeholder login flow
      login(
        { userId: 'temp', email, company: 'Partner', role: 'customer' },
        'temp-token',
        'customer'
      )
      navigate('/vote/ideas')
    } catch {
      addToast({ type: 'error', message: 'Nieprawidlowe dane logowania.' })
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
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-accent/10 rounded-full blur-[128px]" />

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-accent/20 rounded-2xl mb-4">
            <Sparkles className="w-8 h-8 text-accent" />
          </div>
          <h1 className="font-display text-3xl text-text mb-2">
            SAP Innovation Platform
          </h1>
          <p className="text-text-muted text-sm">
            Platforma glosowania na innowacyjne pomysly
          </p>
        </div>

        <Card className="backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="jan@firma.pl"
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

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              loading={loading}
            >
              Zaloguj sie
            </Button>
          </form>

          <div className="mt-6 flex items-center gap-2 text-xs text-text-muted justify-center">
            <Lock className="w-3.5 h-3.5" />
            <span>Dostep tylko dla zaproszonych partnerow SAP</span>
          </div>
        </Card>
      </div>
    </div>
  )
}
