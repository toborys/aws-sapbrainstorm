import { useEffect } from 'react'
import confetti from 'canvas-confetti'
import { PartyPopper, Mail } from 'lucide-react'
import { Card } from '../../components/ui/Card'

export default function CustomerThankyou() {
  useEffect(() => {
    // Fire confetti
    const duration = 2000
    const end = Date.now() + duration

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ['#4A9EFF', '#FF9900', '#22C55E', '#A78BFA'],
      })
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ['#4A9EFF', '#FF9900', '#22C55E', '#A78BFA'],
      })

      if (Date.now() < end) {
        requestAnimationFrame(frame)
      }
    }

    frame()
  }, [])

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-accent/5 rounded-full blur-[200px]" />

      <div className="relative z-10 max-w-lg mx-auto px-4 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-success/20 rounded-full mb-6">
          <PartyPopper className="w-10 h-10 text-success" />
        </div>

        <h1 className="font-display text-4xl text-text mb-4">
          Dziekujemy!
        </h1>

        <p className="text-text-muted text-lg mb-8">
          Twoje glosy zostaly zapisane. Dziekujemy za udzial w glosowaniu na innowacyjne rozwiazania SAP.
        </p>

        <Card className="text-left">
          <h3 className="text-sm font-semibold text-text mb-2">Co dalej?</h3>
          <p className="text-sm text-text-muted mb-4">
            Wyniki glosowania zostana przedstawione na spotkaniu podsumowujacym. O wynikach poinformujemy Cie mailowo.
          </p>

          <div className="flex items-center gap-2 text-sm text-accent">
            <Mail className="w-4 h-4" />
            <a href="mailto:kontakt@sap-innovation.pl" className="hover:underline">
              kontakt@sap-innovation.pl
            </a>
          </div>
        </Card>
      </div>
    </div>
  )
}
