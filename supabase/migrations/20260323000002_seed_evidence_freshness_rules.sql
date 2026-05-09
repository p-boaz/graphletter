-- Seed evidence freshness rules per Decision 4 (Architecture Decisions).
-- Layer 1: evidence type defaults (framework_id IS NULL)

INSERT INTO public.evidence_freshness_rules (evidence_type, framework_id, max_age_days, description) VALUES
  ('policy',        NULL, 365, 'Policies reviewed annually'),
  ('certificate',   NULL, 365, 'Certificates typically valid 1 year'),
  ('screenshot',    NULL, 180, 'Screenshots become stale after 6 months'),
  ('log',           NULL,  90, 'Logs relevant for ~3 months'),
  ('configuration', NULL, 180, 'Configuration snapshots valid 6 months'),
  ('procedure',     NULL, 365, 'Procedures reviewed annually'),
  ('document',      NULL, 365, 'General documents reviewed annually'),
  ('other',         NULL, 365, 'Default 12-month freshness')
ON CONFLICT (evidence_type, framework_id) DO NOTHING;

-- Layer 2: framework-specific overrides
DO $$
DECLARE
  v_pci_id text;
  v_hipaa_id text;
BEGIN
  SELECT id INTO v_pci_id FROM public.scf_frameworks WHERE framework_name ILIKE '%PCI%DSS%' LIMIT 1;
  SELECT id INTO v_hipaa_id FROM public.scf_frameworks WHERE framework_name ILIKE '%HIPAA%' LIMIT 1;

  IF v_pci_id IS NOT NULL THEN
    INSERT INTO public.evidence_freshness_rules (evidence_type, framework_id, max_age_days, description)
    VALUES (NULL, v_pci_id, 365, 'PCI DSS: annual penetration test and assessment refresh')
    ON CONFLICT (evidence_type, framework_id) DO NOTHING;
  END IF;

  IF v_hipaa_id IS NOT NULL THEN
    INSERT INTO public.evidence_freshness_rules (evidence_type, framework_id, max_age_days, description)
    VALUES (NULL, v_hipaa_id, 365, 'HIPAA: annual risk assessment requirement')
    ON CONFLICT (evidence_type, framework_id) DO NOTHING;
  END IF;
END $$;
