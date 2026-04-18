// ================================================================
//  Parcel Service — Port 4003
//  DB : yoba_parcels
//  Publie  : parcel.created, parcel.accepted, parcel.confirmed
//  Consomme: trip.parcel_accepted → met à jour le trip_id
// ================================================================

'use strict'

require('dotenv').config()

const express  = require('express')
const { Pool } = require('pg')
const amqp     = require('amqplib')
const crypto   = require('crypto')
const { z }    = require('zod')

const app  = express()
const PORT = process.env.PORT || 4003
app.use(express.json())

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
let channel = null

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS parcels (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sender_id        UUID NOT NULL,
      trip_id          UUID,
      pickup_address   TEXT NOT NULL,
      pickup_city      VARCHAR(100) NOT NULL,
      pickup_lat       DECIMAL(9,6) NOT NULL,
      pickup_lng       DECIMAL(9,6) NOT NULL,
      delivery_address TEXT NOT NULL,
      delivery_city    VARCHAR(100) NOT NULL,
      delivery_lat     DECIMAL(9,6) NOT NULL,
      delivery_lng     DECIMAL(9,6) NOT NULL,
      weight_kg        DECIMAL(6,2) NOT NULL,
      width_cm         DECIMAL(6,2) NOT NULL,
      height_cm        DECIMAL(6,2) NOT NULL,
      depth_cm         DECIMAL(6,2) NOT NULL,
      declared_value   DECIMAL(10,2) NOT NULL DEFAULT 0,
      is_fragile       BOOLEAN NOT NULL DEFAULT FALSE,
      description      TEXT,
      suggested_price  DECIMAL(10,2),
      final_price      DECIMAL(10,2),
      pickup_qr_code   VARCHAR(100) UNIQUE,
      delivery_qr_code VARCHAR(100) UNIQUE,
      pickup_from      TIMESTAMPTZ NOT NULL,
      pickup_to        TIMESTAMPTZ NOT NULL,
      insurance_opted  BOOLEAN NOT NULL DEFAULT FALSE,
      status           VARCHAR(30) NOT NULL DEFAULT 'pending',
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_parcels_sender ON parcels(sender_id);
    CREATE INDEX IF NOT EXISTS idx_parcels_status ON parcels(status);
  `)
  console.log('\x1b[32m[Parcel] DB initialisée\x1b[0m')
}

function publish(rk, payload) {
  if (!channel) return
  channel.publish('yobaleema.events', rk,
    Buffer.from(JSON.stringify({ ...payload, _source:'parcel-service', _ts:Date.now() })),
    { persistent:true }
  )
}

async function connectRabbit(retries=10) {
  for (let i=1; i<=retries; i++) {
    try {
      const conn = await amqp.connect(process.env.RABBITMQ_URL)
      channel    = await conn.createChannel()
      await channel.assertExchange('yobaleema.events','topic',{ durable:true })
      console.log('\x1b[32m[Parcel] RabbitMQ connecté\x1b[0m')
      return
    } catch(err) {
      console.warn(`[Parcel] RabbitMQ ${i}/${retries}: ${err.message}`)
      if (i<retries) await new Promise(r=>setTimeout(r,3000))
    }
  }
}

const ParcelSchema = z.object({
  pickupAddress:   z.string().min(3),
  pickupCity:      z.string().min(2),
  pickupLat:       z.number(),
  pickupLng:       z.number(),
  deliveryAddress: z.string().min(3),
  deliveryCity:    z.string().min(2),
  deliveryLat:     z.number(),
  deliveryLng:     z.number(),
  weightKg:        z.number().positive(),
  widthCm:         z.number().positive(),
  heightCm:        z.number().positive(),
  depthCm:         z.number().positive(),
  declaredValue:   z.number().min(0).default(0),
  isFragile:       z.boolean().default(false),
  description:     z.string().optional(),
  pickupFrom:      z.string(),
  pickupTo:        z.string(),
  insuranceOpted:  z.boolean().default(false),
})

app.use((req,res,next)=>{
  const t=Date.now()
  res.on('finish',()=>console.log(`[Parcel] ${req.method} ${req.path} → ${res.statusCode} (${Date.now()-t}ms)`))
  next()
})

// GET /api/parcels
app.get('/api/parcels', async (req,res) => {
  const userId = req.headers['x-user-id']
  if (!userId) return res.status(401).json({ success:false, error:'Non autorisé' })
  const { status, page=1, limit=20 } = req.query
  let q = 'SELECT * FROM parcels WHERE sender_id=$1'
  const params = [userId]
  if (status) { params.push(status); q += ` AND status=$${params.length}` }
  q += ` ORDER BY created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`
  params.push(Number(limit), (page-1)*limit)
  const { rows } = await pool.query(q, params)
  res.json({ success:true, data:rows, page:Number(page), limit:Number(limit) })
})

// GET /api/parcels/:id
app.get('/api/parcels/:id', async (req,res) => {
  const userId = req.headers['x-user-id']
  const { rows } = await pool.query('SELECT * FROM parcels WHERE id=$1', [req.params.id])
  if (!rows.length) return res.status(404).json({ success:false, error:'Colis non trouvé' })
  res.json({ success:true, data:rows[0] })
})

// POST /api/parcels
app.post('/api/parcels', async (req,res) => {
  const userId = req.headers['x-user-id']
  if (!userId) return res.status(401).json({ success:false, error:'Non autorisé' })
  try {
    const d = ParcelSchema.parse(req.body)
    const distKm = Math.round(111*Math.sqrt(Math.pow(d.pickupLat-d.deliveryLat,2)+Math.pow(d.pickupLng-d.deliveryLng,2)))
    const suggestedPrice = Math.max(5, Math.round(distKm*0.08 + d.weightKg*1.5))

    const { rows } = await pool.query(`
      INSERT INTO parcels (sender_id,pickup_address,pickup_city,pickup_lat,pickup_lng,
        delivery_address,delivery_city,delivery_lat,delivery_lng,
        weight_kg,width_cm,height_cm,depth_cm,declared_value,is_fragile,
        description,pickup_from,pickup_to,suggested_price,insurance_opted)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      RETURNING *`,
      [userId,d.pickupAddress,d.pickupCity,d.pickupLat,d.pickupLng,
       d.deliveryAddress,d.deliveryCity,d.deliveryLat,d.deliveryLng,
       d.weightKg,d.widthCm,d.heightCm,d.depthCm,d.declaredValue,d.isFragile,
       d.description||null,d.pickupFrom,d.pickupTo,suggestedPrice,d.insuranceOpted]
    )
    publish('parcel.created', { parcelId:rows[0].id, senderId:userId,
      pickupCity:d.pickupCity, deliveryCity:d.deliveryCity })
    res.status(201).json({ success:true, data:rows[0] })
  } catch(err) {
    if (err instanceof z.ZodError) return res.status(400).json({ success:false, error:err.errors[0]?.message })
    console.error('[Parcel] create error:', err)
    res.status(500).json({ success:false, error:'Erreur interne' })
  }
})

// PATCH /api/parcels/:id/status
app.patch('/api/parcels/:id/status', async (req,res) => {
  const userId = req.headers['x-user-id']
  const { status, tripId, finalPrice, pickupQrCode, deliveryQrCode } = req.body
  const sets=['status=$2','updated_at=NOW()']
  const vals=[req.params.id, status]
  if (tripId)         { sets.push(`trip_id=$${vals.length+1}`);           vals.push(tripId) }
  if (finalPrice)     { sets.push(`final_price=$${vals.length+1}`);       vals.push(finalPrice) }
  if (pickupQrCode)   { sets.push(`pickup_qr_code=$${vals.length+1}`);   vals.push(pickupQrCode) }
  if (deliveryQrCode) { sets.push(`delivery_qr_code=$${vals.length+1}`); vals.push(deliveryQrCode) }
  const { rows } = await pool.query(
    `UPDATE parcels SET ${sets.join(',')} WHERE id=$1 RETURNING *`, vals
  )
  if (!rows.length) return res.status(404).json({ success:false, error:'Colis non trouvé' })
  if (status==='confirmed') publish('parcel.confirmed', { parcelId:req.params.id, senderId:userId })
  res.json({ success:true, data:rows[0] })
})

// PATCH /api/parcels/:id/confirm-delivery
app.patch('/api/parcels/:id/confirm-delivery', async (req,res) => {
  const userId = req.headers['x-user-id']
  const { qrCode } = req.body
  const { rows } = await pool.query('SELECT * FROM parcels WHERE id=$1 AND sender_id=$2',[req.params.id,userId])
  if (!rows.length) return res.status(404).json({ success:false, error:'Colis non trouvé' })
  if (rows[0].delivery_qr_code !== qrCode) return res.status(400).json({ success:false, error:'QR code invalide' })
  await pool.query("UPDATE parcels SET status='confirmed',updated_at=NOW() WHERE id=$1",[req.params.id])
  publish('parcel.confirmed',{ parcelId:req.params.id, senderId:userId })
  res.json({ success:true, data:{ message:'Livraison confirmée ✅' } })
})

app.get('/health', (req,res) => res.json({ status:'ok', service:'parcel-service' }))

async function start() {
  for(let i=0;i<15;i++) {
    try { await pool.query('SELECT 1'); break }
    catch { console.warn(`[Parcel] Attente PostgreSQL... (${i+1}/15)`); await new Promise(r=>setTimeout(r,2000)) }
  }
  await initDB()
  await connectRabbit()
  app.listen(PORT, () => console.log(`\x1b[32m[Parcel] 📦 Démarré sur le port ${PORT}\x1b[0m`))
}

start().catch(err=>{ console.error('[Parcel] Erreur démarrage:', err); process.exit(1) })
