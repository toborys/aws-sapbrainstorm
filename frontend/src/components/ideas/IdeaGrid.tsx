import { useState } from 'react'
import { IdeaCard } from './IdeaCard'
import { IdeaModal } from './IdeaModal'
import type { Idea, IdeaCategory } from '../../types'

interface IdeaGridProps {
  ideas: Idea[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  categoryFilter: IdeaCategory | null
  onCategoryChange: (cat: IdeaCategory | null) => void
}

const categories: IdeaCategory[] = [
  'Monitoring',
  'Security',
  'Automation',
  'Migration',
  'Analytics',
  'Performance',
]

export function IdeaGrid({
  ideas,
  selectedIds,
  onToggle,
  categoryFilter,
  onCategoryChange,
}: IdeaGridProps) {
  const [modalIdea, setModalIdea] = useState<Idea | null>(null)

  const filteredIdeas = categoryFilter
    ? ideas.filter((i) => i.category === categoryFilter)
    : ideas

  return (
    <div>
      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${
            !categoryFilter
              ? 'bg-accent text-white'
              : 'bg-surface-2 text-text-muted hover:text-text border border-border'
          }`}
          onClick={() => onCategoryChange(null)}
        >
          Wszystkie
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${
              categoryFilter === cat
                ? 'bg-accent text-white'
                : 'bg-surface-2 text-text-muted hover:text-text border border-border'
            }`}
            onClick={() => onCategoryChange(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredIdeas.map((idea, idx) => (
          <IdeaCard
            key={idea.id}
            idea={idea}
            index={idx}
            isSelected={selectedIds.has(idea.id)}
            onToggle={onToggle}
            onViewDetails={setModalIdea}
          />
        ))}
      </div>

      {filteredIdeas.length === 0 && (
        <div className="text-center py-12 text-text-muted">
          <p>Brak pomyslow w tej kategorii.</p>
        </div>
      )}

      {/* Detail modal */}
      <IdeaModal
        idea={modalIdea}
        isOpen={!!modalIdea}
        onClose={() => setModalIdea(null)}
        isSelected={modalIdea ? selectedIds.has(modalIdea.id) : false}
        onToggle={onToggle}
      />
    </div>
  )
}
