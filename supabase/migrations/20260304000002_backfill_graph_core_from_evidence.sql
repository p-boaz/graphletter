-- Graph Core backfill: seed documents/chunks/atoms/control mappings from legacy evidence table.
-- Safe to rerun.

-- 1) Create one document node per evidence row.
INSERT INTO public.documents (
  user_id,
  source_evidence_id,
  file_name,
  file_type,
  file_size,
  storage_path,
  source_hash,
  ingestion_status,
  metadata
)
SELECT
  e.user_id,
  e.id,
  e.file_name,
  e.file_type,
  e.file_size,
  COALESCE(e.storage_path, e.file_path),
  encode(
    extensions.digest(
      COALESCE(NULLIF(e.extracted_content, ''), NULLIF(e.processed_content, ''), COALESCE(e.evidence_data::text, '')),
      'sha256'
    ),
    'hex'
  ) AS source_hash,
  CASE
    WHEN COALESCE(NULLIF(e.extracted_content, ''), NULLIF(e.processed_content, ''), e.evidence_data::text) IS NULL
      THEN 'pending'
    ELSE 'processed'
  END AS ingestion_status,
  jsonb_build_object(
    'backfilled_from', 'evidence',
    'evidence_id', e.id,
    'evidence_type', e.evidence_type,
    'collection_method', e.collection_method,
    'data_source', e.data_source,
    'backfill_version', 'stage1-v1'
  )
FROM public.evidence e
WHERE e.user_id IS NOT NULL
ON CONFLICT (source_evidence_id) DO UPDATE
SET
  file_name = EXCLUDED.file_name,
  file_type = EXCLUDED.file_type,
  file_size = EXCLUDED.file_size,
  storage_path = EXCLUDED.storage_path,
  source_hash = EXCLUDED.source_hash,
  ingestion_status = EXCLUDED.ingestion_status,
  metadata = public.documents.metadata || EXCLUDED.metadata,
  updated_at = now();

-- 2) Chunk each document from extracted_content -> processed_content -> evidence_data JSON text.
WITH source_documents AS (
  SELECT
    d.id AS document_id,
    d.user_id,
    d.source_evidence_id,
    COALESCE(
      NULLIF(e.extracted_content, ''),
      NULLIF(e.processed_content, ''),
      COALESCE(e.evidence_data::text, '')
    ) AS content_text
  FROM public.documents d
  JOIN public.evidence e ON e.id = d.source_evidence_id
),
chunk_positions AS (
  SELECT
    sd.document_id,
    sd.content_text,
    generate_series(1, GREATEST(length(sd.content_text), 1), 1000) AS start_pos
  FROM source_documents sd
),
prepared_chunks AS (
  SELECT
    cp.document_id,
    ((cp.start_pos - 1) / 1000)::integer AS chunk_index,
    substring(cp.content_text FROM cp.start_pos FOR 1200) AS content,
    cp.start_pos AS char_start,
    CASE
      WHEN length(cp.content_text) = 0 THEN 0
      ELSE LEAST(cp.start_pos + 1199, length(cp.content_text))
    END AS char_end
  FROM chunk_positions cp
)
INSERT INTO public.document_chunks (
  document_id,
  chunk_index,
  content,
  char_start,
  char_end,
  token_count,
  metadata
)
SELECT
  pc.document_id,
  pc.chunk_index,
  pc.content,
  pc.char_start,
  pc.char_end,
  CASE
    WHEN btrim(pc.content) = '' THEN 0
    ELSE COALESCE(array_length(regexp_split_to_array(btrim(pc.content), E'\\s+'), 1), 0)
  END AS token_count,
  jsonb_build_object('backfill_version', 'stage1-v1')
FROM prepared_chunks pc
ON CONFLICT (document_id, chunk_index) DO UPDATE
SET
  content = EXCLUDED.content,
  char_start = EXCLUDED.char_start,
  char_end = EXCLUDED.char_end,
  token_count = EXCLUDED.token_count,
  metadata = public.document_chunks.metadata || EXCLUDED.metadata,
  updated_at = now();

-- 3) Create one bootstrap atom per chunk.
INSERT INTO public.evidence_atoms (
  document_id,
  chunk_id,
  user_id,
  atom_type,
  claim,
  supporting_text,
  confidence,
  source_locator,
  extractor_version,
  metadata
)
SELECT
  dc.document_id,
  dc.id,
  d.user_id,
  'other' AS atom_type,
  CASE
    WHEN btrim(dc.content) = '' THEN '[No extracted content]'
    ELSE left(regexp_replace(dc.content, E'\\s+', ' ', 'g'), 300)
  END AS claim,
  dc.content AS supporting_text,
  0.20 AS confidence,
  jsonb_build_object(
    'chunk_index', dc.chunk_index,
    'char_start', dc.char_start,
    'char_end', dc.char_end
  ) AS source_locator,
  'stage1-bootstrap-v1' AS extractor_version,
  jsonb_build_object(
    'bootstrap', true,
    'source', 'legacy_evidence',
    'backfill_version', 'stage1-v1'
  )
FROM public.document_chunks dc
JOIN public.documents d ON d.id = dc.document_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.evidence_atoms existing_atoms
  WHERE existing_atoms.chunk_id = dc.id
    AND existing_atoms.extractor_version = 'stage1-bootstrap-v1'
);

-- 4) Seed atom -> control mappings when legacy evidence.scf_control_id is present.
INSERT INTO public.evidence_control_map (
  atom_id,
  scf_control_id,
  mapping_method,
  coverage_strength,
  rationale
)
SELECT
  ea.id,
  e.scf_control_id,
  'rule' AS mapping_method,
  'weak' AS coverage_strength,
  'seeded from legacy evidence.scf_control_id' AS rationale
FROM public.evidence_atoms ea
JOIN public.documents d ON d.id = ea.document_id
JOIN public.evidence e ON e.id = d.source_evidence_id
WHERE e.scf_control_id IS NOT NULL
  AND e.scf_control_id <> ''
ON CONFLICT (atom_id, scf_control_id) DO NOTHING;
