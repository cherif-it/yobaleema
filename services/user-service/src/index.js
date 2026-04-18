// ================================================================
//  User Service — Port 4002
//  DB : yoba_users
//  Consomme : user.registered → crée le profil
//  Publie   : user.profile_updated
// ================================================================

'use strict'

require('dotenv').config()

const express  = require('express')
const { Pool } = require('pg')
const amqp     = require('amqplib')
const crypto   = require('crypto')
const { z }    = require('zod')

const app  = express()
const PORT = process.env.PORT || 4002
app.use(express.json())

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// ---- Init DB ----
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      id           UUID PRIMARY KEY,
      email        VARCHAR(255) NOT NULL,
      first_name   VARCHAR(100) NOT NULL,
      last_name    VARCHAR(100) NOT NULL,
      phone        VARCHAR(30),
      avatar_url   TEXT,
      role         VARCHAR(20) NOT NULL DEFAULT 'both',
      kyc_status   VARCHAR(20) NOT NULL DEFAULT 'pending',
      rating_avg   DECIMAL(3,2) NOT NULL DEFAULT 0,
      rating_count INTEGER NOT NULL DEFAULT 0,
      bio          TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      parcel_id     UUID NOT NULL,
      reviewer_id   UUID NOT NULL REFERENCES profiles(id),
      reviewee_id   UUID NOT NULL REFERENCES profiles(id),
      rating        SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment       TEXT,
      reviewer_role VARCHAR(10) NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (parcel_id, reviewer_id)
    );
    CREATE INDEX IF NOT EXISTS idx_profiles_id      ON profiles(id);
    CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id);
  `)
  console.log('\x1b[32m[User] DB initialisée\x1b[0m')
}

// ---- RabbitMQ ----
async function connectRabbit(retries = 10) {
  for (let i = 1; i <= retries; i++) {
    try {
      const conn = await amqp.connect(process.env.RABBITMQ_URL)
      const ch   = await conn.createChannel()
      await ch.assertExchange('yobaleema.events', 'topic', { durable: true })

      // Consommer user.registered → créer le profil
      const q = await ch.assertQueue('user-service.user_registered', { durable: true })
      await ch.bindQueue(q.queue, 'yobaleema.events', 'user.registered')
      ch.consume(q.queue, async (msg) => {
        if (!msg) return
        try {
          const { userId, email, firstName, lastName, role } = JSON.parse(msg.content.toString())
          await pool.query(
            `INSERT INTO profiles (id, email, first_name, last_name, role)
             VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
            [userId, email, firstName, lastName, role]
          )
          console.log(`\x1b[32m[User] ✅ Profil créé : ${email}\x1b[0m`)
          ch.ack(msg)
        } catch (err) {
          console.error('[User] consumer error:', err.message)
          ch.nack(msg, false, true)
        }
      })

      console.log('\x1b[32m[User] RabbitMQ connecté\x1b[0m')
      return
    } catch (err) {
      console.warn(`[User] RabbitMQ tentative ${i}/${retries}: ${err.message}`)
      if (i < retries) await new Promise(r => setTimeout(r, 3000))
    }
  }
}

// ================================================================
//  ROUTES
// ================================================================

app.use((req, res, next) => {
  const t = Date.now()
  res.on('finish', () => console.log(`[User] ${req.method} ${req.path} → ${res.statusCode} (${Date.now()-t}ms)`))
  next()
})

// ---- GET /api/users/me ----
app.get('/api/users/me', async (req, res) => {
  const userId = req.headers['x-user-id']
  if (!userId) return res.status(401).json({ success:false, error:'Non autorisé' })
  const { rows } = await pool.query(
    'SELECT id,email,first_name,last_name,phone,avatar_url,role,kyc_status,rating_avg,rating_count,bio,created_at FROM profiles WHERE id=$1',
    [userId]
  )
  if (!rows.length) return res.status(404).json({ success:false, error:'Profil non trouvé' })
  res.json({ success:true, data: rows[0] })
})

// ---- GET /api/users/:id ----
app.get('/api/users/:id', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id,first_name,last_name,avatar_url,role,kyc_status,rating_avg,rating_count,bio,created_at FROM profiles WHERE id=$1',
    [req.params.id]
  )
  if (!rows.length) return res.status(404).json({ success:false, error:'Utilisateur non trouvé' })
  res.json({ success:true, data: rows[0] })
})

// ---- PATCH /api/users/me ----
app.patch('/api/users/me', async (req, res) => {
  const userId = req.headers['x-user-id']
  if (!userId) return res.status(401).json({ success:false, error:'Non autorisé' })

  const schema = z.object({
    firstName: z.string().min(2).optional(),
    lastName:  z.string().min(2).optional(),
    phone:     z.string().optional(),
    bio:       z.string().max(500).optional(),
  })
  try {
    const data = schema.parse(req.body)
    const sets = [], vals = []
    if (data.firstName !== undefined) { sets.push(`first_name=$${vals.length+1}`); vals.push(data.firstName) }
    if (data.lastName  !== undefined) { sets.push(`last_name=$${vals.length+1}`);  vals.push(data.lastName) }
    if (data.phone     !== undefined) { sets.push(`phone=$${vals.length+1}`);      vals.push(data.phone) }
    if (data.bio       !== undefined) { sets.push(`bio=$${vals.length+1}`);        vals.push(data.bio) }
    if (!sets.length) return res.json({ success:true, data:{ message:'Rien à mettre à jour' } })
    sets.push('updated_at=NOW()')
    vals.push(userId)
    const { rows } = await pool.query(
      `UPDATE profiles SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`,
      vals
    )
    res.json({ success:true, data: rows[0] })
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ success:false, error:err.errors[0]?.message })
    res.status(500).json({ success:false, error:'Erreur interne' })
  }
})

// ---- POST /api/users/:id/review ----
app.post('/api/users/:id/review', async (req, res) => {
  const reviewerId = req.headers['x-user-id']
  if (!reviewerId) return res.status(401).json({ success:false, error:'Non autorisé' })

  const schema = z.object({
    parcelId: z.string().uuid(),
    rating:   z.number().int().min(1).max(5),
    comment:  z.string().max(1000).optional(),
    role:     z.enum(['sender','carrier']),
  })
  try {
    const data = schema.parse(req.body)
    await pool.query(
      `INSERT INTO reviews (parcel_id, reviewer_id, reviewee_id, rating, comment, reviewer_role)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (parcel_id, reviewer_id) DO NOTHING`,
      [data.parcelId, reviewerId, req.params.id, data.rating, data.comment||null, data.role]
    )
    // Recalculer la note
    const { rows } = await pool.query(
      'SELECT AVG(rating)::decimal(3,2) AS avg, COUNT(*)::int AS cnt FROM reviews WHERE reviewee_id=$1',
      [req.params.id]
    )
    await pool.query(
      'UPDATE profiles SET rating_avg=$1, rating_count=$2 WHERE id=$3',
      [rows[0].avg||0, rows[0].cnt, req.params.id]
    )
    res.status(201).json({ success:true, data:{ message:'Avis publié ✅' } })
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ success:false, error:err.errors[0]?.message })
    res.status(500).json({ success:false, error:'Erreur interne' })
  }
})

// ---- GET /api/users/:id/reviews ----
app.get('/api/users/:id/reviews', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT r.*, p.first_name || ' ' || p.last_name AS reviewer_name, p.avatar_url AS reviewer_avatar
     FROM reviews r JOIN profiles p ON p.id=r.reviewer_id
     WHERE r.reviewee_id=$1 ORDER BY r.created_at DESC LIMIT 20`,
    [req.params.id]
  )
  res.json({ success:true, data: rows })
})

app.get('/health', (req, res) => res.json({ status:'ok', service:'user-service' }))

// ================================================================
//  DÉMARRAGE
// ================================================================

async function start() {
  for (let i=0; i<15; i++) {
    try { await pool.query('SELECT 1'); break }
    catch { console.warn(`[User] Attente PostgreSQL... (${i+1}/15)`); await new Promise(r=>setTimeout(r,2000)) }
  }
  await initDB()
  await connectRabbit()
  app.listen(PORT, () => console.log(`\x1b[32m[User] 👤 Démarré sur le port ${PORT}\x1b[0m`))
}

start().catch(err => { console.error('[User] Erreur démarrage:', err); process.exit(1) })
