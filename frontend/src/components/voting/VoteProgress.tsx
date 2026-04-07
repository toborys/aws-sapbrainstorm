import { CheckCircle } from 'lucide-react'
import { Button } from '../ui/Button'

interface VoteProgressProps {
  selected: number
  max: number
  onSubmit: () => void
}

export function VoteProgress({ selected, max, onSubmit }: VoteProgressProps) {
  const percentage = (selected / max) * 100
  const isReady = selected > 0

  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-4">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-text">
            Wybrano: {selected}/{max}
          </span>
          {selected === max && (
            <span className="flex items-center gap-1 text-xs text-success">
              <CheckCircle className="w-3.5 h-3.5" />
              Komplet
            </span>
          )}
        </div>
        <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <Button
        variant="primary"
        disabled={!isReady}
        onClick={onSubmit}
      >
        Dalej
      </Button>
    </div>
  )
}
