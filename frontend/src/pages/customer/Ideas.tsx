import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { IdeaGrid } from '../../components/ideas/IdeaGrid'
import { VoteProgress } from '../../components/voting/VoteProgress'
import { useIdeasStore } from '../../stores/ideasStore'
import { useAuthStore } from '../../stores/authStore'

const MAX_SELECTIONS = 5

export default function CustomerIdeas() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { ideas, selectedIds, loading, categoryFilter, fetchIdeas, toggleSelect, setCategoryFilter } =
    useIdeasStore()

  useEffect(() => {
    fetchIdeas()
  }, [fetchIdeas])

  const activeIdeas = ideas.filter((i) => i.status === 'active').sort((a, b) => a.order - b.order)

  const handleToggle = (id: string) => {
    toggleSelect(id, MAX_SELECTIONS)
  }

  return (
    <AppShell
      topNav={
        <header className="h-16 bg-surface border-b border-border px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-accent/20 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-accent" />
            </div>
            <span className="font-semibold text-text">SAP Innovation Platform</span>
          </div>
          {user && (
            <p className="text-sm text-text-muted">{user.email}</p>
          )}
        </header>
      }
    >
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-3xl text-text mb-2">
            Wybierz najlepsze pomysly
          </h1>
          <p className="text-text-muted">
            Przegladaj innowacyjne rozwiazania SAP na AWS i wybierz do {MAX_SELECTIONS} pomyslow, ktore Twoim zdaniem maja najwiekszy potencjal.
          </p>
        </div>

        {/* Vote progress bar (sticky) */}
        <div className="sticky top-0 z-10 mb-6 -mx-6 px-6 py-3 bg-bg/80 backdrop-blur-sm">
          <VoteProgress
            selected={selectedIds.size}
            max={MAX_SELECTIONS}
            onSubmit={() => navigate('/vote/submit')}
          />
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            <p className="mt-4 text-text-muted">Ladowanie pomyslow...</p>
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
    </AppShell>
  )
}
