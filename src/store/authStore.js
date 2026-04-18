import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '@/services/api'

// ============================================================
//  Store Zustand — Authentification
//  Persiste le token en localStorage
// ============================================================

const useAuthStore = create(
  persist(
    (set, get) => ({
      user:         null,
      accessToken:  null,
      refreshToken: null,
      isLoading:    false,
      error:        null,

      // ---- Login ----
      login: async (email, password) => {
        set({ isLoading: true, error: null })
        try {
          const { data } = await api.post('/auth/login', { email, password })
          set({
            user:         data.user,
            accessToken:  data.accessToken,
            refreshToken: data.refreshToken,
            isLoading:    false,
          })
          api.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`
          return { ok: true }
        } catch (err) {
          const msg = err.response?.data?.error || 'Erreur de connexion'
          set({ isLoading: false, error: msg })
          return { ok: false, error: msg }
        }
      },

      // ---- Register ----
      register: async (payload) => {
        set({ isLoading: true, error: null })
        try {
          const { data } = await api.post('/auth/register', payload)
          set({
            user:         data.user,
            accessToken:  data.accessToken,
            refreshToken: data.refreshToken,
            isLoading:    false,
          })
          api.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`
          return { ok: true }
        } catch (err) {
          const msg = err.response?.data?.error || "Erreur lors de l'inscription"
          set({ isLoading: false, error: msg })
          return { ok: false, error: msg }
        }
      },

      // ---- Logout ----
      logout: async () => {
        const { refreshToken } = get()
        try {
          await api.post('/auth/logout', { refreshToken })
        } catch {}
        delete api.defaults.headers.common['Authorization']
        set({ user: null, accessToken: null, refreshToken: null, error: null })
      },

      // ---- Refresh token ----
      refresh: async () => {
        const { refreshToken } = get()
        if (!refreshToken) return false
        try {
          const { data } = await api.post('/auth/refresh', { refreshToken })
          set({ accessToken: data.accessToken, refreshToken: data.refreshToken })
          api.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`
          return true
        } catch {
          set({ user: null, accessToken: null, refreshToken: null })
          return false
        }
      },

      setUser: (user) => set({ user }),
      clearError: () => set({ error: null }),
    }),
    {
      name: 'yobaleema-auth',
      partialize: (state) => ({
        user:         state.user,
        accessToken:  state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
)

export default useAuthStore
