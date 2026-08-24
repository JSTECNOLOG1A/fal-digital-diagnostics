CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "AppRole" AS ENUM ('hq_admin', 'tenant_admin', 'consultant', 'client_viewer');

-- CreateEnum
CREATE TYPE "AccessStatus" AS ENUM ('active', 'invited', 'revoked', 'suspended');

-- CreateEnum
CREATE TYPE "SyncJobStatus" AS ENUM ('pending', 'running', 'succeeded', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "AppRole" NOT NULL DEFAULT 'consultant',
    "tenant_id" UUID,
    "client_id" UUID,
    "access_status" "AccessStatus" NOT NULL DEFAULT 'active',
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");
CREATE INDEX "users_role_idx" ON "users"("role");

CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_agent" TEXT,
    "ip_address" TEXT,
    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at");
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

CREATE TABLE "user_invites" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "AppRole" NOT NULL,
    "client_id" UUID,
    "invited_by_id" UUID,
    "status" "AccessStatus" NOT NULL DEFAULT 'invited',
    "temporary_password" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_invites_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_invites_tenant_id_email_idx" ON "user_invites"("tenant_id", "email");

CREATE TABLE "groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "groups_tenant_id_idx" ON "groups"("tenant_id");

CREATE TABLE "companies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "cnpj" TEXT,
    "sector" TEXT,
    "erp_system" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "companies_tenant_id_idx" ON "companies"("tenant_id");
CREATE INDEX "companies_group_id_idx" ON "companies"("group_id");

CREATE TABLE "operational_units" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "operational_units_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "operational_units_tenant_id_idx" ON "operational_units"("tenant_id");
CREATE INDEX "operational_units_company_id_idx" ON "operational_units"("company_id");

CREATE TABLE "protheus_connections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "base_url" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "encrypted_password" TEXT NOT NULL,
    "company_code" TEXT NOT NULL,
    "branch_code" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "protheus_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "protheus_connections_tenant_id_key" ON "protheus_connections"("tenant_id");

CREATE TABLE "protheus_sync_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "resource" TEXT NOT NULL,
    "status" "SyncJobStatus" NOT NULL DEFAULT 'pending',
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "error_message" TEXT,
    "stats" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "protheus_sync_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "protheus_sync_jobs_tenant_id_status_idx" ON "protheus_sync_jobs"("tenant_id", "status");

CREATE TABLE "protheus_staging_rows" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "resource" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "protheus_staging_rows_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "protheus_staging_rows_tenant_id_resource_idx" ON "protheus_staging_rows"("tenant_id", "resource");
CREATE UNIQUE INDEX "protheus_staging_rows_tenant_id_resource_external_id_job_id_key" ON "protheus_staging_rows"("tenant_id", "resource", "external_id", "job_id");

-- FKs
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_invites" ADD CONSTRAINT "user_invites_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_invites" ADD CONSTRAINT "user_invites_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "groups" ADD CONSTRAINT "groups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "companies" ADD CONSTRAINT "companies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "companies" ADD CONSTRAINT "companies_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operational_units" ADD CONSTRAINT "operational_units_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operational_units" ADD CONSTRAINT "operational_units_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "protheus_connections" ADD CONSTRAINT "protheus_connections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "protheus_sync_jobs" ADD CONSTRAINT "protheus_sync_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "protheus_sync_jobs" ADD CONSTRAINT "protheus_sync_jobs_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "protheus_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "protheus_staging_rows" ADD CONSTRAINT "protheus_staging_rows_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "protheus_staging_rows" ADD CONSTRAINT "protheus_staging_rows_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "protheus_sync_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: tenant isolation (defense in depth). App sets:
--   SELECT set_config('app.tenant_id', '<uuid>', true);
--   SELECT set_config('app.is_hq', 'true'|'false', true);
ALTER TABLE "groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "operational_units" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_invites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "protheus_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "protheus_sync_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "protheus_staging_rows" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION app_is_hq() RETURNS boolean AS $$
  SELECT coalesce(current_setting('app.is_hq', true), 'false') = 'true';
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_tenant_id() RETURNS text AS $$
  SELECT coalesce(current_setting('app.tenant_id', true), '');
$$ LANGUAGE sql STABLE;

CREATE POLICY tenant_isolation_groups ON "groups"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());

CREATE POLICY tenant_isolation_companies ON "companies"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());

CREATE POLICY tenant_isolation_units ON "operational_units"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());

CREATE POLICY tenant_isolation_invites ON "user_invites"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());

CREATE POLICY tenant_isolation_protheus_conn ON "protheus_connections"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());

CREATE POLICY tenant_isolation_protheus_jobs ON "protheus_sync_jobs"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());

CREATE POLICY tenant_isolation_protheus_staging ON "protheus_staging_rows"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());

CREATE POLICY tenant_isolation_audit ON "audit_logs"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id() OR tenant_id IS NULL);

-- Table owner / app role bypass note:
-- Prisma connects as table owner by default, which bypasses RLS in PostgreSQL.
-- For production, create a non-superuser role `clarity_app` WITHOUT BYPASSRLS
-- and set DATABASE_URL to that role. Migrations stay on owner role.
