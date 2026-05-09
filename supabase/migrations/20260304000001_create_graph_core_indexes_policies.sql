-- Graph Core: indexes + RLS policies

CREATE INDEX IF NOT EXISTS idx_documents_user_created_at
  ON public.documents(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_documents_source_evidence_id
  ON public.documents(source_evidence_id);

CREATE INDEX IF NOT EXISTS idx_document_chunks_document_index
  ON public.document_chunks(document_id, chunk_index);

CREATE INDEX IF NOT EXISTS idx_evidence_atoms_user_type_created
  ON public.evidence_atoms(user_id, atom_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_evidence_atoms_document_id
  ON public.evidence_atoms(document_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_evidence_atoms_chunk_extractor_unique
  ON public.evidence_atoms(chunk_id, extractor_version)
  WHERE chunk_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_evidence_control_map_control_id
  ON public.evidence_control_map(scf_control_id);

CREATE INDEX IF NOT EXISTS idx_control_gap_analysis_user_framework_control_created
  ON public.control_gap_analysis(user_id, framework_id, scf_control_id, created_at DESC);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_atoms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_control_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.control_gap_analysis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to documents" ON public.documents;
DROP POLICY IF EXISTS "Users can select own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;

CREATE POLICY "Service role full access to documents"
  ON public.documents
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users can select own documents"
  ON public.documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents"
  ON public.documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents"
  ON public.documents FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents"
  ON public.documents FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access to document chunks" ON public.document_chunks;
DROP POLICY IF EXISTS "Users can select own document chunks" ON public.document_chunks;
DROP POLICY IF EXISTS "Users can insert own document chunks" ON public.document_chunks;
DROP POLICY IF EXISTS "Users can update own document chunks" ON public.document_chunks;
DROP POLICY IF EXISTS "Users can delete own document chunks" ON public.document_chunks;

CREATE POLICY "Service role full access to document chunks"
  ON public.document_chunks
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users can select own document chunks"
  ON public.document_chunks FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.id = document_chunks.document_id
        AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own document chunks"
  ON public.document_chunks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.id = document_chunks.document_id
        AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own document chunks"
  ON public.document_chunks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.id = document_chunks.document_id
        AND d.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.id = document_chunks.document_id
        AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own document chunks"
  ON public.document_chunks FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.id = document_chunks.document_id
        AND d.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role full access to evidence atoms" ON public.evidence_atoms;
DROP POLICY IF EXISTS "Users can select own evidence atoms" ON public.evidence_atoms;
DROP POLICY IF EXISTS "Users can insert own evidence atoms" ON public.evidence_atoms;
DROP POLICY IF EXISTS "Users can update own evidence atoms" ON public.evidence_atoms;
DROP POLICY IF EXISTS "Users can delete own evidence atoms" ON public.evidence_atoms;

CREATE POLICY "Service role full access to evidence atoms"
  ON public.evidence_atoms
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users can select own evidence atoms"
  ON public.evidence_atoms FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own evidence atoms"
  ON public.evidence_atoms FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own evidence atoms"
  ON public.evidence_atoms FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own evidence atoms"
  ON public.evidence_atoms FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access to evidence control map" ON public.evidence_control_map;
DROP POLICY IF EXISTS "Users can select own evidence control map" ON public.evidence_control_map;
DROP POLICY IF EXISTS "Users can insert own evidence control map" ON public.evidence_control_map;
DROP POLICY IF EXISTS "Users can update own evidence control map" ON public.evidence_control_map;
DROP POLICY IF EXISTS "Users can delete own evidence control map" ON public.evidence_control_map;

CREATE POLICY "Service role full access to evidence control map"
  ON public.evidence_control_map
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users can select own evidence control map"
  ON public.evidence_control_map FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.evidence_atoms a
      WHERE a.id = evidence_control_map.atom_id
        AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own evidence control map"
  ON public.evidence_control_map FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.evidence_atoms a
      WHERE a.id = evidence_control_map.atom_id
        AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own evidence control map"
  ON public.evidence_control_map FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.evidence_atoms a
      WHERE a.id = evidence_control_map.atom_id
        AND a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.evidence_atoms a
      WHERE a.id = evidence_control_map.atom_id
        AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own evidence control map"
  ON public.evidence_control_map FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.evidence_atoms a
      WHERE a.id = evidence_control_map.atom_id
        AND a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role full access to control gap analysis" ON public.control_gap_analysis;
DROP POLICY IF EXISTS "Users can select own control gap analysis" ON public.control_gap_analysis;
DROP POLICY IF EXISTS "Users can insert own control gap analysis" ON public.control_gap_analysis;
DROP POLICY IF EXISTS "Users can update own control gap analysis" ON public.control_gap_analysis;
DROP POLICY IF EXISTS "Users can delete own control gap analysis" ON public.control_gap_analysis;

CREATE POLICY "Service role full access to control gap analysis"
  ON public.control_gap_analysis
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users can select own control gap analysis"
  ON public.control_gap_analysis FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own control gap analysis"
  ON public.control_gap_analysis FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own control gap analysis"
  ON public.control_gap_analysis FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own control gap analysis"
  ON public.control_gap_analysis FOR DELETE
  USING (auth.uid() = user_id);
