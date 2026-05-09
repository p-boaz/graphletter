-- Seed framework-specific freshness overrides for top frameworks (T4).
-- Layered precedence remains:
-- user_override > framework_rule > type_default > global_default.

DO $$
DECLARE
  v_pci_id text;
  v_hipaa_id text;
  v_soc2_id text;
  v_iso27001_id text;
  v_nist_id text;
BEGIN
  SELECT id INTO v_pci_id
  FROM public.scf_frameworks
  WHERE framework_name ILIKE '%PCI%DSS%'
  ORDER BY framework_name
  LIMIT 1;

  SELECT id INTO v_hipaa_id
  FROM public.scf_frameworks
  WHERE framework_name ILIKE '%HIPAA%'
  ORDER BY framework_name
  LIMIT 1;

  SELECT id INTO v_soc2_id
  FROM public.scf_frameworks
  WHERE framework_name ILIKE '%SOC%2%'
     OR framework_name ILIKE '%SOC2%'
     OR framework_name ILIKE '%SOC II%'
  ORDER BY framework_name
  LIMIT 1;

  SELECT id INTO v_iso27001_id
  FROM public.scf_frameworks
  WHERE framework_name ILIKE '%ISO%27001%'
  ORDER BY framework_name
  LIMIT 1;

  SELECT id INTO v_nist_id
  FROM public.scf_frameworks
  WHERE framework_name ILIKE '%NIST%'
  ORDER BY framework_name
  LIMIT 1;

  IF v_pci_id IS NOT NULL THEN
    INSERT INTO public.evidence_freshness_rules
      (evidence_type, framework_id, max_age_days, description)
    VALUES
      (NULL, v_pci_id, 365, 'PCI DSS baseline annual evidence refresh'),
      ('log', v_pci_id, 90, 'PCI DSS quarterly scan and monitoring cadence'),
      ('configuration', v_pci_id, 90, 'PCI DSS quarterly configuration validation cadence')
    ON CONFLICT (evidence_type, framework_id) DO UPDATE
    SET
      max_age_days = EXCLUDED.max_age_days,
      description = EXCLUDED.description;
  END IF;

  IF v_hipaa_id IS NOT NULL THEN
    INSERT INTO public.evidence_freshness_rules
      (evidence_type, framework_id, max_age_days, description)
    VALUES
      (NULL, v_hipaa_id, 365, 'HIPAA annual risk assessment cadence'),
      ('policy', v_hipaa_id, 365, 'HIPAA annual administrative policy review cadence'),
      ('procedure', v_hipaa_id, 365, 'HIPAA annual procedural review cadence')
    ON CONFLICT (evidence_type, framework_id) DO UPDATE
    SET
      max_age_days = EXCLUDED.max_age_days,
      description = EXCLUDED.description;
  END IF;

  IF v_soc2_id IS NOT NULL THEN
    INSERT INTO public.evidence_freshness_rules
      (evidence_type, framework_id, max_age_days, description)
    VALUES
      (NULL, v_soc2_id, 365, 'SOC 2 baseline annual evidence refresh'),
      ('policy', v_soc2_id, 365, 'SOC 2 annual policy review cadence'),
      ('procedure', v_soc2_id, 365, 'SOC 2 annual control procedure review cadence')
    ON CONFLICT (evidence_type, framework_id) DO UPDATE
    SET
      max_age_days = EXCLUDED.max_age_days,
      description = EXCLUDED.description;
  END IF;

  IF v_iso27001_id IS NOT NULL THEN
    INSERT INTO public.evidence_freshness_rules
      (evidence_type, framework_id, max_age_days, description)
    VALUES
      (NULL, v_iso27001_id, 365, 'ISO 27001 baseline annual evidence refresh'),
      ('procedure', v_iso27001_id, 365, 'ISO 27001 annual internal audit cadence'),
      ('policy', v_iso27001_id, 365, 'ISO 27001 annual ISMS policy review cadence')
    ON CONFLICT (evidence_type, framework_id) DO UPDATE
    SET
      max_age_days = EXCLUDED.max_age_days,
      description = EXCLUDED.description;
  END IF;

  IF v_nist_id IS NOT NULL THEN
    INSERT INTO public.evidence_freshness_rules
      (evidence_type, framework_id, max_age_days, description)
    VALUES
      (NULL, v_nist_id, 180, 'NIST baseline recurring review cadence'),
      ('log', v_nist_id, 30, 'NIST continuous monitoring telemetry cadence'),
      ('configuration', v_nist_id, 30, 'NIST continuous configuration monitoring cadence'),
      ('screenshot', v_nist_id, 90, 'NIST periodic control validation cadence')
    ON CONFLICT (evidence_type, framework_id) DO UPDATE
    SET
      max_age_days = EXCLUDED.max_age_days,
      description = EXCLUDED.description;
  END IF;
END $$;
