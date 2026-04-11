import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface AuthState {
  user: { userId: string; email: string; company: string; role: string } | null
  token: string | null
  isAuthenticated: boolean
  poolType: 'customer' | 'team' | null
  login: (user: AuthState['user'], token: string, poolType: 'customer' | 'team') => void
  logout: () => void
  setToken: (token: string) => void
}

function isTokenExpired(token: string): boolean {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const claims = JSON.parse(atob(base64))
    return Date.now() >= claims.exp * 1000
  } catch {
    return true
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      poolType: null,

      login: (user, token, poolType) =>
        set({ user, token, isAuthenticated: true, poolType }),

      logout: () =>
        set({ user: null, token: null, isAuthenticated: false, poolType: null }),

      setToken: (token) => set({ token }),
    }),
    {
      name: 'apx-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        poolType: state.poolType,
      }),
    },
  ),
)

// Check token expiry on load
const state = useAuthStore.getState()
if (state.token && isTokenExpired(state.token)) {
  useAuthStore.getState().logout()
}
