import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { VoteSubmit } from '../../components/voting/VoteSubmit'
import { Button } from '../../components/ui/Button'
import { useIdeasStore } from '../../stores/ideasStore'
import { useVotesStore } from '../../stores/votesStore'
import { useUiStore } from '../../stores/uiStore'

export default function CustomerSubmit() {
  const navigate = useNavigate()
  const { ideas, selectedIds } = useIdeasStore()
  const { submitting, submitVotes } = useVotesStore()
  const addToast = useUiStore((s) => s.addToast)

  const selectedIdeas = ideas.filter((i) => selectedIds.has(i.id))

  const handleSubmit = async (customIdea?: string) => {
    const success = await submitVotes(Array.from(selectedIds), customIdea)
    if (success) {
      navigate('/vote/thankyou')
    } else {
      addToast({ type: 'error', message: 'Blad podczas wysylania glosow. Sprobuj ponownie.' })
    }
  }

  return (
    <AppShell
      topNav={
        <header className="h-16 bg-surface border-b border-border px-6 flex items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-accent/20 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-accent" />
            </div>
            <span className="font-semibold text-text">SAP Innovation Platform</span>
          </div>
        </header>
      }
    >
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Back button */}
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate('/vote/ideas')}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          Powrot do pomyslow
        </Button>

        <h1 className="font-display text-3xl text-text mb-2">
          Potwierdz swoj wybor
        </h1>
        <p className="text-text-muted mb-8">
          Sprawdz swoje wybory i opcjonalnie dodaj wlasny pomysl.
        </p>

        <VoteSubmit
          selectedIdeas={selectedIdeas}
          onSubmit={handleSubmit}
          loading={submitting}
        />
      </div>
    </AppShell>
  )
}
