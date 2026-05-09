-- Add Supabase provider to integration_providers table
-- This addresses the missing provider error in Supabase integration

INSERT INTO "public"."integration_providers" ("provider_id", "provider_name", "provider_type", "supported_services", "connection_schema") VALUES
('supabase', 'Supabase', 'database',
 '["auth", "database", "storage", "functions", "realtime", "edge_functions"]'::jsonb,
 '{
   "required": ["project_url", "api_key", "service_role_key", "management_api_token"],
   "optional": ["custom_domain"],
   "validation": {
     "project_url": "^https://[a-z0-9]+\\.supabase\\.co$",
     "api_key": "^eyJ[A-Za-z0-9-_=]+\\.[A-Za-z0-9-_=]+\\.[A-Za-z0-9-_.+/=]*$",
     "service_role_key": "^eyJ[A-Za-z0-9-_=]+\\.[A-Za-z0-9-_=]+\\.[A-Za-z0-9-_.+/=]*$",
     "management_api_token": "^sbp_[a-f0-9]{40}$"
   }
 }'::jsonb)
ON CONFLICT ("provider_id") DO UPDATE SET
  provider_name = EXCLUDED.provider_name,
  provider_type = EXCLUDED.provider_type,
  supported_services = EXCLUDED.supported_services,
  connection_schema = EXCLUDED.connection_schema,
  is_active = true;

-- Comment for documentation
COMMENT ON TABLE "public"."integration_providers" IS 'Supported integration providers (AWS, Azure, GitHub, Okta, Supabase)';