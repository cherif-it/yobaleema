// ================================================================
//  shared/index.js — Utilitaires partagés entre microservices
//  Chaque service copie ce dossier ou le référence en local
// ================================================================

'use strict'

const amqp   = require('amqplib')
const crypto = require('crypto')

// ----------------------------------------------------------------
//  Logger — couleurs par niveau
// ----------------------------------------------------------------
const COLORS = { info:'\x1b[36m', ok:'\x1b[32m', warn:'\x1b[33m', error:'\x1b[31m', reset:'\x1b[0m' }

const logger = {
  info:  (svc, msg, data) => console.log( `${COLORS.info}[${svc}]${COLORS.reset} ${msg}`, data ?? ''),
  ok:    (svc, msg, data) => console.log( `${COLORS.ok}[${svc}] ✅${COLORS.reset} ${msg}`, data ?? ''),
  warn:  (svc, msg, data) => console.warn(`${COLORS.warn}[${svc}] ⚠️${COLORS.reset}  ${msg}`, data ?? ''),
  error: (svc, msg, data) => console.error(`${COLORS.error}[${svc}] ❌${COLORS.reset} ${msg}`, data ?? ''),
  http:  (svc, method, path, status, ms) => {
    const c = status < 400 ? COLORS.ok : COLORS.error
    console.log(`${COLORS.info}[${svc}]${COLORS.reset} ${c}${method}${COLORS.reset} ${path} → ${status} (${ms}ms)`)
  },
}

// ----------------------------------------------------------------
//  Réponses HTTP standardisées
// ----------------------------------------------------------------
const respond = {
  ok:      (res, data, status = 200)  => res.status(status).json({ success: true,  data }),
  created: (res, data)                => res.status(201).json({ success: true,  data }),
  error:   (res, message, status = 500) => res.status(status).json({ success: false, error: message }),
  notFound:(res, msg = 'Non trouvé')  => res.status(404).json({ success: false, error: msg }),
  badReq:  (res, msg)                 => res.status(400).json({ success: false, error: msg }),
  unauth:  (res, msg = 'Non autorisé')=> res.status(401).json({ success: false, error: msg }),
  conflict:(res, msg)                 => res.status(409).json({ success: false, error: msg }),
}

// ----------------------------------------------------------------
//  Event Bus — RabbitMQ wrapper
//  Exchange unique : yobaleema.events (topic)
// ----------------------------------------------------------------
const EXCHANGE = 'yobaleema.events'

class EventBus {
  constructor(serviceName) {
    this.name      = serviceName
    this.conn      = null
    this.channel   = null
    this.consumers = []  // { routingKey, queue, handler }
  }

  async connect(url, retries = 10) {
    for (let i = 1; i <= retries; i++) {
      try {
        this.conn    = await amqp.connect(url)
        this.channel = await this.conn.createChannel()
        await this.channel.assertExchange(EXCHANGE, 'topic', { durable: true })
        logger.ok(this.name, `RabbitMQ connecté (tentative ${i})`)

        this.conn.on('error', err => logger.error(this.name, 'RabbitMQ error', err.message))
        this.conn.on('close', () => {
          logger.warn(this.name, 'RabbitMQ connexion fermée, reconnexion dans 5s...')
          setTimeout(() => this.connect(url), 5000)
        })
        return this
      } catch (err) {
        logger.warn(this.name, `RabbitMQ tentative ${i}/${retries} échouée: ${err.message}`)
        if (i === retries) throw err
        await new Promise(r => setTimeout(r, 3000))
      }
    }
  }

  // Publier un événement
  publish(routingKey, payload) {
    if (!this.channel) return
    const msg = JSON.stringify({ ...payload, _source: this.name, _ts: Date.now() })
    this.channel.publish(EXCHANGE, routingKey, Buffer.from(msg), { persistent: true })
    logger.info(this.name, `📤 Publié: ${routingKey}`)
  }

  // S'abonner à un événement
  async subscribe(routingKey, handler) {
    if (!this.channel) throw new Error('EventBus non connecté')
    const qName = `${this.name}.${routingKey.replace(/\./g, '_').replace(/\*/g, 'any')}`
    await this.channel.assertQueue(qName, { durable: true })
    await this.channel.bindQueue(qName, EXCHANGE, routingKey)
    await this.channel.consume(qName, async (msg) => {
      if (!msg) return
      try {
        const payload = JSON.parse(msg.content.toString())
        await handler(payload)
        this.channel.ack(msg)
      } catch (err) {
        logger.error(this.name, `Erreur consumer [${routingKey}]`, err.message)
        this.channel.nack(msg, false, true)  // Remettre en queue
      }
    })
    logger.info(this.name, `📥 Abonné: ${routingKey} → ${qName}`)
  }
}

// ----------------------------------------------------------------
//  Middleware HTTP logging
// ----------------------------------------------------------------
function httpLogger(serviceName) {
  return (req, res, next) => {
    const start = Date.now()
    res.on('finish', () => {
      logger.http(serviceName, req.method, req.path, res.statusCode, Date.now() - start)
    })
    next()
  }
}

// ----------------------------------------------------------------
//  Health check handler
// ----------------------------------------------------------------
function healthHandler(serviceName, extras = {}) {
  return (req, res) => res.json({
    status: 'ok',
    service: serviceName,
    timestamp: new Date().toISOString(),
    ...extras,
  })
}

// ----------------------------------------------------------------
//  Utilitaires
// ----------------------------------------------------------------
function uuid() { return crypto.randomUUID() }

function haversineKm(lat1, lng1, lat2, lng2) {
  const R    = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2
    + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

module.exports = { logger, respond, EventBus, httpLogger, healthHandler, uuid, haversineKm }
