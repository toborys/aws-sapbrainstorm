import { create } from 'zustand'

interface AuthState {
  user: { userId: string; email: string; company: string; role: string } | null
  token: string | null
  isAuthenticated: boolean
  poolType: 'customer' | 'team' | null
  login: (user: AuthState['user'], token: string, poolType: 'customer' | 'team') => void
  logout: () => void
  setToken: (token: string) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  poolType: null,

  login: (user, token, poolType) =>
    set({
      user,
      token,
      isAuthenticated: true,
      poolType,
    }),

  logout: () =>
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      poolType: null,
    }),

  setToken: (token) => set({ token }),
}))
