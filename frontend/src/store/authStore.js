import { create } from 'zustand'
import { persist  } from 'zustand/middleware'
import { authAPI  } from '@/services/api'

const useAuthStore = create(
  persist(
    (set, get) => ({
      user:         null,
      accessToken:  null,
      refreshToken: null,
      isLoading:    false,
      error:        null,

      login: async (email, password) => {
        set({ isLoading: true, error: null })
        try {
          const { data } = await authAPI.login({ email, password })
          const { accessToken, refreshToken, user } = data.data
          set({ user, accessToken, refreshToken, isLoading: false })
          return { ok: true }
        } catch (err) {
          const msg = err.response?.data?.error || 'Erreur de connexion'
          set({ isLoading: false, error: msg })
          return { ok: false, error: msg }
        }
      },

      register: async (payload) => {
        set({ isLoading: true, error: null })
        try {
          const { data } = await authAPI.register(payload)
          const { accessToken, refreshToken, user } = data.data
          set({ user, accessToken, refreshToken, isLoading: false })
          return { ok: true }
        } catch (err) {
          const msg = err.response?.data?.error || "Erreur lors de l'inscription"
          set({ isLoading: false, error: msg })
          return { ok: false, error: msg }
        }
      },

      logout: async () => {
        const { refreshToken } = get()
        try { await authAPI.logout({ refreshToken }) } catch {}
        set({ user: null, accessToken: null, refreshToken: null, error: null })
      },

      clearError: () => set({ error: null }),
      setUser:    (u) => set({ user: u }),
    }),
    {
      name: 'yoba-auth',
      partialize: (s) => ({ user: s.user, accessToken: s.accessToken, refreshToken: s.refreshToken }),
    }
  )
)

export default useAuthStore
