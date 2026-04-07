import { Modal } from '../ui/Modal'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import type { Idea } from '../../types'

interface IdeaModalProps {
  idea: Idea | null
  isOpen: boolean
  onClose: () => void
  isSelected: boolean
  onToggle: (id: string) => void
}

export function IdeaModal({ idea, isOpen, onClose, isSelected, onToggle }: IdeaModalProps) {
  if (!idea) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" title={idea.name}>
      <div className="space-y-6">
        {/* Category & tags row */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">{idea.category}</Badge>
          <Badge variant={idea.complexity === 'low' ? 'success' : idea.complexity === 'medium' ? 'warning' : 'danger'}>
            Zlozonosc: {idea.complexity}
          </Badge>
          <Badge>{idea.mvpTime}</Badge>
          <Badge>{idea.model}</Badge>
        </div>

        {/* Tagline */}
        <p className="text-accent text-sm font-medium">{idea.tagline}</p>

        {/* Problem */}
        <div>
          <h4 className="text-sm font-semibold text-text mb-2">Problem</h4>
          <p className="text-sm text-text-muted leading-relaxed">{idea.problem}</p>
        </div>

        {/* Solution */}
        <div>
          <h4 className="text-sm font-semibold text-text mb-2">Rozwiazanie</h4>
          <p className="text-sm text-text-muted leading-relaxed">{idea.solution}</p>
        </div>

        {/* Architecture */}
        <div>
          <h4 className="text-sm font-semibold text-text mb-2">Architektura</h4>
          <p className="text-sm text-text-muted leading-relaxed">{idea.architecture}</p>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface-2 rounded-lg p-3">
            <p className="text-xs text-text-muted mb-1">Ryzyko</p>
            <p className="text-sm text-text">{idea.risk}</p>
            {idea.riskNote && (
              <p className="text-xs text-text-muted mt-1">{idea.riskNote}</p>
            )}
          </div>
          <div className="bg-surface-2 rounded-lg p-3">
            <p className="text-xs text-text-muted mb-1">MRR</p>
            <p className="text-sm text-text">{idea.mrr}</p>
          </div>
          <div className="bg-surface-2 rounded-lg p-3">
            <p className="text-xs text-text-muted mb-1">Potencjal</p>
            <p className="text-sm text-text capitalize">{idea.potential}</p>
          </div>
          <div className="bg-surface-2 rounded-lg p-3">
            <p className="text-xs text-text-muted mb-1">Self-service</p>
            <p className="text-sm text-text">{idea.selfService ? 'Tak' : 'Nie'}</p>
          </div>
        </div>

        {/* Action */}
        <div className="flex justify-end pt-2 border-t border-border">
          <Button
            variant={isSelected ? 'secondary' : 'primary'}
            onClick={() => onToggle(idea.id)}
          >
            {isSelected ? 'Odznacz' : 'Wybierz ten pomysl'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
