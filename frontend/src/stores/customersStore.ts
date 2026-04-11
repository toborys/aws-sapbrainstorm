import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import * as api from '../api/client'
import type { UserProfile } from '../types'

interface CustomersState {
  customers: UserProfile[]
  loading: boolean
  error: string | null
  fetchCustomers: () => Promise<void>
}

export const useCustomersStore = create<CustomersState>()(
  persist(
    (set) => ({
      customers: [],
      loading: false,
      error: null,
      fetchCustomers: async () => {
        set({ loading: true, error: null })
        try {
          const customers = await api.getCustomers()
          set({ customers, loading: false })
        } catch (err) {
          set({ error: (err as Error).message, loading: false })
        }
      },
    }),
    {
      name: 'apx-customers',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ customers: state.customers }),
    },
  ),
)
