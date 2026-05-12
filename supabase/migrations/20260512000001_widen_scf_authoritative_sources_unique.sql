-- Widen the unique key on scf_authoritative_sources to include authoritative_source.
--
-- Upstream SCF 2026.1.1 Authoritative Sources.csv contains rows that share the
-- same mapping_column_header (e.g. "US - NV\nSB220") within a single geography
-- (e.g. "US") but refer to distinct laws — Nevada Privacy Law (Ch 603A, 2023)
-- vs Nevada SB220 (2019). The original UNIQUE (mapping_column_header,
-- geography, import_id) collapses to (mapping_column_header, geography) within
-- a single import batch (one constant import_id), rejecting the second row.
--
-- CC BY-ND 4.0 forbids us from editing upstream content, so both rows must be
-- ingested verbatim. Adding authoritative_source to the discriminator keeps
-- the intra-batch dedupe guard while accommodating upstream's per-row
-- description as the tie-breaker.

ALTER TABLE public.scf_authoritative_sources
  DROP CONSTRAINT IF EXISTS scf_authoritative_sources_mapping_column_header_geography_i_key;

ALTER TABLE public.scf_authoritative_sources
  ADD CONSTRAINT scf_authoritative_sources_unique_per_import
    UNIQUE (mapping_column_header, geography, authoritative_source, import_id);
