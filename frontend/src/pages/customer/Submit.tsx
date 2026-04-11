import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Sparkles, X } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { useIdeasStore } from '../../stores/ideasStore'
import { useVotesStore } from '../../stores/votesStore'
import { useUiStore } from '../../stores/uiStore'

const CUSTOM_IDEA_KEY = 'apx-custom-idea-draft'

export default function CustomerSubmit() {
  const navigate = useNavigate()
  const { ideas, selectedIds, toggleSelect } = useIdeasStore()
  const { submitting, submitVotes } = useVotesStore()
  const addToast = useUiStore((s) => s.addToast)

  const [customIdea, setCustomIdea] = useState(() => {
    try {
      return sessionStorage.getItem(CUSTOM_IDEA_KEY) || ''
    } catch {
      return ''
    }
  })
  const [consent, setConsent] = useState(false)
  const charCount = customIdea.length
  const maxChars = 1000

  // Persist customIdea to sessionStorage on every keystroke
  useEffect(() => {
    try {
      sessionStorage.setItem(CUSTOM_IDEA_KEY, customIdea)
    } catch {
      // Ignore storage errors
    }
  }, [customIdea])

  const selectedIdeas = ideas.filter((i) => selectedIds.includes(i.id))

  const handleSubmit = async () => {
    const success = await submitVotes([...selectedIds], customIdea || undefined)
    if (success) {
      try {
        sessionStorage.removeItem(CUSTOM_IDEA_KEY)
      } catch {
        // Ignore
      }
      navigate('/vote/thankyou')
    } else {
      addToast({ type: 'error', message: 'Błąd podczas wysyłania głosów. Spróbuj ponownie.' })
    }
  }

  return (
    <AppShell
      topNav={
        <header className="h-16 bg-surface/80 backdrop-blur-md border-b border-border px-6 flex items-center sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-accent to-accent/60 rounded-lg flex items-center justify-center shadow-sm">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-text">APX Innovation Platform</span>
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
          Powrót do pomysłów
        </Button>

        <div className="animate-fade-in">
          <h1 className="font-display text-3xl text-text mb-2">
            Potwierdź swój wybór
          </h1>
          <p className="text-text-muted mb-8">
            Sprawdź swoje wybory i opcjonalnie dodaj własny pomysł.
          </p>
        </div>

        <div className="space-y-6">
          {/* Selected ideas summary - removable mini-cards */}
          <Card>
            <h3 className="text-sm font-semibold text-text mb-3">
              Twoje wybrane pomysły ({selectedIdeas.length})
            </h3>
            <div className="space-y-2">
              {selectedIdeas.map((idea, i) => (
                <div
                  key={idea.id}
                  className="flex items-center gap-3 p-3 bg-surface-2 rounded-lg border border-border group"
                >
                  <span className="text-accent font-mono text-sm w-6 shrink-0">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text">{idea.name}</span>
                      <Badge variant="info" className="hidden sm:inline-flex">{idea.category}</Badge>
                    </div>
                    <span className="text-xs text-text-muted">{idea.tagline}</span>
                  </div>
                  <button
                    onClick={() => toggleSelect(idea.id)}
                    className="p-1 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                    title="Usuń"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {selectedIdeas.length === 0 && (
                <p className="text-sm text-text-muted text-center py-4">
                  Nie wybrano żadnych pomysłów.{' '}
                  <button
                    onClick={() => navigate('/vote/ideas')}
                    className="text-accent hover:underline cursor-pointer"
                  >
                    Wróć do wyboru
                  </button>
                </p>
              )}
            </div>
          </Card>

          {/* Custom idea textarea */}
          <Card>
            <label className="block text-sm font-semibold text-text mb-2">
              Masz własny pomysł na narzędzie SAP?
            </label>
            <p className="text-xs text-text-muted mb-3">
              Opcjonalnie opisz swój pomysł na innowacyjne rozwiązanie SAP na AWS.
            </p>
            <textarea
              placeholder="Opisz swój pomysł..."
              value={customIdea}
              onChange={(e) => setCustomIdea(e.target.value.slice(0, maxChars))}
              rows={5}
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors resize-y min-h-[120px]"
            />
            <div className="flex justify-end mt-1">
              <span className={`text-xs ${charCount > maxChars * 0.9 ? 'text-warning' : 'text-text-muted'}`}>
                {charCount}/{maxChars} znaków
              </span>
            </div>
          </Card>

          {/* Consent checkbox */}
          <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl border border-border bg-surface hover:border-border-hover transition-colors">
            <div className="relative mt-0.5">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="peer sr-only"
              />
              <div className="w-5 h-5 rounded-md border-2 border-border bg-surface-2 peer-checked:bg-accent peer-checked:border-accent transition-colors flex items-center justify-center">
                {consent && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-sm text-text-muted leading-relaxed">
              Wyrażam zgodę na przetwarzanie moich odpowiedzi w celach analizy i rozwoju produktów.
              Moje dane będą traktowane poufnie.
            </span>
          </label>

          {/* Submit button */}
          <button
            disabled={!consent || selectedIdeas.length === 0 || submitting}
            onClick={handleSubmit}
            className="w-full py-4 rounded-xl text-white font-semibold text-lg transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent shadow-lg shadow-accent/20 hover:shadow-accent/30 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Wysyłanie...
              </>
            ) : (
              'Prześlij głos'
            )}
          </button>
        </div>
      </div>
    </AppShell>
  )
}
