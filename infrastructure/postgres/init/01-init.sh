#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE yoba_auth;
    CREATE DATABASE yoba_users;
    CREATE DATABASE yoba_parcels;
    CREATE DATABASE yoba_trips;
    CREATE DATABASE yoba_matching;
    CREATE DATABASE yoba_notifications;
EOSQL

#-- ========================version .sql========================================
#--  Yobaleema — Init PostgreSQL 
#--  Crée une base dédiée par microservice (IF NOT EXISTS safe)
#-- ================================================================

#-- Créer les bases si elles n'existent pas déjà
#SELECT 'CREATE DATABASE yoba_auth'        WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'yoba_auth')\gexec
#SELECT 'CREATE DATABASE yoba_users'       WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'yoba_users')\gexec
#SELECT 'CREATE DATABASE yoba_parcels'     WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'yoba_parcels')\gexec
#SELECT 'CREATE DATABASE yoba_trips'       WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'yoba_trips')\gexec
#SELECT 'CREATE DATABASE yoba_matching'    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'yoba_matching')\gexec
#SELECT 'CREATE DATABASE yoba_notifications' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'yoba_notifications')\gexec
