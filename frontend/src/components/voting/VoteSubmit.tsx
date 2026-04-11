import { useState } from 'react'
import { Check } from 'lucide-react'
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
      <Card gradientBorder>
        <h3 className="text-sm font-semibold text-text mb-4">
          Twoje wybrane pomysły ({selectedIdeas.length})
        </h3>
        <ul className="space-y-2.5">
          {selectedIdeas.map((idea, i) => (
            <li key={idea.id} className="flex items-start gap-3 p-3 rounded-xl bg-surface-2/50 border border-border">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-accent/15 text-accent text-[11px] font-mono shrink-0 mt-0.5">
                {i + 1}
              </span>
              <div className="min-w-0">
                <span className="text-sm text-text font-medium">{idea.name}</span>
                <span className="text-sm text-text-secondary ml-2">- {idea.tagline}</span>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {/* Custom idea */}
      <Card>
        <Textarea
          label="Twój własny pomysł (opcjonalnie)"
          placeholder="Opisz swój pomysł na innowacyjne rozwiązanie SAP na AWS..."
          value={customIdea}
          onChange={(e) => setCustomIdea(e.target.value.slice(0, maxChars))}
          helperText={`${charCount}/${maxChars} znaków`}
        />
      </Card>

      {/* Consent */}
      <label className="flex items-start gap-3 cursor-pointer group">
        <div className="relative mt-0.5 shrink-0">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-5 h-5 rounded-md border border-border bg-surface-2/60 peer-checked:bg-accent peer-checked:border-accent transition-all duration-200 flex items-center justify-center">
            {consent && <Check className="w-3 h-3 text-white" />}
          </div>
        </div>
        <span className="text-sm text-text-secondary group-hover:text-text transition-colors">
          Wyrażam zgodę na przetwarzanie moich odpowiedzi w celach analizy i rozwoju produktów.
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
        Wyślij głosy
      </Button>
    </div>
  )
}
