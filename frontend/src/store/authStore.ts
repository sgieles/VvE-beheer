import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, VvE } from '@/types'

interface AuthState {
  token: string | null
  user: User | null
  activeVveId: number | null
  activeVve: VvE | null
  setToken: (token: string) => void
  setUser: (user: User) => void
  setActiveVve: (vve: VvE) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      activeVveId: null,
      activeVve: null,
      setToken: (token) => set({ token }),
      setUser: (user) => set({
        user,
        // Bij inloggen: zet activeVveId op de home-VvE van de gebruiker
        activeVveId: user.vve_id ?? null,
      }),
      setActiveVve: (vve) => set({ activeVve: vve, activeVveId: vve.id }),
      logout: () => set({ token: null, user: null, activeVveId: null, activeVve: null }),
    }),
    { name: 'vve-auth' }
  )
)
