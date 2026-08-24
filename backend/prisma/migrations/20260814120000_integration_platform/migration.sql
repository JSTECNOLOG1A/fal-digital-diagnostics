-- Integration platform tables + RLS

CREATE TYPE "IntegrationDirection" AS ENUM ('outbound', 'inbound', 'bidirectional');
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('pending', 'delivered', 'failed', 'skipped');

CREATE TABLE "integration_connections" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "direction" "IntegrationDirection" NOT NULL DEFAULT 'outbound',
    "base_url" TEXT,
    "auth_type" TEXT NOT NULL DEFAULT 'api_key',
    "encrypted_secrets" TEXT,
    "config" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_success_at" TIMESTAMP(3),
    "last_error_at" TIMESTAMP(3),
    "last_error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "integration_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "integration_api_keys" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_api_keys_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "integration_webhook_endpoints" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "target_url" TEXT NOT NULL,
    "encrypted_secret" TEXT,
    "events" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "integration_webhook_endpoints_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "integration_webhook_deliveries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "endpoint_id" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "response_code" INTEGER,
    "error_message" TEXT,
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_webhook_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "integration_inbound_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "external_id" TEXT,
    "payload" JSONB NOT NULL,
    "headers" JSONB,
    "processed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_inbound_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "integration_jobs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "connection_id" UUID,
    "provider" TEXT NOT NULL,
    "job_type" TEXT NOT NULL,
    "status" "SyncJobStatus" NOT NULL DEFAULT 'pending',
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "error_message" TEXT,
    "stats" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "integration_connections_tenant_id_provider_name_key" ON "integration_connections"("tenant_id", "provider", "name");
CREATE INDEX "integration_connections_tenant_id_provider_idx" ON "integration_connections"("tenant_id", "provider");

CREATE UNIQUE INDEX "integration_api_keys_key_hash_key" ON "integration_api_keys"("key_hash");
CREATE INDEX "integration_api_keys_tenant_id_idx" ON "integration_api_keys"("tenant_id");
CREATE INDEX "integration_api_keys_key_prefix_idx" ON "integration_api_keys"("key_prefix");

CREATE INDEX "integration_webhook_endpoints_tenant_id_idx" ON "integration_webhook_endpoints"("tenant_id");

CREATE INDEX "integration_webhook_deliveries_tenant_id_status_idx" ON "integration_webhook_deliveries"("tenant_id", "status");
CREATE INDEX "integration_webhook_deliveries_endpoint_id_idx" ON "integration_webhook_deliveries"("endpoint_id");

CREATE INDEX "integration_inbound_events_tenant_id_provider_created_at_idx" ON "integration_inbound_events"("tenant_id", "provider", "created_at");
CREATE INDEX "integration_inbound_events_tenant_id_external_id_idx" ON "integration_inbound_events"("tenant_id", "external_id");

CREATE INDEX "integration_jobs_tenant_id_status_idx" ON "integration_jobs"("tenant_id", "status");
CREATE INDEX "integration_jobs_connection_id_idx" ON "integration_jobs"("connection_id");

ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "integration_api_keys" ADD CONSTRAINT "integration_api_keys_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "integration_webhook_endpoints" ADD CONSTRAINT "integration_webhook_endpoints_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "integration_webhook_deliveries" ADD CONSTRAINT "integration_webhook_deliveries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "integration_webhook_deliveries" ADD CONSTRAINT "integration_webhook_deliveries_endpoint_id_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "integration_webhook_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_inbound_events" ADD CONSTRAINT "integration_inbound_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "integration_jobs" ADD CONSTRAINT "integration_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "integration_jobs" ADD CONSTRAINT "integration_jobs_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "integration_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "integration_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "integration_connections" FORCE ROW LEVEL SECURITY;
ALTER TABLE "integration_api_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "integration_api_keys" FORCE ROW LEVEL SECURITY;
ALTER TABLE "integration_webhook_endpoints" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "integration_webhook_endpoints" FORCE ROW LEVEL SECURITY;
ALTER TABLE "integration_webhook_deliveries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "integration_webhook_deliveries" FORCE ROW LEVEL SECURITY;
ALTER TABLE "integration_inbound_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "integration_inbound_events" FORCE ROW LEVEL SECURITY;
ALTER TABLE "integration_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "integration_jobs" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_integration_connections ON "integration_connections"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());

CREATE POLICY tenant_isolation_integration_api_keys ON "integration_api_keys"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());

CREATE POLICY tenant_isolation_integration_webhook_endpoints ON "integration_webhook_endpoints"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());

CREATE POLICY tenant_isolation_integration_webhook_deliveries ON "integration_webhook_deliveries"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());

CREATE POLICY tenant_isolation_integration_inbound_events ON "integration_inbound_events"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());

CREATE POLICY tenant_isolation_integration_jobs ON "integration_jobs"
  USING (app_is_hq() OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id::text = app_tenant_id());
