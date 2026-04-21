import { AlertTriangle, ExternalLink } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'

interface DuplicateWarningDialogProps {
  isOpen: boolean
  onClose: () => void
  existingIdea: { id: string; name: string; tagline: string }
  similarity: number
  /**
   * Called when the user chooses to save anyway. The caller is responsible
   * for retrying the createIdea call with `force = true`.
   */
  onProceed: () => void
  /**
   * Called when the user clicks "View existing". The caller should close
   * the dialog and navigate / highlight as desired.
   */
  onViewExisting: (ideaId: string) => void
  /**
   * Lets the parent disable the "Save anyway" button while a force-retry
   * is in flight. Optional.
   */
  saving?: boolean
}

/**
 * Classify the similarity score into a severity tier. The backend
 * threshold is 0.85 so scores below that should not land here, but we
 * still guard with a default branch.
 */
function severityFor(sim: number): {
  label: string
  tone: 'warning' | 'orange' | 'danger'
  colorClass: string
  bgClass: string
  borderClass: string
} {
  if (sim >= 0.95) {
    return {
      label: 'Almost identical',
      tone: 'danger',
      colorClass: 'text-danger',
      bgClass: 'bg-danger/10',
      borderClass: 'border-danger/30',
    }
  }
  if (sim >= 0.9) {
    return {
      label: 'Very similar',
      tone: 'orange',
      colorClass: 'text-orange-400',
      bgClass: 'bg-orange-500/10',
      borderClass: 'border-orange-500/30',
    }
  }
  return {
    label: 'Similar',
    tone: 'warning',
    colorClass: 'text-yellow-400',
    bgClass: 'bg-yellow-500/10',
    borderClass: 'border-yellow-500/30',
  }
}

export function DuplicateWarningDialog({
  isOpen,
  onClose,
  existingIdea,
  similarity,
  onProceed,
  onViewExisting,
  saving = false,
}: DuplicateWarningDialogProps) {
  const sev = severityFor(similarity)
  const pct = `${(similarity * 100).toFixed(0)}%`

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Possible duplicate detected" size="md">
      <div className="space-y-5">
        {/* Header / severity callout */}
        <div
          className={`flex items-start gap-3 p-4 rounded-xl border ${sev.bgClass} ${sev.borderClass}`}
        >
          <AlertTriangle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${sev.colorClass}`} />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-sm font-semibold ${sev.colorClass}`}>{sev.label}</span>
              <span className={`text-xs font-mono px-2 py-0.5 rounded ${sev.bgClass} ${sev.colorClass}`}>
                {pct} match
              </span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              An idea already in the portfolio looks a lot like the one you're about to save.
              Take a quick look before creating a duplicate.
            </p>
          </div>
        </div>

        {/* Existing idea preview */}
        <div className="p-4 rounded-xl bg-surface-2/60 border border-border">
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-2 font-semibold">
            Existing idea
          </p>
          <h3 className="text-base font-semibold text-text mb-1">{existingIdea.name}</h3>
          {existingIdea.tagline && (
            <p className="text-sm text-accent italic">{existingIdea.tagline}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            icon={<ExternalLink className="w-4 h-4" />}
            onClick={() => onViewExisting(existingIdea.id)}
            disabled={saving}
          >
            View existing
          </Button>
          <Button variant="primary" onClick={onProceed} loading={saving}>
            Save anyway
          </Button>
        </div>
      </div>
    </Modal>
  )
}
