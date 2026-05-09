-- Graphletter Integration System - Clean Baseline Schema
-- This represents the complete schema state after integration system implementation
-- Created: 2025-07-31

-- Integration provider management
CREATE TABLE IF NOT EXISTS "public"."integration_providers" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "provider_id" text UNIQUE NOT NULL,
  "provider_name" text NOT NULL,
  "provider_type" text NOT NULL,
  "supported_services" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "connection_schema" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp without time zone DEFAULT now(),
  CONSTRAINT "integration_providers_pkey" PRIMARY KEY ("id")
);

-- User integration connections
CREATE TABLE IF NOT EXISTS "public"."integration_connections" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "provider_id" text,
  "connection_name" text NOT NULL,
  "connection_config" jsonb NOT NULL,
  "credentials_encrypted" jsonb NOT NULL,
  "connection_status" text DEFAULT 'active'::text,
  "last_sync_at" timestamp without time zone,
  "last_error" text,
  "sync_frequency" text DEFAULT 'daily'::text,
  "created_at" timestamp without time zone DEFAULT now(),
  "updated_at" timestamp without time zone DEFAULT now(),
  CONSTRAINT "integration_connections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "integration_connections_connection_status_check" CHECK ((connection_status = ANY (ARRAY['active'::text, 'inactive'::text, 'error'::text, 'expired'::text]))),
  CONSTRAINT "integration_connections_sync_frequency_check" CHECK ((sync_frequency = ANY (ARRAY['real-time'::text, 'hourly'::text, 'daily'::text, 'weekly'::text]))),
  CONSTRAINT "integration_connections_user_id_provider_id_connection_name_key" UNIQUE ("user_id", "provider_id", "connection_name"),
  CONSTRAINT "integration_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  CONSTRAINT "integration_connections_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."integration_providers"("provider_id")
);

-- Automated evidence collection
CREATE TABLE IF NOT EXISTS "public"."automated_evidence" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "integration_connection_id" uuid,
  "scf_control_id" text,
  "evidence_type" text NOT NULL,
  "data_source" text NOT NULL,
  "evidence_data" jsonb NOT NULL,
  "processed_content" text,
  "collection_timestamp" timestamp without time zone DEFAULT now(),
  "assessment_status" text DEFAULT 'pending'::text,
  "confidence_score" numeric(3,2),
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp without time zone DEFAULT now(),
  CONSTRAINT "automated_evidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "automated_evidence_assessment_status_check" CHECK ((assessment_status = ANY (ARRAY['pending'::text, 'assessed'::text, 'failed'::text, 'skipped'::text]))),
  CONSTRAINT "automated_evidence_confidence_score_check" CHECK (((confidence_score >= (0)::numeric) AND (confidence_score <= (1)::numeric))),
  CONSTRAINT "automated_evidence_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  CONSTRAINT "automated_evidence_integration_connection_id_fkey" FOREIGN KEY ("integration_connection_id") REFERENCES "public"."integration_connections"("id") ON DELETE CASCADE,
  CONSTRAINT "automated_evidence_scf_control_id_fkey" FOREIGN KEY ("scf_control_id") REFERENCES "public"."scf_controls"("id")
);

-- SCF control to integration mappings
CREATE TABLE IF NOT EXISTS "public"."scf_control_integrations" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "scf_control_id" text,
  "provider_id" text,
  "service_name" text NOT NULL,
  "check_type" text NOT NULL,
  "validation_rules" jsonb NOT NULL,
  "priority" integer DEFAULT 100,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp without time zone DEFAULT now(),
  CONSTRAINT "scf_control_integrations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "scf_control_integrations_scf_control_id_fkey" FOREIGN KEY ("scf_control_id") REFERENCES "public"."scf_controls"("id") ON DELETE CASCADE,
  CONSTRAINT "scf_control_integrations_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."integration_providers"("provider_id")
);

-- Compliance drift tracking
CREATE TABLE IF NOT EXISTS "public"."compliance_drift_events" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "integration_connection_id" uuid,
  "scf_control_id" text,
  "drift_type" text NOT NULL,
  "previous_status" text,
  "current_status" text,
  "impact_level" text DEFAULT 'medium'::text,
  "change_details" jsonb NOT NULL,
  "detection_timestamp" timestamp without time zone DEFAULT now(),
  "resolved_at" timestamp without time zone,
  "resolved_by" uuid,
  "resolution_notes" text,
  "created_at" timestamp without time zone DEFAULT now(),
  CONSTRAINT "compliance_drift_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "compliance_drift_events_drift_type_check" CHECK ((drift_type = ANY (ARRAY['degraded'::text, 'improved'::text, 'new_finding'::text, 'resolved'::text]))),
  CONSTRAINT "compliance_drift_events_impact_level_check" CHECK ((impact_level = ANY (ARRAY['critical'::text, 'high'::text, 'medium'::text, 'low'::text]))),
  CONSTRAINT "compliance_drift_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  CONSTRAINT "compliance_drift_events_integration_connection_id_fkey" FOREIGN KEY ("integration_connection_id") REFERENCES "public"."integration_connections"("id") ON DELETE CASCADE,
  CONSTRAINT "compliance_drift_events_scf_control_id_fkey" FOREIGN KEY ("scf_control_id") REFERENCES "public"."scf_controls"("id"),
  CONSTRAINT "compliance_drift_events_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id")
);

-- Automated assessment results
CREATE TABLE IF NOT EXISTS "public"."automated_assessments" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "automated_evidence_id" uuid,
  "scf_control_id" text,
  "scf_ao_id" text,
  "assessment_result" text NOT NULL,
  "confidence_score" numeric(3,2),
  "ai_reasoning" text,
  "validation_rules_applied" jsonb,
  "assessment_timestamp" timestamp without time zone DEFAULT now(),
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp without time zone DEFAULT now(),
  CONSTRAINT "automated_assessments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "automated_assessments_assessment_result_check" CHECK ((assessment_result = ANY (ARRAY['pass'::text, 'fail'::text, 'partial'::text, 'not_applicable'::text]))),
  CONSTRAINT "automated_assessments_confidence_score_check" CHECK (((confidence_score >= (0)::numeric) AND (confidence_score <= (1)::numeric))),
  CONSTRAINT "automated_assessments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  CONSTRAINT "automated_assessments_automated_evidence_id_fkey" FOREIGN KEY ("automated_evidence_id") REFERENCES "public"."automated_evidence"("id") ON DELETE CASCADE,
  CONSTRAINT "automated_assessments_scf_control_id_fkey" FOREIGN KEY ("scf_control_id") REFERENCES "public"."scf_controls"("id")
);

-- Integration sync logs
CREATE TABLE IF NOT EXISTS "public"."integration_sync_logs" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "integration_connection_id" uuid,
  "sync_type" text NOT NULL,
  "sync_status" text NOT NULL,
  "records_processed" integer DEFAULT 0,
  "evidence_created" integer DEFAULT 0,
  "assessments_completed" integer DEFAULT 0,
  "errors_encountered" integer DEFAULT 0,
  "sync_duration_ms" integer,
  "error_details" jsonb,
  "started_at" timestamp without time zone DEFAULT now(),
  "completed_at" timestamp without time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT "integration_sync_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "integration_sync_logs_sync_status_check" CHECK ((sync_status = ANY (ARRAY['started'::text, 'completed'::text, 'failed'::text, 'partial'::text]))),
  CONSTRAINT "integration_sync_logs_integration_connection_id_fkey" FOREIGN KEY ("integration_connection_id") REFERENCES "public"."integration_connections"("id") ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "idx_integration_connections_user_id" ON "public"."integration_connections" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "idx_integration_connections_provider" ON "public"."integration_connections" USING btree ("provider_id");
CREATE INDEX IF NOT EXISTS "idx_integration_connections_status" ON "public"."integration_connections" USING btree ("connection_status");
CREATE INDEX IF NOT EXISTS "idx_automated_evidence_user_id" ON "public"."automated_evidence" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "idx_automated_evidence_control" ON "public"."automated_evidence" USING btree ("scf_control_id");
CREATE INDEX IF NOT EXISTS "idx_automated_evidence_connection" ON "public"."automated_evidence" USING btree ("integration_connection_id");
CREATE INDEX IF NOT EXISTS "idx_automated_evidence_status" ON "public"."automated_evidence" USING btree ("assessment_status");
CREATE INDEX IF NOT EXISTS "idx_automated_evidence_timestamp" ON "public"."automated_evidence" USING btree ("collection_timestamp");
CREATE INDEX IF NOT EXISTS "idx_compliance_drift_user_id" ON "public"."compliance_drift_events" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "idx_compliance_drift_control" ON "public"."compliance_drift_events" USING btree ("scf_control_id");
CREATE INDEX IF NOT EXISTS "idx_compliance_drift_type" ON "public"."compliance_drift_events" USING btree ("drift_type");
CREATE INDEX IF NOT EXISTS "idx_compliance_drift_timestamp" ON "public"."compliance_drift_events" USING btree ("detection_timestamp");
CREATE INDEX IF NOT EXISTS "idx_automated_assessments_user_id" ON "public"."automated_assessments" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "idx_automated_assessments_evidence" ON "public"."automated_assessments" USING btree ("automated_evidence_id");
CREATE INDEX IF NOT EXISTS "idx_automated_assessments_control" ON "public"."automated_assessments" USING btree ("scf_control_id");
CREATE INDEX IF NOT EXISTS "idx_sync_logs_connection" ON "public"."integration_sync_logs" USING btree ("integration_connection_id");
CREATE INDEX IF NOT EXISTS "idx_sync_logs_status" ON "public"."integration_sync_logs" USING btree ("sync_status");
CREATE INDEX IF NOT EXISTS "idx_sync_logs_timestamp" ON "public"."integration_sync_logs" USING btree ("started_at");

-- Insert initial integration providers
INSERT INTO "public"."integration_providers" ("provider_id", "provider_name", "provider_type", "supported_services", "connection_schema") VALUES
('aws', 'Amazon Web Services', 'cloud', 
 '["iam", "vpc", "s3", "cloudtrail", "kms", "ec2", "rds", "lambda"]'::jsonb,
 '{
   "required": ["access_key_id", "secret_access_key", "region"],
   "optional": ["session_token", "role_arn", "external_id"],
   "validation": {
     "region": "^[a-z0-9-]+$",
     "access_key_id": "^AKIA[0-9A-Z]{16}$"
   }
 }'::jsonb),
('azure', 'Microsoft Azure', 'cloud',
 '["active_directory", "network_security_groups", "storage", "key_vault", "monitor"]'::jsonb,
 '{
   "required": ["client_id", "client_secret", "tenant_id", "subscription_id"],
   "optional": ["resource_group"],
   "validation": {
     "tenant_id": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
   }
 }'::jsonb),
('github', 'GitHub', 'devops',
 '["repositories", "organization", "security", "actions"]'::jsonb,
 '{
   "required": ["access_token"],
   "optional": ["organization", "base_url"],
   "validation": {
     "access_token": "^gh[ps]_[a-zA-Z0-9]{36,255}$"
   }
 }'::jsonb),
('okta', 'Okta', 'identity',
 '["users", "groups", "applications", "policies", "logs"]'::jsonb,
 '{
   "required": ["domain", "api_token"],
   "optional": ["rate_limit"],
   "validation": {
     "domain": "^[a-zA-Z0-9-]+\\.okta\\.com$",
     "api_token": "^[a-zA-Z0-9_-]{64,}$"
   }
 }'::jsonb)
ON CONFLICT ("provider_id") DO NOTHING;

-- Create views for integration management
CREATE OR REPLACE VIEW "public"."active_integrations" AS
SELECT 
  ic.id,
  ic.user_id,
  ic.provider_id,
  ip.provider_name,
  ip.provider_type,
  ic.connection_name,
  ic.connection_status,
  ic.last_sync_at,
  ic.sync_frequency,
  ip.supported_services,
  ic.created_at
FROM integration_connections ic
JOIN integration_providers ip ON ic.provider_id = ip.provider_id
WHERE ic.connection_status = 'active' AND ip.is_active = true;

CREATE OR REPLACE VIEW "public"."integration_compliance_coverage" AS
SELECT 
  ic.user_id,
  ic.provider_id,
  ip.provider_name,
  ic.connection_name,
  COUNT(DISTINCT ae.scf_control_id) as controls_covered,
  COUNT(DISTINCT ae.id) as evidence_records,
  COUNT(DISTINCT aa.id) as assessments_completed,
  AVG(aa.confidence_score) as avg_confidence,
  MAX(ae.collection_timestamp) as last_evidence_collected
FROM integration_connections ic
JOIN integration_providers ip ON ic.provider_id = ip.provider_id
LEFT JOIN automated_evidence ae ON ic.id = ae.integration_connection_id
LEFT JOIN automated_assessments aa ON ae.id = aa.automated_evidence_id
WHERE ic.connection_status = 'active'
GROUP BY ic.user_id, ic.provider_id, ip.provider_name, ic.connection_name;

-- Row Level Security (RLS)
ALTER TABLE "public"."integration_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."automated_evidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."compliance_drift_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."automated_assessments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."integration_sync_logs" ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own integrations" ON "public"."integration_connections"
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own automated evidence" ON "public"."automated_evidence"
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own drift events" ON "public"."compliance_drift_events"
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own automated assessments" ON "public"."automated_assessments"
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Service can manage sync logs" ON "public"."integration_sync_logs"
  FOR ALL USING (true);

-- Grant necessary permissions
GRANT SELECT ON "public"."integration_providers" TO authenticated;
GRANT ALL ON "public"."integration_connections" TO authenticated;
GRANT ALL ON "public"."automated_evidence" TO authenticated;
GRANT ALL ON "public"."scf_control_integrations" TO authenticated;
GRANT ALL ON "public"."compliance_drift_events" TO authenticated;
GRANT ALL ON "public"."automated_assessments" TO authenticated;
GRANT SELECT ON "public"."integration_sync_logs" TO authenticated;

-- Service role gets full access
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Comments for documentation
COMMENT ON TABLE "public"."integration_providers" IS 'Supported integration providers (AWS, Azure, GitHub, etc.)';
COMMENT ON TABLE "public"."integration_connections" IS 'User connections to external systems';
COMMENT ON TABLE "public"."automated_evidence" IS 'Evidence automatically collected from integrated systems';
COMMENT ON TABLE "public"."scf_control_integrations" IS 'Mapping SCF controls to integration checks';
COMMENT ON TABLE "public"."compliance_drift_events" IS 'Compliance status changes detected automatically';
COMMENT ON TABLE "public"."automated_assessments" IS 'AI assessments of automated evidence';
COMMENT ON TABLE "public"."integration_sync_logs" IS 'Audit trail of integration synchronization activities';