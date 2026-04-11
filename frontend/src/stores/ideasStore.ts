import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Idea, IdeaCategory } from '../types'
import * as api from '../api/client'

interface IdeasState {
  ideas: Idea[]
  selectedIds: string[]
  loading: boolean
  error: string | null
  categoryFilter: IdeaCategory | null

  fetchIdeas: () => Promise<void>
  toggleSelect: (id: string, maxSelections?: number) => boolean
  clearSelection: () => void
  setCategoryFilter: (category: IdeaCategory | null) => void
  setIdeas: (ideas: Idea[]) => void
}

export const useIdeasStore = create<IdeasState>()(
  persist(
    (set, get) => ({
      ideas: [],
      selectedIds: [],
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

        if (selectedIds.includes(id)) {
          set({ selectedIds: selectedIds.filter((sid) => sid !== id) })
          return true
        }

        if (selectedIds.length >= maxSelections) {
          return false
        }

        set({ selectedIds: [...selectedIds, id] })
        return true
      },

      clearSelection: () => set({ selectedIds: [] }),

      setCategoryFilter: (category) => set({ categoryFilter: category }),

      setIdeas: (ideas) => set({ ideas }),
    }),
    {
      name: 'apx-ideas',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        ideas: state.ideas,
        selectedIds: state.selectedIds,
      }),
    },
  ),
)
