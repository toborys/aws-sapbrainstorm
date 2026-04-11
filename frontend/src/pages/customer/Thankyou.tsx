import { useEffect } from 'react'
import confetti from 'canvas-confetti'
import { PartyPopper, Mail, Calendar } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { useIdeasStore } from '../../stores/ideasStore'
import { useVotesStore } from '../../stores/votesStore'

export default function CustomerThankyou() {
  const { ideas, selectedIds } = useIdeasStore()
  const { votes, fetchMyVotes } = useVotesStore()

  const selectedIdeas = ideas.filter((i) => selectedIds.includes(i.id))

  // If selectedIds is empty (e.g. page refresh), try to fetch votes from API
  useEffect(() => {
    if (selectedIds.length === 0 && !votes) {
      fetchMyVotes()
    }
  }, [selectedIds.length, votes, fetchMyVotes])

  // Derive voted idea IDs from API response if store selection is empty
  const votedIdeaIds = selectedIds.length > 0 ? selectedIds : (votes?.votedIdeas ?? [])
  const displayIdeas = selectedIdeas.length > 0
    ? selectedIdeas
    : ideas.filter((i) => votedIdeaIds.includes(i.id))

  useEffect(() => {
    // Fire confetti
    const duration = 2500
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
      {/* Background gradients */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-accent/5 rounded-full blur-[200px]" />
      <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-success/3 rounded-full blur-[150px]" />

      <div className="relative z-10 max-w-lg mx-auto px-4 text-center">
        {/* Success icon */}
        <div className="inline-flex items-center justify-center w-24 h-24 bg-success/20 rounded-full mb-6 animate-scale-in">
          <PartyPopper className="w-12 h-12 text-success" />
        </div>

        <h1 className="font-display text-4xl text-text mb-4 animate-fade-in">
          Dziękujemy za Twój głos!
        </h1>

        <p className="text-text-muted text-lg mb-8 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          Twoje głosy zostały zapisane. Dziękujemy za udział w głosowaniu na innowacyjne rozwiązania SAP.
        </p>

        {/* Summary of votes */}
        {displayIdeas.length > 0 && (
          <Card className="text-left mb-6 animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <h3 className="text-sm font-semibold text-text mb-3">Twoje wybory</h3>
            <ul className="space-y-2">
              {displayIdeas.map((idea, i) => (
                <li key={idea.id} className="flex items-center gap-2 text-sm">
                  <span className="text-accent font-mono">{i + 1}.</span>
                  <span className="text-text">{idea.name}</span>
                  <span className="text-text-muted">- {idea.tagline}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* If we only have IDs but no idea objects, show IDs */}
        {displayIdeas.length === 0 && votedIdeaIds.length > 0 && (
          <Card className="text-left mb-6 animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <h3 className="text-sm font-semibold text-text mb-3">Twoje wybory</h3>
            <p className="text-sm text-text-muted">
              Zagłosowałeś na {votedIdeaIds.length} pomysłów.
            </p>
          </Card>
        )}

        <Card className="text-left animate-fade-in" style={{ animationDelay: '0.6s' }}>
          <h3 className="text-sm font-semibold text-text mb-2">Co dalej?</h3>
          <p className="text-sm text-text-muted mb-4">
            Wyniki głosowania zostaną przedstawione na spotkaniu podsumowującym.
            Skontaktujemy się wkrótce z informacjami o wynikach.
          </p>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-accent">
              <Mail className="w-4 h-4" />
              <a href="mailto:kontakt@sap-innovation.pl" className="hover:underline">
                kontakt@sap-innovation.pl
              </a>
            </div>

            <button className="flex items-center gap-2 text-sm text-purple hover:text-purple/80 transition-colors cursor-pointer">
              <Calendar className="w-4 h-4" />
              <span>Umów spotkanie</span>
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}
