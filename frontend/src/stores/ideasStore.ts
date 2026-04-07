import { create } from 'zustand'
import type { Idea, IdeaCategory } from '../types'
import * as api from '../api/client'

interface IdeasState {
  ideas: Idea[]
  selectedIds: Set<string>
  loading: boolean
  error: string | null
  categoryFilter: IdeaCategory | null

  fetchIdeas: () => Promise<void>
  toggleSelect: (id: string, maxSelections?: number) => boolean
  clearSelection: () => void
  setCategoryFilter: (category: IdeaCategory | null) => void
  setIdeas: (ideas: Idea[]) => void
}

export const useIdeasStore = create<IdeasState>((set, get) => ({
  ideas: [],
  selectedIds: new Set(),
  loading: false,
  error: null,
  categoryFilter: null,

  fetchIdeas: async () => {
    set({ loading: true, error: null })
    try {
      const ideas = await api.getIdeas()
      set({ ideas, loading: false })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },

  toggleSelect: (id: string, maxSelections = 5) => {
    const { selectedIds } = get()
    const next = new Set(selectedIds)

    if (next.has(id)) {
      next.delete(id)
      set({ selectedIds: next })
      return true
    }

    if (next.size >= maxSelections) {
      return false
    }

    next.add(id)
    set({ selectedIds: next })
    return true
  },

  clearSelection: () => set({ selectedIds: new Set() }),

  setCategoryFilter: (category) => set({ categoryFilter: category }),

  setIdeas: (ideas) => set({ ideas }),
}))
