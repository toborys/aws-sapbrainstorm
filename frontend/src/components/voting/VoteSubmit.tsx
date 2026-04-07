import { useState } from 'react'
import { Button } from '../ui/Button'
import { Textarea } from '../ui/Textarea'
import { Card } from '../ui/Card'
import type { Idea } from '../../types'

interface VoteSubmitProps {
  selectedIdeas: Idea[]
  onSubmit: (customIdea?: string) => void
  loading: boolean
}

export function VoteSubmit({ selectedIdeas, onSubmit, loading }: VoteSubmitProps) {
  const [customIdea, setCustomIdea] = useState('')
  const [consent, setConsent] = useState(false)

  const charCount = customIdea.length
  const maxChars = 1000

  return (
    <div className="space-y-6">
      {/* Selected ideas summary */}
      <Card>
        <h3 className="text-sm font-semibold text-text mb-3">
          Twoje wybrane pomysly ({selectedIdeas.length})
        </h3>
        <ul className="space-y-2">
          {selectedIdeas.map((idea, i) => (
            <li key={idea.id} className="flex items-start gap-2 text-sm">
              <span className="text-accent font-mono">{i + 1}.</span>
              <div>
                <span className="text-text">{idea.name}</span>
                <span className="text-text-muted ml-2">- {idea.tagline}</span>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {/* Custom idea */}
      <Card>
        <Textarea
          label="Twoj wlasny pomysl (opcjonalnie)"
          placeholder="Opisz swoj pomysl na innowacyjne rozwiazanie SAP na AWS..."
          value={customIdea}
          onChange={(e) => setCustomIdea(e.target.value.slice(0, maxChars))}
          helperText={`${charCount}/${maxChars} znakow`}
        />
      </Card>

      {/* Consent */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1 w-4 h-4 rounded border-border bg-surface-2 accent-accent"
        />
        <span className="text-sm text-text-muted">
          Wyrazam zgode na przetwarzanie moich odpowiedzi w celach analizy i rozwoju produktow.
        </span>
      </label>

      {/* Submit */}
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        disabled={!consent}
        loading={loading}
        onClick={() => onSubmit(customIdea || undefined)}
      >
        Wyslij glosy
      </Button>
    </div>
  )
}
