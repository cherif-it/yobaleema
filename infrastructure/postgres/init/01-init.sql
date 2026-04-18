-- ================================================================
--  Yobaleema — Init PostgreSQL
--  Crée une base dédiée par microservice
--  Exécuté automatiquement au premier démarrage du container
-- ================================================================

-- Bases de données (une par service)
CREATE DATABASE yoba_auth;
CREATE DATABASE yoba_users;
CREATE DATABASE yoba_parcels;
CREATE DATABASE yoba_trips;
CREATE DATABASE yoba_matching;
CREATE DATABASE yoba_notifications;

-- ================================================================
--  SCHEMA : yoba_auth
-- ================================================================
\connect yoba_auth

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users_auth (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'both'
                  CHECK (role IN ('sender','carrier','both','admin')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users_auth(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auth_email    ON users_auth(email);
CREATE INDEX idx_rt_user       ON refresh_tokens(user_id);
CREATE INDEX idx_rt_hash       ON refresh_tokens(token_hash);

-- ================================================================
--  SCHEMA : yoba_users
-- ================================================================
\connect yoba_users

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS profiles (
  id           UUID PRIMARY KEY,        -- Même ID que users_auth
  email        VARCHAR(255) NOT NULL,
  first_name   VARCHAR(100) NOT NULL,
  last_name    VARCHAR(100) NOT NULL,
  phone        VARCHAR(30),
  avatar_url   TEXT,
  role         VARCHAR(20) NOT NULL DEFAULT 'both',
  kyc_status   VARCHAR(20) NOT NULL DEFAULT 'pending'
                 CHECK (kyc_status IN ('pending','submitted','approved','rejected')),
  rating_avg   DECIMAL(3,2) NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  stripe_account_id VARCHAR(100),
  bio          TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parcel_id   UUID NOT NULL,
  reviewer_id UUID NOT NULL REFERENCES profiles(id),
  reviewee_id UUID NOT NULL REFERENCES profiles(id),
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  reviewer_role VARCHAR(10) NOT NULL CHECK (reviewer_role IN ('sender','carrier')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (parcel_id, reviewer_id)
);

CREATE INDEX idx_profiles_id      ON profiles(id);
CREATE INDEX idx_reviews_reviewee ON reviews(reviewee_id);

-- ================================================================
--  SCHEMA : yoba_parcels
-- ================================================================
\connect yoba_parcels

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS parcels (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  status           VARCHAR(30) NOT NULL DEFAULT 'pending'
                     CHECK (status IN (
                       'pending','matched','accepted','picked_up',
                       'in_transit','delivered','confirmed','disputed','cancelled'
                     )),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_parcels_sender ON parcels(sender_id);
CREATE INDEX idx_parcels_status ON parcels(status);
CREATE INDEX idx_parcels_trip   ON parcels(trip_id);

-- ================================================================
--  SCHEMA : yoba_trips
-- ================================================================
\connect yoba_trips

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS trips (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  status               VARCHAR(20) NOT NULL DEFAULT 'open'
                         CHECK (status IN ('open','full','in_progress','completed','cancelled')),
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trips_carrier    ON trips(carrier_id);
CREATE INDEX idx_trips_status     ON trips(status);
CREATE INDEX idx_trips_departure  ON trips(departure_at);

-- ================================================================
--  SCHEMA : yoba_matching  (cache des matchs calculés)
-- ================================================================
\connect yoba_matching

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS match_results (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parcel_id   UUID NOT NULL,
  trip_id     UUID NOT NULL,
  carrier_id  UUID NOT NULL,
  score       SMALLINT NOT NULL,
  detour_pct  SMALLINT NOT NULL,
  price_suggested DECIMAL(10,2) NOT NULL,
  dist_km     DECIMAL(8,2),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (parcel_id, trip_id)
);

CREATE INDEX idx_match_parcel ON match_results(parcel_id);

-- ================================================================
--  SCHEMA : yoba_notifications
-- ================================================================
\connect yoba_notifications

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parcel_id   UUID NOT NULL,
  sender_id   UUID NOT NULL,
  receiver_id UUID NOT NULL,
  content     TEXT NOT NULL,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL,
  type        VARCHAR(50) NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  read_at     TIMESTAMPTZ,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_parcel     ON messages(parcel_id);
CREATE INDEX idx_messages_receiver   ON messages(receiver_id);
CREATE INDEX idx_notifs_user         ON notifications(user_id);
CREATE INDEX idx_notifs_read         ON notifications(user_id, read_at);
