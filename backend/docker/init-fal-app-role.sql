-- Role de runtime sem BYPASSRLS (ISO 27001 A.8 / A.9 — least privilege)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'fal_app') THEN
    CREATE ROLE fal_app LOGIN PASSWORD 'fal_app_dev_only_change_me' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END
$$;
