import axios from 'axios'

// ============================================================
//  Service API — Axios avec intercepteurs JWT
// ============================================================

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

// Injecter le token sur chaque requête
api.interceptors.request.use((config) => {
  // Récupérer le token depuis le store Zustand (localStorage)
  try {
    const stored = JSON.parse(localStorage.getItem('yobaleema-auth') || '{}')
    const token  = stored?.state?.accessToken
    if (token) config.headers['Authorization'] = `Bearer ${token}`
  } catch {}
  return config
})

// Refresh automatique si 401
let isRefreshing = false
let refreshQueue = []

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject })
        }).then(() => api(original))
      }

      original._retry  = true
      isRefreshing     = true

      try {
        const stored = JSON.parse(localStorage.getItem('yobaleema-auth') || '{}')
        const rt     = stored?.state?.refreshToken
        if (!rt) throw new Error('No refresh token')

        const { data } = await axios.post('/api/auth/refresh', { refreshToken: rt })

        // Mettre à jour le store
        stored.state.accessToken  = data.accessToken
        stored.state.refreshToken = data.refreshToken
        localStorage.setItem('yobaleema-auth', JSON.stringify(stored))
        api.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`

        refreshQueue.forEach(p => p.resolve())
        refreshQueue = []
        return api(original)
      } catch {
        refreshQueue.forEach(p => p.reject())
        refreshQueue = []
        localStorage.removeItem('yobaleema-auth')
        window.location.href = '/connexion'
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default api

// ============================================================
//  Fonctions helper par domaine
// ============================================================

export const authAPI = {
  login:    (d) => api.post('/auth/login', d),
  register: (d) => api.post('/auth/register', d),
  logout:   (d) => api.post('/auth/logout', d),
  refresh:  (d) => api.post('/auth/refresh', d),
  me:       ()  => api.get('/auth/me'),
}

export const parcelAPI = {
  list:            (params) => api.get('/parcels', { params }),
  get:             (id)     => api.get(`/parcels/${id}`),
  create:          (data)   => api.post('/parcels', data),
  confirmDelivery: (id, qr) => api.patch(`/parcels/${id}/confirm-delivery`, { qrCode: qr }),
}

export const tripAPI = {
  list:          (params) => api.get('/trips', { params }),
  myTrips:       ()       => api.get('/trips/my'),
  create:        (data)   => api.post('/trips', data),
  acceptParcel:  (id, parcelId) => api.patch(`/trips/${id}/accept-parcel`, { parcelId }),
}

export const matchingAPI = {
  getMatches: (parcelId) => api.get(`/matching/${parcelId}`),
  refresh:    (parcelId) => api.post(`/matching/${parcelId}/refresh`),
}

export const paymentAPI = {
  createIntent: (data)  => api.post('/payments/intent', data),
  capture:      (piId)  => api.post('/payments/capture', { paymentIntentId: piId }),
  getByParcel:  (id)    => api.get(`/payments/parcel/${id}`),
}

export const messageAPI = {
  list: (parcelId) => api.get('/messages', { params: { parcelId } }),
  send: (data)     => api.post('/messages', data),
  markRead: (parcelId) => api.patch('/messages/read', { parcelId }),
}
