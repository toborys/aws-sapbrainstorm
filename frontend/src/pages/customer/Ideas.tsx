import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { IdeaGrid } from '../../components/ideas/IdeaGrid'
import { VoteProgress } from '../../components/voting/VoteProgress'
import { useIdeasStore } from '../../stores/ideasStore'
import { useVotesStore } from '../../stores/votesStore'
import { useAuthStore } from '../../stores/authStore'

const MAX_SELECTIONS = 5

export default function CustomerIdeas() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { ideas, selectedIds, loading, categoryFilter, fetchIdeas, toggleSelect, setCategoryFilter } =
    useIdeasStore()
  const { hasVoted, checkVotingStatus } = useVotesStore()

  useEffect(() => {
    fetchIdeas()
    checkVotingStatus()
  }, [fetchIdeas, checkVotingStatus])

  useEffect(() => {
    if (hasVoted) {
      navigate('/vote/thankyou', { replace: true })
    }
  }, [hasVoted, navigate])

  const activeIdeas = ideas.filter((i) => i.status === 'active').sort((a, b) => a.order - b.order)

  const handleToggle = (id: string) => {
    toggleSelect(id, MAX_SELECTIONS)
  }

  const selectedNames = activeIdeas
    .filter((i) => selectedIds.includes(i.id))
    .map((i) => i.name)

  return (
    <AppShell
      topNav={
        <header className="h-16 bg-surface/80 backdrop-blur-md border-b border-border px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-accent to-accent/60 rounded-lg flex items-center justify-center shadow-sm">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-text">APX Innovation Platform</span>
          </div>
          {user && (
            <p className="text-sm text-text-muted">{user.email}</p>
          )}
        </header>
      }
    >
      {/* Main content with bottom padding for fixed vote bar */}
      <div className="max-w-6xl mx-auto px-6 pt-8 pb-32">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="font-display text-3xl text-text mb-2">
            Select the best ideas
          </h1>
          <p className="text-text-muted">
            Browse innovative SAP on AWS solutions and select up to {MAX_SELECTIONS} ideas
            you believe have the greatest potential.
          </p>
        </div>

        {/* Progress indicator */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex gap-1">
            {Array.from({ length: MAX_SELECTIONS }).map((_, i) => (
              <div
                key={i}
                className={`w-8 h-1.5 rounded-full transition-all duration-300 ${
                  i < selectedIds.length ? 'bg-accent' : 'bg-surface-2'
                }`}
              />
            ))}
          </div>
          <span className="text-sm text-text-muted">
            Selected {selectedIds.length} of {MAX_SELECTIONS} ideas
          </span>
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            <p className="mt-4 text-text-muted">Loading ideas...</p>
          </div>
        ) : (
          <IdeaGrid
            ideas={activeIdeas}
            selectedIds={selectedIds}
            onToggle={handleToggle}
            categoryFilter={categoryFilter}
            onCategoryChange={setCategoryFilter}
          />
        )}
      </div>

      {/* Fixed bottom vote bar */}
      <VoteProgress
        selected={selectedIds.length}
        max={MAX_SELECTIONS}
        onSubmit={() => navigate('/vote/submit')}
        selectedNames={selectedNames}
      />
    </AppShell>
  )
}
