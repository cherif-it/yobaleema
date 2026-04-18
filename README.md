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

traoreamadoucherifjuniordiop@cherif-macbook-pro yobaleema % docker-compose up --build WARN[0000] /Users/traoreamadoucherifjuniordiop/web/yobaleema/docker-compose.yml: the attribute version is obsolete, it will be ignored, please remove it to avoid potential confusion [+] Building 3.3s (44/52)
=> [internal] load local bake definitions 0.0s => => reading from stdin 3.14kB 0.0s => [matching-service internal] load build definition from Dockerfile 0.0s => => transferring dockerfile: 274B 0.0s => [frontend internal] load build definition from Dockerfile.dev 0.0s => => transferring dockerfile: 274B 0.0s => [api-gateway internal] load build definition from Dockerfile 0.0s => => transferring dockerfile: 274B 0.0s => [notification-service internal] load build definition from Dockerfile 0.0s => => transferring dockerfile: 274B 0.0s => [parcel-service internal] load build definition from Dockerfile 0.0s => => transferring dockerfile: 274B 0.0s => [auth-service internal] load build definition from Dockerfile 0.1s => => transferring dockerfile: 274B 0.0s => [trip-service internal] load build definition from Dockerfile 0.1s => => transferring dockerfile: 274B 0.0s => [user-service internal] load build definition from Dockerfile 0.1s => => transferring dockerfile: 274B 0.0s => [notification-service internal] load metadata for docker.io/library/node:20-alpine 0.6s => [trip-service internal] load .dockerignore 0.1s => => transferring context: 2B 0.0s => [frontend internal] load .dockerignore 0.0s => => transferring context: 2B 0.0s => [notification-service internal] load .dockerignore 0.1s => => transferring context: 2B 0.0s => [auth-service internal] load .dockerignore 0.0s => => transferring context: 2B 0.0s => [matching-service internal] load .dockerignore 0.1s => => transferring context: 2B 0.0s => [api-gateway internal] load .dockerignore 0.0s => => transferring context: 2B 0.0s => [user-service internal] load .dockerignore 0.1s => => transferring context: 2B 0.0s => [parcel-service internal] load .dockerignore 0.0s => => transferring context: 2B 0.0s => [notification-service 1/5] FROM docker.io/library/node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 0.0s => [frontend internal] load build context 0.1s => => transferring context: 112.95kB 0.0s => [parcel-service internal] load build context 0.0s => => transferring context: 10.08kB 0.0s => [matching-service internal] load build context 0.1s => => transferring context: 9.47kB 0.0s => [trip-service internal] load build context 0.1s => => transferring context: 8.87kB 0.0s => [user-service internal] load build context 0.1s => => transferring context: 9.88kB 0.0s => [api-gateway internal] load build context 0.1s => => transferring context: 10.59kB 0.0s => [auth-service internal] load build context 0.1s => => transferring context: 10.85kB 0.0s => [notification-service internal] load build context 0.1s => => transferring context: 12.66kB 0.0s => CACHED [parcel-service 2/5] WORKDIR /app 0.0s => [matching-service 3/5] COPY package*.json ./ 0.1s => [parcel-service 3/5] COPY package*.json ./ 0.0s => [frontend 3/5] COPY package*.json ./ 0.1s => [user-service 3/5] COPY package*.json ./ 0.1s => [api-gateway 3/5] COPY package*.json ./ 0.1s => [notification-service 3/5] COPY package*.json ./ 0.1s => [auth-service 3/5] COPY package*.json ./ 0.1s => [trip-service 3/5] COPY package*.json ./ 0.1s => ERROR [parcel-service 4/5] RUN npm ci --only=production 1.3s => CANCELED [matching-service 4/5] RUN npm ci --only=production 1.5s => CANCELED [frontend 4/5] RUN npm install 1.5s => CANCELED [notification-service 4/5] RUN npm ci --only=production 1.5s => CANCELED [api-gateway 4/5] RUN npm ci --only=production 1.5s => CANCELED [auth-service 4/5] RUN npm ci --only=production 1.5s => CANCELED [user-service 4/5] RUN npm ci --only=production 1.5s => CANCELED [trip-service 4/5] RUN npm ci --only=production 1.5s
[parcel-service 4/5] RUN npm ci --only=production: 0.456 npm warn config only Use --omit=dev to omit dev dependencies from the install. 1.255 npm error code EUSAGE 1.256 npm error 1.256 npm error The npm ci command can only install with an existing package-lock.json or 1.256 npm error npm-shrinkwrap.json with lockfileVersion >= 1. Run an install with npm@5 or 1.256 npm error later to generate a package-lock.json file, then try again. 1.256 npm error 1.256 npm error Clean install a project 1.256 npm error 1.256 npm error Usage: 1.256 npm error npm ci 1.256 npm error 1.256 npm error Options: 1.256 npm error [--install-strategy <hoisted|nested|shallow|linked>] [--legacy-bundling] 1.256 npm error [--global-style] [--omit <dev|optional|peer> [--omit <dev|optional|peer> ...]] 1.256 npm error [--include <prod|dev|optional|peer> [--include <prod|dev|optional|peer> ...]] 1.256 npm error [--strict-peer-deps] [--foreground-scripts] [--ignore-scripts] [--no-audit] 1.256 npm error [--no-bin-links] [--no-fund] [--dry-run] 1.256 npm error [-w|--workspace [-w|--workspace ...]] 1.256 npm error [-ws|--workspaces] [--include-workspace-root] [--install-links] 1.256 npm error 1.256 npm error aliases: clean-install, ic, install-clean, isntall-clean 1.256 npm error 1.256 npm error Run "npm help ci" for more info 1.260 npm error A complete log of this run can be found in: /root/.npm/_logs/2026-04-18T19_19_21_095Z-debug-0.log

Dockerfile:4
2 | WORKDIR /app 3 | COPY package*.json ./ 4 | >>> RUN npm ci --only=production 5 | COPY . . 6 | CMD ["node", "src/index.js"]
target parcel-service: failed to solve: process "/bin/sh -c npm ci --only=production" did not complete successfully: exit code: 1

View build details: docker-desktop://dashboard/build/desktop-linux/desktop-linux/y739ocfdo090xsgi46t805lx2


## second fix

docker-compose up --build
[+] Building 3.4s (44/52)                                                                                                                                                         
 => [internal] load local bake definitions                                                                                                                                   0.0s
 => => reading from stdin 3.14kB                                                                                                                                             0.0s
 => [trip-service internal] load build definition from Dockerfile                                                                                                            0.0s
 => => transferring dockerfile: 274B                                                                                                                                         0.0s
 => [frontend internal] load build definition from Dockerfile.dev                                                                                                            0.0s
 => => transferring dockerfile: 274B                                                                                                                                         0.0s
 => [api-gateway internal] load build definition from Dockerfile                                                                                                             0.1s
 => => transferring dockerfile: 274B                                                                                                                                         0.0s
 => [parcel-service internal] load build definition from Dockerfile                                                                                                          0.0s
 => => transferring dockerfile: 274B                                                                                                                                         0.0s
 => [matching-service internal] load build definition from Dockerfile                                                                                                        0.0s
 => => transferring dockerfile: 274B                                                                                                                                         0.0s
 => [user-service internal] load build definition from Dockerfile                                                                                                            0.0s
 => => transferring dockerfile: 274B                                                                                                                                         0.0s
 => [auth-service internal] load build definition from Dockerfile                                                                                                            0.1s
 => => transferring dockerfile: 274B                                                                                                                                         0.0s
 => [notification-service internal] load build definition from Dockerfile                                                                                                    0.1s
 => => transferring dockerfile: 274B                                                                                                                                         0.0s
 => [api-gateway internal] load metadata for docker.io/library/node:20-alpine                                                                                                0.6s
 => [api-gateway internal] load .dockerignore                                                                                                                                0.0s
 => => transferring context: 2B                                                                                                                                              0.0s
 => [trip-service internal] load .dockerignore                                                                                                                               0.0s
 => => transferring context: 2B                                                                                                                                              0.0s
 => [notification-service internal] load .dockerignore                                                                                                                       0.0s
 => => transferring context: 2B                                                                                                                                              0.0s
 => [user-service internal] load .dockerignore                                                                                                                               0.1s
 => => transferring context: 2B                                                                                                                                              0.0s
 => [auth-service internal] load .dockerignore                                                                                                                               0.0s
 => => transferring context: 2B                                                                                                                                              0.0s
 => [frontend internal] load .dockerignore                                                                                                                                   0.1s
 => => transferring context: 2B                                                                                                                                              0.0s
 => [parcel-service internal] load .dockerignore                                                                                                                             0.1s
 => => transferring context: 2B                                                                                                                                              0.0s
 => [matching-service internal] load .dockerignore                                                                                                                           0.0s
 => => transferring context: 2B                                                                                                                                              0.0s
 => [auth-service 1/5] FROM docker.io/library/node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293                                         0.0s
 => [matching-service internal] load build context                                                                                                                           0.0s
 => => transferring context: 578B                                                                                                                                            0.0s
 => [api-gateway internal] load build context                                                                                                                                0.0s
 => => transferring context: 578B                                                                                                                                            0.0s
 => [notification-service internal] load build context                                                                                                                       0.0s
 => => transferring context: 578B                                                                                                                                            0.0s
 => [frontend internal] load build context                                                                                                                                   0.1s
 => => transferring context: 5.79kB                                                                                                                                          0.0s
 => [parcel-service internal] load build context                                                                                                                             0.0s
 => => transferring context: 578B                                                                                                                                            0.0s
 => [trip-service internal] load build context                                                                                                                               0.1s
 => => transferring context: 578B                                                                                                                                            0.0s
 => [user-service internal] load build context                                                                                                                               0.1s
 => => transferring context: 578B                                                                                                                                            0.0s
 => [auth-service internal] load build context                                                                                                                               0.0s
 => => transferring context: 578B                                                                                                                                            0.0s
 => CACHED [frontend 2/5] WORKDIR /app                                                                                                                                       0.0s
 => CACHED [matching-service 3/5] COPY package*.json ./                                                                                                                      0.0s
 => CACHED [parcel-service 3/5] COPY package*.json ./                                                                                                                        0.0s
 => CACHED [auth-service 3/5] COPY package*.json ./                                                                                                                          0.0s
 => CANCELED [auth-service 4/5] RUN npm ci --only=production                                                                                                                 1.7s
 => ERROR [matching-service 4/5] RUN npm ci --only=production                                                                                                                1.5s
 => CACHED [api-gateway 3/5] COPY package*.json ./                                                                                                                           0.0s
 => CANCELED [api-gateway 4/5] RUN npm ci --only=production                                                                                                                  1.7s
 => ERROR [parcel-service 4/5] RUN npm ci --only=production                                                                                                                  1.6s
 => CACHED [notification-service 3/5] COPY package*.json ./                                                                                                                  0.0s
 => CACHED [user-service 3/5] COPY package*.json ./                                                                                                                          0.0s
 => CANCELED [user-service 4/5] RUN npm ci --only=production                                                                                                                 1.7s
 => CACHED [trip-service 3/5] COPY package*.json ./                                                                                                                          0.0s
 => CANCELED [trip-service 4/5] RUN npm ci --only=production                                                                                                                 1.7s
 => CACHED [frontend 3/5] COPY package*.json ./                                                                                                                              0.0s
 => CANCELED [frontend 4/5] RUN npm install                                                                                                                                  1.7s
 => ERROR [notification-service 4/5] RUN npm ci --only=production                                                                                                            1.5s
------
 > [matching-service 4/5] RUN npm ci --only=production:
0.487 npm warn config only Use `--omit=dev` to omit dev dependencies from the install.
1.465 npm error code EUSAGE
1.468 npm error
1.468 npm error The `npm ci` command can only install with an existing package-lock.json or
1.468 npm error npm-shrinkwrap.json with lockfileVersion >= 1. Run an install with npm@5 or
1.468 npm error later to generate a package-lock.json file, then try again.
1.468 npm error
1.468 npm error Clean install a project
1.468 npm error
1.468 npm error Usage:
1.468 npm error npm ci
1.468 npm error
1.468 npm error Options:
1.468 npm error [--install-strategy <hoisted|nested|shallow|linked>] [--legacy-bundling]
1.468 npm error [--global-style] [--omit <dev|optional|peer> [--omit <dev|optional|peer> ...]]
1.468 npm error [--include <prod|dev|optional|peer> [--include <prod|dev|optional|peer> ...]]
1.468 npm error [--strict-peer-deps] [--foreground-scripts] [--ignore-scripts] [--no-audit]
1.468 npm error [--no-bin-links] [--no-fund] [--dry-run]
1.468 npm error [-w|--workspace <workspace-name> [-w|--workspace <workspace-name> ...]]
1.468 npm error [-ws|--workspaces] [--include-workspace-root] [--install-links]
1.468 npm error
1.468 npm error aliases: clean-install, ic, install-clean, isntall-clean
1.468 npm error
1.468 npm error Run "npm help ci" for more info
1.472 npm error A complete log of this run can be found in: /root/.npm/_logs/2026-04-18T19_21_19_080Z-debug-0.log
------
------
 > [parcel-service 4/5] RUN npm ci --only=production:
0.586 npm warn config only Use `--omit=dev` to omit dev dependencies from the install.
1.535 npm error code EUSAGE
1.536 npm error
1.536 npm error The `npm ci` command can only install with an existing package-lock.json or
1.536 npm error npm-shrinkwrap.json with lockfileVersion >= 1. Run an install with npm@5 or
1.536 npm error later to generate a package-lock.json file, then try again.
1.536 npm error
1.536 npm error Clean install a project
1.536 npm error
1.536 npm error Usage:
1.536 npm error npm ci
1.536 npm error
1.536 npm error Options:
1.536 npm error [--install-strategy <hoisted|nested|shallow|linked>] [--legacy-bundling]
1.536 npm error [--global-style] [--omit <dev|optional|peer> [--omit <dev|optional|peer> ...]]
1.536 npm error [--include <prod|dev|optional|peer> [--include <prod|dev|optional|peer> ...]]
1.536 npm error [--strict-peer-deps] [--foreground-scripts] [--ignore-scripts] [--no-audit]
1.536 npm error [--no-bin-links] [--no-fund] [--dry-run]
1.536 npm error [-w|--workspace <workspace-name> [-w|--workspace <workspace-name> ...]]
1.536 npm error [-ws|--workspaces] [--include-workspace-root] [--install-links]
1.536 npm error
1.536 npm error aliases: clean-install, ic, install-clean, isntall-clean
1.536 npm error
1.536 npm error Run "npm help ci" for more info
1.540 npm error A complete log of this run can be found in: /root/.npm/_logs/2026-04-18T19_21_19_179Z-debug-0.log
------
------
 > [notification-service 4/5] RUN npm ci --only=production:
0.432 npm warn config only Use `--omit=dev` to omit dev dependencies from the install.
1.413 npm error code EUSAGE
1.414 npm error
1.414 npm error The `npm ci` command can only install with an existing package-lock.json or
1.414 npm error npm-shrinkwrap.json with lockfileVersion >= 1. Run an install with npm@5 or
1.414 npm error later to generate a package-lock.json file, then try again.
1.414 npm error
1.414 npm error Clean install a project
1.414 npm error
1.414 npm error Usage:
1.414 npm error npm ci
1.414 npm error
1.414 npm error Options:
1.414 npm error [--install-strategy <hoisted|nested|shallow|linked>] [--legacy-bundling]
1.414 npm error [--global-style] [--omit <dev|optional|peer> [--omit <dev|optional|peer> ...]]
1.414 npm error [--include <prod|dev|optional|peer> [--include <prod|dev|optional|peer> ...]]
1.414 npm error [--strict-peer-deps] [--foreground-scripts] [--ignore-scripts] [--no-audit]
1.414 npm error [--no-bin-links] [--no-fund] [--dry-run]
1.414 npm error [-w|--workspace <workspace-name> [-w|--workspace <workspace-name> ...]]
1.414 npm error [-ws|--workspaces] [--include-workspace-root] [--install-links]
1.414 npm error
1.414 npm error aliases: clean-install, ic, install-clean, isntall-clean
1.414 npm error
1.414 npm error Run "npm help ci" for more info
1.419 npm error A complete log of this run can be found in: /root/.npm/_logs/2026-04-18T19_21_19_033Z-debug-0.log
------
Dockerfile:4
--------------------
   2 |     WORKDIR /app
   3 |     COPY package*.json ./
   4 | >>> RUN npm ci --only=production
   5 |     COPY . .
   6 |     CMD ["node", "src/index.js"]
--------------------
target notification-service: failed to solve: process "/bin/sh -c npm ci --only=production" did not complete successfully: exit code: 1

View build details: docker-desktop://dashboard/build/desktop-linux/desktop-linux/gnex7fm2lg5qdb6i8b3p59rmh


#### comment corriger les erreurs

L'erreur est claire : npm ci nécessite un package-lock.json qui n'existe pas. Il faut remplacer npm ci par npm install dans tous les Dockerfiles.Ran 4 commands, read a fileRan 4 commands, read a fileCause du problème : npm ci exige un fichier package-lock.json déjà généré, qui n'était pas dans le projet.
Correction appliquée dans tous les Dockerfiles :
dockerfile# Avant (erreur)
RUN npm ci --only=production

# Après (corrigé)
RUN npm install --omit=dev
npm install génère le package-lock.json lui-même au moment du build. --omit=dev exclut les dépendances de développement comme --only=production le faisait.
Téléchargez le ZIP, extrayez et relancez :


## 3eme fix

docker-compose up --build
[+] Running 32/32
 ✔ rabbitmq Pulled                                                                                                                                                        8.5s 
 ✔ postgres Pulled                                                                                                                                                       15.6s 
 ✔ redis Pulled                                                                                                                                                          11.5s 
[+] Building 61.1s (69/69) FINISHED                                                                                                                                                                     
 => [internal] load local bake definitions                                                                                                                                                         0.0s
 => => reading from stdin 3.14kB                                                                                                                                                                   0.0s
 => [trip-service internal] load build definition from Dockerfile                                                                                                                                  0.0s
 => => transferring dockerfile: 240B                                                                                                                                                               0.0s
 => [auth-service internal] load build definition from Dockerfile                                                                                                                                  0.0s
 => => transferring dockerfile: 240B                                                                                                                                                               0.0s
 => [user-service internal] load build definition from Dockerfile                                                                                                                                  0.1s
 => => transferring dockerfile: 240B                                                                                                                                                               0.0s
 => [parcel-service internal] load build definition from Dockerfile                                                                                                                                0.1s
 => => transferring dockerfile: 240B                                                                                                                                                               0.0s
 => [api-gateway internal] load build definition from Dockerfile                                                                                                                                   0.1s
 => => transferring dockerfile: 240B                                                                                                                                                               0.0s
 => [frontend internal] load build definition from Dockerfile.dev                                                                                                                                  0.1s
 => => transferring dockerfile: 242B                                                                                                                                                               0.0s
 => [notification-service internal] load build definition from Dockerfile                                                                                                                          0.0s
 => => transferring dockerfile: 240B                                                                                                                                                               0.0s
 => [matching-service internal] load build definition from Dockerfile                                                                                                                              0.1s
 => => transferring dockerfile: 240B                                                                                                                                                               0.0s
 => [frontend internal] load metadata for docker.io/library/node:20-alpine                                                                                                                         0.8s
 => [auth] library/node:pull token for registry-1.docker.io                                                                                                                                        0.0s
 => [trip-service internal] load .dockerignore                                                                                                                                                     0.0s
 => => transferring context: 2B                                                                                                                                                                    0.0s
 => [api-gateway internal] load .dockerignore                                                                                                                                                      0.0s
 => => transferring context: 2B                                                                                                                                                                    0.0s
 => [matching-service internal] load .dockerignore                                                                                                                                                 0.1s
 => => transferring context: 2B                                                                                                                                                                    0.0s
 => [auth-service internal] load .dockerignore                                                                                                                                                     0.1s
 => => transferring context: 2B                                                                                                                                                                    0.0s
 => [parcel-service internal] load .dockerignore                                                                                                                                                   0.1s
 => => transferring context: 2B                                                                                                                                                                    0.0s
 => [user-service internal] load .dockerignore                                                                                                                                                     0.1s
 => => transferring context: 2B                                                                                                                                                                    0.0s
 => [notification-service internal] load .dockerignore                                                                                                                                             0.0s
 => => transferring context: 2B                                                                                                                                                                    0.0s
 => [frontend internal] load .dockerignore                                                                                                                                                         0.0s
 => => transferring context: 2B                                                                                                                                                                    0.0s
 => [trip-service internal] load build context                                                                                                                                                     0.0s
 => => transferring context: 8.74kB                                                                                                                                                                0.0s
 => [matching-service 1/5] FROM docker.io/library/node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293                                                           0.0s
 => [frontend internal] load build context                                                                                                                                                         0.1s
 => => transferring context: 111.78kB                                                                                                                                                              0.0s
 => [api-gateway internal] load build context                                                                                                                                                      0.0s
 => => transferring context: 10.46kB                                                                                                                                                               0.0s
 => [user-service internal] load build context                                                                                                                                                     0.1s
 => => transferring context: 9.75kB                                                                                                                                                                0.0s
 => [auth-service internal] load build context                                                                                                                                                     0.1s
 => => transferring context: 10.72kB                                                                                                                                                               0.0s
 => [parcel-service internal] load build context                                                                                                                                                   0.0s
 => => transferring context: 9.95kB                                                                                                                                                                0.0s
 => [notification-service internal] load build context                                                                                                                                             0.0s
 => => transferring context: 12.53kB                                                                                                                                                               0.0s
 => [matching-service internal] load build context                                                                                                                                                 0.1s
 => => transferring context: 9.35kB                                                                                                                                                                0.0s
 => CACHED [api-gateway 2/5] WORKDIR /app                                                                                                                                                          0.0s
 => [api-gateway 3/5] COPY package*.json ./                                                                                                                                                        0.9s
 => [trip-service 3/5] COPY package*.json ./                                                                                                                                                       0.9s
 => [parcel-service 3/5] COPY package*.json ./                                                                                                                                                     0.9s
 => [notification-service 3/5] COPY package*.json ./                                                                                                                                               0.9s
 => [auth-service 3/5] COPY package*.json ./                                                                                                                                                       0.9s
 => [user-service 3/5] COPY package*.json ./                                                                                                                                                       0.9s
 => [matching-service 3/5] COPY package*.json ./                                                                                                                                                   0.9s
 => [frontend 3/5] COPY package*.json ./                                                                                                                                                           0.9s
 => [api-gateway 4/5] RUN npm install --omit=dev                                                                                                                                                  19.8s
 => [trip-service 4/5] RUN npm install --omit=dev                                                                                                                                                 18.3s
 => [parcel-service 4/5] RUN npm install --omit=dev                                                                                                                                               18.2s
 => [notification-service 4/5] RUN npm install --omit=dev                                                                                                                                         16.6s
 => [auth-service 4/5] RUN npm install --omit=dev                                                                                                                                                 19.3s
 => [user-service 4/5] RUN npm install --omit=dev                                                                                                                                                 16.5s
 => [matching-service 4/5] RUN npm install --omit=dev                                                                                                                                             18.1s
 => [frontend 4/5] RUN npm install                                                                                                                                                                56.0s
 => [user-service 5/5] COPY . .                                                                                                                                                                    0.2s
 => [notification-service 5/5] COPY . .                                                                                                                                                            0.2s
 => [user-service] exporting to image                                                                                                                                                              1.2s
 => => exporting layers                                                                                                                                                                            1.1s
 => => writing image sha256:7d3fab47d5962eedb4ddc11dee4a300e3ecd201b32aaa792ebecb70bb9bfc028                                                                                                       0.0s
 => => naming to docker.io/library/yobaleema-user-service                                                                                                                                          0.0s
 => [notification-service] exporting to image                                                                                                                                                      1.0s
 => => exporting layers                                                                                                                                                                            1.0s
 => => writing image sha256:8df7eafec396d5524f484977c28923ceb94bcc42b7bf9c8fc6f543bf13a4f70c                                                                                                       0.0s
 => => naming to docker.io/library/yobaleema-notification-service                                                                                                                                  0.0s
 => [notification-service] resolving provenance for metadata file                                                                                                                                  0.0s
 => [parcel-service 5/5] COPY . .                                                                                                                                                                  0.2s
 => [matching-service 5/5] COPY . .                                                                                                                                                                0.1s
 => [user-service] resolving provenance for metadata file                                                                                                                                          0.0s
 => [trip-service 5/5] COPY . .                                                                                                                                                                    0.1s
 => [matching-service] exporting to image                                                                                                                                                          1.4s
 => => exporting layers                                                                                                                                                                            1.2s
 => => writing image sha256:52b98fe76f1aa12599f65d1bc978541064cb2ca34c2640b970bdae3123653066                                                                                                       0.0s
 => => naming to docker.io/library/yobaleema-matching-service                                                                                                                                      0.0s
 => [parcel-service] exporting to image                                                                                                                                                            1.4s
 => => exporting layers                                                                                                                                                                            1.3s
 => => writing image sha256:8c156ba5bc5b978c8fec489b09735fa38bea5a326a980c5a59e7f9bbaae5c9f9                                                                                                       0.0s
 => => naming to docker.io/library/yobaleema-parcel-service                                                                                                                                        0.0s
 => [trip-service] exporting to image                                                                                                                                                              1.4s
 => => exporting layers                                                                                                                                                                            1.2s
 => => writing image sha256:cf5d3b4b8a9d50789b0b0d3b75513af1968b91c9cfbaa086fde782d789e34468                                                                                                       0.0s
 => => naming to docker.io/library/yobaleema-trip-service                                                                                                                                          0.0s
 => [auth-service 5/5] COPY . .                                                                                                                                                                    0.3s
 => [auth-service] exporting to image                                                                                                                                                              1.2s
 => => exporting layers                                                                                                                                                                            1.2s
 => => writing image sha256:ae62cdf0a29aca67165a3e3f089dc7016d5b9760f55cefb52a026bb0385d755a                                                                                                       0.0s
 => => naming to docker.io/library/yobaleema-auth-service                                                                                                                                          0.0s
 => [api-gateway 5/5] COPY . .                                                                                                                                                                     0.2s
 => [api-gateway] exporting to image                                                                                                                                                               1.1s
 => => exporting layers                                                                                                                                                                            1.1s
 => => writing image sha256:f38f747de02c79a1a730186526c028c49e34d7f4a1fd62fde307da74c15329fc                                                                                                       0.0s
 => => naming to docker.io/library/yobaleema-api-gateway                                                                                                                                           0.0s
 => [matching-service] resolving provenance for metadata file                                                                                                                                      0.0s
 => [parcel-service] resolving provenance for metadata file                                                                                                                                        0.1s
 => [trip-service] resolving provenance for metadata file                                                                                                                                          0.0s
 => [auth-service] resolving provenance for metadata file                                                                                                                                          0.0s
 => [api-gateway] resolving provenance for metadata file                                                                                                                                           0.0s
 => [frontend 5/5] COPY . .                                                                                                                                                                        0.0s
 => [frontend] exporting to image                                                                                                                                                                  2.4s
 => => exporting layers                                                                                                                                                                            2.4s
 => => writing image sha256:39c26757b4e86d03ce3c8095e4a39e35bdda351df7aabc6594857ca29bbc1429                                                                                                       0.0s
 => => naming to docker.io/library/yobaleema-frontend                                                                                                                                              0.0s
 => [frontend] resolving provenance for metadata file                                                                                                                                              0.0s
[+] Running 23/23
 ✔ auth-service                      Built                                                                                                                                                         0.0s 
 ✔ parcel-service                    Built                                                                                                                                                         0.0s 
 ✔ api-gateway                       Built                                                                                                                                                         0.0s 
 ✔ frontend                          Built                                                                                                                                                         0.0s 
 ✔ trip-service                      Built                                                                                                                                                         0.0s 
 ✔ notification-service              Built                                                                                                                                                         0.0s 
 ✔ matching-service                  Built                                                                                                                                                         0.0s 
 ✔ user-service                      Built                                                                                                                                                         0.0s 
 ✔ Network yobaleema_default         Created                                                                                                                                                       0.1s 
 ✔ Volume "yobaleema_rabbitmq_data"  Created                                                                                                                                                       0.0s 
 ✔ Volume "yobaleema_postgres_data"  Created                                                                                                                                                       0.0s 
 ✔ Volume "yobaleema_redis_data"     Created                                                                                                                                                       0.0s 
 ✔ Container yoba_redis              Created                                                                                                                                                       0.2s 
 ✔ Container yoba_rabbitmq           Created                                                                                                                                                       0.1s 
 ✔ Container yoba_postgres           Created                                                                                                                                                       0.1s 
 ✔ Container yoba_trips              Created                                                                                                                                                       0.1s 
 ✔ Container yoba_parcels            Created                                                                                                                                                       0.2s 
 ✔ Container yoba_users              Created                                                                                                                                                       0.1s 
 ✔ Container yoba_notifs             Created                                                                                                                                                       0.1s 
 ✔ Container yoba_gateway            Created                                                                                                                                                       0.1s 
 ✔ Container yoba_matching           Created                                                                                                                                                       0.1s 
 ✔ Container yoba_auth               Created                                                                                                                                                       0.1s 
 ✔ Container yoba_frontend           Created                                                                                                                                                       1.4s 
Attaching to yoba_auth, yoba_frontend, yoba_gateway, yoba_matching, yoba_notifs, yoba_parcels, yoba_postgres, yoba_rabbitmq, yoba_redis, yoba_trips, yoba_users
yoba_postgres  | The files belonging to this database system will be owned by user "postgres".
yoba_postgres  | This user must also own the server process.
yoba_postgres  | 
yoba_postgres  | The database cluster will be initialized with locale "en_US.utf8".
yoba_postgres  | The default database encoding has accordingly been set to "UTF8".
yoba_postgres  | The default text search configuration will be set to "english".
yoba_postgres  | 
yoba_postgres  | Data page checksums are disabled.
yoba_postgres  | 
yoba_postgres  | fixing permissions on existing directory /var/lib/postgresql/data ... ok
yoba_postgres  | creating subdirectories ... ok
yoba_postgres  | selecting dynamic shared memory implementation ... posix
yoba_postgres  | selecting default max_connections ... 100
yoba_postgres  | selecting default shared_buffers ... 128MB
yoba_postgres  | selecting default time zone ... UTC
yoba_postgres  | creating configuration files ... ok
yoba_postgres  | running bootstrap script ... ok
yoba_postgres  | sh: locale: not found
yoba_postgres  | 2026-04-18 19:42:12.893 UTC [35] WARNING:  no usable system locales were found
yoba_postgres  | performing post-bootstrap initialization ... ok
yoba_postgres  | syncing data to disk ... ok
yoba_postgres  | 
yoba_postgres  | 
yoba_postgres  | Success. You can now start the database server using:
yoba_postgres  | 
yoba_postgres  |     pg_ctl -D /var/lib/postgresql/data -l logfile start
yoba_postgres  | 
yoba_postgres  | initdb: warning: enabling "trust" authentication for local connections
yoba_postgres  | initdb: hint: You can change this by editing pg_hba.conf or using the option -A, or --auth-local and --auth-host, the next time you run initdb.
yoba_postgres  | waiting for server to start....2026-04-18 19:42:13.881 UTC [41] LOG:  starting PostgreSQL 16.13 on x86_64-pc-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit
yoba_postgres  | 2026-04-18 19:42:13.884 UTC [41] LOG:  listening on Unix socket "/var/run/postgresql/.s.PGSQL.5432"
yoba_postgres  | 2026-04-18 19:42:13.891 UTC [44] LOG:  database system was shut down at 2026-04-18 19:42:13 UTC
yoba_postgres  | 2026-04-18 19:42:13.898 UTC [41] LOG:  database system is ready to accept connections
yoba_postgres  |  done
yoba_postgres  | server started
yoba_postgres  | CREATE DATABASE
yoba_postgres  | 
yoba_postgres  | 
yoba_postgres  | /usr/local/bin/docker-entrypoint.sh: running /docker-entrypoint-initdb.d/01-init.sql
yoba_postgres  | 2026-04-18 19:42:14.076 UTC [54] ERROR:  database "yoba_auth" already exists
yoba_postgres  | 2026-04-18 19:42:14.076 UTC [54] STATEMENT:  CREATE DATABASE yoba_auth;
yoba_postgres  | psql:/docker-entrypoint-initdb.d/01-init.sql:8: ERROR:  database "yoba_auth" already exists
yoba_postgres exited with code 0
yoba_postgres  | 
yoba_postgres  | PostgreSQL Database directory appears to contain a database; Skipping initialization
yoba_postgres  | 
yoba_postgres  | 2026-04-18 19:42:14.632 UTC [1] LOG:  starting PostgreSQL 16.13 on x86_64-pc-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit
yoba_postgres  | 2026-04-18 19:42:14.632 UTC [1] LOG:  listening on IPv4 address "0.0.0.0", port 5432
yoba_postgres  | 2026-04-18 19:42:14.632 UTC [1] LOG:  listening on IPv6 address "::", port 5432
yoba_postgres  | 2026-04-18 19:42:14.637 UTC [1] LOG:  listening on Unix socket "/var/run/postgresql/.s.PGSQL.5432"
yoba_postgres  | 2026-04-18 19:42:14.643 UTC [29] LOG:  database system was interrupted; last known up at 2026-04-18 19:42:13 UTC
yoba_postgres  | 2026-04-18 19:42:14.840 UTC [29] LOG:  database system was not properly shut down; automatic recovery in progress
yoba_postgres  | 2026-04-18 19:42:14.843 UTC [29] LOG:  redo starts at 0/14F2628
yoba_postgres  | 2026-04-18 19:42:14.867 UTC [29] LOG:  invalid record length at 0/191E930: expected at least 24, got 0
yoba_postgres  | 2026-04-18 19:42:14.867 UTC [29] LOG:  redo done at 0/191E8E8 system usage: CPU: user: 0.01 s, system: 0.00 s, elapsed: 0.02 s
yoba_postgres  | 2026-04-18 19:42:14.875 UTC [27] LOG:  checkpoint starting: end-of-recovery immediate wait
yoba_postgres  | 2026-04-18 19:42:14.953 UTC [27] LOG:  checkpoint complete: wrote 926 buffers (5.7%); 0 WAL file(s) added, 0 removed, 0 recycled; write=0.020 s, sync=0.053 s, total=0.080 s; sync files=301, longest=0.011 s, average=0.001 s; distance=4272 kB, estimate=4272 kB; lsn=0/191E930, redo lsn=0/191E930
yoba_postgres  | 2026-04-18 19:42:14.961 UTC [1] LOG:  database system is ready to accept connections
yoba_gateway   | node:internal/modules/cjs/loader:1210
yoba_gateway   |   throw err;
yoba_gateway   |   ^
yoba_gateway   | 
yoba_gateway   | Error: Cannot find module 'dotenv'
yoba_gateway   | Require stack:
yoba_gateway   | - /app/src/index.js
yoba_gateway   |     at Module._resolveFilename (node:internal/modules/cjs/loader:1207:15)
yoba_gateway   |     at Module._load (node:internal/modules/cjs/loader:1038:27)
yoba_gateway   |     at Module.require (node:internal/modules/cjs/loader:1289:19)
yoba_gateway   |     at require (node:internal/modules/helpers:182:18)
yoba_gateway   |     at Object.<anonymous> (/app/src/index.js:10:1)
yoba_gateway   |     at Module._compile (node:internal/modules/cjs/loader:1521:14)
yoba_gateway   |     at Module._extensions..js (node:internal/modules/cjs/loader:1623:10)
yoba_gateway   |     at Module.load (node:internal/modules/cjs/loader:1266:32)
yoba_gateway   |     at Module._load (node:internal/modules/cjs/loader:1091:12)
yoba_gateway   |     at Function.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:164:12) {
yoba_gateway   |   code: 'MODULE_NOT_FOUND',
yoba_gateway   |   requireStack: [ '/app/src/index.js' ]
yoba_gateway   | }
yoba_gateway   | 
yoba_gateway   | Node.js v20.20.2
yoba_gateway exited with code 0
yoba_gateway   | node:internal/modules/cjs/loader:1210
yoba_gateway   |   throw err;
yoba_gateway   |   ^
yoba_gateway   | 
yoba_gateway   | Error: Cannot find module 'dotenv'
yoba_gateway   | Require stack:
yoba_gateway   | - /app/src/index.js
yoba_gateway   |     at Module._resolveFilename (node:internal/modules/cjs/loader:1207:15)
yoba_gateway   |     at Module._load (node:internal/modules/cjs/loader:1038:27)
yoba_gateway   |     at Module.require (node:internal/modules/cjs/loader:1289:19)
yoba_gateway   |     at require (node:internal/modules/helpers:182:18)
yoba_gateway   |     at Object.<anonymous> (/app/src/index.js:10:1)
yoba_gateway   |     at Module._compile (node:internal/modules/cjs/loader:1521:14)
yoba_gateway   |     at Module._extensions..js (node:internal/modules/cjs/loader:1623:10)
yoba_gateway   |     at Module.load (node:internal/modules/cjs/loader:1266:32)
yoba_gateway   |     at Module._load (node:internal/modules/cjs/loader:1091:12)
yoba_gateway   |     at Function.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:164:12) {
yoba_gateway   |   code: 'MODULE_NOT_FOUND',
yoba_gateway   |   requireStack: [ '/app/src/index.js' ]
yoba_gateway   | }
yoba_gateway   | 
yoba_gateway   | Node.js v20.20.2
yoba_frontend  | 
yoba_frontend  | > @yobaleema/frontend@1.0.0 dev
yoba_frontend  | > vite --host 0.0.0.0 --port 3000
yoba_frontend  | 
yoba_gateway exited with code 1
yoba_gateway   | node:internal/modules/cjs/loader:1210
yoba_gateway   |   throw err;
yoba_gateway   |   ^
yoba_gateway   | 
yoba_gateway   | Error: Cannot find module 'dotenv'
yoba_gateway   | Require stack:
yoba_gateway   | - /app/src/index.js
yoba_gateway   |     at Module._resolveFilename (node:internal/modules/cjs/loader:1207:15)
yoba_gateway   |     at Module._load (node:internal/modules/cjs/loader:1038:27)
yoba_gateway   |     at Module.require (node:internal/modules/cjs/loader:1289:19)
yoba_gateway   |     at require (node:internal/modules/helpers:182:18)
yoba_gateway   |     at Object.<anonymous> (/app/src/index.js:10:1)
yoba_gateway   |     at Module._compile (node:internal/modules/cjs/loader:1521:14)
yoba_gateway   |     at Module._extensions..js (node:internal/modules/cjs/loader:1623:10)
yoba_gateway   |     at Module.load (node:internal/modules/cjs/loader:1266:32)
yoba_gateway   |     at Module._load (node:internal/modules/cjs/loader:1091:12)
yoba_gateway   |     at Function.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:164:12) {
yoba_gateway   |   code: 'MODULE_NOT_FOUND',
yoba_gateway   |   requireStack: [ '/app/src/index.js' ]
yoba_gateway   | }
yoba_gateway   | 
yoba_gateway   | Node.js v20.20.2
yoba_frontend  | 
yoba_frontend  |   VITE v5.4.21  ready in 663 ms
yoba_frontend  | 
yoba_frontend  |   ➜  Local:   http://localhost:3000/
yoba_frontend  |   ➜  Network: http://172.18.0.6:3000/
yoba_gateway exited with code 1
yoba_postgres  | 2026-04-18 19:42:19.598 UTC [39] FATAL:  database "yoba" does not exist
yoba_gateway   | node:internal/modules/cjs/loader:1210
yoba_gateway   |   throw err;
yoba_gateway   |   ^
yoba_gateway   | 
yoba_gateway   | Error: Cannot find module 'dotenv'
yoba_gateway   | Require stack:
yoba_gateway   | - /app/src/index.js
yoba_gateway   |     at Module._resolveFilename (node:internal/modules/cjs/loader:1207:15)
yoba_gateway   |     at Module._load (node:internal/modules/cjs/loader:1038:27)
yoba_gateway   |     at Module.require (node:internal/modules/cjs/loader:1289:19)
yoba_gateway   |     at require (node:internal/modules/helpers:182:18)
yoba_gateway   |     at Object.<anonymous> (/app/src/index.js:10:1)
yoba_gateway   |     at Module._compile (node:internal/modules/cjs/loader:1521:14)
yoba_gateway   |     at Module._extensions..js (node:internal/modules/cjs/loader:1623:10)
yoba_gateway   |     at Module.load (node:internal/modules/cjs/loader:1266:32)
yoba_gateway   |     at Module._load (node:internal/modules/cjs/loader:1091:12)
yoba_gateway   |     at Function.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:164:12) {
yoba_gateway   |   code: 'MODULE_NOT_FOUND',
yoba_gateway   |   requireStack: [ '/app/src/index.js' ]
yoba_gateway   | }
yoba_gateway   | 
yoba_gateway   | Node.js v20.20.2
yoba_gateway exited with code 1
yoba_frontend  | Error:   Failed to scan for dependencies from entries:
yoba_frontend  |   /app/index.html
yoba_frontend  | 
yoba_frontend  |   ✘ [ERROR] Expected "..." but found "}"
yoba_frontend  | 
yoba_frontend  |     src/pages/LoginPage.jsx:28:113:
yoba_frontend  |       28 │ ...                 {/* ref, name, onChange, onBlur de register() */}
yoba_frontend  |          │                                                                     ^
yoba_frontend  |          ╵                                                                     ...
yoba_frontend  | 
yoba_frontend  | 
yoba_frontend  |     at failureErrorWithLog (/app/node_modules/esbuild/lib/main.js:1472:15)
yoba_frontend  |     at /app/node_modules/esbuild/lib/main.js:945:25
yoba_frontend  |     at runOnEndCallbacks (/app/node_modules/esbuild/lib/main.js:1315:45)
yoba_frontend  |     at buildResponseToResult (/app/node_modules/esbuild/lib/main.js:943:7)
yoba_frontend  |     at /app/node_modules/esbuild/lib/main.js:955:9
yoba_frontend  |     at new Promise (<anonymous>)
yoba_frontend  |     at requestCallbacks.on-end (/app/node_modules/esbuild/lib/main.js:954:54)
yoba_frontend  |     at handleRequest (/app/node_modules/esbuild/lib/main.js:647:17)
yoba_frontend  |     at handleIncomingPacket (/app/node_modules/esbuild/lib/main.js:672:7)
yoba_frontend  |     at Socket.readFromStdout (/app/node_modules/esbuild/lib/main.js:600:7)
yoba_gateway   | node:internal/modules/cjs/loader:1210
yoba_gateway   |   throw err;
yoba_gateway   |   ^
yoba_gateway   | 
yoba_gateway   | Error: Cannot find module 'dotenv'
yoba_gateway   | Require stack:
yoba_gateway   | - /app/src/index.js
yoba_gateway   |     at Module._resolveFilename (node:internal/modules/cjs/loader:1207:15)
yoba_gateway   |     at Module._load (node:internal/modules/cjs/loader:1038:27)
yoba_gateway   |     at Module.require (node:internal/modules/cjs/loader:1289:19)
yoba_gateway   |     at require (node:internal/modules/helpers:182:18)
yoba_gateway   |     at Object.<anonymous> (/app/src/index.js:10:1)
yoba_gateway   |     at Module._compile (node:internal/modules/cjs/loader:1521:14)
yoba_gateway   |     at Module._extensions..js (node:internal/modules/cjs/loader:1623:10)
yoba_gateway   |     at Module.load (node:internal/modules/cjs/loader:1266:32)
yoba_gateway   |     at Module._load (node:internal/modules/cjs/loader:1091:12)
yoba_gateway   |     at Function.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:164:12) {
yoba_gateway   |   code: 'MODULE_NOT_FOUND',
yoba_gateway   |   requireStack: [ '/app/src/index.js' ]
yoba_gateway   | }
yoba_gateway   | 
yoba_gateway   | Node.js v20.20.2
yoba_gateway exited with code 1
yoba_rabbitmq  | 2026-04-18 19:42:22.121672+00:00 [notice] <0.44.0> Application syslog exited with reason: stopped
yoba_rabbitmq  | 2026-04-18 19:42:22.139309+00:00 [notice] <0.254.0> Logging: switching to configured handler(s); following messages may not be visible in this log output
yoba_rabbitmq  | 2026-04-18 19:42:22.142019+00:00 [notice] <0.254.0> Logging: configured log handlers are now ACTIVE
yoba_rabbitmq  | 2026-04-18 19:42:22.208986+00:00 [info] <0.254.0> ra: starting system quorum_queues
yoba_rabbitmq  | 2026-04-18 19:42:22.209113+00:00 [info] <0.254.0> starting Ra system: quorum_queues in directory: /var/lib/rabbitmq/mnesia/rabbit@ab23889b55be/quorum/rabbit@ab23889b55be
yoba_rabbitmq  | 2026-04-18 19:42:22.455893+00:00 [info] <0.268.0> ra system 'quorum_queues' running pre init for 0 registered servers
yoba_rabbitmq  | 2026-04-18 19:42:22.494597+00:00 [info] <0.269.0> ra: meta data store initialised for system quorum_queues. 0 record(s) recovered
yoba_rabbitmq  | 2026-04-18 19:42:22.553155+00:00 [notice] <0.274.0> WAL: ra_log_wal init, open tbls: ra_log_open_mem_tables, closed tbls: ra_log_closed_mem_tables
yoba_rabbitmq  | 2026-04-18 19:42:22.608351+00:00 [info] <0.254.0> ra: starting system coordination
yoba_rabbitmq  | 2026-04-18 19:42:22.608470+00:00 [info] <0.254.0> starting Ra system: coordination in directory: /var/lib/rabbitmq/mnesia/rabbit@ab23889b55be/coordination/rabbit@ab23889b55be
yoba_rabbitmq  | 2026-04-18 19:42:22.613469+00:00 [info] <0.282.0> ra system 'coordination' running pre init for 0 registered servers
yoba_rabbitmq  | 2026-04-18 19:42:22.616854+00:00 [info] <0.283.0> ra: meta data store initialised for system coordination. 0 record(s) recovered
yoba_rabbitmq  | 2026-04-18 19:42:22.617333+00:00 [notice] <0.288.0> WAL: ra_coordination_log_wal init, open tbls: ra_coordination_log_open_mem_tables, closed tbls: ra_coordination_log_closed_mem_tables
yoba_rabbitmq  | 2026-04-18 19:42:22.625923+00:00 [info] <0.254.0> ra: starting system coordination
yoba_rabbitmq  | 2026-04-18 19:42:22.625991+00:00 [info] <0.254.0> starting Ra system: coordination in directory: /var/lib/rabbitmq/mnesia/rabbit@ab23889b55be/coordination/rabbit@ab23889b55be
yoba_rabbitmq  | 2026-04-18 19:42:22.932615+00:00 [info] <0.254.0> Waiting for Khepri leader for 30000 ms, 9 retries left
yoba_rabbitmq  | 2026-04-18 19:42:22.947033+00:00 [notice] <0.292.0> RabbitMQ metadata store: candidate -> leader in term: 1 machine version: 1
yoba_rabbitmq  | 2026-04-18 19:42:23.002700+00:00 [info] <0.254.0> Khepri leader elected
yoba_rabbitmq  | 2026-04-18 19:42:23.002818+00:00 [info] <0.254.0> Waiting for Khepri projections for 30000 ms, 9 retries left
yoba_gateway   | node:internal/modules/cjs/loader:1210
yoba_gateway   |   throw err;
yoba_gateway   |   ^
yoba_gateway   | 
yoba_gateway   | Error: Cannot find module 'dotenv'
yoba_gateway   | Require stack:
yoba_gateway   | - /app/src/index.js
yoba_gateway   |     at Module._resolveFilename (node:internal/modules/cjs/loader:1207:15)
yoba_gateway   |     at Module._load (node:internal/modules/cjs/loader:1038:27)
yoba_gateway   |     at Module.require (node:internal/modules/cjs/loader:1289:19)
yoba_gateway   |     at require (node:internal/modules/helpers:182:18)
yoba_gateway   |     at Object.<anonymous> (/app/src/index.js:10:1)
yoba_gateway   |     at Module._compile (node:internal/modules/cjs/loader:1521:14)
yoba_gateway   |     at Module._extensions..js (node:internal/modules/cjs/loader:1623:10)
yoba_gateway   |     at Module.load (node:internal/modules/cjs/loader:1266:32)
yoba_gateway   |     at Module._load (node:internal/modules/cjs/loader:1091:12)
yoba_gateway   |     at Function.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:164:12) {
yoba_gateway   |   code: 'MODULE_NOT_FOUND',
yoba_gateway   |   requireStack: [ '/app/src/index.js' ]
yoba_gateway   | }
yoba_gateway   | 
yoba_gateway   | Node.js v20.20.2
yoba_gateway exited with code 1
yoba_rabbitmq  | 2026-04-18 19:42:24.162042+00:00 [info] <0.254.0> 
yoba_rabbitmq  | 2026-04-18 19:42:24.162042+00:00 [info] <0.254.0>  Starting RabbitMQ 3.13.7 on Erlang 26.2.5.16 [jit]
yoba_rabbitmq  | 2026-04-18 19:42:24.162042+00:00 [info] <0.254.0>  Copyright (c) 2007-2024 Broadcom Inc and/or its subsidiaries
yoba_rabbitmq  | 2026-04-18 19:42:24.162042+00:00 [info] <0.254.0>  Licensed under the MPL 2.0. Website: https://rabbitmq.com
yoba_rabbitmq  | 
yoba_rabbitmq  |   ##  ##      RabbitMQ 3.13.7
yoba_rabbitmq  |   ##  ##
yoba_rabbitmq  |   ##########  Copyright (c) 2007-2024 Broadcom Inc and/or its subsidiaries
yoba_rabbitmq  |   ######  ##
yoba_rabbitmq  |   ##########  Licensed under the MPL 2.0. Website: https://rabbitmq.com
yoba_rabbitmq  | 
yoba_rabbitmq  |   Erlang:      26.2.5.16 [jit]
yoba_rabbitmq  |   TLS Library: OpenSSL - OpenSSL 3.1.8 11 Feb 2025
yoba_rabbitmq  |   Release series support status: see https://www.rabbitmq.com/release-information
yoba_rabbitmq  | 
yoba_rabbitmq  |   Doc guides:  https://www.rabbitmq.com/docs
yoba_rabbitmq  |   Support:     https://www.rabbitmq.com/docs/contact
yoba_rabbitmq  |   Tutorials:   https://www.rabbitmq.com/tutorials
yoba_rabbitmq  |   Monitoring:  https://www.rabbitmq.com/docs/monitoring
yoba_rabbitmq  |   Upgrading:   https://www.rabbitmq.com/docs/upgrade
yoba_rabbitmq  | 
yoba_rabbitmq  |   Logs: <stdout>
yoba_rabbitmq  | 
yoba_rabbitmq  |   Config file(s): /etc/rabbitmq/conf.d/10-defaults.conf
yoba_rabbitmq  | 
yoba_rabbitmq  |   Starting broker...2026-04-18 19:42:24.170531+00:00 [info] <0.254.0> 
yoba_rabbitmq  | 2026-04-18 19:42:24.170531+00:00 [info] <0.254.0>  node           : rabbit@ab23889b55be
yoba_rabbitmq  | 2026-04-18 19:42:24.170531+00:00 [info] <0.254.0>  home dir       : /var/lib/rabbitmq
yoba_rabbitmq  | 2026-04-18 19:42:24.170531+00:00 [info] <0.254.0>  config file(s) : /etc/rabbitmq/conf.d/10-defaults.conf
yoba_rabbitmq  | 2026-04-18 19:42:24.170531+00:00 [info] <0.254.0>  cookie hash    : pqlGTwQ8Mb37r6chFDqwZg==
yoba_rabbitmq  | 2026-04-18 19:42:24.170531+00:00 [info] <0.254.0>  log(s)         : <stdout>
yoba_rabbitmq  | 2026-04-18 19:42:24.170531+00:00 [info] <0.254.0>  data dir       : /var/lib/rabbitmq/mnesia/rabbit@ab23889b55be
Gracefully stopping... (press Ctrl+C again to force)
dependency failed to start: container yoba_postgres is unhealthy


#### comment corriger

Trois erreurs distinctes. Je les corrige toutes en une fois :

- dotenv manquant dans api-gateway/package.json
- Commentaire JSX invalide dans LoginPage.jsx (ligne {/* ref... */} dans un spread)
- PostgreSQL DB yoba inexistante — la DB par défaut doit correspondre

Ran 6 commands, edited a file, read a fileRan 6 commands, edited a file, read a file

3 bugs corrigés :
Erreur                          Cause                                                      Fix
Cannot find module 'dotenv'    dotenv absent du package.json de l'api-gateway  Ajouté dans toutes les dépendances

Expected "..." but found "}"   Commentaire JSX {/* ... */} placé à l'intérieur d'une expression JSX dans LoginPage.jsx Commentaire supprimé 

database "yoba" does not exist  POSTGRES_DB: yoba_auth créait automatiquement yoba_auth, puis le init.sql échouait en voulant la recréer      POSTGRES_DB: postgres + init.sql avec IF NOT EXISTS

Important : avant de relancer, supprimez l'ancien volume PostgreSQL corrompu :

bashdocker-compose down -v    # supprime les volumes de l'ancienne session
docker-compose up --build