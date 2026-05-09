-- Add extracted_content field to user_evidence table for full-text search
-- This field will store the extracted text content from uploaded files

-- Add the extracted content column
ALTER TABLE "public"."user_evidence" 
ADD COLUMN "extracted_content" text;

-- Add content extraction timestamp for tracking when content was last extracted
ALTER TABLE "public"."user_evidence" 
ADD COLUMN "content_extracted_at" timestamp with time zone;

-- Add content extraction status for tracking extraction process
ALTER TABLE "public"."user_evidence" 
ADD COLUMN "content_extraction_status" text DEFAULT 'pending'::text;

-- Add content extraction status check constraint
ALTER TABLE "public"."user_evidence" 
ADD CONSTRAINT "user_evidence_content_extraction_status_check" 
CHECK ((content_extraction_status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'skipped'::text])));

-- Add index for full-text search on extracted_content
-- Using GIN index for better text search performance
CREATE INDEX IF NOT EXISTS idx_user_evidence_extracted_content_gin 
ON "public"."user_evidence" 
USING gin(to_tsvector('english', coalesce(extracted_content, '')));

-- Add index for content extraction status for efficient filtering
CREATE INDEX IF NOT EXISTS idx_user_evidence_content_extraction_status 
ON "public"."user_evidence" (content_extraction_status);

-- Add combined index for user-specific content search
CREATE INDEX IF NOT EXISTS idx_user_evidence_user_content_search 
ON "public"."user_evidence" (user_id, content_extraction_status) 
WHERE extracted_content IS NOT NULL;

-- Add comment explaining the new fields
COMMENT ON COLUMN "public"."user_evidence"."extracted_content" 
IS 'Full text content extracted from uploaded files for search functionality';

COMMENT ON COLUMN "public"."user_evidence"."content_extracted_at" 
IS 'Timestamp when content was last extracted from the file';

COMMENT ON COLUMN "public"."user_evidence"."content_extraction_status" 
IS 'Status of content extraction: pending, processing, completed, failed, or skipped';
