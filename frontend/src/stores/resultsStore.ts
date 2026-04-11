import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import * as api from '../api/client'
import type { VoteResults, CustomIdea } from '../types'

interface ResultsState {
  voteResults: VoteResults | null
  customIdeas: CustomIdea[]
  loading: boolean
  error: string | null
  fetchResults: () => Promise<void>
  fetchCustomIdeas: () => Promise<void>
  fetchAll: () => Promise<void>
}

export const useResultsStore = create<ResultsState>()(
  persist(
    (set) => ({
      voteResults: null,
      customIdeas: [],
      loading: false,
      error: null,
      fetchResults: async () => {
        try {
          const voteResults = await api.getVoteResults()
          set({ voteResults })
        } catch (err) {
          set({ error: (err as Error).message })
        }
      },
      fetchCustomIdeas: async () => {
        try {
          const customIdeas = await api.getCustomIdeas()
          set({ customIdeas })
        } catch (err) {
          set({ error: (err as Error).message })
        }
      },
      fetchAll: async () => {
        set({ loading: true, error: null })
        try {
          const [voteResults, customIdeas] = await Promise.all([
            api.getVoteResults().catch(() => null),
            api.getCustomIdeas().catch(() => []),
          ])
          set({ voteResults, customIdeas: customIdeas as CustomIdea[], loading: false })
        } catch (err) {
          set({ error: (err as Error).message, loading: false })
        }
      },
    }),
    {
      name: 'apx-results',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        voteResults: state.voteResults,
        customIdeas: state.customIdeas,
      }),
    },
  ),
)
