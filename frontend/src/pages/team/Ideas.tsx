import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical,
  Plus,
  Sparkles,
  Eye,
  EyeOff,
  Archive,
  Pencil,
  Lightbulb,
  Search,
  LayoutGrid,
  List,
} from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { TopNav } from '../../components/layout/TopNav'
import { Sidebar } from '../../components/layout/Sidebar'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Textarea } from '../../components/ui/Textarea'
import { useIdeasStore } from '../../stores/ideasStore'
import { useUiStore } from '../../stores/uiStore'
import { createIdea, updateIdea, reorderIdeas } from '../../api/client'
import type { Idea, IdeaCategory } from '../../types'

const CATEGORIES: IdeaCategory[] = [
  'Monitoring & Observability',
  'Security & Compliance',
  'Automation',
  'Migration & Modernization',
  'Analytics & Insights',
  'Performance Testing',
  'Cloud & Infrastructure',
  'SAP Solutions',
  'AI & Machine Learning',
  'Cybersecurity',
  'SaaS Products',
  'Professional Services',
  'Sales & Go-to-Market',
  'Customer Success',
  'Internal Tools & Automation',
  'Data & Analytics',
]

const CATEGORY_SHORT_LABELS: Record<string, string> = {
  'Monitoring & Observability': 'Monitoring',
  'Security & Compliance': 'Security',
  'Automation': 'Automation',
  'Migration & Modernization': 'Migration',
  'Analytics & Insights': 'Analytics',
  'Performance Testing': 'Performance',
  'Cloud & Infrastructure': 'Cloud',
  'SAP Solutions': 'SAP',
  'AI & Machine Learning': 'AI/ML',
  'Cybersecurity': 'Cybersecurity',
  'SaaS Products': 'SaaS',
  'Professional Services': 'Services',
  'Sales & Go-to-Market': 'Sales/GTM',
  'Customer Success': 'CS',
  'Internal Tools & Automation': 'Internal',
  'Data & Analytics': 'Data',
}

const categoryBadgeVariant: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  'Monitoring & Observability': 'info',
  'Security & Compliance': 'danger',
  'Automation': 'success',
  'Migration & Modernization': 'warning',
  'Analytics & Insights': 'default',
  'Performance Testing': 'info',
  'Cloud & Infrastructure': 'info',
  'SAP Solutions': 'warning',
  'AI & Machine Learning': 'success',
  'Cybersecurity': 'danger',
  'SaaS Products': 'success',
  'Professional Services': 'default',
  'Sales & Go-to-Market': 'warning',
  'Customer Success': 'info',
  'Internal Tools & Automation': 'default',
  'Data & Analytics': 'info',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktywny',
  hidden: 'Ukryty',
  archived: 'Zarchiwizowany',
}

function SortableIdea({
  idea,
  onToggleStatus,
  onEdit,
  onArchive,
}: {
  idea: Idea
  onToggleStatus: (id: string) => void
  onEdit: (idea: Idea) => void
  onArchive: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: idea.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-4 bg-surface/60 backdrop-blur-sm border border-border rounded-xl group transition-all duration-200 hover:border-border-hover ${
        idea.status === 'hidden' ? 'opacity-50' : ''
      } ${idea.status === 'archived' ? 'opacity-30' : ''}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="p-1 text-text-muted hover:text-text cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <span className="text-xs font-mono text-text-muted w-6">{idea.order}</span>

      <Badge variant={categoryBadgeVariant[idea.category] || 'default'}>{idea.category}</Badge>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-text font-medium truncate">{idea.name}</p>
        <p className="text-xs text-text-muted truncate">{idea.tagline}</p>
      </div>

      <div className="flex items-center gap-2">
        {idea.status !== 'active' && (
          <span className="text-xs px-2 py-0.5 rounded bg-surface-2 text-text-muted hidden sm:inline">
            {STATUS_LABELS[idea.status] || idea.status}
          </span>
        )}
        {idea.complexity && (
          <span className="text-xs px-2 py-0.5 rounded bg-surface-2 text-text-muted hidden sm:inline">
            {idea.complexity === 'low' ? 'Niska' : idea.complexity === 'high' ? 'Wysoka' : 'Srednia'}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onToggleStatus(idea.id)}
          className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
          title={idea.status === 'active' ? 'Ukryj' : 'Pokaz'}
        >
          {idea.status === 'active' ? (
            <EyeOff className="w-4 h-4" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
        </button>
        <button
          onClick={() => onEdit(idea)}
          className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
          title="Edytuj"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={() => onArchive(idea.id)}
          className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-surface-2 transition-colors cursor-pointer"
          title="Archiwizuj"
        >
          <Archive className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function IdeaGridCard({
  idea,
  onToggleStatus,
  onEdit,
  onArchive,
}: {
  idea: Idea
  onToggleStatus: (id: string) => void
  onEdit: (idea: Idea) => void
  onArchive: (id: string) => void
}) {
  return (
    <Card
      interactive
      className={`relative group ${idea.status === 'hidden' ? 'opacity-50' : ''} ${idea.status === 'archived' ? 'opacity-30' : ''}`}
    >
      <div className="absolute -top-2 -left-2 w-7 h-7 bg-surface-2 border border-border rounded-full flex items-center justify-center text-xs font-mono text-text-muted">
        {idea.order}
      </div>

      <div className="flex items-center gap-1 absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onToggleStatus(idea.id)}
          className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
        >
          {idea.status === 'active' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
        <button
          onClick={() => onEdit(idea)}
          className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={() => onArchive(idea.id)}
          className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-surface-2 transition-colors cursor-pointer"
        >
          <Archive className="w-4 h-4" />
        </button>
      </div>

      <Badge variant={categoryBadgeVariant[idea.category] || 'default'} className="mb-3">
        {idea.category}
      </Badge>

      {idea.status !== 'active' && (
        <span className="text-xs px-2 py-0.5 rounded bg-surface-2 text-text-muted mb-2 inline-block">
          {STATUS_LABELS[idea.status] || idea.status}
        </span>
      )}

      <h3 className="font-display text-lg text-text mb-1 pr-16 leading-tight">{idea.name}</h3>
      <p className="text-sm text-accent italic mb-2">{idea.tagline}</p>
      <p className="text-xs text-text-muted line-clamp-2 mb-3">{idea.problem}</p>

      <div className="flex flex-wrap gap-2">
        {idea.complexity && (
          <span className="text-xs px-2 py-1 rounded bg-surface-2 text-text-muted">
            {idea.complexity === 'low' ? 'Niska' : idea.complexity === 'high' ? 'Wysoka' : 'Srednia'}
          </span>
        )}
        {idea.mvpTime && (
          <span className="text-xs px-2 py-1 rounded bg-surface-2 text-text-muted">{idea.mvpTime}</span>
        )}
        {idea.model && (
          <span className="text-xs px-2 py-1 rounded bg-surface-2 text-text-muted">{idea.model}</span>
        )}
      </div>
    </Card>
  )
}

export default function TeamIdeas() {
  const navigate = useNavigate()
  const { ideas, fetchIdeas, setIdeas } = useIdeasStore()
  const { addToast } = useUiStore()
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newTagline, setNewTagline] = useState('')
  const [newCategory, setNewCategory] = useState<IdeaCategory>('Monitoring & Observability')
  const [newProblem, setNewProblem] = useState('')
  const [newSolution, setNewSolution] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<IdeaCategory | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    try {
      const saved = localStorage.getItem('apx-ideas-view-mode')
      if (saved === 'list' || saved === 'grid') return saved
    } catch {
      // Ignore
    }
    return 'list'
  })
  const [_saving, setSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    fetchIdeas()
  }, [fetchIdeas])

  // Persist viewMode to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('apx-ideas-view-mode', viewMode)
    } catch {
      // Ignore
    }
  }, [viewMode])

  const sorted = [...ideas].sort((a, b) => a.order - b.order)

  const filtered = sorted.filter((idea) => {
    const matchesSearch =
      !searchQuery ||
      idea.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      idea.tagline.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = !categoryFilter || idea.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = sorted.findIndex((i) => i.id === active.id)
    const newIndex = sorted.findIndex((i) => i.id === over.id)
    const reordered = arrayMove(sorted, oldIndex, newIndex).map((idea, idx) => ({
      ...idea,
      order: idx + 1,
    }))
    setIdeas(reordered)

    try {
      await reorderIdeas(reordered.map((i) => i.id))
    } catch (err) {
      addToast({ type: 'error', message: `Blad zmiany kolejnosci: ${(err as Error).message}` })
      fetchIdeas()
    }
  }

  const handleToggleStatus = async (id: string) => {
    const idea = ideas.find((i) => i.id === id)
    if (!idea) return

    const newStatus = idea.status === 'active' ? 'hidden' : 'active'
    const updated = ideas.map((i) =>
      i.id === id ? { ...i, status: newStatus as Idea['status'] } : i
    )
    setIdeas(updated)

    try {
      await updateIdea(id, { status: newStatus as Idea['status'] })
      addToast({ type: 'success', message: newStatus === 'hidden' ? 'Pomysl ukryty' : 'Pomysl widoczny' })
      fetchIdeas()
    } catch (err) {
      addToast({ type: 'error', message: `Blad: ${(err as Error).message}` })
      fetchIdeas()
    }
  }

  const handleArchive = async (id: string) => {
    const updated = ideas.map((i) =>
      i.id === id ? { ...i, status: 'archived' as Idea['status'] } : i
    )
    setIdeas(updated)

    try {
      await updateIdea(id, { status: 'archived' })
      addToast({ type: 'success', message: 'Pomysl zarchiwizowany' })
      fetchIdeas()
    } catch (err) {
      addToast({ type: 'error', message: `Blad: ${(err as Error).message}` })
      fetchIdeas()
    }
  }

  const handleAddIdea = async () => {
    setSaving(true)
    try {
      await createIdea({
        name: newName,
        tagline: newTagline,
        category: newCategory,
        problem: newProblem,
        solution: newSolution,
        status: 'active',
        order: ideas.length + 1,
      })
      addToast({ type: 'success', message: `Dodano "${newName}"` })
      setShowAddModal(false)
      setNewName('')
      setNewTagline('')
      setNewProblem('')
      setNewSolution('')
      fetchIdeas()
    } catch (err) {
      addToast({ type: 'error', message: `Blad: ${(err as Error).message}` })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!editingIdea) return
    setSaving(true)
    try {
      await updateIdea(editingIdea.id, editingIdea)
      addToast({ type: 'success', message: `Zapisano "${editingIdea.name}"` })
      setEditingIdea(null)
      fetchIdeas()
    } catch (err) {
      addToast({ type: 'error', message: `Blad: ${(err as Error).message}` })
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell topNav={<TopNav />} sidebar={<Sidebar />}>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8 animate-fade-in">
          <div>
            <h1 className="font-display text-3xl text-text mb-2 tracking-tight">Pomysly</h1>
            <p className="text-text-secondary">
              Zarzadzaj lista pomyslow, zmieniaj kolejnosc i widocznosc
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              icon={<Sparkles className="w-4 h-4" />}
              onClick={() => navigate('/team/brainstorm')}
            >
              Burza mozgow AI
            </Button>
            <Button
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setShowAddModal(true)}
            >
              Dodaj recznie
            </Button>
          </div>
        </div>

        {/* Search and filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Szukaj pomyslow..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-surface-2/60 backdrop-blur-sm border border-border rounded-xl text-text text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/30 transition-all duration-200"
            />
          </div>

          {/* Category filter pills */}
          <div className="flex flex-wrap gap-1.5">
            <button
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer ${
                !categoryFilter
                  ? 'bg-accent/15 text-accent border border-accent/25'
                  : 'bg-surface-2/60 text-text-muted border border-border hover:border-border-hover hover:text-text-secondary'
              }`}
              onClick={() => setCategoryFilter(null)}
            >
              Wszystkie
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer ${
                  categoryFilter === cat
                    ? 'bg-accent/15 text-accent border border-accent/25'
                    : 'bg-surface-2/60 text-text-muted border border-border hover:border-border-hover hover:text-text-secondary'
                }`}
                onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
              >
                {CATEGORY_SHORT_LABELS[cat] || cat}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex gap-1 bg-surface-2/60 backdrop-blur-sm rounded-xl p-1 border border-border">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
                viewMode === 'list' ? 'bg-surface-3 text-text shadow-sm' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
                viewMode === 'grid' ? 'bg-surface-3 text-text shadow-sm' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Ideas display */}
        {viewMode === 'list' ? (
          <Card>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={filtered.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {filtered.map((idea) => (
                    <SortableIdea
                      key={idea.id}
                      idea={idea}
                      onToggleStatus={handleToggleStatus}
                      onEdit={setEditingIdea}
                      onArchive={handleArchive}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {filtered.length === 0 && (
              <div className="text-center py-12 text-text-muted">
                <Lightbulb className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p>Brak pomyslow pasujacych do filtrow.</p>
              </div>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((idea) => (
              <IdeaGridCard
                key={idea.id}
                idea={idea}
                onToggleStatus={handleToggleStatus}
                onEdit={setEditingIdea}
                onArchive={handleArchive}
              />
            ))}
            {filtered.length === 0 && (
              <div className="col-span-3 text-center py-12 text-text-muted">
                <Lightbulb className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p>Brak pomyslow pasujacych do filtrow.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit modal */}
      <Modal
        isOpen={!!editingIdea}
        onClose={() => setEditingIdea(null)}
        title="Edytuj pomysl"
        size="lg"
      >
        {editingIdea && (
          <div className="space-y-4">
            <Input
              label="Nazwa"
              value={editingIdea.name}
              onChange={(e) => setEditingIdea({ ...editingIdea, name: e.target.value })}
            />
            <Input
              label="Tagline"
              value={editingIdea.tagline}
              onChange={(e) => setEditingIdea({ ...editingIdea, tagline: e.target.value })}
            />
            <Textarea
              label="Problem"
              value={editingIdea.problem}
              onChange={(e) => setEditingIdea({ ...editingIdea, problem: e.target.value })}
            />
            <Textarea
              label="Rozwiazanie"
              value={editingIdea.solution}
              onChange={(e) => setEditingIdea({ ...editingIdea, solution: e.target.value })}
            />
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={() => setEditingIdea(null)}>
                Anuluj
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveEdit}
              >
                Zapisz
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Nowy pomysl"
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Nazwa"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nazwa pomyslu..."
          />
          <Input
            label="Tagline"
            value={newTagline}
            onChange={(e) => setNewTagline(e.target.value)}
            placeholder="Krotki opis..."
          />
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Kategoria</label>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as IdeaCategory)}
              className="w-full px-4 py-2.5 bg-surface-2/60 backdrop-blur-sm border border-border rounded-xl text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/30 transition-all duration-200"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_SHORT_LABELS[cat] || cat}
                </option>
              ))}
            </select>
          </div>
          <Textarea
            label="Problem"
            value={newProblem}
            onChange={(e) => setNewProblem(e.target.value)}
            placeholder="Jaki problem rozwiazuje..."
          />
          <Textarea
            label="Rozwiazanie"
            value={newSolution}
            onChange={(e) => setNewSolution(e.target.value)}
            placeholder="Opis rozwiazania..."
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>
              Anuluj
            </Button>
            <Button variant="primary" onClick={handleAddIdea} disabled={!newName}>
              Dodaj
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  )
}
