import { Check } from 'lucide-react'
import { Badge } from '../ui/Badge'
import type { Idea } from '../../types'

interface IdeaCardProps {
  idea: Idea
  index: number
  isSelected: boolean
  onToggle: (id: string) => void
  onViewDetails?: (idea: Idea) => void
}

const categoryBadgeVariant: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  Monitoring: 'info',
  Security: 'danger',
  Automation: 'success',
  Migration: 'warning',
  Analytics: 'default',
  Performance: 'info',
}

const complexityLabel: Record<string, string> = {
  low: 'Niska',
  medium: 'Srednia',
  high: 'Wysoka',
}

export function IdeaCard({ idea, index, isSelected, onToggle, onViewDetails }: IdeaCardProps) {
  return (
    <div
      className={`relative group bg-surface border rounded-xl p-5 transition-all duration-300 cursor-pointer ${
        isSelected
          ? 'border-accent shadow-lg shadow-accent/10 ring-1 ring-accent/30'
          : 'border-border hover:border-accent/30 hover:shadow-md hover:shadow-accent/5'
      }`}
      onClick={() => onViewDetails?.(idea)}
    >
      {/* Number badge */}
      <div className="absolute -top-3 -left-2 w-7 h-7 bg-surface-2 border border-border rounded-full flex items-center justify-center text-xs font-mono text-text-muted">
        {index + 1}
      </div>

      {/* Select toggle */}
      <button
        className={`absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
          isSelected
            ? 'bg-accent text-white'
            : 'bg-surface-2 border border-border text-text-muted hover:border-accent/50 hover:text-accent'
        }`}
        onClick={(e) => {
          e.stopPropagation()
          onToggle(idea.id)
        }}
      >
        {isSelected && <Check className="w-4 h-4" />}
      </button>

      {/* Category */}
      <div className="mb-3">
        <Badge variant={categoryBadgeVariant[idea.category] || 'default'}>
          {idea.category}
        </Badge>
      </div>

      {/* Name */}
      <h3 className="font-display text-lg text-text mb-1 pr-8 leading-tight">
        {idea.name}
      </h3>

      {/* Tagline */}
      <p className="text-sm text-text-muted mb-3 line-clamp-2">{idea.tagline}</p>

      {/* Problem excerpt */}
      <p className="text-xs text-text-muted/70 mb-4 line-clamp-2">{idea.problem}</p>

      {/* Tags */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs px-2 py-1 rounded bg-surface-2 text-text-muted">
          {complexityLabel[idea.complexity] || idea.complexity}
        </span>
        <span className="text-xs px-2 py-1 rounded bg-surface-2 text-text-muted">
          {idea.mvpTime}
        </span>
        <span className="text-xs px-2 py-1 rounded bg-surface-2 text-text-muted">
          {idea.model}
        </span>
      </div>
    </div>
  )
}
