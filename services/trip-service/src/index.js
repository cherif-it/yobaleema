// ================================================================
//  Trip Service — Port 4004
//  DB : yoba_trips
//  Publie   : trip.created, trip.parcel_accepted
//  Consomme : parcel.created → optionnel (futur auto-matching)
// ================================================================

'use strict'

require('dotenv').config()

const express  = require('express')
const { Pool } = require('pg')
const amqp     = require('amqplib')
const crypto   = require('crypto')
const { z }    = require('zod')

const app  = express()
const PORT = process.env.PORT || 4004
app.use(express.json())

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
let channel = null

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS trips (
      id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      carrier_id           UUID NOT NULL,
      origin_address       TEXT NOT NULL,
      origin_city          VARCHAR(100) NOT NULL,
      origin_lat           DECIMAL(9,6) NOT NULL,
      origin_lng           DECIMAL(9,6) NOT NULL,
      dest_address         TEXT NOT NULL,
      dest_city            VARCHAR(100) NOT NULL,
      dest_lat             DECIMAL(9,6) NOT NULL,
      dest_lng             DECIMAL(9,6) NOT NULL,
      departure_at         TIMESTAMPTZ NOT NULL,
      max_weight_kg        DECIMAL(6,2) NOT NULL,
      max_volume_dm3       DECIMAL(8,2) NOT NULL,
      available_weight_kg  DECIMAL(6,2) NOT NULL,
      available_volume_dm3 DECIMAL(8,2) NOT NULL,
      status               VARCHAR(20) NOT NULL DEFAULT 'open',
      notes                TEXT,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_trips_carrier   ON trips(carrier_id);
    CREATE INDEX IF NOT EXISTS idx_trips_status    ON trips(status);
    CREATE INDEX IF NOT EXISTS idx_trips_departure ON trips(departure_at);
  `)
  console.log('\x1b[32m[Trip] DB initialisée\x1b[0m')
}

function publish(rk, payload) {
  if (!channel) return
  channel.publish('yobaleema.events', rk,
    Buffer.from(JSON.stringify({ ...payload, _source:'trip-service', _ts:Date.now() })),
    { persistent:true }
  )
}

async function connectRabbit(retries=10) {
  for (let i=1; i<=retries; i++) {
    try {
      const conn = await amqp.connect(process.env.RABBITMQ_URL)
      channel    = await conn.createChannel()
      await channel.assertExchange('yobaleema.events','topic',{ durable:true })
      console.log('\x1b[32m[Trip] RabbitMQ connecté\x1b[0m')
      return
    } catch(err) {
      console.warn(`[Trip] RabbitMQ ${i}/${retries}: ${err.message}`)
      if (i<retries) await new Promise(r=>setTimeout(r,3000))
    }
  }
}

const TripSchema = z.object({
  originAddress: z.string().min(3),
  originCity:    z.string().min(2),
  originLat:     z.number(),
  originLng:     z.number(),
  destAddress:   z.string().min(3),
  destCity:      z.string().min(2),
  destLat:       z.number(),
  destLng:       z.number(),
  departureAt:   z.string().min(1),
  maxWeightKg:   z.number().positive(),
  maxVolumeDm3:  z.number().positive(),
  notes:         z.string().optional(),
})

app.use((req,res,next)=>{
  const t=Date.now()
  res.on('finish',()=>console.log(`[Trip] ${req.method} ${req.path} → ${res.statusCode} (${Date.now()-t}ms)`))
  next()
})

// GET /api/trips — Trajets publics
app.get('/api/trips', async (req,res) => {
  const { from, to, date, page=1, limit=20 } = req.query
  let q = `SELECT t.*, '' AS carrier_name
           FROM trips t WHERE t.status='open' AND t.departure_at > NOW()`
  const params = []
  if (from) { params.push(`%${from}%`); q+=` AND LOWER(t.origin_city) LIKE LOWER($${params.length})` }
  if (to)   { params.push(`%${to}%`);   q+=` AND LOWER(t.dest_city) LIKE LOWER($${params.length})` }
  if (date) { params.push(date);         q+=` AND DATE(t.departure_at)=$${params.length}` }
  q+=` ORDER BY t.departure_at ASC LIMIT $${params.length+1} OFFSET $${params.length+2}`
  params.push(Number(limit),(page-1)*Number(limit))
  const { rows } = await pool.query(q,params)
  res.json({ success:true, data:rows, page:Number(page), limit:Number(limit) })
})

// GET /api/trips/my
app.get('/api/trips/my', async (req,res) => {
  const userId = req.headers['x-user-id']
  if (!userId) return res.status(401).json({ success:false, error:'Non autorisé' })
  const { rows } = await pool.query(
    'SELECT * FROM trips WHERE carrier_id=$1 ORDER BY departure_at DESC', [userId]
  )
  res.json({ success:true, data:rows })
})

// GET /api/trips/:id
app.get('/api/trips/:id', async (req,res) => {
  const { rows } = await pool.query('SELECT * FROM trips WHERE id=$1',[req.params.id])
  if (!rows.length) return res.status(404).json({ success:false, error:'Trajet non trouvé' })
  res.json({ success:true, data:rows[0] })
})

// POST /api/trips
app.post('/api/trips', async (req,res) => {
  const userId = req.headers['x-user-id']
  if (!userId) return res.status(401).json({ success:false, error:'Non autorisé' })
  try {
    const d = TripSchema.parse(req.body)
    const { rows } = await pool.query(`
      INSERT INTO trips (carrier_id,origin_address,origin_city,origin_lat,origin_lng,
        dest_address,dest_city,dest_lat,dest_lng,departure_at,
        max_weight_kg,max_volume_dm3,available_weight_kg,available_volume_dm3,notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$11,$12,$13)
      RETURNING *`,
      [userId,d.originAddress,d.originCity,d.originLat,d.originLng,
       d.destAddress,d.destCity,d.destLat,d.destLng,d.departureAt,
       d.maxWeightKg,d.maxVolumeDm3,d.notes||null]
    )
    publish('trip.created',{ tripId:rows[0].id, carrierId:userId,
      originCity:d.originCity, destCity:d.destCity })
    res.status(201).json({ success:true, data:rows[0] })
  } catch(err) {
    if (err instanceof z.ZodError) return res.status(400).json({ success:false, error:err.errors[0]?.message })
    console.error('[Trip] create error:', err)
    res.status(500).json({ success:false, error:'Erreur interne' })
  }
})

// PATCH /api/trips/:id/accept-parcel
app.patch('/api/trips/:id/accept-parcel', async (req,res) => {
  const userId = req.headers['x-user-id']
  if (!userId) return res.status(401).json({ success:false, error:'Non autorisé' })
  const { parcelId, parcelWeightKg=0, parcelVolumeDm3=0 } = req.body

  const { rows:trip } = await pool.query('SELECT * FROM trips WHERE id=$1 AND carrier_id=$2',[req.params.id,userId])
  if (!trip.length) return res.status(404).json({ success:false, error:'Trajet non trouvé' })

  const pickupQr   = crypto.randomBytes(16).toString('hex')
  const deliveryQr = crypto.randomBytes(16).toString('hex')

  await pool.query(`
    UPDATE trips SET
      available_weight_kg  = available_weight_kg - $1,
      available_volume_dm3 = available_volume_dm3 - $2,
      updated_at = NOW()
    WHERE id=$3`,
    [parcelWeightKg, parcelVolumeDm3, req.params.id]
  )

  publish('trip.parcel_accepted',{
    tripId:req.params.id, parcelId, carrierId:userId,
    pickupQr, deliveryQr,
  })

  res.json({ success:true, data:{ message:'Colis accepté ✅', pickupQr, deliveryQr } })
})

app.get('/health',(req,res)=>res.json({ status:'ok', service:'trip-service' }))

async function start() {
  for(let i=0;i<15;i++) {
    try { await pool.query('SELECT 1'); break }
    catch { console.warn(`[Trip] Attente PostgreSQL... (${i+1}/15)`); await new Promise(r=>setTimeout(r,2000)) }
  }
  await initDB()
  await connectRabbit()
  app.listen(PORT,()=>console.log(`\x1b[32m[Trip] 🗺  Démarré sur le port ${PORT}\x1b[0m`))
}

start().catch(err=>{ console.error('[Trip] Erreur démarrage:',err); process.exit(1) })
