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






## fist fix
traoreamadoucherifjuniordiop@cherif-macbook-pro yobaleema % docker-compose up --build
WARN[0000] /Users/traoreamadoucherifjuniordiop/web/yobaleema/docker-compose.yml: the attribute `version` is obsolete, it will be ignored, please remove it to avoid potential confusion 
[+] Building 3.3s (44/52)                                                                                                                                                         
 => [internal] load local bake definitions                                                                                                                                   0.0s
 => => reading from stdin 3.14kB                                                                                                                                             0.0s
 => [matching-service internal] load build definition from Dockerfile                                                                                                        0.0s
 => => transferring dockerfile: 274B                                                                                                                                         0.0s
 => [frontend internal] load build definition from Dockerfile.dev                                                                                                            0.0s
 => => transferring dockerfile: 274B                                                                                                                                         0.0s
 => [api-gateway internal] load build definition from Dockerfile                                                                                                             0.0s
 => => transferring dockerfile: 274B                                                                                                                                         0.0s
 => [notification-service internal] load build definition from Dockerfile                                                                                                    0.0s
 => => transferring dockerfile: 274B                                                                                                                                         0.0s
 => [parcel-service internal] load build definition from Dockerfile                                                                                                          0.0s
 => => transferring dockerfile: 274B                                                                                                                                         0.0s
 => [auth-service internal] load build definition from Dockerfile                                                                                                            0.1s
 => => transferring dockerfile: 274B                                                                                                                                         0.0s
 => [trip-service internal] load build definition from Dockerfile                                                                                                            0.1s
 => => transferring dockerfile: 274B                                                                                                                                         0.0s
 => [user-service internal] load build definition from Dockerfile                                                                                                            0.1s
 => => transferring dockerfile: 274B                                                                                                                                         0.0s
 => [notification-service internal] load metadata for docker.io/library/node:20-alpine                                                                                       0.6s
 => [trip-service internal] load .dockerignore                                                                                                                               0.1s
 => => transferring context: 2B                                                                                                                                              0.0s
 => [frontend internal] load .dockerignore                                                                                                                                   0.0s
 => => transferring context: 2B                                                                                                                                              0.0s
 => [notification-service internal] load .dockerignore                                                                                                                       0.1s
 => => transferring context: 2B                                                                                                                                              0.0s
 => [auth-service internal] load .dockerignore                                                                                                                               0.0s
 => => transferring context: 2B                                                                                                                                              0.0s
 => [matching-service internal] load .dockerignore                                                                                                                           0.1s
 => => transferring context: 2B                                                                                                                                              0.0s
 => [api-gateway internal] load .dockerignore                                                                                                                                0.0s
 => => transferring context: 2B                                                                                                                                              0.0s
 => [user-service internal] load .dockerignore                                                                                                                               0.1s
 => => transferring context: 2B                                                                                                                                              0.0s
 => [parcel-service internal] load .dockerignore                                                                                                                             0.0s
 => => transferring context: 2B                                                                                                                                              0.0s
 => [notification-service 1/5] FROM docker.io/library/node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293                                 0.0s
 => [frontend internal] load build context                                                                                                                                   0.1s
 => => transferring context: 112.95kB                                                                                                                                        0.0s
 => [parcel-service internal] load build context                                                                                                                             0.0s
 => => transferring context: 10.08kB                                                                                                                                         0.0s
 => [matching-service internal] load build context                                                                                                                           0.1s
 => => transferring context: 9.47kB                                                                                                                                          0.0s
 => [trip-service internal] load build context                                                                                                                               0.1s
 => => transferring context: 8.87kB                                                                                                                                          0.0s
 => [user-service internal] load build context                                                                                                                               0.1s
 => => transferring context: 9.88kB                                                                                                                                          0.0s
 => [api-gateway internal] load build context                                                                                                                                0.1s
 => => transferring context: 10.59kB                                                                                                                                         0.0s
 => [auth-service internal] load build context                                                                                                                               0.1s
 => => transferring context: 10.85kB                                                                                                                                         0.0s
 => [notification-service internal] load build context                                                                                                                       0.1s
 => => transferring context: 12.66kB                                                                                                                                         0.0s
 => CACHED [parcel-service 2/5] WORKDIR /app                                                                                                                                 0.0s
 => [matching-service 3/5] COPY package*.json ./                                                                                                                             0.1s
 => [parcel-service 3/5] COPY package*.json ./                                                                                                                               0.0s
 => [frontend 3/5] COPY package*.json ./                                                                                                                                     0.1s
 => [user-service 3/5] COPY package*.json ./                                                                                                                                 0.1s
 => [api-gateway 3/5] COPY package*.json ./                                                                                                                                  0.1s
 => [notification-service 3/5] COPY package*.json ./                                                                                                                         0.1s
 => [auth-service 3/5] COPY package*.json ./                                                                                                                                 0.1s
 => [trip-service 3/5] COPY package*.json ./                                                                                                                                 0.1s
 => ERROR [parcel-service 4/5] RUN npm ci --only=production                                                                                                                  1.3s
 => CANCELED [matching-service 4/5] RUN npm ci --only=production                                                                                                             1.5s
 => CANCELED [frontend 4/5] RUN npm install                                                                                                                                  1.5s
 => CANCELED [notification-service 4/5] RUN npm ci --only=production                                                                                                         1.5s
 => CANCELED [api-gateway 4/5] RUN npm ci --only=production                                                                                                                  1.5s
 => CANCELED [auth-service 4/5] RUN npm ci --only=production                                                                                                                 1.5s
 => CANCELED [user-service 4/5] RUN npm ci --only=production                                                                                                                 1.5s
 => CANCELED [trip-service 4/5] RUN npm ci --only=production                                                                                                                 1.5s
------
 > [parcel-service 4/5] RUN npm ci --only=production:
0.456 npm warn config only Use `--omit=dev` to omit dev dependencies from the install.
1.255 npm error code EUSAGE
1.256 npm error
1.256 npm error The `npm ci` command can only install with an existing package-lock.json or
1.256 npm error npm-shrinkwrap.json with lockfileVersion >= 1. Run an install with npm@5 or
1.256 npm error later to generate a package-lock.json file, then try again.
1.256 npm error
1.256 npm error Clean install a project
1.256 npm error
1.256 npm error Usage:
1.256 npm error npm ci
1.256 npm error
1.256 npm error Options:
1.256 npm error [--install-strategy <hoisted|nested|shallow|linked>] [--legacy-bundling]
1.256 npm error [--global-style] [--omit <dev|optional|peer> [--omit <dev|optional|peer> ...]]
1.256 npm error [--include <prod|dev|optional|peer> [--include <prod|dev|optional|peer> ...]]
1.256 npm error [--strict-peer-deps] [--foreground-scripts] [--ignore-scripts] [--no-audit]
1.256 npm error [--no-bin-links] [--no-fund] [--dry-run]
1.256 npm error [-w|--workspace <workspace-name> [-w|--workspace <workspace-name> ...]]
1.256 npm error [-ws|--workspaces] [--include-workspace-root] [--install-links]
1.256 npm error
1.256 npm error aliases: clean-install, ic, install-clean, isntall-clean
1.256 npm error
1.256 npm error Run "npm help ci" for more info
1.260 npm error A complete log of this run can be found in: /root/.npm/_logs/2026-04-18T19_19_21_095Z-debug-0.log
------
Dockerfile:4
--------------------
   2 |     WORKDIR /app
   3 |     COPY package*.json ./
   4 | >>> RUN npm ci --only=production
   5 |     COPY . .
   6 |     CMD ["node", "src/index.js"]
--------------------
target parcel-service: failed to solve: process "/bin/sh -c npm ci --only=production" did not complete successfully: exit code: 1

View build details: docker-desktop://dashboard/build/desktop-linux/desktop-linux/y739ocfdo090xsgi46t805lx2