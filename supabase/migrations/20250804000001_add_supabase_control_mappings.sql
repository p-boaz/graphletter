-- Add SCF control mappings for Supabase integration
-- This defines which SCF controls can be assessed through Supabase data
-- Only adding core controls that are likely to exist in the SCF framework

INSERT INTO "public"."scf_control_integrations" ("scf_control_id", "provider_id", "service_name", "check_type", "validation_rules", "priority", "is_active") VALUES
-- Authentication configuration mappings (only if IAC-02 exists)
('IAC-02', 'supabase', 'auth', 'configuration_check', 
 '{
   "evidence_type": "supabase_auth_config",
   "required_fields": ["enable_signup", "enable_confirmations", "password_min_length"],
   "assessment_criteria": {
     "strong_auth": ["enable_confirmations", "password_min_length >= 8"],
     "mfa_support": ["enable_phone_confirmations", "external_oauth_providers"],
     "session_management": ["jwt_exp <= 3600", "refresh_token_rotation"]
   }
 }'::jsonb, 90, true),

-- Network access control mappings (only if NET-03 exists)
('NET-03', 'supabase', 'network', 'configuration_check',
 '{
   "evidence_type": "supabase_network_restrictions", 
   "required_fields": ["restrictions"],
   "assessment_criteria": {
     "ip_restrictions": ["allowed_ip_ranges"],
     "geo_blocking": ["blocked_countries"],
     "network_isolation": ["vpc_peering", "private_networking"]
   }
 }'::jsonb, 85, true),

-- Cryptographic key management mappings (only if CRY-03 exists)
('CRY-03', 'supabase', 'auth', 'key_management_check',
 '{
   "evidence_type": "supabase_signing_keys",
   "required_fields": ["keys", "keyCount"],
   "assessment_criteria": {
     "key_rotation": ["multiple_active_keys", "key_age_checks"],
     "key_strength": ["key_algorithm", "key_length"],
     "secure_storage": ["key_storage_method"]
   }
 }'::jsonb, 88, true),

-- Risk assessment mappings (only if RSK-01 exists)
('RSK-01', 'supabase', 'advisors', 'security_assessment',
 '{
   "evidence_type": "supabase_security_advisors",
   "required_fields": ["advisors"],
   "assessment_criteria": {
     "vulnerability_scan": ["security_advisor_results"],
     "risk_scoring": ["critical_issues", "high_issues"],
     "remediation_tracking": ["issue_status", "resolution_timeline"]
   }
 }'::jsonb, 80, true)

ON CONFLICT DO NOTHING;

-- Comment for documentation  
COMMENT ON TABLE "public"."scf_control_integrations" IS 'Mapping SCF controls to integration checks (AWS, Azure, GitHub, Okta, Supabase)';