import { useState, useEffect } from 'react'
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
  Pencil,
  Lightbulb,
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
import type { Idea } from '../../types'

function SortableIdea({
  idea,
  onToggleStatus,
  onEdit,
}: {
  idea: Idea
  onToggleStatus: (id: string) => void
  onEdit: (idea: Idea) => void
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
      className={`flex items-center gap-3 p-4 bg-surface border border-border rounded-lg group ${
        idea.status === 'hidden' ? 'opacity-50' : ''
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="p-1 text-text-muted hover:text-text cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <span className="text-xs font-mono text-text-muted w-6">{idea.order}</span>

      <Badge variant="info">{idea.category}</Badge>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-text font-medium truncate">{idea.name}</p>
        <p className="text-xs text-text-muted truncate">{idea.tagline}</p>
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
      </div>
    </div>
  )
}

export default function TeamIdeas() {
  const { ideas, fetchIdeas, setIdeas } = useIdeasStore()
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newTagline, setNewTagline] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    fetchIdeas()
  }, [fetchIdeas])

  const sorted = [...ideas].sort((a, b) => a.order - b.order)

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = sorted.findIndex((i) => i.id === active.id)
    const newIndex = sorted.findIndex((i) => i.id === over.id)
    const reordered = arrayMove(sorted, oldIndex, newIndex).map((idea, idx) => ({
      ...idea,
      order: idx + 1,
    }))
    setIdeas(reordered)
    // TODO: call api.reorderIdeas
  }

  const handleToggleStatus = (id: string) => {
    const updated = ideas.map((i) =>
      i.id === id ? { ...i, status: i.status === 'active' ? ('hidden' as const) : ('active' as const) } : i
    )
    setIdeas(updated)
    // TODO: call api.updateIdea
  }

  return (
    <AppShell topNav={<TopNav />} sidebar={<Sidebar />}>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl text-text mb-2">Pomysly</h1>
            <p className="text-text-muted">
              Zarzadzaj lista pomyslow, zmieniaj kolejnosc i widocznosc
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              icon={<Sparkles className="w-4 h-4" />}
              onClick={() => {
                /* TODO: AI generate */
              }}
            >
              Generuj AI
            </Button>
            <Button
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setShowAddModal(true)}
            >
              Dodaj pomysl
            </Button>
          </div>
        </div>

        {/* Sortable list */}
        <Card>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sorted.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {sorted.map((idea) => (
                  <SortableIdea
                    key={idea.id}
                    idea={idea}
                    onToggleStatus={handleToggleStatus}
                    onEdit={setEditingIdea}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {sorted.length === 0 && (
            <div className="text-center py-12 text-text-muted">
              <Lightbulb className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p>Brak pomyslow. Dodaj pierwszy pomysl lub wygeneruj za pomoca AI.</p>
            </div>
          )}
        </Card>
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
                onClick={() => {
                  // TODO: call api.updateIdea
                  setEditingIdea(null)
                }}
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
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>
              Anuluj
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                // TODO: call api.createIdea
                setShowAddModal(false)
                setNewName('')
                setNewTagline('')
              }}
            >
              Dodaj
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  )
}
