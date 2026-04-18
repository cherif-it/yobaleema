// ================================================================
//  services/api.js — Client HTTP centralisé
//  Toutes les requêtes passent par le Gateway (port 4000)
//  Refresh JWT automatique sur 401
// ================================================================

import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000',
  timeout: 12000,
  headers: { 'Content-Type': 'application/json' },
})

// ---- Injecter le token JWT ----
api.interceptors.request.use((config) => {
  try {
    const stored = JSON.parse(localStorage.getItem('yoba-auth') || '{}')
    const token  = stored?.state?.accessToken
    if (token) config.headers['Authorization'] = `Bearer ${token}`
  } catch {}
  return config
})

// ---- Refresh automatique sur 401 ----
let isRefreshing  = false
let refreshQueue  = []

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => refreshQueue.push({ resolve, reject }))
          .then(() => api(original))
      }
      original._retry = true
      isRefreshing    = true
      try {
        const stored = JSON.parse(localStorage.getItem('yoba-auth') || '{}')
        const rt     = stored?.state?.refreshToken
        if (!rt) throw new Error('No refresh token')

        const { data } = await axios.post(
          `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/auth/refresh`,
          { refreshToken: rt }
        )
        const newAccess  = data.data.accessToken
        const newRefresh = data.data.refreshToken

        stored.state.accessToken  = newAccess
        stored.state.refreshToken = newRefresh
        localStorage.setItem('yoba-auth', JSON.stringify(stored))
        api.defaults.headers.common['Authorization'] = `Bearer ${newAccess}`

        refreshQueue.forEach(p => p.resolve())
        refreshQueue = []
        return api(original)
      } catch {
        refreshQueue.forEach(p => p.reject())
        refreshQueue = []
        localStorage.removeItem('yoba-auth')
        window.location.href = '/connexion'
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(err)
  }
)

export default api

// ---- API par domaine (appelés par les pages/hooks) ----

export const authAPI = {
  register: (d) => api.post('/api/auth/register', d),
  login:    (d) => api.post('/api/auth/login', d),
  logout:   (d) => api.post('/api/auth/logout', d),
  refresh:  (d) => api.post('/api/auth/refresh', d),
  me:       ()  => api.get('/api/auth/me'),
}

export const userAPI = {
  me:        ()       => api.get('/api/users/me'),
  get:       (id)     => api.get(`/api/users/${id}`),
  update:    (d)      => api.patch('/api/users/me', d),
  reviews:   (id)     => api.get(`/api/users/${id}/reviews`),
  addReview: (id, d)  => api.post(`/api/users/${id}/review`, d),
}

export const parcelAPI = {
  list:            (p) => api.get('/api/parcels', { params: p }),
  get:             (id)=> api.get(`/api/parcels/${id}`),
  create:          (d) => api.post('/api/parcels', d),
  confirmDelivery: (id, qrCode) => api.patch(`/api/parcels/${id}/confirm-delivery`, { qrCode }),
}

export const tripAPI = {
  list:         (p) => api.get('/api/trips', { params: p }),
  myTrips:      ()  => api.get('/api/trips/my'),
  get:          (id)=> api.get(`/api/trips/${id}`),
  create:       (d) => api.post('/api/trips', d),
  acceptParcel: (tripId, d) => api.patch(`/api/trips/${tripId}/accept-parcel`, d),
}

export const matchingAPI = {
  get:     (parcelId) => api.get(`/api/matching/${parcelId}`),
  refresh: (parcelId) => api.post(`/api/matching/${parcelId}/refresh`),
}

export const messageAPI = {
  list:     (parcelId) => api.get('/api/messages', { params: { parcelId } }),
  send:     (d)        => api.post('/api/messages', d),
  markRead: (parcelId) => api.patch('/api/messages/read', { parcelId }),
}

export const notifAPI = {
  list:       ()   => api.get('/api/notifications'),
  unreadCount:()   => api.get('/api/notifications/unread-count'),
  markRead:  (id)  => api.patch(`/api/notifications/${id}/read`),
}
