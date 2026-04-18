// ================================================================
//  Matching Service — Port 4005
//  DB propre : yoba_matching (cache des résultats)
//  Requête   : parcel-service + trip-service via HTTP interne
//  Publie    : parcel.matched
// ================================================================

'use strict'

require('dotenv').config()

const express  = require('express')
const { Pool } = require('pg')
const amqp     = require('amqplib')
const Redis    = require('ioredis')

const app   = express()
const PORT  = process.env.PORT || 4005
app.use(express.json())

const pool  = new Pool({ connectionString: process.env.DATABASE_URL })
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

const MAX_DETOUR = Number(process.env.MAX_DETOUR_PERCENT || 15) / 100
const MAX_RADIUS = Number(process.env.MAX_PICKUP_RADIUS_KM || 30)

const PARCEL_URL = process.env.PARCEL_URL || 'http://parcel-service:4003'
const TRIP_URL   = process.env.TRIP_URL   || 'http://trip-service:4004'

let channel = null

// Distance Haversine
function km(lat1, lng1, lat2, lng2) {
  const R=6371, dL=(lat2-lat1)*Math.PI/180, dN=(lng2-lng1)*Math.PI/180
  const a=Math.sin(dL/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dN/2)**2
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))
}

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS match_results (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      parcel_id       UUID NOT NULL,
      trip_id         UUID NOT NULL,
      carrier_id      UUID NOT NULL,
      score           SMALLINT NOT NULL,
      detour_pct      SMALLINT NOT NULL,
      price_suggested DECIMAL(10,2) NOT NULL,
      dist_km         DECIMAL(8,2),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (parcel_id, trip_id)
    );
    CREATE INDEX IF NOT EXISTS idx_match_parcel ON match_results(parcel_id);
  `)
  console.log('\x1b[32m[Matching] DB initialisée\x1b[0m')
}

async function connectRabbit(retries=10) {
  for (let i=1; i<=retries; i++) {
    try {
      const conn = await amqp.connect(process.env.RABBITMQ_URL)
      channel    = await conn.createChannel()
      await channel.assertExchange('yobaleema.events','topic',{ durable:true })

      // Déclencher le matching auto quand un colis est créé
      const q = await channel.assertQueue('matching-service.parcel_created',{ durable:true })
      await channel.bindQueue(q.queue,'yobaleema.events','parcel.created')
      channel.consume(q.queue, async (msg) => {
        if (!msg) return
        try {
          const { parcelId } = JSON.parse(msg.content.toString())
          await runMatching(parcelId, null)   // userId=null car event interne
          channel.ack(msg)
        } catch(err) {
          console.error('[Matching] consumer error:', err.message)
          channel.nack(msg, false, false)  // dead-letter (pas de re-queue infini)
        }
      })

      console.log('\x1b[32m[Matching] RabbitMQ connecté\x1b[0m')
      return
    } catch(err) {
      console.warn(`[Matching] RabbitMQ ${i}/${retries}: ${err.message}`)
      if (i<retries) await new Promise(r=>setTimeout(r,3000))
    }
  }
}

// ---- Algorithme principal ----
async function runMatching(parcelId, userId) {
  // Cache Redis (5 minutes)
  const cacheKey = `match:${parcelId}`
  const cached   = await redis.get(cacheKey)
  if (cached) return JSON.parse(cached)

  // Récupérer le colis via HTTP interne
  const headers = userId ? { 'x-user-id': userId } : { 'x-user-id': 'system' }
  const pr = await fetch(`${PARCEL_URL}/api/parcels/${parcelId}`, { headers })
  if (!pr.ok) throw new Error('Colis non trouvé')
  const { data: parcel } = await pr.json()

  // Récupérer les trajets disponibles via HTTP interne
  const tr = await fetch(
    `${TRIP_URL}/api/trips?limit=200`, { headers }
  )
  const { data: trips } = await tr.json()

  const results = []

  for (const trip of trips || []) {
    if (trip.carrier_id === parcel.sender_id) continue
    if (Number(trip.available_weight_kg) < Number(parcel.weight_kg)) continue

    const directDist  = km(trip.origin_lat, trip.origin_lng, trip.dest_lat, trip.dest_lng)
    const d1 = km(trip.origin_lat,   trip.origin_lng,   parcel.pickup_lat,   parcel.pickup_lng)
    const d2 = km(parcel.pickup_lat,  parcel.pickup_lng,  parcel.delivery_lat, parcel.delivery_lng)
    const d3 = km(parcel.delivery_lat,parcel.delivery_lng,trip.dest_lat,       trip.dest_lng)
    const detourDist  = d1 + d2 + d3

    if (d1 > MAX_RADIUS || d3 > MAX_RADIUS) continue

    const detourRatio = directDist > 0 ? (detourDist - directDist) / directDist : 0
    if (detourRatio > MAX_DETOUR) continue

    const detourScore   = 1 - detourRatio / MAX_DETOUR
    const ratingScore   = (Number(trip.rating_avg) || 0) / 5
    const popularScore  = Math.min(1,(Number(trip.rating_count)||0)/50)
    const score         = Math.round((detourScore*0.5 + ratingScore*0.35 + popularScore*0.15)*100)
    const suggestedPrice= Math.max(5, Math.round(detourDist*0.06 + Number(parcel.weight_kg)*1.2))

    results.push({
      tripId:         trip.id,
      carrierId:      trip.carrier_id,
      carrierName:    trip.carrier_name || 'Transporteur',
      avatarUrl:      trip.avatar_url   || null,
      ratingAvg:      Number(trip.rating_avg) || 0,
      ratingCount:    Number(trip.rating_count) || 0,
      departureAt:    trip.departure_at,
      originCity:     trip.origin_city,
      destCity:       trip.dest_city,
      detourPercent:  Math.round(detourRatio * 100),
      distKm:         Math.round(detourDist),
      suggestedPrice,
      score,
    })
  }

  results.sort((a,b) => b.score - a.score)
  const top10 = results.slice(0, 10)

  // Persister les résultats
  for (const m of top10) {
    await pool.query(
      `INSERT INTO match_results (parcel_id,trip_id,carrier_id,score,detour_pct,price_suggested,dist_km)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (parcel_id,trip_id) DO UPDATE
       SET score=$4,detour_pct=$5,price_suggested=$6,dist_km=$7`,
      [parcelId, m.tripId, m.carrierId, m.score, m.detourPercent, m.suggestedPrice, m.distKm]
    )
  }

  // Notifier si des matchs trouvés
  if (top10.length > 0 && channel) {
    channel.publish('yobaleema.events','parcel.matched',
      Buffer.from(JSON.stringify({ parcelId, matchCount:top10.length, _source:'matching-service', _ts:Date.now() })),
      { persistent:true }
    )
  }

  // Cache 5 min
  await redis.setex(cacheKey, 300, JSON.stringify(top10))
  console.log(`\x1b[32m[Matching] ✅ ${top10.length} matches pour colis ${parcelId}\x1b[0m`)
  return top10
}

app.use((req,res,next)=>{
  const t=Date.now()
  res.on('finish',()=>console.log(`[Matching] ${req.method} ${req.path} → ${res.statusCode} (${Date.now()-t}ms)`))
  next()
})

// GET /api/matching/:parcelId
app.get('/api/matching/:parcelId', async (req,res) => {
  const userId = req.headers['x-user-id']
  if (!userId) return res.status(401).json({ success:false, error:'Non autorisé' })
  try {
    const results = await runMatching(req.params.parcelId, userId)
    res.json({ success:true, data:results, count:results.length })
  } catch(err) {
    console.error('[Matching] error:', err.message)
    res.status(500).json({ success:false, error:err.message })
  }
})

// POST /api/matching/:parcelId/refresh — Invalider le cache et relancer
app.post('/api/matching/:parcelId/refresh', async (req,res) => {
  const userId = req.headers['x-user-id']
  await redis.del(`match:${req.params.parcelId}`)
  try {
    const results = await runMatching(req.params.parcelId, userId)
    res.json({ success:true, data:results, count:results.length })
  } catch(err) {
    res.status(500).json({ success:false, error:err.message })
  }
})

app.get('/health',(req,res)=>res.json({ status:'ok', service:'matching-service' }))

async function start() {
  for(let i=0;i<15;i++) {
    try { await pool.query('SELECT 1'); break }
    catch { console.warn(`[Matching] Attente PostgreSQL... (${i+1}/15)`); await new Promise(r=>setTimeout(r,2000)) }
  }
  await initDB()
  await connectRabbit()
  app.listen(PORT,()=>console.log(`\x1b[32m[Matching] 🎯 Démarré sur le port ${PORT}\x1b[0m`))
}

start().catch(err=>{ console.error('[Matching] Erreur démarrage:',err); process.exit(1) })
