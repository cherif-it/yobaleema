// ================================================================
//  Auth Service — Port 4001
//  DB : yoba_auth (PostgreSQL)
//  Publie : user.registered
//  Responsabilités : register, login, refresh, logout, /me
// ================================================================

'use strict'

require('dotenv').config()

const express  = require('express')
const bcrypt   = require('bcryptjs')
const jwt      = require('jsonwebtoken')
const crypto   = require('crypto')
const { Pool } = require('pg')
const amqp     = require('amqplib')
const { z }    = require('zod')

const app  = express()
const PORT = process.env.PORT || 4001
app.use(express.json())

// ---- DB ----
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// ---- RabbitMQ ----
let channel = null
async function connectRabbit(retries = 10) {
  for (let i = 1; i <= retries; i++) {
    try {
      const conn = await amqp.connect(process.env.RABBITMQ_URL)
      channel    = await conn.createChannel()
      await channel.assertExchange('yobaleema.events', 'topic', { durable: true })
      console.log('\x1b[32m[Auth] RabbitMQ connecté\x1b[0m')
      return
    } catch (err) {
      console.warn(`[Auth] RabbitMQ tentative ${i}/${retries}: ${err.message}`)
      if (i < retries) await new Promise(r => setTimeout(r, 3000))
    }
  }
}

function publish(routingKey, payload) {
  if (!channel) return
  channel.publish('yobaleema.events', routingKey,
    Buffer.from(JSON.stringify({ ...payload, _source: 'auth-service', _ts: Date.now() })),
    { persistent: true }
  )
}

// ---- Init DB ----
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users_auth (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email         VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role          VARCHAR(20) NOT NULL DEFAULT 'both'
                      CHECK (role IN ('sender','carrier','both','admin')),
      is_active     BOOLEAN NOT NULL DEFAULT TRUE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NOT NULL REFERENCES users_auth(id) ON DELETE CASCADE,
      token_hash  VARCHAR(255) NOT NULL UNIQUE,
      expires_at  TIMESTAMPTZ NOT NULL,
      revoked_at  TIMESTAMPTZ,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_auth_email ON users_auth(email);
    CREATE INDEX IF NOT EXISTS idx_rt_hash    ON refresh_tokens(token_hash);
  `)
  console.log('\x1b[32m[Auth] DB initialisée\x1b[0m')
}

// ---- JWT helpers ----
const makeAccess = (u) => jwt.sign(
  { sub: u.id, email: u.email, role: u.role },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
)

const makeRefresh = async (userId) => {
  const token   = crypto.randomBytes(64).toString('hex')
  const hash    = crypto.createHash('sha256').update(token).digest('hex')
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,$3)',
    [userId, hash, expires]
  )
  return token
}

// ---- Validation ----
const RegisterSchema = z.object({
  email:     z.string().min(1,'Email requis').email('Email invalide'),
  password:  z.string().min(8,'8 caractères minimum'),
  firstName: z.string().min(2,'Prénom requis'),
  lastName:  z.string().min(2,'Nom requis'),
  role:      z.enum(['sender','carrier','both']).default('both'),
})
const LoginSchema = z.object({
  email:    z.string().min(1,'Email requis').email('Email invalide'),
  password: z.string().min(1,'Mot de passe requis'),
})

// ================================================================
//  ROUTES
// ================================================================

// Logging
app.use((req, res, next) => {
  const t = Date.now()
  res.on('finish', () => console.log(`[Auth] ${req.method} ${req.path} → ${res.statusCode} (${Date.now()-t}ms)`))
  next()
})

// ---- POST /api/auth/register ----
app.post('/api/auth/register', async (req, res) => {
  try {
    const data = RegisterSchema.parse(req.body)

    const exists = await pool.query('SELECT id FROM users_auth WHERE email=$1', [data.email])
    if (exists.rows.length) {
      return res.status(409).json({ success:false, error:'Cet email est déjà utilisé' })
    }

    const hash = await bcrypt.hash(data.password, 12)
    const { rows } = await pool.query(
      'INSERT INTO users_auth (email,password_hash,role) VALUES ($1,$2,$3) RETURNING id,email,role',
      [data.email, hash, data.role]
    )
    const user = rows[0]

    // Publier l'événement → user-service crée le profil
    publish('user.registered', {
      userId:    user.id,
      email:     user.email,
      firstName: data.firstName,
      lastName:  data.lastName,
      role:      user.role,
    })

    const accessToken  = makeAccess(user)
    const refreshToken = await makeRefresh(user.id)

    console.log(`\x1b[32m[Auth] ✅ Inscrit : ${user.email}\x1b[0m`)
    res.status(201).json({
      success: true,
      data: {
        accessToken, refreshToken,
        user: { id:user.id, email:user.email, role:user.role, firstName:data.firstName, lastName:data.lastName },
      },
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success:false, error: err.errors[0]?.message, details: err.errors })
    }
    console.error('[Auth] register error:', err)
    res.status(500).json({ success:false, error:'Erreur interne' })
  }
})

// ---- POST /api/auth/login ----
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = LoginSchema.parse(req.body)

    const { rows } = await pool.query(
      'SELECT id,email,password_hash,role,is_active FROM users_auth WHERE email=$1',
      [email]
    )
    if (!rows.length) {
      return res.status(401).json({ success:false, error:'Email ou mot de passe incorrect' })
    }
    const user = rows[0]
    if (!user.is_active) {
      return res.status(403).json({ success:false, error:'Compte désactivé' })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return res.status(401).json({ success:false, error:'Email ou mot de passe incorrect' })
    }

    const accessToken  = makeAccess(user)
    const refreshToken = await makeRefresh(user.id)

    console.log(`\x1b[32m[Auth] ✅ Connecté : ${user.email}\x1b[0m`)
    res.json({
      success: true,
      data: {
        accessToken, refreshToken,
        user: { id:user.id, email:user.email, role:user.role },
      },
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success:false, error: err.errors[0]?.message })
    }
    console.error('[Auth] login error:', err)
    res.status(500).json({ success:false, error:'Erreur interne' })
  }
})

// ---- POST /api/auth/refresh ----
app.post('/api/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body
  if (!refreshToken) return res.status(401).json({ success:false, error:'Token manquant' })

  const hash = crypto.createHash('sha256').update(refreshToken).digest('hex')
  const { rows } = await pool.query(
    `SELECT rt.user_id, u.email, u.role
     FROM refresh_tokens rt JOIN users_auth u ON u.id=rt.user_id
     WHERE rt.token_hash=$1 AND rt.expires_at>NOW() AND rt.revoked_at IS NULL`,
    [hash]
  )
  if (!rows.length) return res.status(401).json({ success:false, error:'Token invalide ou expiré' })

  const { user_id, email, role } = rows[0]
  await pool.query('UPDATE refresh_tokens SET revoked_at=NOW() WHERE token_hash=$1', [hash])

  const newAccess  = makeAccess({ id:user_id, email, role })
  const newRefresh = await makeRefresh(user_id)

  res.json({ success:true, data:{ accessToken:newAccess, refreshToken:newRefresh } })
})

// ---- POST /api/auth/logout ----
app.post('/api/auth/logout', async (req, res) => {
  const { refreshToken } = req.body
  if (refreshToken) {
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex')
    await pool.query('UPDATE refresh_tokens SET revoked_at=NOW() WHERE token_hash=$1', [hash])
  }
  res.json({ success:true, data:{ message:'Déconnecté avec succès' } })
})

// ---- GET /api/auth/me ----
app.get('/api/auth/me', async (req, res) => {
  const userId = req.headers['x-user-id']
  if (!userId) return res.status(401).json({ success:false, error:'Non autorisé' })
  const { rows } = await pool.query(
    'SELECT id,email,role,created_at FROM users_auth WHERE id=$1',
    [userId]
  )
  if (!rows.length) return res.status(404).json({ success:false, error:'Utilisateur non trouvé' })
  res.json({ success:true, data: rows[0] })
})

// ---- Health ----
app.get('/health', (req, res) => res.json({ status:'ok', service:'auth-service' }))

// ================================================================
//  DÉMARRAGE
// ================================================================

async function start() {
  // Attendre PostgreSQL
  for (let i = 0; i < 15; i++) {
    try { await pool.query('SELECT 1'); break }
    catch { console.warn(`[Auth] Attente PostgreSQL... (${i+1}/15)`); await new Promise(r=>setTimeout(r,2000)) }
  }
  await initDB()
  await connectRabbit()
  app.listen(PORT, () => console.log(`\x1b[32m[Auth] 🔐 Démarré sur le port ${PORT}\x1b[0m`))
}

start().catch(err => { console.error('[Auth] Erreur démarrage:', err); process.exit(1) })
