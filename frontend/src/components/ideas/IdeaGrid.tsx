import { useState, useMemo } from 'react'
import { Search, Filter, X } from 'lucide-react'
import { IdeaCard } from './IdeaCard'
import { IdeaModal } from './IdeaModal'
import type { Idea, IdeaCategory } from '../../types'

interface IdeaGridProps {
  ideas: Idea[]
  selectedIds: string[]
  onToggle: (id: string) => void
  categoryFilter: IdeaCategory | null
  onCategoryChange: (cat: IdeaCategory | null) => void
  variant?: 'vote' | 'manage'
  onToggleStatus?: (id: string) => void
  onEdit?: (idea: Idea) => void
}

const categories: IdeaCategory[] = [
  'Monitoring & Observability',
  'Security & Compliance',
  'Automation',
  'Migration & Modernization',
  'Analytics & Insights',
  'Performance Testing',
]

const technicalCategories: IdeaCategory[] = ['Monitoring & Observability', 'Security & Compliance', 'Performance Testing', 'Automation']
const businessCategories: IdeaCategory[] = ['Migration & Modernization', 'Analytics & Insights']

const categoryColors: Record<string, string> = {
  'Monitoring & Observability': '#4a9eff',
  'Security & Compliance': '#f87171',
  'Automation': '#34d399',
  'Migration & Modernization': '#fbbf24',
  'Analytics & Insights': '#a78bfa',
  'Performance Testing': '#ff9900',
}

const categoryShortNames: Record<string, string> = {
  'Monitoring & Observability': 'Monitoring',
  'Security & Compliance': 'Security',
  'Automation': 'Automation',
  'Migration & Modernization': 'Migration',
  'Analytics & Insights': 'Analytics',
  'Performance Testing': 'Performance',
}

export function IdeaGrid({
  ideas,
  selectedIds,
  onToggle,
  categoryFilter,
  onCategoryChange,
  variant = 'vote',
  onToggleStatus,
  onEdit,
}: IdeaGridProps) {
  const [modalIdea, setModalIdea] = useState<Idea | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryGroup, setCategoryGroup] = useState<'all' | 'technical' | 'business'>('all')

  const visibleCategories = useMemo(() => {
    if (categoryGroup === 'technical') return technicalCategories
    if (categoryGroup === 'business') return businessCategories
    return categories
  }, [categoryGroup])

  const filteredIdeas = useMemo(() => {
    let filtered = ideas

    // Category filter
    if (categoryFilter) {
      filtered = filtered.filter((i) => i.category === categoryFilter)
    } else if (categoryGroup !== 'all') {
      const groupCats = categoryGroup === 'technical' ? technicalCategories : businessCategories
      filtered = filtered.filter((i) => groupCats.includes(i.category))
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.tagline.toLowerCase().includes(q) ||
          i.problem.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q),
      )
    }

    return filtered
  }, [ideas, categoryFilter, categoryGroup, searchQuery])

  return (
    <div>
      {/* Search + Group toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
        {/* Search bar */}
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Szukaj pomyslow..."
            className="w-full pl-10 pr-8 py-2.5 bg-surface-2/60 backdrop-blur-sm border border-border rounded-xl text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/30 transition-all duration-200"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category group toggle */}
        <div className="flex items-center gap-1 p-1 bg-surface-2/60 backdrop-blur-sm rounded-xl border border-border">
          <GroupToggle
            active={categoryGroup === 'all'}
            onClick={() => { setCategoryGroup('all'); onCategoryChange(null) }}
            label="Wszystkie"
          />
          <GroupToggle
            active={categoryGroup === 'technical'}
            onClick={() => { setCategoryGroup('technical'); onCategoryChange(null) }}
            label="Techniczne"
          />
          <GroupToggle
            active={categoryGroup === 'business'}
            onClick={() => { setCategoryGroup('business'); onCategoryChange(null) }}
            label="Biznesowe"
          />
        </div>
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Filter className="w-3.5 h-3.5 text-text-muted mr-1" />
        <button
          className={`
            px-3 py-1.5 rounded-xl text-xs font-medium
            transition-all duration-200 cursor-pointer
            ${!categoryFilter
              ? 'bg-accent/15 text-accent border border-accent/25'
              : 'bg-surface-2/60 text-text-muted border border-border hover:border-border-hover hover:text-text-secondary'
            }
          `}
          onClick={() => onCategoryChange(null)}
        >
          Wszystkie
        </button>
        {visibleCategories.map((cat) => (
          <button
            key={cat}
            className={`
              px-3 py-1.5 rounded-xl text-xs font-medium
              transition-all duration-200 cursor-pointer
              flex items-center gap-1.5
              ${categoryFilter === cat
                ? 'bg-accent/15 text-accent border border-accent/25'
                : 'bg-surface-2/60 text-text-muted border border-border hover:border-border-hover hover:text-text-secondary'
              }
            `}
            onClick={() => onCategoryChange(cat)}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: categoryColors[cat] }}
            />
            {categoryShortNames[cat] || cat}
          </button>
        ))}

        {/* Count */}
        <span className="ml-auto text-xs text-text-muted">
          {filteredIdeas.length} z {ideas.length} pomyslow
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredIdeas.map((idea, idx) => (
          <IdeaCard
            key={idea.id}
            idea={idea}
            index={idx}
            selected={selectedIds.includes(idea.id)}
            onSelect={() => onToggle(idea.id)}
            onViewDetails={() => setModalIdea(idea)}
            variant={variant}
            onToggleStatus={onToggleStatus}
            onEdit={onEdit}
          />
        ))}
      </div>

      {filteredIdeas.length === 0 && (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-surface-2/60 mb-4 border border-border">
            <Search className="w-7 h-7 text-text-muted" />
          </div>
          <p className="text-text-secondary text-sm mb-1">
            Brak pomyslow w tej kategorii.
          </p>
          <p className="text-text-muted text-xs">
            Sprobuj zmienic filtr lub wyszukiwanie.
          </p>
        </div>
      )}

      {/* Detail modal */}
      <IdeaModal
        idea={modalIdea}
        isOpen={!!modalIdea}
        onClose={() => setModalIdea(null)}
        isSelected={modalIdea ? selectedIds.includes(modalIdea.id) : false}
        onToggle={onToggle}
        variant={variant}
      />
    </div>
  )
}

function GroupToggle({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-3 py-1.5 rounded-lg text-xs font-medium
        transition-all duration-200 cursor-pointer
        ${active
          ? 'bg-surface-3 text-text shadow-sm'
          : 'text-text-muted hover:text-text-secondary'
        }
      `}
    >
      {label}
    </button>
  )
}
