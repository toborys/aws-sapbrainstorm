import { create } from 'zustand'
import type { VotingSession } from '../types'
import * as api from '../api/client'

interface VotesState {
  votes: VotingSession | null
  hasVoted: boolean
  loading: boolean
  error: string | null
  submitting: boolean

  submitVotes: (ideaIds: string[], customIdea?: string) => Promise<boolean>
  fetchMyVotes: () => Promise<void>
}

export const useVotesStore = create<VotesState>((set) => ({
  votes: null,
  hasVoted: false,
  loading: false,
  error: null,
  submitting: false,

  submitVotes: async (ideaIds, customIdea) => {
    set({ submitting: true, error: null })
    try {
      const result = await api.submitVotes({ ideaIds, customIdea })
      set({ votes: result, hasVoted: true, submitting: false })
      return true
    } catch (err) {
      set({ error: (err as Error).message, submitting: false })
      return false
    }
  },

  fetchMyVotes: async () => {
    set({ loading: true, error: null })
    try {
      const votes = await api.getMyVotes()
      set({ votes, hasVoted: !!votes, loading: false })
    } catch (err) {
      set({ hasVoted: false, loading: false, error: (err as Error).message })
    }
  },
}))
