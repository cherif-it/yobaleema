// ================================================================
//  API Gateway — Yobaleema
//  Port : 4000
//  Rôle : Point d'entrée unique. Routing, auth JWT, rate limiting,
//         WebSocket temps réel (géoloc, messages, notifications)
// ================================================================

'use strict'

require('dotenv').config()

const express    = require('express')
const http       = require('http')
const { Server } = require('socket.io')
const { createProxyMiddleware } = require('http-proxy-middleware')
const rateLimit  = require('express-rate-limit')
const helmet     = require('helmet')
const cors       = require('cors')
const jwt        = require('jsonwebtoken')
const Redis      = require('ioredis')

const app    = express()
const server = http.createServer(app)
const PORT   = process.env.PORT || 4000

// ---- Infrastructure ----
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

// ---- WebSocket ----
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true },
})

// ---- Services cibles ----
const SERVICES = {
  auth:         process.env.AUTH_URL         || 'http://localhost:4001',
  users:        process.env.USER_URL         || 'http://localhost:4002',
  parcels:      process.env.PARCEL_URL       || 'http://localhost:4003',
  trips:        process.env.TRIP_URL         || 'http://localhost:4004',
  matching:     process.env.MATCHING_URL     || 'http://localhost:4005',
  notifications:process.env.NOTIFICATION_URL|| 'http://localhost:4006',
}

// ================================================================
//  MIDDLEWARES GLOBAUX
// ================================================================

app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}))
app.use(express.json())

// Logging
app.use((req, res, next) => {
  const start = Date.now()
  res.on('finish', () => {
    const c = res.statusCode < 400 ? '\x1b[32m' : '\x1b[31m'
    console.log(`\x1b[36m[GW]\x1b[0m ${c}${req.method}\x1b[0m ${req.path} → ${res.statusCode} (${Date.now()-start}ms)`)
  })
  next()
})

// Rate limit global
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }))

// Rate limit strict sur auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, error: 'Trop de tentatives, réessayez dans 15 minutes.' },
})

// ================================================================
//  MIDDLEWARE JWT
// ================================================================

async function authenticate(req, res, next) {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null

  if (!token) return res.status(401).json({ success: false, error: 'Token manquant' })

  // Vérifier blacklist Redis (tokens révoqués)
  const blacklisted = await redis.get(`blacklist:${token}`)
  if (blacklisted) return res.status(401).json({ success: false, error: 'Token révoqué' })

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    // Transmettre l'identité aux microservices via headers internes
    req.headers['x-user-id']    = decoded.sub
    req.headers['x-user-email'] = decoded.email
    req.headers['x-user-role']  = decoded.role
    next()
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Token expiré' : 'Token invalide'
    return res.status(401).json({ success: false, error: msg })
  }
}

// ================================================================
//  PROXY FACTORY
// ================================================================

function proxy(target, pathRewrite) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite,
    on: {
      error: (err, req, res) => {
        console.error(`\x1b[31m[GW] Proxy error → ${target}:\x1b[0m`, err.message)
        if (!res.headersSent) {
          res.status(503).json({ success: false, error: 'Service temporairement indisponible' })
        }
      },
    },
  })
}

// ================================================================
//  ROUTES PUBLIQUES (sans JWT)
// ================================================================

app.use('/api/auth',     authLimiter, proxy(SERVICES.auth))
app.use('/api/trips',    proxy(SERVICES.trips))          // Recherche publique

// Webhook Stripe — signature propre, pas de JWT
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }), proxy(SERVICES.parcels))

// ================================================================
//  ROUTES PROTÉGÉES (JWT requis)
// ================================================================

app.use('/api/users',         authenticate, proxy(SERVICES.users))
app.use('/api/parcels',       authenticate, proxy(SERVICES.parcels))
app.use('/api/my-trips',      authenticate, proxy(SERVICES.trips, { '^/api/my-trips': '/api/trips/my' }))
app.use('/api/matching',      authenticate, proxy(SERVICES.matching))
app.use('/api/notifications', authenticate, proxy(SERVICES.notifications))
app.use('/api/messages',      authenticate, proxy(SERVICES.notifications))

// ================================================================
//  HEALTH CHECK
// ================================================================

app.get('/health', async (req, res) => {
  const checks = await Promise.allSettled(
    Object.entries(SERVICES).map(async ([name, url]) => {
      try {
        const r = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) })
        return { name, status: r.ok ? 'ok' : 'degraded' }
      } catch {
        return { name, status: 'down' }
      }
    })
  )
  res.json({
    status: 'ok',
    gateway: 'running',
    timestamp: new Date().toISOString(),
    services: checks.map(c => c.status === 'fulfilled' ? c.value : { name: '?', status: 'down' }),
  })
})

// ================================================================
//  WEBSOCKET — Temps réel
//  - Géolocalisation colis
//  - Messages in-app
//  - Notifications push
// ================================================================

const connectedUsers = new Map()  // userId → Set<socketId>

io.use((socket, next) => {
  const token = socket.handshake.auth?.token
  if (!token) return next(new Error('Token manquant'))
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    socket.userId = decoded.sub
    socket.role   = decoded.role
    next()
  } catch {
    next(new Error('Token invalide'))
  }
})

io.on('connection', (socket) => {
  const { userId } = socket
  console.log(`\x1b[36m[WS]\x1b[0m \x1b[32mConnecté:\x1b[0m ${userId}`)

  // Gérer plusieurs onglets simultanés
  if (!connectedUsers.has(userId)) connectedUsers.set(userId, new Set())
  connectedUsers.get(userId).add(socket.id)

  // ---- Rejoindre la room d'un colis ----
  socket.on('parcel:join', (parcelId) => {
    socket.join(`parcel:${parcelId}`)
    console.log(`\x1b[36m[WS]\x1b[0m ${userId} rejoint parcel:${parcelId}`)
  })

  // ---- Mise à jour GPS du transporteur ----
  socket.on('location:update', async ({ parcelId, lat, lng }) => {
    const payload = { lat, lng, carrierId: userId, timestamp: Date.now() }
    // Diffuser à tous dans la room du colis
    socket.to(`parcel:${parcelId}`).emit('location:updated', payload)
    // Persister en Redis (TTL 2h pour reconnexion)
    await redis.setex(`location:${parcelId}`, 7200, JSON.stringify(payload))
  })

  // ---- Récupérer la dernière position connue ----
  socket.on('location:get', async ({ parcelId }, callback) => {
    const cached = await redis.get(`location:${parcelId}`)
    callback(cached ? JSON.parse(cached) : null)
  })

  // ---- Message in-app ----
  socket.on('message:send', ({ toUserId, parcelId, content }) => {
    const targetSockets = connectedUsers.get(toUserId)
    if (targetSockets?.size > 0) {
      targetSockets.forEach(sid => {
        io.to(sid).emit('message:received', {
          fromUserId: userId,
          parcelId,
          content,
          timestamp: Date.now(),
        })
      })
    }
  })

  // ---- Notification push ----
  socket.on('disconnect', () => {
    const sockets = connectedUsers.get(userId)
    if (sockets) {
      sockets.delete(socket.id)
      if (sockets.size === 0) connectedUsers.delete(userId)
    }
    console.log(`\x1b[36m[WS]\x1b[0m \x1b[31mDéconnecté:\x1b[0m ${userId}`)
  })
})

// Exposer io pour usage interne si besoin
app.set('io', io)
app.set('connectedUsers', connectedUsers)

// ================================================================
//  DÉMARRAGE
// ================================================================

server.listen(PORT, () => {
  console.log('\n\x1b[33m  ╔══════════════════════════════════╗')
  console.log('  ║  YOBALEEMA  —  API Gateway      ║')
  console.log('  ╚══════════════════════════════════╝\x1b[0m\n')
  console.log(`  🚀 Gateway    : \x1b[36mhttp://localhost:${PORT}\x1b[0m`)
  console.log(`  🔌 WebSocket  : \x1b[36mws://localhost:${PORT}\x1b[0m`)
  console.log(`  📦 Services   : ${Object.keys(SERVICES).join(', ')}`)
  console.log('')
})
