-- Graph Core: base tables for document -> chunk -> atom -> control mapping

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_evidence_id uuid,
  file_name text,
  file_type text,
  file_size bigint,
  storage_path text,
  source_hash text,
  ingestion_status text NOT NULL DEFAULT 'pending' CHECK (
    ingestion_status IN ('pending', 'processed', 'failed')
  ),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT documents_pkey PRIMARY KEY (id),
  CONSTRAINT documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT documents_source_evidence_id_fkey FOREIGN KEY (source_evidence_id) REFERENCES public.evidence(id) ON DELETE SET NULL,
  CONSTRAINT documents_source_evidence_id_unique UNIQUE (source_evidence_id)
);

CREATE TABLE IF NOT EXISTS public.document_chunks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  char_start integer,
  char_end integer,
  token_count integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT document_chunks_pkey PRIMARY KEY (id),
  CONSTRAINT document_chunks_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE,
  CONSTRAINT document_chunks_document_index_unique UNIQUE (document_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS public.evidence_atoms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  chunk_id uuid,
  user_id uuid NOT NULL,
  atom_type text NOT NULL CHECK (
    atom_type IN (
      'policy_statement',
      'technical_control',
      'procedure_step',
      'monitoring_signal',
      'attestation',
      'other'
    )
  ),
  claim text NOT NULL,
  supporting_text text,
  confidence numeric CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  source_locator jsonb,
  extractor_version text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT evidence_atoms_pkey PRIMARY KEY (id),
  CONSTRAINT evidence_atoms_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE,
  CONSTRAINT evidence_atoms_chunk_id_fkey FOREIGN KEY (chunk_id) REFERENCES public.document_chunks(id) ON DELETE SET NULL,
  CONSTRAINT evidence_atoms_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.evidence_control_map (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  atom_id uuid NOT NULL,
  scf_control_id text NOT NULL,
  mapping_method text NOT NULL CHECK (mapping_method IN ('rule', 'llm', 'manual')),
  coverage_strength text NOT NULL CHECK (coverage_strength IN ('strong', 'moderate', 'weak', 'none')),
  rationale text,
  mapped_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT evidence_control_map_pkey PRIMARY KEY (id),
  CONSTRAINT evidence_control_map_atom_id_fkey FOREIGN KEY (atom_id) REFERENCES public.evidence_atoms(id) ON DELETE CASCADE,
  CONSTRAINT evidence_control_map_scf_control_id_fkey FOREIGN KEY (scf_control_id) REFERENCES public.scf_controls(id),
  CONSTRAINT evidence_control_map_mapped_by_fkey FOREIGN KEY (mapped_by) REFERENCES auth.users(id),
  CONSTRAINT evidence_control_map_atom_control_unique UNIQUE (atom_id, scf_control_id)
);

CREATE TABLE IF NOT EXISTS public.control_gap_analysis (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  framework_id uuid,
  scf_control_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('compliant', 'partial', 'missing', 'conflicting', 'stale')),
  gap_type text,
  summary text,
  analysis_version text NOT NULL,
  supporting_atom_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT control_gap_analysis_pkey PRIMARY KEY (id),
  CONSTRAINT control_gap_analysis_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT control_gap_analysis_framework_id_fkey FOREIGN KEY (framework_id) REFERENCES public.scf_frameworks(id) ON DELETE SET NULL,
  CONSTRAINT control_gap_analysis_scf_control_id_fkey FOREIGN KEY (scf_control_id) REFERENCES public.scf_controls(id)
);

COMMENT ON TABLE public.documents IS 'Graph core document node; links uploaded evidence files to parsed graph artifacts.';
COMMENT ON TABLE public.document_chunks IS 'Chunked document text segments used as extraction units.';
COMMENT ON TABLE public.evidence_atoms IS 'Atomic evidence claims extracted from document chunks.';
COMMENT ON TABLE public.evidence_control_map IS 'Junction table mapping evidence atoms to SCF controls.';
COMMENT ON TABLE public.control_gap_analysis IS 'Versioned control gap snapshots derived from graph evidence coverage.';
