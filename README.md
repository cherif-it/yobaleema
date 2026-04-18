# Yobaleema — Frontend React

Application React (Vite + Tailwind + Framer Motion + Zustand + React Query)
pour la plateforme de covoiturage de colis **Yobaleema**.

---

## 🚀 Démarrage rapide

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer les variables d'environnement
cp .env.example .env
# Modifier VITE_API_URL si besoin

# 3. Lancer en développement
npm run dev
# → http://localhost:3000
```

---

## 📁 Structure du projet

```
src/
├── components/
│   ├── layout/
│   │   ├── Layout.jsx          # Wrapper global (Navbar + Outlet + Footer)
│   │   ├── Navbar.jsx          # Navigation responsive + menu utilisateur
│   │   ├── Footer.jsx          # Pied de page complet
│   │   └── ProtectedRoute.jsx  # Guard pour les routes authentifiées
│   ├── sections/
│   │   ├── HeroSection.jsx     # Hero avec route SVG animée
│   │   └── index.jsx           # TrustBar, HowItWorks, Features, Pricing, Testimonials, CTA
│   └── ui/
│       ├── YobaleemaLogo.jsx   # Logo SVG fidèle (3 variantes : dark/light/mono)
│       └── Reveal.jsx          # Animation scroll avec Framer Motion
│
├── pages/
│   ├── HomePage.jsx            # Assemblage des sections
│   ├── LoginPage.jsx           # Connexion (split panel)
│   ├── RegisterPage.jsx        # Inscription (avec choix de rôle)
│   ├── DashboardPage.jsx       # Dashboard (colis / trajets / revenus)
│   ├── SendParcelPage.jsx      # Formulaire multi-étapes envoi colis
│   ├── OfferTripPage.jsx       # Formulaire proposition de trajet
│   ├── SearchPage.jsx          # Recherche de trajets publics
│   ├── ParcelDetailPage.jsx    # Détail colis + matchings + QR codes
│   └── NotFoundPage.jsx        # Page 404
│
├── store/
│   └── authStore.js            # Zustand : auth, login, logout, refresh
│
├── services/
│   └── api.js                  # Axios + intercepteurs JWT + fonctions par domaine
│
├── hooks/
│   └── useScrollReveal.js      # IntersectionObserver hook
│
└── styles/
    └── index.css               # Tailwind + variables CSS + classes custom
```

---

## 🎨 Identité visuelle

La palette et la typographie sont fidèles au logo **Yobaleema** :

| Token | Valeur | Usage |
|-------|--------|-------|
| `--brown` | `#8B3A00` | Couleur principale |
| `--brown-mid` | `#A34800` | Hover boutons |
| `--brown-light` | `#C8630A` | Accent, liens |
| `--brown-pale` | `#F0D5B8` | Fonds clairs |
| `--brown-ultra` | `#FAF0E6` | Fonds très clairs |
| `--gray-bg` | `#E8E6E2` | Fond global |
| `--charcoal` | `#1E1C1A` | Texte principal |
| Font display | Barlow Condensed 800 | Titres uppercase |
| Font body | Barlow 300–600 | Corps de texte |

---

## 🔌 Variables d'environnement

```env
# .env
VITE_API_URL=http://localhost:4000    # URL de l'API Gateway
VITE_WS_URL=ws://localhost:4000       # URL WebSocket (géolocalisation)
VITE_STRIPE_PK=pk_test_xxx            # Clé publique Stripe (si intégration paiement)
```

---

## 📦 Dépendances principales

| Package | Rôle |
|---------|------|
| React 18 + Vite | Framework + bundler |
| React Router v6 | Routing SPA |
| Zustand | Store global (auth) |
| React Query v5 | Fetching, cache, états serveur |
| Framer Motion | Animations (scroll reveal, transitions de page) |
| React Hook Form + Zod | Formulaires + validation |
| Axios | HTTP client + intercepteurs JWT |
| Tailwind CSS v3 | Utilitaires CSS |
| Lucide React | Icônes |
| Socket.io-client | WebSocket temps réel (géoloc) |

---

## 🗺️ Routes

| Route | Page | Auth |
|-------|------|------|
| `/` | HomePage | ✗ |
| `/connexion` | LoginPage | ✗ |
| `/inscription` | RegisterPage | ✗ |
| `/recherche` | SearchPage | ✗ |
| `/dashboard` | DashboardPage | ✓ |
| `/envoyer` | SendParcelPage | ✓ |
| `/proposer-trajet` | OfferTripPage | ✓ |
| `/colis/:id` | ParcelDetailPage | ✓ |

---

## 🔧 Scripts

```bash
npm run dev      # Développement (HMR)
npm run build    # Build production
npm run preview  # Prévisualiser le build
npm run lint     # Linter ESLint
```

---

## 🔗 Backend requis

Ce frontend s'attend à un backend disponible sur `VITE_API_URL` (défaut `/api`).
Voir le dossier `../services/` pour les microservices Node.js correspondants.

Architecture attendue :
- `POST /api/auth/login` — Connexion
- `POST /api/auth/register` — Inscription
- `GET /api/parcels` — Liste des colis
- `POST /api/parcels` — Créer un colis
- `GET /api/trips` — Liste des trajets
- `POST /api/trips` — Créer un trajet
- `GET /api/matching/:parcelId` — Matchings pour un colis

---

## 📱 Pages à venir

- `ProfilePage` — Édition du profil, notes reçues
- `MessagesPage` — Messagerie in-app
- `PaymentPage` — Intégration Stripe Elements
- `NotificationsPage` — Centre de notifications
