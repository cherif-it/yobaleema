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


#### fix

  

 docker-compose up --build
[+] Building 1.8s (68/68) FINISHED                                                                                                                                                                         
 => [internal] load local bake definitions                                                                                                                                                            0.0s
 => => reading from stdin 3.14kB                                                                                                                                                                      0.0s
 => [matching-service internal] load build definition from Dockerfile                                                                                                                                 0.0s
 => => transferring dockerfile: 157B                                                                                                                                                                  0.0s
 => [api-gateway internal] load build definition from Dockerfile                                                                                                                                      0.0s
 => => transferring dockerfile: 157B                                                                                                                                                                  0.0s
 => [notification-service internal] load build definition from Dockerfile                                                                                                                             0.1s
 => => transferring dockerfile: 157B                                                                                                                                                                  0.0s
 => [auth-service internal] load build definition from Dockerfile                                                                                                                                     0.0s
 => => transferring dockerfile: 157B                                                                                                                                                                  0.0s
 => [parcel-service internal] load build definition from Dockerfile                                                                                                                                   0.0s
 => => transferring dockerfile: 157B                                                                                                                                                                  0.0s
 => [frontend internal] load build definition from Dockerfile.dev                                                                                                                                     0.1s
 => => transferring dockerfile: 159B                                                                                                                                                                  0.0s
 => [trip-service internal] load build definition from Dockerfile                                                                                                                                     0.0s
 => => transferring dockerfile: 157B                                                                                                                                                                  0.0s
 => [user-service internal] load build definition from Dockerfile                                                                                                                                     0.0s
 => => transferring dockerfile: 157B                                                                                                                                                                  0.0s
 => [parcel-service internal] load metadata for docker.io/library/node:20-alpine                                                                                                                      0.6s
 => [frontend internal] load .dockerignore                                                                                                                                                            0.1s
 => => transferring context: 2B                                                                                                                                                                       0.0s
 => [matching-service internal] load .dockerignore                                                                                                                                                    0.1s
 => => transferring context: 2B                                                                                                                                                                       0.0s
 => [auth-service internal] load .dockerignore                                                                                                                                                        0.0s
 => => transferring context: 2B                                                                                                                                                                       0.0s
 => [user-service internal] load .dockerignore                                                                                                                                                        0.0s
 => => transferring context: 2B                                                                                                                                                                       0.0s
 => [notification-service internal] load .dockerignore                                                                                                                                                0.0s
 => => transferring context: 2B                                                                                                                                                                       0.0s
 => [api-gateway internal] load .dockerignore                                                                                                                                                         0.0s
 => => transferring context: 2B                                                                                                                                                                       0.0s
 => [parcel-service internal] load .dockerignore                                                                                                                                                      0.0s
 => => transferring context: 2B                                                                                                                                                                       0.0s
 => [trip-service internal] load .dockerignore                                                                                                                                                        0.1s
 => => transferring context: 2B                                                                                                                                                                       0.0s
 => [trip-service 1/5] FROM docker.io/library/node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293                                                                  0.0s
 => [notification-service internal] load build context                                                                                                                                                0.0s
 => => transferring context: 201B                                                                                                                                                                     0.0s
 => [parcel-service internal] load build context                                                                                                                                                      0.0s
 => => transferring context: 201B                                                                                                                                                                     0.0s
 => [matching-service internal] load build context                                                                                                                                                    0.0s
 => => transferring context: 201B                                                                                                                                                                     0.0s
 => [api-gateway internal] load build context                                                                                                                                                         0.0s
 => => transferring context: 201B                                                                                                                                                                     0.0s
 => [auth-service internal] load build context                                                                                                                                                        0.0s
 => => transferring context: 201B                                                                                                                                                                     0.0s
 => [frontend internal] load build context                                                                                                                                                            0.1s
 => => transferring context: 2.31kB                                                                                                                                                                   0.0s
 => [user-service internal] load build context                                                                                                                                                        0.0s
 => => transferring context: 201B                                                                                                                                                                     0.0s
 => [trip-service internal] load build context                                                                                                                                                        0.1s
 => => transferring context: 201B                                                                                                                                                                     0.0s
 => CACHED [frontend 2/5] WORKDIR /app                                                                                                                                                                0.0s
 => CACHED [notification-service 3/5] COPY package*.json ./                                                                                                                                           0.0s
 => CACHED [notification-service 4/5] RUN npm install --omit=dev                                                                                                                                      0.0s
 => CACHED [notification-service 5/5] COPY . .                                                                                                                                                        0.0s
 => [notification-service] exporting to image                                                                                                                                                         0.0s
 => => exporting layers                                                                                                                                                                               0.0s
 => => writing image sha256:8445561366e09940a3f0c01b87c12d75d11aaa8300fd2ffd9e44c95567ffb3dd                                                                                                          0.0s
 => => naming to docker.io/library/yobaleema-notification-service                                                                                                                                     0.0s
 => CACHED [parcel-service 3/5] COPY package*.json ./                                                                                                                                                 0.0s
 => CACHED [parcel-service 4/5] RUN npm install --omit=dev                                                                                                                                            0.0s
 => CACHED [parcel-service 5/5] COPY . .                                                                                                                                                              0.0s
 => [parcel-service] exporting to image                                                                                                                                                               0.0s
 => => exporting layers                                                                                                                                                                               0.0s
 => => writing image sha256:cf673bb8d0d007eb0918174a77c40b100b9b3ac6d8beee1d8e1edaf5111b6e0a                                                                                                          0.0s
 => => naming to docker.io/library/yobaleema-parcel-service                                                                                                                                           0.0s
 => CACHED [auth-service 3/5] COPY package*.json ./                                                                                                                                                   0.0s
 => CACHED [auth-service 4/5] RUN npm install --omit=dev                                                                                                                                              0.0s
 => CACHED [auth-service 5/5] COPY . .                                                                                                                                                                0.0s
 => CACHED [user-service 3/5] COPY package*.json ./                                                                                                                                                   0.0s
 => CACHED [user-service 4/5] RUN npm install --omit=dev                                                                                                                                              0.0s
 => CACHED [user-service 5/5] COPY . .                                                                                                                                                                0.0s
 => CACHED [api-gateway 3/5] COPY package*.json ./                                                                                                                                                    0.0s
 => CACHED [api-gateway 4/5] RUN npm install --omit=dev                                                                                                                                               0.0s
 => CACHED [api-gateway 5/5] COPY . .                                                                                                                                                                 0.0s
 => CACHED [trip-service 3/5] COPY package*.json ./                                                                                                                                                   0.0s
 => CACHED [trip-service 4/5] RUN npm install --omit=dev                                                                                                                                              0.0s
 => CACHED [trip-service 5/5] COPY . .                                                                                                                                                                0.0s
 => CACHED [matching-service 3/5] COPY package*.json ./                                                                                                                                               0.0s
 => CACHED [matching-service 4/5] RUN npm install --omit=dev                                                                                                                                          0.0s
 => CACHED [matching-service 5/5] COPY . .                                                                                                                                                            0.0s
 => CACHED [frontend 3/5] COPY package*.json ./                                                                                                                                                       0.0s
 => CACHED [frontend 4/5] RUN npm install                                                                                                                                                             0.0s
 => CACHED [frontend 5/5] COPY . .                                                                                                                                                                    0.0s
 => [auth-service] exporting to image                                                                                                                                                                 0.0s
 => => exporting layers                                                                                                                                                                               0.0s
 => => writing image sha256:50fb013135f1f6c61686b320a2f1abb4e6dc3e9591124ac155ac0154ad8ebae9                                                                                                          0.0s
 => => naming to docker.io/library/yobaleema-auth-service                                                                                                                                             0.0s
 => [api-gateway] exporting to image                                                                                                                                                                  0.0s
 => => exporting layers                                                                                                                                                                               0.0s
 => => writing image sha256:962556ffeff1eb4ec35f9abe08b734e125951a276630d3ec660c4418e3798059                                                                                                          0.0s
 => => naming to docker.io/library/yobaleema-api-gateway                                                                                                                                              0.0s
 => [matching-service] exporting to image                                                                                                                                                             0.0s
 => => exporting layers                                                                                                                                                                               0.0s
 => => writing image sha256:e2328f4d69dde4df719299fa84eedeec7d0b3968b613f58fd855bea703df0495                                                                                                          0.0s
 => => naming to docker.io/library/yobaleema-matching-service                                                                                                                                         0.0s
 => [trip-service] exporting to image                                                                                                                                                                 0.0s
 => => exporting layers                                                                                                                                                                               0.0s
 => => writing image sha256:b0a0d0d3ab19ba1b2cb79d2ff11e95377ae37c02542d8233dc4e02bd42ce189a                                                                                                          0.0s
 => => naming to docker.io/library/yobaleema-trip-service                                                                                                                                             0.0s
 => [frontend] exporting to image                                                                                                                                                                     0.0s
 => => exporting layers                                                                                                                                                                               0.0s
 => => writing image sha256:e95ec12a7277a46b86aa24a46ca4adcd358b2f32d1a03355f86fbbf2f44f0b79                                                                                                          0.0s
 => => naming to docker.io/library/yobaleema-frontend                                                                                                                                                 0.0s
 => [user-service] exporting to image                                                                                                                                                                 0.0s
 => => exporting layers                                                                                                                                                                               0.0s
 => => writing image sha256:79d26d4a5c62cba1443cc58acb18714e4e7e25b1c065168b31f704991d7e8787                                                                                                          0.0s
 => => naming to docker.io/library/yobaleema-user-service                                                                                                                                             0.0s
 => [notification-service] resolving provenance for metadata file                                                                                                                                     0.1s
 => [parcel-service] resolving provenance for metadata file                                                                                                                                           0.0s
 => [auth-service] resolving provenance for metadata file                                                                                                                                             0.0s
 => [trip-service] resolving provenance for metadata file                                                                                                                                             0.0s
 => [matching-service] resolving provenance for metadata file                                                                                                                                         0.0s
 => [frontend] resolving provenance for metadata file                                                                                                                                                 0.0s
 => [user-service] resolving provenance for metadata file                                                                                                                                             0.0s
 => [api-gateway] resolving provenance for metadata file                                                                                                                                              0.0s
[+] Running 12/15
 ✔ auth-service                      Built                                                                                                                                                            0.0s 
 ✔ notification-service              Built                                                                                                                                                            0.0s 
[+] Running 15/22                    Built                                                                                                                                                            0.0s 
 ✔ auth-service                      Built                                                                                                                                                            0.0s 
 ✔ notification-service              Built                                                                                                                                                            0.0s 
 ✔ frontend                          Built                                                                                                                                                            0.0s 
 ✔ trip-service                      Built                                                                                                                                                            0.0s 
 ✔ user-service                      Built                                                                                                                                                            0.0s 
 ✔ api-gateway                       Built                                                                                                                                                            0.0s 
 ✔ parcel-service                    Built                                                                                                                                                            0.0s 
 ✔ matching-service                  Built                                                                                                                                                            0.0s 
 ✔ Network yobaleema_default         Created                                                                                                                                                          0.1s 
[+] Running 22/23ema_rabbitmq_data"  Created                                                                                                                                                          0.0s 
 ✔ auth-service                      Built                                                                                                                                                            0.0s 
 ✔ notification-service              Built                                                                                                                                                            0.0s 
 ✔ frontend                          Built                                                                                                                                                            0.0s 
 ✔ trip-service                      Built                                                                                                                                                            0.0s 
 ✔ user-service                      Built                                                                                                                                                            0.0s 
 ✔ api-gateway                       Built                                                                                                                                                            0.0s 
 ✔ parcel-service                    Built                                                                                                                                                            0.0s 
 ✔ matching-service                  Built                                                                                                                                                            0.0s 
 ✔ Network yobaleema_default         Created                                                                                                                                                          0.1s 
 ✔ Volume "yobaleema_rabbitmq_data"  Created                                                                                                                                                          0.0s 
[+] Running 22/23ema_redis_data"     Created                                                                                                                                                          0.0s 
 ✔ auth-service                      Built                                                                                                                                                            0.0s 
 ✔ notification-service              Built                                                                                                                                                            0.0s 
 ✔ frontend                          Built                                                                                                                                                            0.0s 
 ✔ trip-service                      Built                                                                                                                                                            0.0s 
 ✔ user-service                      Built                                                                                                                                                            0.0s 
 ✔ api-gateway                       Built                                                                                                                                                            0.0s 
 ✔ parcel-service                    Built                                                                                                                                                            0.0s 
 ✔ matching-service                  Built                                                                                                                                                            0.0s 
 ✔ Network yobaleema_default         Created                                                                                                                                                          0.1s 
 ✔ Volume "yobaleema_rabbitmq_data"  Created                                                                                                                                                          0.0s 
[+] Running 22/23ema_redis_data"     Created                                                                                                                                                          0.0s 
 ✔ auth-service                      Built                                                                                                                                                            0.0s 
 ✔ notification-service              Built                                                                                                                                                            0.0s 
 ✔ frontend                          Built                                                                                                                                                            0.0s 
 ✔ trip-service                      Built                                                                                                                                                            0.0s 
 ✔ user-service                      Built                                                                                                                                                            0.0s 
 ✔ api-gateway                       Built                                                                                                                                                            0.0s 
 ✔ parcel-service                    Built                                                                                                                                                            0.0s 
 ✔ matching-service                  Built                                                                                                                                                            0.0s 
 ✔ Network yobaleema_default         Created                                                                                                                                                          0.1s 
 ✔ Volume "yobaleema_rabbitmq_data"  Created                                                                                                                                                          0.0s 
[+] Running 22/23ema_redis_data"     Created                                                                                                                                                          0.0s 
 ✔ auth-service                      Built                                                                                                                                                            0.0s 
 ✔ notification-service              Built                                                                                                                                                            0.0s 
 ✔ frontend                          Built                                                                                                                                                            0.0s 
 ✔ trip-service                      Built                                                                                                                                                            0.0s 
 ✔ user-service                      Built                                                                                                                                                            0.0s 
 ✔ api-gateway                       Built                                                                                                                                                            0.0s 
 ✔ parcel-service                    Built                                                                                                                                                            0.0s 
 ✔ matching-service                  Built                                                                                                                                                            0.0s 
 ✔ Network yobaleema_default         Created                                                                                                                                                          0.1s 
 ✔ Volume "yobaleema_rabbitmq_data"  Created                                                                                                                                                          0.0s 
[+] Running 22/23ema_redis_data"     Created                                                                                                                                                          0.0s 
 ✔ auth-service                      Built                                                                                                                                                            0.0s 
 ✔ notification-service              Built                                                                                                                                                            0.0s 
 ✔ frontend                          Built                                                                                                                                                            0.0s 
 ✔ trip-service                      Built                                                                                                                                                            0.0s 
 ✔ user-service                      Built                                                                                                                                                            0.0s 
 ✔ api-gateway                       Built                                                                                                                                                            0.0s 
 ✔ parcel-service                    Built                                                                                                                                                            0.0s 
 ✔ matching-service                  Built                                                                                                                                                            0.0s 
 ✔ Network yobaleema_default         Created                                                                                                                                                          0.1s 
 ✔ Volume "yobaleema_rabbitmq_data"  Created                                                                                                                                                          0.0s 
[+] Running 22/23ema_redis_data"     Created                                                                                                                                                          0.0s 
 ✔ auth-service                      Built                                                                                                                                                            0.0s 
 ✔ notification-service              Built                                                                                                                                                            0.0s 
 ✔ frontend                          Built                                                                                                                                                            0.0s 
 ✔ trip-service                      Built                                                                                                                                                            0.0s 
 ✔ user-service                      Built                                                                                                                                                            0.0s 
 ✔ api-gateway                       Built                                                                                                                                                            0.0s 
 ✔ parcel-service                    Built                                                                                                                                                            0.0s 
 ✔ matching-service                  Built                                                                                                                                                            0.0s 
 ✔ Network yobaleema_default         Created                                                                                                                                                          0.1s 
 ✔ Volume "yobaleema_rabbitmq_data"  Created                                                                                                                                                          0.0s 
[+] Running 22/23ema_redis_data"     Created                                                                                                                                                          0.0s 
 ✔ auth-service                      Built                                                                                                                                                            0.0s 
 ✔ notification-service              Built                                                                                                                                                            0.0s 
 ✔ frontend                          Built                                                                                                                                                            0.0s 
 ✔ trip-service                      Built                                                                                                                                                            0.0s 
 ✔ user-service                      Built                                                                                                                                                            0.0s 
 ✔ api-gateway                       Built                                                                                                                                                            0.0s 
 ✔ parcel-service                    Built                                                                                                                                                            0.0s 
 ✔ matching-service                  Built                                                                                                                                                            0.0s 
 ✔ Network yobaleema_default         Created                                                                                                                                                          0.1s 
 ✔ Volume "yobaleema_rabbitmq_data"  Created                                                                                                                                                          0.0s 
[+] Running 22/23ema_redis_data"     Created                                                                                                                                                          0.0s 
 ✔ auth-service                      Built                                                                                                                                                            0.0s 
 ✔ notification-service              Built                                                                                                                                                            0.0s 
 ✔ frontend                          Built                                                                                                                                                            0.0s 
 ✔ trip-service                      Built                                                                                                                                                            0.0s 
 ✔ user-service                      Built                                                                                                                                                            0.0s 
 ✔ api-gateway                       Built                                                                                                                                                            0.0s 
 ✔ parcel-service                    Built                                                                                                                                                            0.0s 
 ✔ matching-service                  Built                                                                                                                                                            0.0s 
 ✔ Network yobaleema_default         Created                                                                                                                                                          0.1s 
 ✔ Volume "yobaleema_rabbitmq_data"  Created                                                                                                                                                          0.0s 
[+] Running 22/23ema_redis_data"     Created                                                                                                                                                          0.0s 
 ✔ auth-service                      Built                                                                                                                                                            0.0s 
 ✔ notification-service              Built                                                                                                                                                            0.0s 
 ✔ frontend                          Built                                                                                                                                                            0.0s 
 ✔ trip-service                      Built                                                                                                                                                            0.0s 
 ✔ user-service                      Built                                                                                                                                                            0.0s 
 ✔ api-gateway                       Built                                                                                                                                                            0.0s 
 ✔ parcel-service                    Built                                                                                                                                                            0.0s 
 ✔ matching-service                  Built                                                                                                                                                            0.0s 
 ✔ Network yobaleema_default         Created                                                                                                                                                          0.1s 
 ✔ Volume "yobaleema_rabbitmq_data"  Created                                                                                                                                                          0.0s 
[+] Running 22/23ema_redis_data"     Created                                                                                                                                                          0.0s 
 ✔ auth-service                      Built                                                                                                                                                            0.0s 
 ✔ notification-service              Built                                                                                                                                                            0.0s 
 ✔ frontend                          Built                                                                                                                                                            0.0s 
 ✔ trip-service                      Built                                                                                                                                                            0.0s 
 ✔ user-service                      Built                                                                                                                                                            0.0s 
 ✔ api-gateway                       Built                                                                                                                                                            0.0s 
 ✔ parcel-service                    Built                                                                                                                                                            0.0s 
 ✔ matching-service                  Built                                                                                                                                                            0.0s 
 ✔ Network yobaleema_default         Created                                                                                                                                                          0.1s 
 ✔ Volume "yobaleema_rabbitmq_data"  Created                                                                                                                                                          0.0s 
[+] Running 22/23ema_redis_data"     Created                                                                                                                                                          0.0s 
 ✔ auth-service                      Built                                                                                                                                                            0.0s 
 ✔ notification-service              Built                                                                                                                                                            0.0s 
 ✔ frontend                          Built                                                                                                                                                            0.0s 
 ✔ trip-service                      Built                                                                                                                                                            0.0s 
 ✔ user-service                      Built                                                                                                                                                            0.0s 
 ✔ api-gateway                       Built                                                                                                                                                            0.0s 
 ✔ parcel-service                    Built                                                                                                                                                            0.0s 
 ✔ matching-service                  Built                                                                                                                                                            0.0s 
 ✔ Network yobaleema_default         Created                                                                                                                                                          0.1s 
 ✔ Volume "yobaleema_rabbitmq_data"  Created                                                                                                                                                          0.0s 
[+] Running 22/23ema_redis_data"     Created                                                                                                                                                          0.0s 
 ✔ auth-service                      Built                                                                                                                                                            0.0s 
 ✔ notification-service              Built                                                                                                                                                            0.0s 
 ✔ frontend                          Built                                                                                                                                                            0.0s 
 ✔ trip-service                      Built                                                                                                                                                            0.0s 
 ✔ user-service                      Built                                                                                                                                                            0.0s 
 ✔ api-gateway                       Built                                                                                                                                                            0.0s 
 ✔ parcel-service                    Built                                                                                                                                                            0.0s 
 ✔ matching-service                  Built                                                                                                                                                            0.0s 
 ✔ Network yobaleema_default         Created                                                                                                                                                          0.1s 
 ✔ Volume "yobaleema_rabbitmq_data"  Created                                                                                                                                                          0.0s 
[+] Running 22/23ema_redis_data"     Created                                                                                                                                                          0.0s 
 ✔ auth-service                      Built                                                                                                                                                            0.0s 
 ✔ notification-service              Built                                                                                                                                                            0.0s 
 ✔ frontend                          Built                                                                                                                                                            0.0s 
 ✔ trip-service                      Built                                                                                                                                                            0.0s 
 ✔ user-service                      Built                                                                                                                                                            0.0s 
 ✔ api-gateway                       Built                                                                                                                                                            0.0s 
 ✔ parcel-service                    Built                                                                                                                                                            0.0s 
 ✔ matching-service                  Built                                                                                                                                                            0.0s 
 ✔ Network yobaleema_default         Created                                                                                                                                                          0.1s 
 ✔ Volume "yobaleema_rabbitmq_data"  Created                                                                                                                                                          0.0s 
[+] Running 22/23ema_redis_data"     Created                                                                                                                                                          0.0s 
 ✔ auth-service                      Built                                                                                                                                                            0.0s 
 ✔ notification-service              Built                                                                                                                                                            0.0s 
 ✔ frontend                          Built                                                                                                                                                            0.0s 
 ✔ trip-service                      Built                                                                                                                                                            0.0s 
 ✔ user-service                      Built                                                                                                                                                            0.0s 
 ✔ api-gateway                       Built                                                                                                                                                            0.0s 
 ✔ parcel-service                    Built                                                                                                                                                            0.0s 
 ✔ matching-service                  Built                                                                                                                                                            0.0s 
 ✔ Network yobaleema_default         Created                                                                                                                                                          0.1s 
 ✔ Volume "yobaleema_rabbitmq_data"  Created                                                                                                                                                          0.0s 
[+] Running 22/23ema_redis_data"     Created                                                                                                                                                          0.0s 
 ✔ auth-service                      Built                                                                                                                                                            0.0s 
 ✔ notification-service              Built                                                                                                                                                            0.0s 
 ✔ frontend                          Built                                                                                                                                                            0.0s 
 ✔ trip-service                      Built                                                                                                                                                            0.0s 
 ✔ user-service                      Built                                                                                                                                                            0.0s 
 ✔ api-gateway                       Built                                                                                                                                                            0.0s 
 ✔ parcel-service                    Built                                                                                                                                                            0.0s 
 ✔ matching-service                  Built                                                                                                                                                            0.0s 
 ✔ Network yobaleema_default         Created                                                                                                                                                          0.1s 
 ✔ Volume "yobaleema_rabbitmq_data"  Created                                                                                                                                                          0.0s 
[+] Running 22/23ema_redis_data"     Created                                                                                                                                                          0.0s 
 ✔ auth-service                      Built                                                                                                                                                            0.0s 
 ✔ notification-service              Built                                                                                                                                                            0.0s 
 ✔ frontend                          Built                                                                                                                                                            0.0s 
 ✔ trip-service                      Built                                                                                                                                                            0.0s 
 ✔ user-service                      Built                                                                                                                                                            0.0s 
 ✔ api-gateway                       Built                                                                                                                                                            0.0s 
 ✔ parcel-service                    Built                                                                                                                                                            0.0s 
 ✔ matching-service                  Built                                                                                                                                                            0.0s 
 ✔ Network yobaleema_default         Created                                                                                                                                                          0.1s 
 ✔ Volume "yobaleema_rabbitmq_data"  Created                                                                                                                                                          0.0s 
[+] Running 23/23ema_redis_data"     Created                                                                                                                                                          0.0s 
 ✔ auth-service                      Built                                                                                                                                                            0.0s 
 ✔ notification-service              Built                                                                                                                                                            0.0s 
 ✔ frontend                          Built                                                                                                                                                            0.0s 
 ✔ trip-service                      Built                                                                                                                                                            0.0s 
 ✔ user-service                      Built                                                                                                                                                            0.0s 
 ✔ api-gateway                       Built                                                                                                                                                            0.0s 
 ✔ parcel-service                    Built                                                                                                                                                            0.0s 
 ✔ matching-service                  Built                                                                                                                                                            0.0s 
 ✔ Network yobaleema_default         Created                                                                                                                                                          0.1s 
 ✔ Volume "yobaleema_rabbitmq_data"  Created                                                                                                                                                          0.0s 
 ✔ Volume "yobaleema_redis_data"     Created                                                                                                                                                          0.0s 
 ✔ Volume "yobaleema_postgres_data"  Created                                                                                                                                                          0.0s 
 ✔ Container yoba_rabbitmq           Created                                                                                                                                                          0.1s 
 ✔ Container yoba_redis              Created                                                                                                                                                          0.1s 
 ✔ Container yoba_postgres           Created                                                                                                                                                          0.1s 
 ✔ Container yoba_gateway            Created                                                                                                                                                          0.1s 
 ✔ Container yoba_trips              Created                                                                                                                                                          0.1s 
 ✔ Container yoba_parcels            Created                                                                                                                                                          0.1s 
 ✔ Container yoba_matching           Created                                                                                                                                                          0.1s 
 ✔ Container yoba_users              Created                                                                                                                                                          0.1s 
 ✔ Container yoba_notifs             Created                                                                                                                                                          0.1s 
 ✔ Container yoba_auth               Created                                                                                                                                                          0.1s 
 ✔ Container yoba_frontend           Created                                                                                                                                                          1.6s 
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
yoba_postgres  | 2026-04-18 20:20:08.293 UTC [35] WARNING:  no usable system locales were found
yoba_postgres  | performing post-bootstrap initialization ... ok
yoba_postgres  | initdb: warning: enabling "trust" authentication for local connections
yoba_postgres  | initdb: hint: You can change this by editing pg_hba.conf or using the option -A, or --auth-local and --auth-host, the next time you run initdb.
yoba_postgres  | syncing data to disk ... ok
yoba_postgres  | 
yoba_postgres  | 
yoba_postgres  | Success. You can now start the database server using:
yoba_postgres  | 
yoba_postgres  |     pg_ctl -D /var/lib/postgresql/data -l logfile start
yoba_postgres  | 
yoba_postgres  | waiting for server to start....2026-04-18 20:20:09.198 UTC [41] LOG:  starting PostgreSQL 16.13 on x86_64-pc-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit
yoba_postgres  | 2026-04-18 20:20:09.200 UTC [41] LOG:  listening on Unix socket "/var/run/postgresql/.s.PGSQL.5432"
yoba_postgres  | 2026-04-18 20:20:09.206 UTC [44] LOG:  database system was shut down at 2026-04-18 20:20:08 UTC
yoba_postgres  | 2026-04-18 20:20:09.211 UTC [41] LOG:  database system is ready to accept connections
yoba_postgres  |  done
yoba_postgres  | server started
yoba_postgres  | 
yoba_postgres  | /usr/local/bin/docker-entrypoint.sh: running /docker-entrypoint-initdb.d/01-init.sql
yoba_postgres  | CREATE DATABASE
yoba_postgres  | CREATE DATABASE
yoba_postgres  | CREATE DATABASE
yoba_postgres  | CREATE DATABASE
yoba_postgres  | CREATE DATABASE
yoba_postgres  | CREATE DATABASE
yoba_postgres  | 
yoba_postgres  | 
yoba_postgres  | waiting for server to shut down....2026-04-18 20:20:09.626 UTC [41] LOG:  received fast shutdown request
yoba_postgres  | 2026-04-18 20:20:09.628 UTC [41] LOG:  aborting any active transactions
yoba_postgres  | 2026-04-18 20:20:09.631 UTC [41] LOG:  background worker "logical replication launcher" (PID 47) exited with exit code 1
yoba_postgres  | 2026-04-18 20:20:09.638 UTC [42] LOG:  shutting down
yoba_postgres  | 2026-04-18 20:20:09.639 UTC [42] LOG:  checkpoint starting: shutdown immediate
yoba_postgres  | 2026-04-18 20:20:10.035 UTC [42] LOG:  checkpoint complete: wrote 5526 buffers (33.7%); 0 WAL file(s) added, 0 removed, 1 recycled; write=0.132 s, sync=0.257 s, total=0.398 s; sync files=1781, longest=0.052 s, average=0.001 s; distance=25632 kB, estimate=25632 kB; lsn=0/2DFA678, redo lsn=0/2DFA678
yoba_postgres  | 2026-04-18 20:20:10.047 UTC [41] LOG:  database system is shut down
yoba_postgres  |  done
yoba_postgres  | server stopped
yoba_postgres  | 
yoba_postgres  | PostgreSQL init process complete; ready for start up.
yoba_postgres  | 
yoba_postgres  | 2026-04-18 20:20:10.157 UTC [1] LOG:  starting PostgreSQL 16.13 on x86_64-pc-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit
yoba_postgres  | 2026-04-18 20:20:10.158 UTC [1] LOG:  listening on IPv4 address "0.0.0.0", port 5432
yoba_postgres  | 2026-04-18 20:20:10.158 UTC [1] LOG:  listening on IPv6 address "::", port 5432
yoba_postgres  | 2026-04-18 20:20:10.161 UTC [1] LOG:  listening on Unix socket "/var/run/postgresql/.s.PGSQL.5432"
yoba_postgres  | 2026-04-18 20:20:10.167 UTC [57] LOG:  database system was shut down at 2026-04-18 20:20:10 UTC
yoba_postgres  | 2026-04-18 20:20:10.174 UTC [1] LOG:  database system is ready to accept connections
yoba_postgres  | 2026-04-18 20:20:12.520 UTC [67] FATAL:  database "yoba" does not exist
yoba_gateway   | [HPM] Proxy created: /  -> http://auth-service:4001
yoba_gateway   | [HPM] Proxy created: /  -> http://trip-service:4004
yoba_gateway   | [HPM] Proxy created: /  -> http://parcel-service:4003
yoba_gateway   | [HPM] Proxy created: /  -> http://user-service:4002
yoba_gateway   | [HPM] Proxy created: /  -> http://parcel-service:4003
yoba_gateway   | [HPM] Proxy created: /  -> http://trip-service:4004
yoba_gateway   | [HPM] Proxy rewrite rule created: "^/api/my-trips" ~> "/api/trips/my"
yoba_gateway   | [HPM] Proxy created: /  -> http://matching-service:4005
yoba_gateway   | [HPM] Proxy created: /  -> http://notification-service:4006
yoba_gateway   | [HPM] Proxy created: /  -> http://notification-service:4006
yoba_gateway   | 
yoba_gateway   |   ╔══════════════════════════════════╗
yoba_gateway   |   ║  YOBALEEMA  —  API Gateway      ║
yoba_gateway   |   ╚══════════════════════════════════╝
yoba_gateway   | 
yoba_gateway   |   🚀 Gateway    : http://localhost:4000
yoba_gateway   |   🔌 WebSocket  : ws://localhost:4000
yoba_gateway   |   📦 Services   : auth, users, parcels, trips, matching, notifications
yoba_gateway   | 
yoba_frontend  | 
yoba_frontend  | > @yobaleema/frontend@1.0.0 dev
yoba_frontend  | > vite --host 0.0.0.0 --port 3000
yoba_frontend  | 
yoba_frontend  | 
yoba_frontend  |   VITE v5.4.21  ready in 326 ms
yoba_frontend  | 
yoba_frontend  |   ➜  Local:   http://localhost:3000/
yoba_frontend  |   ➜  Network: http://172.18.0.6:3000/
yoba_rabbitmq  | 2026-04-18 20:20:15.585004+00:00 [notice] <0.44.0> Application syslog exited with reason: stopped
yoba_rabbitmq  | 2026-04-18 20:20:15.590715+00:00 [notice] <0.254.0> Logging: switching to configured handler(s); following messages may not be visible in this log output
yoba_rabbitmq  | 2026-04-18 20:20:15.593257+00:00 [notice] <0.254.0> Logging: configured log handlers are now ACTIVE
yoba_rabbitmq  | 2026-04-18 20:20:15.625234+00:00 [info] <0.254.0> ra: starting system quorum_queues
yoba_rabbitmq  | 2026-04-18 20:20:15.625359+00:00 [info] <0.254.0> starting Ra system: quorum_queues in directory: /var/lib/rabbitmq/mnesia/rabbit@207f07fd034e/quorum/rabbit@207f07fd034e
yoba_rabbitmq  | 2026-04-18 20:20:15.757462+00:00 [info] <0.268.0> ra system 'quorum_queues' running pre init for 0 registered servers
yoba_rabbitmq  | 2026-04-18 20:20:15.779254+00:00 [info] <0.269.0> ra: meta data store initialised for system quorum_queues. 0 record(s) recovered
yoba_rabbitmq  | 2026-04-18 20:20:15.812231+00:00 [notice] <0.274.0> WAL: ra_log_wal init, open tbls: ra_log_open_mem_tables, closed tbls: ra_log_closed_mem_tables
yoba_rabbitmq  | 2026-04-18 20:20:15.845123+00:00 [info] <0.254.0> ra: starting system coordination
yoba_rabbitmq  | 2026-04-18 20:20:15.845181+00:00 [info] <0.254.0> starting Ra system: coordination in directory: /var/lib/rabbitmq/mnesia/rabbit@207f07fd034e/coordination/rabbit@207f07fd034e
yoba_rabbitmq  | 2026-04-18 20:20:15.847605+00:00 [info] <0.282.0> ra system 'coordination' running pre init for 0 registered servers
yoba_rabbitmq  | 2026-04-18 20:20:15.849994+00:00 [info] <0.283.0> ra: meta data store initialised for system coordination. 0 record(s) recovered
yoba_rabbitmq  | 2026-04-18 20:20:15.850328+00:00 [notice] <0.288.0> WAL: ra_coordination_log_wal init, open tbls: ra_coordination_log_open_mem_tables, closed tbls: ra_coordination_log_closed_mem_tables
yoba_rabbitmq  | 2026-04-18 20:20:15.855060+00:00 [info] <0.254.0> ra: starting system coordination
yoba_rabbitmq  | 2026-04-18 20:20:15.855118+00:00 [info] <0.254.0> starting Ra system: coordination in directory: /var/lib/rabbitmq/mnesia/rabbit@207f07fd034e/coordination/rabbit@207f07fd034e
yoba_rabbitmq  | 2026-04-18 20:20:16.047382+00:00 [info] <0.254.0> Waiting for Khepri leader for 30000 ms, 9 retries left
yoba_rabbitmq  | 2026-04-18 20:20:16.053861+00:00 [notice] <0.292.0> RabbitMQ metadata store: candidate -> leader in term: 1 machine version: 1
yoba_rabbitmq  | 2026-04-18 20:20:16.084661+00:00 [info] <0.254.0> Khepri leader elected
yoba_rabbitmq  | 2026-04-18 20:20:16.084717+00:00 [info] <0.254.0> Waiting for Khepri projections for 30000 ms, 9 retries left
yoba_rabbitmq  | 2026-04-18 20:20:16.624882+00:00 [info] <0.254.0> 
yoba_rabbitmq  | 2026-04-18 20:20:16.624882+00:00 [info] <0.254.0>  Starting RabbitMQ 3.13.7 on Erlang 26.2.5.16 [jit]
yoba_rabbitmq  | 2026-04-18 20:20:16.624882+00:00 [info] <0.254.0>  Copyright (c) 2007-2024 Broadcom Inc and/or its subsidiaries
yoba_rabbitmq  | 2026-04-18 20:20:16.624882+00:00 [info] <0.254.0>  Licensed under the MPL 2.0. Website: https://rabbitmq.com
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
yoba_rabbitmq  |   Starting broker...2026-04-18 20:20:16.628327+00:00 [info] <0.254.0> 
yoba_rabbitmq  | 2026-04-18 20:20:16.628327+00:00 [info] <0.254.0>  node           : rabbit@207f07fd034e
yoba_rabbitmq  | 2026-04-18 20:20:16.628327+00:00 [info] <0.254.0>  home dir       : /var/lib/rabbitmq
yoba_rabbitmq  | 2026-04-18 20:20:16.628327+00:00 [info] <0.254.0>  config file(s) : /etc/rabbitmq/conf.d/10-defaults.conf
yoba_rabbitmq  | 2026-04-18 20:20:16.628327+00:00 [info] <0.254.0>  cookie hash    : 8ButzRy6It89klzi4E66aA==
yoba_rabbitmq  | 2026-04-18 20:20:16.628327+00:00 [info] <0.254.0>  log(s)         : <stdout>
yoba_rabbitmq  | 2026-04-18 20:20:16.628327+00:00 [info] <0.254.0>  data dir       : /var/lib/rabbitmq/mnesia/rabbit@207f07fd034e
yoba_rabbitmq  | 2026-04-18 20:20:17.256287+00:00 [info] <0.254.0> Running boot step pre_boot defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:17.256368+00:00 [info] <0.254.0> Running boot step rabbit_global_counters defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:17.257347+00:00 [info] <0.254.0> Running boot step rabbit_osiris_metrics defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:17.257518+00:00 [info] <0.254.0> Running boot step rabbit_core_metrics defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:17.258681+00:00 [info] <0.254.0> Running boot step rabbit_alarm defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:17.279585+00:00 [info] <0.329.0> Memory high watermark set to 3175 MiB (3329985740 bytes) of 7939 MiB (8324964352 bytes) total
yoba_rabbitmq  | 2026-04-18 20:20:17.285490+00:00 [info] <0.331.0> Enabling free disk space monitoring (disk free space: 36347822080, total memory: 8324964352)
yoba_rabbitmq  | 2026-04-18 20:20:17.285586+00:00 [info] <0.331.0> Disk free limit set to 50MB
yoba_rabbitmq  | 2026-04-18 20:20:17.290831+00:00 [info] <0.254.0> Running boot step code_server_cache defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:17.290944+00:00 [info] <0.254.0> Running boot step file_handle_cache defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:17.322951+00:00 [info] <0.334.0> Limiting to approx 1048479 file handles (943629 sockets)
yoba_rabbitmq  | 2026-04-18 20:20:17.323581+00:00 [info] <0.335.0> FHC read buffering: OFF
yoba_rabbitmq  | 2026-04-18 20:20:17.323640+00:00 [info] <0.335.0> FHC write buffering: ON
yoba_rabbitmq  | 2026-04-18 20:20:17.324543+00:00 [info] <0.254.0> Running boot step worker_pool defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:17.324686+00:00 [info] <0.315.0> Will use 8 processes for default worker pool
yoba_rabbitmq  | 2026-04-18 20:20:17.324748+00:00 [info] <0.315.0> Starting worker pool 'worker_pool' with 8 processes in it
yoba_rabbitmq  | 2026-04-18 20:20:17.326543+00:00 [info] <0.254.0> Running boot step database defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:17.327948+00:00 [info] <0.254.0> Peer discovery: configured backend: rabbit_peer_discovery_classic_config
yoba_rabbitmq  | 2026-04-18 20:20:17.331078+00:00 [notice] <0.316.0> Feature flags: attempt to enable `detailed_queues_endpoint`...
yoba_rabbitmq  | 2026-04-18 20:20:17.467478+00:00 [notice] <0.316.0> Feature flags: `detailed_queues_endpoint` enabled
yoba_rabbitmq  | 2026-04-18 20:20:17.467671+00:00 [notice] <0.316.0> Feature flags: attempt to enable `quorum_queue_non_voters`...
yoba_postgres  | 2026-04-18 20:20:17.594 UTC [74] FATAL:  database "yoba" does not exist
yoba_rabbitmq  | 2026-04-18 20:20:17.636640+00:00 [notice] <0.316.0> Feature flags: `quorum_queue_non_voters` enabled
yoba_rabbitmq  | 2026-04-18 20:20:17.636880+00:00 [notice] <0.316.0> Feature flags: attempt to enable `stream_update_config_command`...
yoba_rabbitmq  | 2026-04-18 20:20:17.771233+00:00 [notice] <0.316.0> Feature flags: `stream_update_config_command` enabled
yoba_rabbitmq  | 2026-04-18 20:20:17.771475+00:00 [notice] <0.316.0> Feature flags: attempt to enable `stream_filtering`...
yoba_rabbitmq  | 2026-04-18 20:20:17.891757+00:00 [notice] <0.316.0> Feature flags: `stream_filtering` enabled
yoba_rabbitmq  | 2026-04-18 20:20:17.891944+00:00 [notice] <0.316.0> Feature flags: attempt to enable `stream_sac_coordinator_unblock_group`...
yoba_rabbitmq  | 2026-04-18 20:20:18.081439+00:00 [notice] <0.316.0> Feature flags: `stream_sac_coordinator_unblock_group` enabled
yoba_rabbitmq  | 2026-04-18 20:20:18.081727+00:00 [notice] <0.316.0> Feature flags: attempt to enable `restart_streams`...
yoba_rabbitmq  | 2026-04-18 20:20:18.228078+00:00 [notice] <0.316.0> Feature flags: `restart_streams` enabled
yoba_rabbitmq  | 2026-04-18 20:20:18.228641+00:00 [notice] <0.316.0> Feature flags: attempt to enable `message_containers`...
yoba_rabbitmq  | 2026-04-18 20:20:18.414024+00:00 [notice] <0.316.0> Feature flags: `message_containers` enabled
yoba_rabbitmq  | 2026-04-18 20:20:18.414208+00:00 [notice] <0.316.0> Feature flags: attempt to enable `message_containers_deaths_v2`...
yoba_rabbitmq  | 2026-04-18 20:20:18.555925+00:00 [notice] <0.316.0> Feature flags: `message_containers_deaths_v2` enabled
yoba_rabbitmq  | 2026-04-18 20:20:18.556444+00:00 [info] <0.254.0> DB: virgin node -> run peer discovery
yoba_rabbitmq  | 2026-04-18 20:20:18.556585+00:00 [warning] <0.254.0> Classic peer discovery backend: list of nodes does not contain the local node []
yoba_rabbitmq  | 2026-04-18 20:20:18.592893+00:00 [notice] <0.44.0> Application mnesia exited with reason: stopped
yoba_rabbitmq  | 2026-04-18 20:20:18.928407+00:00 [info] <0.254.0> Waiting for Mnesia tables for 30000 ms, 9 retries left
yoba_rabbitmq  | 2026-04-18 20:20:18.928709+00:00 [info] <0.254.0> Successfully synced tables from a peer
yoba_rabbitmq  | 2026-04-18 20:20:18.928822+00:00 [info] <0.254.0> Waiting for Mnesia tables for 30000 ms, 9 retries left
yoba_rabbitmq  | 2026-04-18 20:20:18.928918+00:00 [info] <0.254.0> Successfully synced tables from a peer
yoba_rabbitmq  | 2026-04-18 20:20:18.937793+00:00 [info] <0.254.0> Waiting for Mnesia tables for 30000 ms, 9 retries left
yoba_rabbitmq  | 2026-04-18 20:20:18.938168+00:00 [info] <0.254.0> Successfully synced tables from a peer
yoba_rabbitmq  | 2026-04-18 20:20:18.938613+00:00 [info] <0.254.0> Running boot step tracking_metadata_store defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:18.940044+00:00 [info] <0.564.0> Setting up a table for connection tracking on this node: tracked_connection
yoba_rabbitmq  | 2026-04-18 20:20:18.941539+00:00 [info] <0.564.0> Setting up a table for per-vhost connection counting on this node: tracked_connection_per_vhost
yoba_rabbitmq  | 2026-04-18 20:20:18.941907+00:00 [info] <0.564.0> Setting up a table for per-user connection counting on this node: tracked_connection_per_user
yoba_rabbitmq  | 2026-04-18 20:20:18.942770+00:00 [info] <0.564.0> Setting up a table for channel tracking on this node: tracked_channel
yoba_rabbitmq  | 2026-04-18 20:20:18.943118+00:00 [info] <0.564.0> Setting up a table for channel tracking on this node: tracked_channel_per_user
yoba_rabbitmq  | 2026-04-18 20:20:18.943341+00:00 [info] <0.254.0> Running boot step networking_metadata_store defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:18.944468+00:00 [info] <0.254.0> Running boot step feature_flags defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:18.945441+00:00 [info] <0.254.0> Running boot step codec_correctness_check defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:18.945562+00:00 [info] <0.254.0> Running boot step external_infrastructure defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:18.945636+00:00 [info] <0.254.0> Running boot step rabbit_event defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:18.945924+00:00 [info] <0.254.0> Running boot step rabbit_registry defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:18.946040+00:00 [info] <0.254.0> Running boot step rabbit_auth_mechanism_amqplain defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:18.946191+00:00 [info] <0.254.0> Running boot step rabbit_auth_mechanism_cr_demo defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:18.946276+00:00 [info] <0.254.0> Running boot step rabbit_auth_mechanism_plain defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:18.946351+00:00 [info] <0.254.0> Running boot step rabbit_exchange_type_direct defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:18.946423+00:00 [info] <0.254.0> Running boot step rabbit_exchange_type_fanout defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:18.947223+00:00 [info] <0.254.0> Running boot step rabbit_exchange_type_headers defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:18.947387+00:00 [info] <0.254.0> Running boot step rabbit_exchange_type_topic defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:18.947486+00:00 [info] <0.254.0> Running boot step rabbit_mirror_queue_mode_all defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:18.947555+00:00 [info] <0.254.0> Running boot step rabbit_mirror_queue_mode_exactly defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:18.947653+00:00 [info] <0.254.0> Running boot step rabbit_mirror_queue_mode_nodes defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:18.947741+00:00 [info] <0.254.0> Running boot step rabbit_priority_queue defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:18.947783+00:00 [info] <0.254.0> Priority queues enabled, real BQ is rabbit_variable_queue
yoba_rabbitmq  | 2026-04-18 20:20:18.947958+00:00 [info] <0.254.0> Running boot step rabbit_queue_location_client_local defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:18.948245+00:00 [info] <0.254.0> Running boot step rabbit_queue_location_min_masters defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:18.948421+00:00 [info] <0.254.0> Running boot step rabbit_queue_location_random defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:18.948745+00:00 [info] <0.254.0> Running boot step kernel_ready defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:18.948878+00:00 [info] <0.254.0> Running boot step rabbit_sysmon_minder defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:18.949251+00:00 [info] <0.254.0> Running boot step rabbit_epmd_monitor defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:18.954794+00:00 [info] <0.572.0> epmd monitor knows us, inter-node communication (distribution) port: 25672
yoba_rabbitmq  | 2026-04-18 20:20:18.955291+00:00 [info] <0.254.0> Running boot step guid_generator defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:18.963701+00:00 [info] <0.254.0> Running boot step rabbit_node_monitor defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:18.964096+00:00 [info] <0.576.0> Starting rabbit_node_monitor (in ignore mode)
yoba_rabbitmq  | 2026-04-18 20:20:18.964762+00:00 [info] <0.254.0> Running boot step delegate_sup defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:18.966364+00:00 [info] <0.254.0> Running boot step rabbit_memory_monitor defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:18.966742+00:00 [info] <0.254.0> Running boot step rabbit_fifo_dlx_sup defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:18.967465+00:00 [info] <0.254.0> Running boot step core_initialized defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:18.967529+00:00 [info] <0.254.0> Running boot step rabbit_channel_tracking_handler defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:18.967755+00:00 [info] <0.254.0> Running boot step rabbit_connection_tracking_handler defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:18.967903+00:00 [info] <0.254.0> Running boot step rabbit_definitions_hashing defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:18.968083+00:00 [info] <0.254.0> Running boot step rabbit_exchange_parameters defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:19.061778+00:00 [info] <0.254.0> Running boot step rabbit_mirror_queue_misc defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:19.063184+00:00 [info] <0.254.0> Running boot step rabbit_policies defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:19.064272+00:00 [info] <0.254.0> Running boot step rabbit_policy defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:19.064506+00:00 [info] <0.254.0> Running boot step rabbit_queue_location_validator defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:19.064642+00:00 [info] <0.254.0> Running boot step rabbit_quorum_memory_manager defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:19.064734+00:00 [info] <0.254.0> Running boot step rabbit_quorum_queue defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:19.064950+00:00 [info] <0.254.0> Running boot step rabbit_stream_coordinator defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:19.065548+00:00 [info] <0.254.0> Running boot step rabbit_vhost_limit defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:19.065697+00:00 [info] <0.254.0> Running boot step rabbit_federation_parameters defined by app rabbitmq_federation
yoba_rabbitmq  | 2026-04-18 20:20:19.066355+00:00 [info] <0.254.0> Running boot step rabbit_federation_supervisor defined by app rabbitmq_federation
yoba_rabbitmq  | 2026-04-18 20:20:19.111113+00:00 [info] <0.254.0> Running boot step rabbit_federation_queue defined by app rabbitmq_federation
yoba_rabbitmq  | 2026-04-18 20:20:19.111490+00:00 [info] <0.254.0> Running boot step rabbit_federation_upstream_exchange defined by app rabbitmq_federation
yoba_rabbitmq  | 2026-04-18 20:20:19.111596+00:00 [info] <0.254.0> Running boot step rabbit_mgmt_reset_handler defined by app rabbitmq_management
yoba_rabbitmq  | 2026-04-18 20:20:19.111669+00:00 [info] <0.254.0> Running boot step rabbit_mgmt_db_handler defined by app rabbitmq_management_agent
yoba_rabbitmq  | 2026-04-18 20:20:19.111722+00:00 [info] <0.254.0> Management plugin: using rates mode 'basic'
yoba_rabbitmq  | 2026-04-18 20:20:19.112323+00:00 [info] <0.254.0> Running boot step recovery defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:19.178582+00:00 [info] <0.254.0> Running boot step empty_db_check defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:19.178676+00:00 [info] <0.254.0> Will seed default virtual host and user...
yoba_rabbitmq  | 2026-04-18 20:20:19.178788+00:00 [info] <0.254.0> Adding vhost 'yobaleema' (description: 'Default virtual host', tags: [])
yoba_rabbitmq  | 2026-04-18 20:20:19.230828+00:00 [info] <0.636.0> Making sure data directory '/var/lib/rabbitmq/mnesia/rabbit@207f07fd034e/msg_stores/vhosts/ESL7FFYNBPUB6JB5ANNK0VSE5' for vhost 'yobaleema' exists
yoba_rabbitmq  | 2026-04-18 20:20:19.237548+00:00 [info] <0.636.0> Setting segment_entry_count for vhost 'yobaleema' with 0 queues to '2048'
yoba_rabbitmq  | 2026-04-18 20:20:19.301605+00:00 [info] <0.636.0> Starting message stores for vhost 'yobaleema'
yoba_rabbitmq  | 2026-04-18 20:20:19.302443+00:00 [info] <0.645.0> Message store "ESL7FFYNBPUB6JB5ANNK0VSE5/msg_store_transient": using rabbit_msg_store_ets_index to provide index
yoba_rabbitmq  | 2026-04-18 20:20:19.307179+00:00 [info] <0.636.0> Started message store of type transient for vhost 'yobaleema'
yoba_rabbitmq  | 2026-04-18 20:20:19.307379+00:00 [info] <0.649.0> Message store "ESL7FFYNBPUB6JB5ANNK0VSE5/msg_store_persistent": using rabbit_msg_store_ets_index to provide index
yoba_rabbitmq  | 2026-04-18 20:20:19.307850+00:00 [warning] <0.649.0> Message store "ESL7FFYNBPUB6JB5ANNK0VSE5/msg_store_persistent": rebuilding indices from scratch
yoba_rabbitmq  | 2026-04-18 20:20:19.309925+00:00 [info] <0.636.0> Started message store of type persistent for vhost 'yobaleema'
yoba_rabbitmq  | 2026-04-18 20:20:19.324420+00:00 [info] <0.636.0> Recovering 0 queues of type rabbit_classic_queue took 84ms
yoba_rabbitmq  | 2026-04-18 20:20:19.324516+00:00 [info] <0.636.0> Recovering 0 queues of type rabbit_quorum_queue took 0ms
yoba_rabbitmq  | 2026-04-18 20:20:19.324686+00:00 [info] <0.636.0> Recovering 0 queues of type rabbit_stream_queue took 0ms
yoba_rabbitmq  | 2026-04-18 20:20:19.344375+00:00 [info] <0.254.0> Created user 'yoba'
yoba_rabbitmq  | 2026-04-18 20:20:19.355237+00:00 [info] <0.254.0> Successfully set user tags for user 'yoba' to [administrator]
yoba_rabbitmq  | 2026-04-18 20:20:19.363024+00:00 [info] <0.254.0> Successfully set permissions for user 'yoba' in virtual host 'yobaleema' to '.*', '.*', '.*'
yoba_rabbitmq  | 2026-04-18 20:20:19.363473+00:00 [info] <0.254.0> Running boot step rabbit_observer_cli defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:19.363665+00:00 [info] <0.254.0> Running boot step rabbit_looking_glass defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:19.363811+00:00 [info] <0.254.0> Running boot step rabbit_core_metrics_gc defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:19.365487+00:00 [info] <0.254.0> Running boot step background_gc defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:19.365732+00:00 [info] <0.254.0> Running boot step routing_ready defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:19.365781+00:00 [info] <0.254.0> Running boot step pre_flight defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:19.365832+00:00 [info] <0.254.0> Running boot step notify_cluster defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:19.365931+00:00 [info] <0.254.0> Running boot step networking defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:19.366006+00:00 [info] <0.254.0> Running boot step rabbit_quorum_queue_periodic_membership_reconciliation defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:19.366160+00:00 [info] <0.254.0> Running boot step definition_import_worker_pool defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:19.366474+00:00 [info] <0.315.0> Starting worker pool 'definition_import_pool' with 8 processes in it
yoba_rabbitmq  | 2026-04-18 20:20:19.367496+00:00 [info] <0.254.0> Running boot step cluster_name defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:19.371421+00:00 [info] <0.254.0> Initialising internal cluster ID to 'rabbitmq-cluster-id-s6oLCiYg-n65xoxfD3zamA'
yoba_rabbitmq  | 2026-04-18 20:20:19.385279+00:00 [info] <0.254.0> Running boot step virtual_host_reconciliation defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:19.385623+00:00 [info] <0.254.0> Running boot step direct_client defined by app rabbit
yoba_rabbitmq  | 2026-04-18 20:20:19.385731+00:00 [info] <0.254.0> Running boot step rabbit_federation_exchange defined by app rabbitmq_federation
yoba_rabbitmq  | 2026-04-18 20:20:19.385946+00:00 [info] <0.254.0> Running boot step rabbit_management_load_definitions defined by app rabbitmq_management
yoba_rabbitmq  | 2026-04-18 20:20:19.386150+00:00 [info] <0.690.0> Resetting node maintenance status
yoba_notifs    | [Notif] DB initialisée
yoba_rabbitmq  | 2026-04-18 20:20:20.146276+00:00 [warning] <0.719.0> Deprecated features: `management_metrics_collection`: Feature `management_metrics_collection` is deprecated.
yoba_rabbitmq  | 2026-04-18 20:20:20.146276+00:00 [warning] <0.719.0> By default, this feature can still be used for now.
yoba_rabbitmq  | 2026-04-18 20:20:20.146276+00:00 [warning] <0.719.0> Its use will not be permitted by default in a future minor RabbitMQ version and the feature will be removed from a future major RabbitMQ version; actual versions to be determined.
yoba_rabbitmq  | 2026-04-18 20:20:20.146276+00:00 [warning] <0.719.0> To continue using this feature when it is not permitted by default, set the following parameter in your configuration:
yoba_rabbitmq  | 2026-04-18 20:20:20.146276+00:00 [warning] <0.719.0>     "deprecated_features.permit.management_metrics_collection = true"
yoba_rabbitmq  | 2026-04-18 20:20:20.146276+00:00 [warning] <0.719.0> To test RabbitMQ as if the feature was removed, set this in your configuration:
yoba_rabbitmq  | 2026-04-18 20:20:20.146276+00:00 [warning] <0.719.0>     "deprecated_features.permit.management_metrics_collection = false"
yoba_matching  | [Matching] DB initialisée
yoba_notifs    | [Notif] RabbitMQ 1/10: connect ECONNREFUSED 172.18.0.2:5672
yoba_matching  | [Matching] RabbitMQ 1/10: connect ECONNREFUSED 172.18.0.2:5672
yoba_trips     | [Trip] DB initialisée
yoba_trips     | [Trip] RabbitMQ 1/10: connect ECONNREFUSED 172.18.0.2:5672
yoba_users     | [User] DB initialisée
yoba_parcels   | [Parcel] DB initialisée
yoba_users     | [User] RabbitMQ tentative 1/10: connect ECONNREFUSED 172.18.0.2:5672
yoba_parcels   | [Parcel] RabbitMQ 1/10: connect ECONNREFUSED 172.18.0.2:5672
yoba_auth      | [Auth] DB initialisée
yoba_auth      | [Auth] RabbitMQ tentative 1/10: connect ECONNREFUSED 172.18.0.2:5672
yoba_postgres  | 2026-04-18 20:20:22.658 UTC [87] FATAL:  database "yoba" does not exist
yoba_notifs    | [Notif] RabbitMQ 2/10: connect ECONNREFUSED 172.18.0.2:5672
yoba_matching  | [Matching] RabbitMQ 2/10: connect ECONNREFUSED 172.18.0.2:5672
yoba_trips     | [Trip] RabbitMQ 2/10: connect ECONNREFUSED 172.18.0.2:5672
yoba_gateway   | [GW] GET /health → 200 (74ms)
yoba_users     | [User] RabbitMQ tentative 2/10: connect ECONNREFUSED 172.18.0.2:5672
yoba_parcels   | [Parcel] RabbitMQ 2/10: connect ECONNREFUSED 172.18.0.2:5672
yoba_auth      | [Auth] RabbitMQ tentative 2/10: connect ECONNREFUSED 172.18.0.2:5672
yoba_rabbitmq  | 2026-04-18 20:20:25.977051+00:00 [info] <0.756.0> Management plugin: HTTP (non-TLS) listener started on port 15672
yoba_rabbitmq  | 2026-04-18 20:20:25.977541+00:00 [info] <0.786.0> Statistics database started.
yoba_rabbitmq  | 2026-04-18 20:20:25.977786+00:00 [info] <0.785.0> Starting worker pool 'management_worker_pool' with 3 processes in it
yoba_rabbitmq  | 2026-04-18 20:20:25.994840+00:00 [info] <0.804.0> Prometheus metrics: HTTP (non-TLS) listener started on port 15692
yoba_rabbitmq  | 2026-04-18 20:20:25.995125+00:00 [info] <0.690.0> Ready to start client connection listeners
yoba_rabbitmq  | 2026-04-18 20:20:25.999432+00:00 [info] <0.848.0> started TCP listener on [::]:5672
yoba_rabbitmq  |  completed with 5 plugins.
yoba_rabbitmq  | 2026-04-18 20:20:26.170541+00:00 [info] <0.690.0> Server startup complete; 5 plugins started.
yoba_rabbitmq  | 2026-04-18 20:20:26.170541+00:00 [info] <0.690.0>  * rabbitmq_prometheus
yoba_rabbitmq  | 2026-04-18 20:20:26.170541+00:00 [info] <0.690.0>  * rabbitmq_federation
yoba_rabbitmq  | 2026-04-18 20:20:26.170541+00:00 [info] <0.690.0>  * rabbitmq_management
yoba_rabbitmq  | 2026-04-18 20:20:26.170541+00:00 [info] <0.690.0>  * rabbitmq_management_agent
yoba_rabbitmq  | 2026-04-18 20:20:26.170541+00:00 [info] <0.690.0>  * rabbitmq_web_dispatch
yoba_rabbitmq  | 2026-04-18 20:20:26.171710+00:00 [info] <0.852.0> accepting AMQP connection <0.852.0> (172.18.0.8:33458 -> 172.18.0.2:5672)
yoba_rabbitmq  | 2026-04-18 20:20:26.180680+00:00 [info] <0.856.0> accepting AMQP connection <0.856.0> (172.18.0.7:58028 -> 172.18.0.2:5672)
yoba_rabbitmq  | 2026-04-18 20:20:26.203503+00:00 [info] <0.865.0> accepting AMQP connection <0.865.0> (172.18.0.9:45978 -> 172.18.0.2:5672)
yoba_rabbitmq  | 2026-04-18 20:20:26.223546+00:00 [info] <0.852.0> connection <0.852.0> (172.18.0.8:33458 -> 172.18.0.2:5672): user 'yoba' authenticated and granted access to vhost 'yobaleema'
yoba_rabbitmq  | 2026-04-18 20:20:26.230309+00:00 [info] <0.856.0> connection <0.856.0> (172.18.0.7:58028 -> 172.18.0.2:5672): user 'yoba' authenticated and granted access to vhost 'yobaleema'
yoba_rabbitmq  | 2026-04-18 20:20:26.237702+00:00 [info] <0.9.0> Time to start RabbitMQ: 17948 ms
yoba_rabbitmq  | 2026-04-18 20:20:26.251443+00:00 [info] <0.865.0> connection <0.865.0> (172.18.0.9:45978 -> 172.18.0.2:5672): user 'yoba' authenticated and granted access to vhost 'yobaleema'
yoba_trips     | [Trip] RabbitMQ connecté
yoba_matching  | [Matching] RabbitMQ connecté
yoba_matching  | [Matching] 🎯 Démarré sur le port 4005
yoba_trips     | [Trip] 🗺  Démarré sur le port 4004
yoba_rabbitmq  | 2026-04-18 20:20:26.280344+00:00 [info] <0.925.0> accepting AMQP connection <0.925.0> (172.18.0.11:42726 -> 172.18.0.2:5672)
yoba_rabbitmq  | 2026-04-18 20:20:26.285670+00:00 [info] <0.929.0> accepting AMQP connection <0.929.0> (172.18.0.12:46118 -> 172.18.0.2:5672)
yoba_rabbitmq  | 2026-04-18 20:20:26.293498+00:00 [info] <0.933.0> accepting AMQP connection <0.933.0> (172.18.0.10:54944 -> 172.18.0.2:5672)
yoba_notifs    | [Notif] RabbitMQ connecté — en écoute de 7 événements
yoba_rabbitmq  | 2026-04-18 20:20:26.334427+00:00 [info] <0.925.0> connection <0.925.0> (172.18.0.11:42726 -> 172.18.0.2:5672): user 'yoba' authenticated and granted access to vhost 'yobaleema'
yoba_rabbitmq  | 2026-04-18 20:20:26.336884+00:00 [info] <0.929.0> connection <0.929.0> (172.18.0.12:46118 -> 172.18.0.2:5672): user 'yoba' authenticated and granted access to vhost 'yobaleema'
yoba_notifs    | [Notif] 🔔 Démarré sur le port 4006
yoba_parcels   | [Parcel] RabbitMQ connecté
yoba_rabbitmq  | 2026-04-18 20:20:26.345585+00:00 [info] <0.933.0> connection <0.933.0> (172.18.0.10:54944 -> 172.18.0.2:5672): user 'yoba' authenticated and granted access to vhost 'yobaleema'
yoba_parcels   | [Parcel] 📦 Démarré sur le port 4003
yoba_auth      | [Auth] RabbitMQ connecté
yoba_users     | [User] RabbitMQ connecté
yoba_auth      | [Auth] 🔐 Démarré sur le port 4001
yoba_users     | [User] 👤 Démarré sur le port 4002
yoba_postgres  | 2026-04-18 20:20:27.726 UTC [94] FATAL:  database "yoba" does not exist
yoba_postgres  | 2026-04-18 20:20:32.789 UTC [101] FATAL:  database "yoba" does not exist
yoba_matching  | [Matching] GET /health → 200 (6ms)
yoba_parcels   | [Parcel] GET /health → 200 (8ms)
yoba_trips     | [Trip] GET /health → 200 (8ms)
yoba_notifs    | [Notif] GET /health → 200 (8ms)
yoba_auth      | [Auth] GET /health → 200 (11ms)
yoba_users     | [User] GET /health → 200 (12ms)
yoba_gateway   | [GW] GET /health → 200 (52ms)
yoba_postgres  | 2026-04-18 20:20:37.852 UTC [108] FATAL:  database "yoba" does not exist
yoba_postgres  | 2026-04-18 20:20:42.993 UTC [116] FATAL:  database "yoba" does not exist
yoba_auth      | [Auth] GET /health → 200 (3ms)
yoba_users     | [User] GET /health → 200 (1ms)
yoba_matching  | [Matching] GET /health → 200 (1ms)
yoba_parcels   | [Parcel] GET /health → 200 (2ms)
yoba_trips     | [Trip] GET /health → 200 (2ms)
yoba_notifs    | [Notif] GET /health → 200 (4ms)
yoba_gateway   | [GW] GET /health → 200 (35ms)
yoba_postgres  | 2026-04-18 20:20:48.062 UTC [124] FATAL:  database "yoba" does not exist
yoba_postgres  | 2026-04-18 20:20:53.126 UTC [131] FATAL:  database "yoba" does not exist
yoba_parcels   | [Parcel] GET /health → 200 (0ms)
yoba_notifs    | [Notif] GET /health → 200 (1ms)
yoba_matching  | [Matching] GET /health → 200 (1ms)
yoba_trips     | [Trip] GET /health → 200 (2ms)
yoba_auth      | [Auth] GET /health → 200 (0ms)
yoba_users     | [User] GET /health → 200 (0ms)
yoba_gateway   | [GW] GET /health → 200 (14ms)
yoba_postgres  | 2026-04-18 20:20:58.190 UTC [139] FATAL:  database "yoba" does not exist
yoba_frontend exited with code 0
yoba_postgres  | 2026-04-18 20:21:03.251 UTC [147] FATAL:  database "yoba" does not exist
yoba_users     | [User] GET /health → 200 (1ms)
yoba_trips     | [Trip] GET /health → 200 (1ms)
yoba_parcels   | [Parcel] GET /health → 200 (1ms)
yoba_matching  | [Matching] GET /health → 200 (1ms)
yoba_auth      | [Auth] GET /health → 200 (0ms)
yoba_notifs    | [Notif] GET /health → 200 (1ms)
yoba_gateway   | [GW] GET /health → 200 (21ms)
yoba_postgres  | 2026-04-18 20:21:08.314 UTC [154] FATAL:  database "yoba" does not exist
yoba_rabbitmq  | 2026-04-18 20:21:09.472344+00:00 [warning] <0.865.0> closing AMQP connection <0.865.0> (172.18.0.9:45978 -> 172.18.0.2:5672, vhost: 'yobaleema', user: 'yoba'):
yoba_rabbitmq  | 2026-04-18 20:21:09.472344+00:00 [warning] <0.865.0> client unexpectedly closed TCP connection
yoba_rabbitmq  | 2026-04-18 20:21:09.474486+00:00 [warning] <0.925.0> closing AMQP connection <0.925.0> (172.18.0.11:42726 -> 172.18.0.2:5672, vhost: 'yobaleema', user: 'yoba'):
yoba_rabbitmq  | 2026-04-18 20:21:09.474486+00:00 [warning] <0.925.0> client unexpectedly closed TCP connection
yoba_rabbitmq  | 2026-04-18 20:21:09.475329+00:00 [warning] <0.852.0> closing AMQP connection <0.852.0> (172.18.0.8:33458 -> 172.18.0.2:5672, vhost: 'yobaleema', user: 'yoba'):
yoba_rabbitmq  | 2026-04-18 20:21:09.475329+00:00 [warning] <0.852.0> client unexpectedly closed TCP connection
yoba_rabbitmq  | 2026-04-18 20:21:09.476072+00:00 [warning] <0.933.0> closing AMQP connection <0.933.0> (172.18.0.10:54944 -> 172.18.0.2:5672, vhost: 'yobaleema', user: 'yoba'):
yoba_rabbitmq  | 2026-04-18 20:21:09.476072+00:00 [warning] <0.933.0> client unexpectedly closed TCP connection
yoba_rabbitmq  | 2026-04-18 20:21:09.478081+00:00 [warning] <0.856.0> closing AMQP connection <0.856.0> (172.18.0.7:58028 -> 172.18.0.2:5672, vhost: 'yobaleema', user: 'yoba'):
yoba_rabbitmq  | 2026-04-18 20:21:09.478081+00:00 [warning] <0.856.0> client unexpectedly closed TCP connection
yoba_rabbitmq  | 2026-04-18 20:21:09.478454+00:00 [warning] <0.929.0> closing AMQP connection <0.929.0> (172.18.0.12:46118 -> 172.18.0.2:5672, vhost: 'yobaleema', user: 'yoba'):
yoba_rabbitmq  | 2026-04-18 20:21:09.478454+00:00 [warning] <0.929.0> client unexpectedly closed TCP connection
yoba_postgres  | 2026-04-18 20:21:09.999 UTC [1] LOG:  received fast shutdown request
yoba_trips exited with code 137
yoba_rabbitmq  | 2026-04-18 20:21:10.003861+00:00 [notice] <0.64.0> SIGTERM received - shutting down
yoba_rabbitmq  | 2026-04-18 20:21:10.003861+00:00 [notice] <0.64.0> 
yoba_postgres  | 2026-04-18 20:21:10.007 UTC [1] LOG:  aborting any active transactions
yoba_postgres  | 2026-04-18 20:21:10.012 UTC [1] LOG:  background worker "logical replication launcher" (PID 60) exited with exit code 1
yoba_rabbitmq  | 2026-04-18 20:21:10.012620+00:00 [warning] <0.712.0> HTTP listener registry could not find context rabbitmq_prometheus_tls
yoba_postgres  | 2026-04-18 20:21:10.016 UTC [55] LOG:  shutting down
yoba_postgres  | 2026-04-18 20:21:10.019 UTC [55] LOG:  checkpoint starting: shutdown immediate
yoba_rabbitmq  | 2026-04-18 20:21:10.029661+00:00 [warning] <0.712.0> HTTP listener registry could not find context rabbitmq_management_tls
yoba_auth exited with code 137
yoba_redis     | 1:signal-handler (1776543670) Received SIGTERM scheduling shutdown...
yoba_notifs exited with code 137
yoba_users exited with code 137
yoba_matching exited with code 137
yoba_rabbitmq  | 2026-04-18 20:21:10.089447+00:00 [info] <0.848.0> stopped TCP listener on [::]:5672
yoba_rabbitmq  | 2026-04-18 20:21:10.093812+00:00 [info] <0.636.0> Virtual host 'yobaleema' is stopping
yoba_rabbitmq  | 2026-04-18 20:21:10.094082+00:00 [info] <0.1029.0> Closing all connections in vhost 'yobaleema' on node 'rabbit@207f07fd034e' because the vhost is stopping
yoba_parcels exited with code 137
yoba_rabbitmq  | 2026-04-18 20:21:10.106703+00:00 [info] <0.649.0> Stopping message store for directory '/var/lib/rabbitmq/mnesia/rabbit@207f07fd034e/msg_stores/vhosts/ESL7FFYNBPUB6JB5ANNK0VSE5/msg_store_persistent'
yoba_redis     | 1:M 18 Apr 2026 20:21:10.111 # Redis is now ready to exit, bye bye...
yoba_gateway exited with code 137
yoba_rabbitmq  | 2026-04-18 20:21:10.126308+00:00 [info] <0.649.0> Message store for directory '/var/lib/rabbitmq/mnesia/rabbit@207f07fd034e/msg_stores/vhosts/ESL7FFYNBPUB6JB5ANNK0VSE5/msg_store_persistent' is stopped
yoba_rabbitmq  | 2026-04-18 20:21:10.126560+00:00 [info] <0.645.0> Stopping message store for directory '/var/lib/rabbitmq/mnesia/rabbit@207f07fd034e/msg_stores/vhosts/ESL7FFYNBPUB6JB5ANNK0VSE5/msg_store_transient'
yoba_rabbitmq  | 2026-04-18 20:21:10.142352+00:00 [info] <0.645.0> Message store for directory '/var/lib/rabbitmq/mnesia/rabbit@207f07fd034e/msg_stores/vhosts/ESL7FFYNBPUB6JB5ANNK0VSE5/msg_store_transient' is stopped
yoba_postgres  | 2026-04-18 20:21:10.183 UTC [55] LOG:  checkpoint complete: wrote 318 buffers (1.9%); 0 WAL file(s) added, 0 removed, 0 recycled; write=0.016 s, sync=0.128 s, total=0.168 s; sync files=266, longest=0.012 s, average=0.001 s; distance=1231 kB, estimate=1231 kB; lsn=0/2F2E438, redo lsn=0/2F2E438
yoba_postgres  | 2026-04-18 20:21:10.191 UTC [1] LOG:  database system is shut down
yoba_redis exited with code 0
yoba_postgres exited with code 0
yoba_rabbitmq exited with code 0