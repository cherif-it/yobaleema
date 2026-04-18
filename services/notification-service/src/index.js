// ================================================================
//  Notification Service — Port 4006
//  DB : yoba_notifications
//  Consomme : user.registered, parcel.created, parcel.matched,
//             parcel.accepted, parcel.confirmed, trip.parcel_accepted
//  API      : GET/POST /api/messages, GET /api/notifications
// ================================================================

'use strict'

require('dotenv').config()

const express    = require('express')
const { Pool }   = require('pg')
const amqp       = require('amqplib')
const nodemailer = require('nodemailer').default || require('nodemailer')
const crypto     = require('crypto')

const app  = express()
const PORT = process.env.PORT || 4006
app.use(express.json())

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// ---- Mailer (désactivé si pas de config SMTP) ----
let transporter = null
if (process.env.SMTP_HOST && process.env.SMTP_USER) {
  transporter = require('nodemailer').createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
}

async function sendMail(to, subject, html) {
  if (!transporter) {
    console.log(`\x1b[33m[Notif] 📧 Email (mock) → ${to}: ${subject}\x1b[0m`)
    return
  }
  try {
    await transporter.sendMail({
      from: process.env.FROM_EMAIL || 'no-reply@yobaleema.fr',
      to, subject, html,
    })
    console.log(`\x1b[32m[Notif] ✅ Email envoyé → ${to}: ${subject}\x1b[0m`)
  } catch (err) {
    console.error(`\x1b[31m[Notif] Email error:\x1b[0m`, err.message)
  }
}

// ---- Init DB ----
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      parcel_id   UUID NOT NULL,
      sender_id   UUID NOT NULL,
      receiver_id UUID NOT NULL,
      content     TEXT NOT NULL,
      read_at     TIMESTAMPTZ,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NOT NULL,
      type        VARCHAR(50) NOT NULL,
      title       TEXT NOT NULL,
      body        TEXT NOT NULL,
      read_at     TIMESTAMPTZ,
      metadata    JSONB,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_messages_parcel   ON messages(parcel_id);
    CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
    CREATE INDEX IF NOT EXISTS idx_notifs_user       ON notifications(user_id);
  `)
  console.log('\x1b[32m[Notif] DB initialisée\x1b[0m')
}

// ---- Créer une notification in-app ----
async function createNotif(userId, type, title, body, metadata = {}) {
  await pool.query(
    'INSERT INTO notifications (user_id, type, title, body, metadata) VALUES ($1,$2,$3,$4,$5)',
    [userId, type, title, body, JSON.stringify(metadata)]
  )
}

// ================================================================
//  TEMPLATES EMAIL
// ================================================================

const templates = {
  'user.registered': ({ firstName, email }) => ({
    to: email,
    subject: '🎉 Bienvenue sur Yobaleema !',
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <div style="background:#8B3A00;padding:32px;text-align:center;border-radius:12px 12px 0 0">
          <h1 style="color:white;margin:0;font-size:28px;letter-spacing:2px">YOBALEEMA</h1>
        </div>
        <div style="background:#FAF0E6;padding:32px;border-radius:0 0 12px 12px">
          <h2 style="color:#1E1C1A">Bonjour ${firstName} ! 👋</h2>
          <p style="color:#4A4740;line-height:1.7">
            Votre compte Yobaleema a été créé avec succès.<br>
            Vous pouvez dès maintenant envoyer vos colis ou proposer un trajet.
          </p>
          <a href="http://localhost:3000/dashboard"
             style="display:inline-block;background:#8B3A00;color:white;padding:14px 28px;
                    border-radius:6px;text-decoration:none;font-weight:bold;margin-top:16px">
            Accéder à mon compte →
          </a>
        </div>
      </div>`,
  }),

  'parcel.matched': ({ senderId, parcelId, matchCount }) => ({
    userId: senderId,
    type: 'parcel_matched',
    title: `${matchCount} transporteur${matchCount > 1 ? 's' : ''} disponible${matchCount > 1 ? 's' : ''} !`,
    body:  `Des transporteurs ont été trouvés pour votre colis. Consultez les propositions.`,
    metadata: { parcelId },
  }),

  'parcel.accepted': ({ senderId, carrierId, parcelId }) => ({
    userId: senderId,
    type: 'parcel_accepted',
    title: 'Votre colis a été accepté ✅',
    body:  'Un transporteur a accepté de prendre en charge votre colis.',
    metadata: { parcelId, carrierId },
  }),

  'parcel.confirmed': ({ senderId, parcelId }) => ({
    userId: senderId,
    type: 'parcel_confirmed',
    title: 'Livraison confirmée 🎉',
    body:  'Le paiement a été libéré vers le transporteur.',
    metadata: { parcelId },
  }),

  'trip.parcel_accepted': ({ carrierId, parcelId, pickupQr, deliveryQr }) => ({
    userId: carrierId,
    type: 'trip_parcel_accepted',
    title: 'Nouveau colis à transporter 📦',
    body:  `Un expéditeur a validé votre proposition. QR collecte: ${pickupQr?.slice(0,8)}…`,
    metadata: { parcelId, pickupQr, deliveryQr },
  }),
}

// ================================================================
//  CONSUMER RABBITMQ
// ================================================================

const EVENTS_TO_CONSUME = [
  'user.registered',
  'parcel.created',
  'parcel.matched',
  'parcel.accepted',
  'parcel.confirmed',
  'trip.created',
  'trip.parcel_accepted',
]

async function connectRabbit(retries = 10) {
  for (let i = 1; i <= retries; i++) {
    try {
      const conn = await amqp.connect(process.env.RABBITMQ_URL)
      const ch   = await conn.createChannel()
      await ch.assertExchange('yobaleema.events', 'topic', { durable: true })

      for (const event of EVENTS_TO_CONSUME) {
        const qName = `notification-service.${event.replace(/\./g, '_')}`
        const q     = await ch.assertQueue(qName, { durable: true })
        await ch.bindQueue(q.queue, 'yobaleema.events', event)

        ch.consume(q.queue, async (msg) => {
          if (!msg) return
          try {
            const payload = JSON.parse(msg.content.toString())
            console.log(`\x1b[36m[Notif] 📥 Event: ${event}\x1b[0m`, JSON.stringify(payload).slice(0, 80))

            const tpl = templates[event]
            if (tpl) {
              const result = tpl(payload)
              // Créer notif in-app si userId défini
              if (result.userId) {
                await createNotif(result.userId, result.type, result.title, result.body, result.metadata)
              }
              // Envoyer email si to défini
              if (result.to) {
                await sendMail(result.to, result.subject, result.html)
              }
            }

            ch.ack(msg)
          } catch (err) {
            console.error(`\x1b[31m[Notif] Erreur event ${event}:\x1b[0m`, err.message)
            ch.nack(msg, false, false)
          }
        })
      }

      console.log('\x1b[32m[Notif] RabbitMQ connecté — en écoute de', EVENTS_TO_CONSUME.length, 'événements\x1b[0m')
      return
    } catch (err) {
      console.warn(`[Notif] RabbitMQ ${i}/${retries}: ${err.message}`)
      if (i < retries) await new Promise(r => setTimeout(r, 3000))
    }
  }
}

// ================================================================
//  ROUTES API
// ================================================================

app.use((req, res, next) => {
  const t = Date.now()
  res.on('finish', () => console.log(`[Notif] ${req.method} ${req.path} → ${res.statusCode} (${Date.now()-t}ms)`))
  next()
})

// ---- GET /api/messages ----
app.get('/api/messages', async (req, res) => {
  const userId   = req.headers['x-user-id']
  if (!userId) return res.status(401).json({ success: false, error: 'Non autorisé' })
  const { parcelId } = req.query
  let q = 'SELECT * FROM messages WHERE (sender_id=$1 OR receiver_id=$1)'
  const params = [userId]
  if (parcelId) { params.push(parcelId); q += ` AND parcel_id=$${params.length}` }
  q += ' ORDER BY created_at ASC'
  const { rows } = await pool.query(q, params)
  res.json({ success: true, data: rows })
})

// ---- POST /api/messages ----
app.post('/api/messages', async (req, res) => {
  const userId = req.headers['x-user-id']
  if (!userId) return res.status(401).json({ success: false, error: 'Non autorisé' })
  const { parcelId, receiverId, content } = req.body
  if (!parcelId || !receiverId || !content?.trim()) {
    return res.status(400).json({ success: false, error: 'Données manquantes' })
  }
  const { rows } = await pool.query(
    'INSERT INTO messages (parcel_id, sender_id, receiver_id, content) VALUES ($1,$2,$3,$4) RETURNING *',
    [parcelId, userId, receiverId, content.trim()]
  )
  res.status(201).json({ success: true, data: rows[0] })
})

// ---- PATCH /api/messages/read ----
app.patch('/api/messages/read', async (req, res) => {
  const userId     = req.headers['x-user-id']
  const { parcelId } = req.body
  await pool.query(
    'UPDATE messages SET read_at=NOW() WHERE receiver_id=$1 AND parcel_id=$2 AND read_at IS NULL',
    [userId, parcelId]
  )
  res.json({ success: true, data: { message: 'Messages marqués comme lus' } })
})

// ---- GET /api/notifications ----
app.get('/api/notifications', async (req, res) => {
  const userId = req.headers['x-user-id']
  if (!userId) return res.status(401).json({ success: false, error: 'Non autorisé' })
  const { rows } = await pool.query(
    'SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30',
    [userId]
  )
  res.json({ success: true, data: rows })
})

// ---- GET /api/notifications/unread-count ----
app.get('/api/notifications/unread-count', async (req, res) => {
  const userId = req.headers['x-user-id']
  if (!userId) return res.status(401).json({ success: false, error: 'Non autorisé' })
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id=$1 AND read_at IS NULL',
    [userId]
  )
  res.json({ success: true, data: { count: rows[0].count } })
})

// ---- PATCH /api/notifications/:id/read ----
app.patch('/api/notifications/:id/read', async (req, res) => {
  const userId = req.headers['x-user-id']
  await pool.query(
    'UPDATE notifications SET read_at=NOW() WHERE id=$1 AND user_id=$2',
    [req.params.id, userId]
  )
  res.json({ success: true, data: { message: 'Notification lue' } })
})

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'notification-service' }))

// ================================================================
//  DÉMARRAGE
// ================================================================

async function start() {
  for (let i = 0; i < 15; i++) {
    try { await pool.query('SELECT 1'); break }
    catch { console.warn(`[Notif] Attente PostgreSQL... (${i+1}/15)`); await new Promise(r => setTimeout(r, 2000)) }
  }
  await initDB()
  await connectRabbit()
  app.listen(PORT, () => console.log(`\x1b[32m[Notif] 🔔 Démarré sur le port ${PORT}\x1b[0m`))
}

start().catch(err => { console.error('[Notif] Erreur démarrage:', err); process.exit(1) })
