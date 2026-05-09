ALTER TABLE public.evidence_control_map
ADD COLUMN IF NOT EXISTS mapping_polarity text NOT NULL DEFAULT 'supports'
  CHECK (mapping_polarity IN ('supports', 'contradicts'));

COMMENT ON COLUMN public.evidence_control_map.mapping_polarity IS
  'Indicates whether the mapped atom supports or contradicts the control implementation.';

CREATE INDEX IF NOT EXISTS idx_evidence_control_map_control_polarity
  ON public.evidence_control_map(scf_control_id, mapping_polarity);

