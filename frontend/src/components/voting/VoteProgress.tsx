import { Check, ArrowRight, X } from 'lucide-react'

interface VoteProgressProps {
  selected: number
  max: number
  onSubmit: () => void
  selectedNames?: string[]
  onDeselect?: (index: number) => void
}

export function VoteProgress({
  selected,
  max,
  onSubmit,
  selectedNames = [],
  onDeselect,
}: VoteProgressProps) {
  const isReady = selected > 0

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 animate-slide-up">
      <div className="max-w-6xl mx-auto px-6 pb-6">
        <div className="glass rounded-2xl p-4 shadow-2xl shadow-black/30 border border-border">
          <div className="flex items-center gap-6">
            {/* Progress circles */}
            <div className="flex items-center gap-2">
              {Array.from({ length: max }).map((_, i) => {
                const filled = i < selected

                return (
                  <div
                    key={i}
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center
                      transition-all duration-300 text-xs font-medium
                      ${filled
                        ? 'bg-accent/20 text-accent border border-accent/30 shadow-md shadow-accent/20'
                        : 'bg-surface-2/60 text-text-muted border border-border'
                      }
                    `}
                  >
                    {filled ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      i + 1
                    )}
                  </div>
                )
              })}
            </div>

            {/* Text */}
            <div className="flex-1">
              <p className="text-sm font-medium text-text">
                {selected} of {max} selected
              </p>

              {/* Selected names pills */}
              {selectedNames.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {selectedNames.map((name, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-accent/10 text-accent text-[11px] font-medium border border-accent/15"
                    >
                      {name.length > 25 ? name.slice(0, 25) + '...' : name}
                      {onDeselect && (
                        <button
                          onClick={() => onDeselect(idx)}
                          className="ml-0.5 hover:text-white transition-colors cursor-pointer"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Submit button */}
            <button
              disabled={!isReady}
              onClick={onSubmit}
              className={`
                flex items-center gap-2
                px-6 py-3 rounded-xl text-sm font-semibold
                transition-all duration-300 cursor-pointer
                active:scale-[0.98]
                ${isReady
                  ? 'bg-gradient-to-r from-accent to-accent-hover text-white shadow-lg shadow-accent/25 hover:shadow-xl hover:shadow-accent/35'
                  : 'bg-surface-2 text-text-muted border border-border cursor-not-allowed'
                }
              `}
            >
              Submit Votes
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
