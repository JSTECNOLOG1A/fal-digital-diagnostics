-- AddForeignKey
ALTER TABLE "fal_action_library" ADD CONSTRAINT "fal_action_library_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS (aplicado manualmente via psql após a migração — documentação/histórico).
ALTER TABLE "fal_action_library" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_fal_action_library ON "fal_action_library"
  USING (app_is_hq() OR tenant_id IS NULL OR tenant_id::text = app_tenant_id())
  WITH CHECK (app_is_hq() OR tenant_id IS NULL OR tenant_id::text = app_tenant_id());
ALTER TABLE "fal_action_library" FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'fal_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON fal_action_library TO fal_app;
  END IF;
END $$;
