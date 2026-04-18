# Yobaleema — Architecture Microservices

Plateforme de covoiturage de colis entre particuliers.
Architecture **7 microservices** orchestrés par Docker Compose.

---

## 🏗️ Architecture

```
                         ┌──────────────────────────────────────────┐
                         │           API GATEWAY  :4000              │
                         │  • Routing HTTP par service               │
                         │  • Vérification JWT (Bearer token)        │
                         │  • WebSocket Socket.io (GPS, messages)    │
                         │  • Rate limiting                          │
                         └──────┬───────────────────────────────────┘
                                │ proxy HTTP interne
          ┌─────────────────────┼──────────────────────────────┐
          │                     │                              │
    ┌─────▼──────┐  ┌──────────▼──────┐  ┌─────────────▼──────┐
    │Auth Service│  │  User Service   │  │  Parcel Service     │
    │  :4001     │  │     :4002       │  │      :4003          │
    │  DB:auth   │  │   DB:users      │  │    DB:parcels       │
    └────────────┘  └─────────────────┘  └─────────────────────┘
          │                     │                              │
    ┌─────▼──────┐  ┌──────────▼──────┐  ┌─────────────▼──────┐
    │Trip Service│  │Matching Service │  │Notification Service │
    │  :4004     │  │     :4005       │  │      :4006          │
    │  DB:trips  │  │  DB:matching    │  │  DB:notifications   │
    └────────────┘  └─────────────────┘  └─────────────────────┘
          │                     │                              │
          └─────────────────────┴──────────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │     RabbitMQ          │  ← Bus d'événements
                    │  Exchange: topic      │     (event-driven)
                    │  yobaleema.events     │
                    └───────────────────────┘

    Infrastructure commune : PostgreSQL (6 DBs) · Redis · RabbitMQ
```

---

## 🚀 Démarrage en 3 commandes

**Prérequis : Docker + Docker Compose installés**

```bash
# 1. Cloner et entrer dans le projet
cd yobaleema-ms

# 2. Créer le fichier de secrets
cp .env.example .env

# 3. Lancer tout
docker-compose up --build
```

Attendre ~60 secondes que tous les services démarrent, puis :

| Service        | URL                          |
|----------------|------------------------------|
| **Frontend**   | http://localhost:3000        |
| **API Gateway**| http://localhost:4000        |
| **RabbitMQ**   | http://localhost:15672       |
| **PostgreSQL** | localhost:5432               |
| **Redis**      | localhost:6379               |

Identifiants RabbitMQ Dashboard : `yoba` / `yoba_secret`

---

## 📁 Structure du projet

```
yobaleema-ms/
├── docker-compose.yml              ← Orchestration complète
├── .env.example                    ← Variables (JWT secrets, SMTP)
├── infrastructure/
│   └── postgres/init/01-init.sql  ← Crée les 6 bases + tables
├── shared/
│   └── index.js                   ← Logger, EventBus, helpers
├── services/
│   ├── api-gateway/               ← Port 4000 — routeur + JWT + WS
│   ├── auth-service/              ← Port 4001 — register/login/refresh
│   ├── user-service/              ← Port 4002 — profils, avis
│   ├── parcel-service/            ← Port 4003 — CRUD colis
│   ├── trip-service/              ← Port 4004 — CRUD trajets
│   ├── matching-service/          ← Port 4005 — algo Haversine + cache Redis
│   └── notification-service/      ← Port 4006 — events RabbitMQ + messages
└── frontend/                      ← React + Vite + TailwindCSS
    └── src/
        ├── pages/                 ← Home, Login, Register, Dashboard...
        ├── components/            ← Layout, sections, UI
        ├── services/api.js        ← Axios → Gateway (auto-refresh JWT)
        └── store/authStore.js     ← Zustand (persisté localStorage)
```

---

## 🔄 Bus d'événements (RabbitMQ)

Exchange : `yobaleema.events` (type `topic`, durable)

| Événement              | Publié par        | Consommé par                        |
|------------------------|-------------------|-------------------------------------|
| `user.registered`      | auth-service      | user-service (crée le profil)       |
| `user.registered`      | auth-service      | notification-service (email bienv.) |
| `parcel.created`       | parcel-service    | matching-service (auto-matching)    |
| `parcel.created`       | parcel-service    | notification-service                |
| `parcel.matched`       | matching-service  | notification-service (notif app)    |
| `parcel.accepted`      | parcel-service    | notification-service                |
| `parcel.confirmed`     | parcel-service    | notification-service                |
| `trip.created`         | trip-service      | notification-service                |
| `trip.parcel_accepted` | trip-service      | notification-service (QR codes)     |

---

## 🗄️ Bases de données

Chaque service possède sa **propre base PostgreSQL isolée** :

| Service              | Base                 | Tables principales              |
|----------------------|----------------------|---------------------------------|
| auth-service         | `yoba_auth`          | users_auth, refresh_tokens      |
| user-service         | `yoba_users`         | profiles, reviews               |
| parcel-service       | `yoba_parcels`       | parcels                         |
| trip-service         | `yoba_trips`         | trips                           |
| matching-service     | `yoba_matching`      | match_results (cache)           |
| notification-service | `yoba_notifications` | messages, notifications         |

---

## 🔐 Sécurité

- **JWT** : access token 15 min, refresh token 7 jours (rotation à chaque renouvellement)
- **bcrypt** (rounds=12) sur tous les mots de passe
- **CORS** restreint à `FRONTEND_URL`
- **Rate limiting** : 30 req/15min sur `/api/auth`, 500 req/15min global
- **Headers HTTP** : Helmet.js sur tous les services

---

## 🌐 Algorithme de matching (matching-service)

Distance **Haversine** entre 2 points GPS.

**Critères de filtrage :**
1. Poids disponible ≥ poids du colis
2. Distance pickup→origine trajet ≤ 30 km
3. Distance livraison→destination trajet ≤ 30 km
4. Détour ≤ 15% de la distance directe du trajet

**Score composite (0–100) :**
- 50% → score détour (moins de détour = mieux)
- 35% → note du transporteur (0–5★)
- 15% → popularité (nombre d'avis)

Résultats mis en **cache Redis 5 minutes**. Invalidation possible via `POST /api/matching/:id/refresh`.

---

## 🛠️ Développement sans Docker

Pour lancer un service individuellement :

```bash
# 1. Démarrer les infras seules
docker-compose up postgres redis rabbitmq

# 2. Dans chaque service
cd services/auth-service
npm install
cp ../../.env.example .env   # Adapter DATABASE_URL etc.
npm run dev
```

---

## ➕ Ajouter un microservice

1. Créer `services/mon-service/` avec `src/index.js`, `package.json`, `Dockerfile`
2. Ajouter le service dans `docker-compose.yml`
3. Ajouter la route proxy dans `services/api-gateway/src/index.js`
4. Déclarer les subscriptions RabbitMQ si besoin

---

## 🔧 Variables d'environnement importantes

| Variable             | Défaut                    | Description            |
|----------------------|---------------------------|------------------------|
| `JWT_SECRET`         | (à changer !)             | Clé de signature JWT   |
| `JWT_REFRESH_SECRET` | (à changer !)             | Clé refresh token      |
| `SMTP_HOST`          | smtp.mailtrap.io          | Serveur email          |
| `SMTP_USER`          | (vide)                    | Email désactivé si vide|

---

## 📦 Stack technique

| Couche       | Technologie                              |
|--------------|------------------------------------------|
| Frontend     | React 18, Vite, TailwindCSS, Framer Motion, Zustand, React Query |
| Gateway      | Express, http-proxy-middleware, Socket.io |
| Services     | Node.js 20, Express, pg (PostgreSQL)     |
| Auth         | bcryptjs, jsonwebtoken                   |
| Messaging    | RabbitMQ (amqplib), exchange topic       |
| Cache        | Redis (ioredis), TTL 5min               |
| Email        | Nodemailer (SMTP configurable)          |
| DB           | PostgreSQL 16 (6 bases isolées)         |
| Container    | Docker, Docker Compose                  |
