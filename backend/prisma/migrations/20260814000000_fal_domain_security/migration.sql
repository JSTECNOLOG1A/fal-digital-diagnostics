-- Domínio FAL + hardening RLS (FORCE) + grants ao role fal_app

CREATE TYPE "AssessmentStatus" AS ENUM ('draft', 'in_progress', 'completed', 'archived');
CREATE TYPE "DataSubjectRequestType" AS ENUM ('access', 'rectification', 'erasure', 'portability', 'objection');
CREATE TYPE "DataSubjectRequestStatus" AS ENUM ('received', 'in_progress', 'completed', 'rejected');

CREATE TABLE "method_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "method_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "method_versions_tenant_id_code_version_key" ON "method_versions"("tenant_id", "code", "version");
CREATE INDEX "method_versions_tenant_id_idx" ON "method_versions"("tenant_id");

CREATE TABLE "clients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "clients_tenant_id_idx" ON "clients"("tenant_id");

CREATE TABLE "assessments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "client_id" UUID,
    "method_version_id" UUID,
    "title" TEXT NOT NULL,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'draft',
    "created_by_id" UUID,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "assessments_tenant_id_status_idx" ON "assessments"("tenant_id", "status");
CREATE INDEX "assessments_client_id_idx" ON "assessments"("client_id");

CREATE TABLE "data_subject_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "type" "DataSubjectRequestType" NOT NULL,
    "status" "DataSubjectRequestStatus" NOT NULL DEFAULT 'received',
    "subject_email" TEXT NOT NULL,
    "subject_name" TEXT,
    "details" TEXT,
    "handled_by_id" UUID,
    "due_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "data_subject_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "data_subject_requests_tenant_id_status_idx" ON "data_subject_requests"("tenant_id", "status");
CREATE INDEX "data_subject_requests_subject_email_idx" ON "data_subject_requests"("subject_email");

ALTER TABLE "method_versions" ADD CONSTRAINT "method_versions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clients" ADD CONSTRAINT "clients_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_method_version_id_fkey" FOREIGN KEY ("method_version_id") REFERENCES "method_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "data_subject_requests" ADD CONSTRAINT "data_subject_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "data_subject_requests" ADD CONSTRAINT "data_subject_requests_handled_by_id_fkey" FOREIGN KEY ("handled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS nas novas tabelas
ALTER TABLE "method_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assessments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "data_subject_requests" ENABLE ROW LEVEL SECURITY;

-- users: sem RLS FORÇADA — login por e-mail ocorre antes do tenant context.
-- Isolamento de listagem fica em UsersService + TenantGuard (camada app).

CREATE POLICY tenant_isolation_method_versions ON "method_versions"
  USING (app_is_hq() OR tenant_id IS NULL OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id IS NULL OR tenant_id::text = app_tenant_id());

CREATE POLICY tenant_isolation_clients ON "clients"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());

CREATE POLICY tenant_isolation_assessments ON "assessments"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());

CREATE POLICY tenant_isolation_dsr ON "data_subject_requests"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());

-- FORCE: table owner / fal_app não bypassam políticas (defense in depth)
ALTER TABLE "groups" FORCE ROW LEVEL SECURITY;
ALTER TABLE "companies" FORCE ROW LEVEL SECURITY;
ALTER TABLE "operational_units" FORCE ROW LEVEL SECURITY;
ALTER TABLE "user_invites" FORCE ROW LEVEL SECURITY;
ALTER TABLE "protheus_connections" FORCE ROW LEVEL SECURITY;
ALTER TABLE "protheus_sync_jobs" FORCE ROW LEVEL SECURITY;
ALTER TABLE "protheus_staging_rows" FORCE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
ALTER TABLE "method_versions" FORCE ROW LEVEL SECURITY;
ALTER TABLE "clients" FORCE ROW LEVEL SECURITY;
ALTER TABLE "assessments" FORCE ROW LEVEL SECURITY;
ALTER TABLE "data_subject_requests" FORCE ROW LEVEL SECURITY;

-- Grants ao role de aplicação (least privilege)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'fal_app') THEN
    GRANT CONNECT ON DATABASE fal TO fal_app;
    GRANT USAGE ON SCHEMA public TO fal_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO fal_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO fal_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fal_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO fal_app;
  END IF;
END
$$;
