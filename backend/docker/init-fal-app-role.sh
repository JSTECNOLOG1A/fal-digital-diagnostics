#!/bin/sh
# Cria role de runtime sem BYPASSRLS (ISO least privilege).
# Usado so na primeira inicializacao do volume Postgres (imagem alpine = sem bash).
set -eu

APP_PASS="${FAL_APP_PASSWORD:?FAL_APP_PASSWORD e obrigatorio}"
DB_NAME="${POSTGRES_DB:-fal}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$DB_NAME" \
  -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'fal_app') THEN CREATE ROLE fal_app LOGIN PASSWORD '${APP_PASS}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT; ELSE ALTER ROLE fal_app WITH LOGIN PASSWORD '${APP_PASS}'; END IF; END \$\$;"
