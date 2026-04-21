import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { VotingSession } from '../types'
import * as api from '../api/client'

export interface SubmitVotesInput {
  ideaIds: string[]
  customIdea?: string
  ranking?: string[]
  wtpBand?: string
  urgency?: string
  pilotOptIn?: boolean
  pilotEmail?: string
}

interface VotesState {
  votes: VotingSession | null
  hasVoted: boolean
  loading: boolean
  error: string | null
  submitting: boolean

  submitVotes: (input: SubmitVotesInput) => Promise<boolean>
  fetchMyVotes: () => Promise<void>
  checkVotingStatus: () => Promise<void>
}

export const useVotesStore = create<VotesState>()(
  persist(
    (set) => ({
      votes: null,
      hasVoted: false,
      loading: false,
      error: null,
      submitting: false,

      submitVotes: async (input) => {
        set({ submitting: true, error: null })
        try {
          const result = await api.submitVotes(input)
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

      checkVotingStatus: async () => {
        try {
          const votes = await api.getMyVotes()
          set({ votes, hasVoted: !!votes })
        } catch {
          // Not voted or error — leave hasVoted as-is
        }
      },
    }),
    {
      name: 'apx-votes',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        hasVoted: state.hasVoted,
        votes: state.votes,
      }),
    },
  ),
)
