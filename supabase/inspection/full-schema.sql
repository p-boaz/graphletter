SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."begin_compliance_transaction"("p_user_id" "uuid", "p_document_id" "uuid", "p_session_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    transaction_id uuid;
    result jsonb;
BEGIN
    -- Validate input parameters
    IF p_user_id IS NULL OR p_document_id IS NULL OR p_session_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Missing required parameters: user_id, document_id, or session_id'
        );
    END IF;

    -- Check if user is authenticated and matches the provided user_id
    IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Unauthorized: User must be authenticated and match provided user_id'
        );
    END IF;

    -- End any existing active transactions for this session
    UPDATE compliance_transactions 
    SET status = 'rolled_back', completed_at = now()
    WHERE session_id = p_session_id AND status = 'active';

    -- Create new transaction record
    INSERT INTO compliance_transactions (user_id, document_id, session_id, metadata)
    VALUES (
        p_user_id, 
        p_document_id, 
        p_session_id,
        jsonb_build_object(
            'started_by', 'begin_compliance_transaction',
            'api_version', 'enhanced_v1'
        )
    )
    RETURNING id INTO transaction_id;

    -- Return success with transaction info
    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', transaction_id,
        'session_id', p_session_id,
        'message', 'Compliance transaction started successfully'
    );

EXCEPTION
    WHEN OTHERS THEN
        -- Log the error and return failure
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Failed to start compliance transaction: ' || SQLERRM
        );
END;
$$;


ALTER FUNCTION "public"."begin_compliance_transaction"("p_user_id" "uuid", "p_document_id" "uuid", "p_session_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."begin_compliance_transaction"("p_user_id" "uuid", "p_document_id" "uuid", "p_session_id" "uuid") IS 'Starts a new compliance transaction for enhanced persistence operations';



CREATE OR REPLACE FUNCTION "public"."commit_compliance_transaction"("p_session_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    transaction_record record;
    affected_rows integer;
BEGIN
    -- If no session_id provided, try to find the most recent active transaction for the user
    IF p_session_id IS NULL THEN
        SELECT id, session_id, user_id INTO transaction_record
        FROM compliance_transactions
        WHERE user_id = auth.uid() AND status = 'active'
        ORDER BY started_at DESC
        LIMIT 1;
    ELSE
        SELECT id, session_id, user_id INTO transaction_record
        FROM compliance_transactions
        WHERE session_id = p_session_id AND status = 'active' AND user_id = auth.uid()
        LIMIT 1;
    END IF;

    -- Check if transaction exists and belongs to current user
    IF transaction_record.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No active compliance transaction found for current user'
        );
    END IF;

    -- Mark transaction as committed
    UPDATE compliance_transactions 
    SET status = 'committed', completed_at = now(),
        metadata = metadata || jsonb_build_object(
            'committed_by', 'commit_compliance_transaction',
            'committed_at', now()
        )
    WHERE id = transaction_record.id;

    GET DIAGNOSTICS affected_rows = ROW_COUNT;

    IF affected_rows > 0 THEN
        RETURN jsonb_build_object(
            'success', true,
            'transaction_id', transaction_record.id,
            'session_id', transaction_record.session_id,
            'message', 'Compliance transaction committed successfully'
        );
    ELSE
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Failed to commit compliance transaction'
        );
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Failed to commit compliance transaction: ' || SQLERRM
        );
END;
$$;


ALTER FUNCTION "public"."commit_compliance_transaction"("p_session_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."commit_compliance_transaction"("p_session_id" "uuid") IS 'Commits an active compliance transaction';



CREATE OR REPLACE FUNCTION "public"."create_user_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    BEGIN
        INSERT INTO user_profiles (user_id, full_name, organization)
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
            COALESCE(NEW.raw_user_meta_data->>'organization', '')
        );
        RETURN NEW;
    EXCEPTION
        WHEN unique_violation THEN
            -- Profile already exists, ignore
            RETURN NEW;
        WHEN OTHERS THEN
            -- Log the error but don't fail the user creation
            RAISE WARNING 'Failed to create user profile for user %: %', NEW.id, SQLERRM;
            RETURN NEW;
    END;
    $$;


ALTER FUNCTION "public"."create_user_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_compliance_views"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_compliance_dashboard;
    REFRESH MATERIALIZED VIEW CONCURRENTLY framework_coverage_heatmap_mv;
END;
$$;


ALTER FUNCTION "public"."refresh_compliance_views"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rollback_compliance_transaction"("p_session_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    transaction_record record;
    affected_rows integer;
BEGIN
    -- If no session_id provided, try to find the most recent active transaction for the user
    IF p_session_id IS NULL THEN
        SELECT id, session_id, user_id INTO transaction_record
        FROM compliance_transactions
        WHERE user_id = auth.uid() AND status = 'active'
        ORDER BY started_at DESC
        LIMIT 1;
    ELSE
        SELECT id, session_id, user_id INTO transaction_record
        FROM compliance_transactions
        WHERE session_id = p_session_id AND status = 'active' AND user_id = auth.uid()
        LIMIT 1;
    END IF;

    -- Check if transaction exists and belongs to current user
    IF transaction_record.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No active compliance transaction found for current user'
        );
    END IF;

    -- Mark transaction as rolled back
    UPDATE compliance_transactions 
    SET status = 'rolled_back', completed_at = now(),
        metadata = metadata || jsonb_build_object(
            'rolled_back_by', 'rollback_compliance_transaction',
            'rolled_back_at', now()
        )
    WHERE id = transaction_record.id;

    GET DIAGNOSTICS affected_rows = ROW_COUNT;

    IF affected_rows > 0 THEN
        RETURN jsonb_build_object(
            'success', true,
            'transaction_id', transaction_record.id,
            'session_id', transaction_record.session_id,
            'message', 'Compliance transaction rolled back successfully'
        );
    ELSE
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Failed to rollback compliance transaction'
        );
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Failed to rollback compliance transaction: ' || SQLERRM
        );
END;
$$;


ALTER FUNCTION "public"."rollback_compliance_transaction"("p_session_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."rollback_compliance_transaction"("p_session_id" "uuid") IS 'Rolls back an active compliance transaction';



CREATE OR REPLACE FUNCTION "public"."trigger_refresh_views"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    PERFORM refresh_compliance_views();
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."trigger_refresh_views"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_scf_controls_search_vector"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B');
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_scf_controls_search_vector"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."scf_assessment_objectives" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "scf_control_id" "text" NOT NULL,
    "scf_ao_id" "text" NOT NULL,
    "assessment_objective" "text" NOT NULL,
    "origin" "text",
    "notes_errata" "text",
    "scf_baseline_aos" boolean DEFAULT false,
    "dhs_ztcf_aos" boolean DEFAULT false,
    "nist_800_53_r5_aos" boolean DEFAULT false,
    "nist_800_171_r2_aos" boolean DEFAULT false,
    "nist_800_171_r3_aos" boolean DEFAULT false,
    "nist_800_172_aos" boolean DEFAULT false,
    "asset_type" "text",
    "assessment_procedure" "text",
    "expected_results" "text",
    "assessment_status" "text",
    "inherited" boolean DEFAULT false,
    "assessment_frequency" "text",
    "last_date_assessed" "date",
    "assessment_performed_by" "text",
    "scf_version" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "scf_assessment_objectives_assessment_status_check" CHECK ((("assessment_status" IS NULL) OR ("assessment_status" = ANY (ARRAY['met'::"text", 'not_met'::"text", 'not_tested'::"text", 'not_applicable'::"text"]))))
);


ALTER TABLE "public"."scf_assessment_objectives" OWNER TO "postgres";


COMMENT ON TABLE "public"."scf_assessment_objectives" IS 'SCF Assessment Objectives for compliance testing and validation';



COMMENT ON COLUMN "public"."scf_assessment_objectives"."scf_control_id" IS 'Reference to the SCF control this assessment objective belongs to';



COMMENT ON COLUMN "public"."scf_assessment_objectives"."scf_ao_id" IS 'Unique SCF Assessment Objective identifier (e.g., AAT-01_A01)';



COMMENT ON COLUMN "public"."scf_assessment_objectives"."assessment_objective" IS 'The assessment objective description text';



COMMENT ON COLUMN "public"."scf_assessment_objectives"."origin" IS 'Source or origin of this assessment objective';



COMMENT ON COLUMN "public"."scf_assessment_objectives"."assessment_status" IS 'Current assessment status (met, not_met, not_tested, not_applicable)';



COMMENT ON COLUMN "public"."scf_assessment_objectives"."inherited" IS 'Whether this assessment objective is inherited from another control';



CREATE TABLE IF NOT EXISTS "public"."scf_authoritative_sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "geography" "text" NOT NULL,
    "mapping_column_header" "text" NOT NULL,
    "source_organization" "text" NOT NULL,
    "authoritative_source" "text" NOT NULL,
    "strm_url" "text",
    "source_url" "text",
    "scf_version" "text" NOT NULL,
    "import_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."scf_authoritative_sources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scf_control_mappings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "control_id" "text",
    "framework_id" "uuid",
    "framework_control_id" "text" NOT NULL,
    "mapping_type" "text" DEFAULT 'direct'::"text",
    "confidence_score" numeric(3,2),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."scf_control_mappings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scf_controls" (
    "id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "domain_id" "text",
    "principle" "text",
    "control_questions" "text"[],
    "guidance_micro" "text",
    "guidance_small" "text",
    "guidance_medium" "text",
    "guidance_large" "text",
    "guidance_enterprise" "text",
    "applies_to_people" boolean DEFAULT false,
    "applies_to_process" boolean DEFAULT false,
    "applies_to_technology" boolean DEFAULT false,
    "applies_to_governance" boolean DEFAULT false,
    "risk_ids" "text"[],
    "threat_ids" "text"[],
    "assessment_objectives" "text"[],
    "evidence_requests" "text"[],
    "scf_version" "text" NOT NULL,
    "import_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "search_vector" "tsvector"
);


ALTER TABLE "public"."scf_controls" OWNER TO "postgres";


COMMENT ON COLUMN "public"."scf_controls"."search_vector" IS 'Full-text search vector for title and description';



CREATE TABLE IF NOT EXISTS "public"."scf_domains" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "principles" "text"[],
    "control_count" integer DEFAULT 0,
    "scf_version" "text" NOT NULL,
    "import_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "principle_intent" "text"
);


ALTER TABLE "public"."scf_domains" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scf_evidence_request_list" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "erl_id" "text" NOT NULL,
    "area_of_focus" "text" NOT NULL,
    "documentation_artifact" "text" NOT NULL,
    "artifact_description" "text" NOT NULL,
    "scf_control_mappings" "text"[] DEFAULT '{}'::"text"[],
    "scf_version" "text" NOT NULL,
    "import_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."scf_evidence_request_list" OWNER TO "postgres";


COMMENT ON TABLE "public"."scf_evidence_request_list" IS 'SCF Evidence Request List for compliance documentation requirements';



COMMENT ON COLUMN "public"."scf_evidence_request_list"."erl_id" IS 'Unique ERL identifier (e.g., E-GOV-01)';



COMMENT ON COLUMN "public"."scf_evidence_request_list"."area_of_focus" IS 'Category or area of focus for the evidence requirement';



COMMENT ON COLUMN "public"."scf_evidence_request_list"."documentation_artifact" IS 'Name of the required documentation artifact';



COMMENT ON COLUMN "public"."scf_evidence_request_list"."artifact_description" IS 'Detailed description of what the artifact should contain';



COMMENT ON COLUMN "public"."scf_evidence_request_list"."scf_control_mappings" IS 'Array of SCF control IDs that this evidence request maps to';



CREATE OR REPLACE VIEW "public"."scf_evidence_control_mappings" AS
 SELECT "id",
    "erl_id",
    "area_of_focus",
    "documentation_artifact",
    "artifact_description",
    "unnest"("scf_control_mappings") AS "scf_control_id",
    "scf_version",
    "import_id",
    "created_at",
    "updated_at"
   FROM "public"."scf_evidence_request_list" "erl"
  WHERE ("array_length"("scf_control_mappings", 1) > 0);


ALTER VIEW "public"."scf_evidence_control_mappings" OWNER TO "postgres";


COMMENT ON VIEW "public"."scf_evidence_control_mappings" IS 'Expanded view of evidence requests with individual control mappings for easier querying';



CREATE TABLE IF NOT EXISTS "public"."scf_frameworks" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "framework_name" "text" NOT NULL,
    "framework_version" "text",
    "source_url" "text",
    "mapping_type" "text" NOT NULL,
    "total_mappings" integer DEFAULT 0,
    "scf_version" "text" NOT NULL,
    "import_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."scf_frameworks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scf_imports" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "filename" "text" NOT NULL,
    "file_size" bigint NOT NULL,
    "scf_version" "text" NOT NULL,
    "import_status" "text" DEFAULT 'processing'::"text" NOT NULL,
    "total_controls" integer DEFAULT 0,
    "total_domains" integer DEFAULT 0,
    "total_frameworks" integer DEFAULT 0,
    "total_mappings" integer DEFAULT 0,
    "errors" "text"[],
    "warnings" "text"[],
    "imported_by" "uuid",
    "imported_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone
);


ALTER TABLE "public"."scf_imports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scf_principles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "number" integer NOT NULL,
    "domain_code" "text" NOT NULL,
    "domain_name" "text" NOT NULL,
    "principle_name" "text" NOT NULL,
    "principle_intent" "text" NOT NULL,
    "scf_version" "text" NOT NULL,
    "import_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."scf_principles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_analysis_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "document_id" "uuid",
    "session_type" "text" DEFAULT 'scf_enhanced_analysis'::"text",
    "analysis_results" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "controls_extracted" integer DEFAULT 0,
    "controls_mapped" integer DEFAULT 0,
    "frameworks_analyzed" "text"[] DEFAULT '{}'::"text"[],
    "precision_score" numeric(5,2) DEFAULT 0.0,
    "processing_notes" "text"[],
    "debug_info" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "analysis_summary" "text",
    "document_name" "text",
    "extraction_confidence" numeric(3,2),
    "frameworks_covered" "jsonb" DEFAULT '[]'::"jsonb",
    "total_controls_found" integer,
    CONSTRAINT "user_analysis_sessions_extraction_confidence_check" CHECK ((("extraction_confidence" >= (0)::numeric) AND ("extraction_confidence" <= (1)::numeric)))
);


ALTER TABLE "public"."user_analysis_sessions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_analysis_sessions"."analysis_summary" IS 'AI-generated summary of the document analysis';



COMMENT ON COLUMN "public"."user_analysis_sessions"."document_name" IS 'Name of the analyzed document file';



COMMENT ON COLUMN "public"."user_analysis_sessions"."extraction_confidence" IS 'AI confidence score for the entire document analysis (0.0 to 1.0)';



COMMENT ON COLUMN "public"."user_analysis_sessions"."frameworks_covered" IS 'Array of framework names covered in this analysis session';



CREATE TABLE IF NOT EXISTS "public"."user_compliance_gaps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "framework_name" "text" NOT NULL,
    "framework_control_id" "text",
    "gap_type" "text",
    "severity" "text" DEFAULT 'medium'::"text",
    "title" "text",
    "description" "text",
    "recommendation" "text",
    "status" "text" DEFAULT 'open'::"text",
    "assigned_to" "text",
    "due_date" "date",
    "resolution_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "resolved_at" timestamp with time zone,
    "document_id" "uuid",
    "priority" "text",
    "control_description" "text",
    "control_title" "text",
    "coverage_percentage" numeric(5,2),
    "priority_level" "text",
    "recommendations" "jsonb",
    "scf_control_id" "text",
    CONSTRAINT "user_compliance_gaps_coverage_percentage_check" CHECK ((("coverage_percentage" >= (0)::numeric) AND ("coverage_percentage" <= (100)::numeric))),
    CONSTRAINT "user_compliance_gaps_priority_level_check" CHECK (("priority_level" = ANY (ARRAY['high'::"text", 'medium'::"text", 'low'::"text"]))),
    CONSTRAINT "user_compliance_gaps_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "user_compliance_gaps_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in-progress'::"text", 'resolved'::"text", 'accepted-risk'::"text"])))
);


ALTER TABLE "public"."user_compliance_gaps" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_compliance_gaps"."framework_control_id" IS 'Framework control ID - can be null for SCF-only gaps';



COMMENT ON COLUMN "public"."user_compliance_gaps"."gap_type" IS 'Type of compliance gap - can be null when not specified';



COMMENT ON COLUMN "public"."user_compliance_gaps"."title" IS 'Gap title - can be null when control_title is used instead';



COMMENT ON COLUMN "public"."user_compliance_gaps"."control_description" IS 'Description of the missing control that represents a compliance gap';



COMMENT ON COLUMN "public"."user_compliance_gaps"."control_title" IS 'Title of the missing control that represents a compliance gap';



COMMENT ON COLUMN "public"."user_compliance_gaps"."coverage_percentage" IS 'Percentage of framework coverage for this compliance gap';



COMMENT ON COLUMN "public"."user_compliance_gaps"."priority_level" IS 'Priority level for addressing this compliance gap (high, medium, low)';



COMMENT ON COLUMN "public"."user_compliance_gaps"."scf_control_id" IS 'SCF control identifier for the compliance gap';



CREATE TABLE IF NOT EXISTS "public"."user_compliance_status" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "soc2_score" integer DEFAULT 0,
    "iso27001_score" integer DEFAULT 0,
    "nist_score" integer DEFAULT 0,
    "gdpr_score" integer DEFAULT 0,
    "hipaa_score" integer DEFAULT 0,
    "overall_score" integer DEFAULT 0,
    "total_controls" integer DEFAULT 0,
    "compliant_controls" integer DEFAULT 0,
    "partial_controls" integer DEFAULT 0,
    "non_compliant_controls" integer DEFAULT 0,
    "not_assessed_controls" integer DEFAULT 0,
    "last_calculated" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "domains_covered" "jsonb" DEFAULT '[]'::"jsonb",
    "framework_scores" "jsonb" DEFAULT '{}'::"jsonb",
    "frameworks_covered" "jsonb" DEFAULT '[]'::"jsonb",
    "last_analysis_date" timestamp with time zone DEFAULT "now"(),
    "total_controls_mapped" integer DEFAULT 0
);


ALTER TABLE "public"."user_compliance_status" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_compliance_status"."domains_covered" IS 'Array of SCF domains covered by the user compliance analysis';



COMMENT ON COLUMN "public"."user_compliance_status"."framework_scores" IS 'Object containing coverage scores for each framework';



COMMENT ON COLUMN "public"."user_compliance_status"."frameworks_covered" IS 'Array of framework names covered in the compliance analysis';



COMMENT ON COLUMN "public"."user_compliance_status"."last_analysis_date" IS 'Timestamp of the last compliance analysis performed';



COMMENT ON COLUMN "public"."user_compliance_status"."total_controls_mapped" IS 'Total number of controls mapped in the compliance analysis';



CREATE TABLE IF NOT EXISTS "public"."user_controls" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "document_id" "uuid",
    "title" "text",
    "description" "text",
    "confidence_score" numeric(3,2) DEFAULT 0.8,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "scf_domain" "text",
    "analysis_metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "user_text_original" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "scf_control_id" "text",
    "user_text_match" "text",
    "mapping_status" "text" DEFAULT 'confirmed'::"text",
    "implementation_status" "text" DEFAULT 'not_implemented'::"text",
    "implementation_notes" "text",
    "last_reviewed_date" timestamp with time zone,
    CONSTRAINT "user_controls_implementation_status_check" CHECK (("implementation_status" = ANY (ARRAY['not_implemented'::"text", 'planned'::"text", 'in_progress'::"text", 'implemented'::"text", 'needs_review'::"text"]))),
    CONSTRAINT "user_controls_mapping_status_check" CHECK (("mapping_status" = ANY (ARRAY['suggested'::"text", 'confirmed'::"text", 'rejected'::"text", 'modified'::"text"])))
);


ALTER TABLE "public"."user_controls" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_controls" IS 'User controls table - cleaned up unused legacy fields in migration 20250117000002';



COMMENT ON COLUMN "public"."user_controls"."title" IS 'Control title - can be null when control_title is used instead';



COMMENT ON COLUMN "public"."user_controls"."scf_control_id" IS 'SCF control identifier that this control maps to';



COMMENT ON COLUMN "public"."user_controls"."user_text_match" IS 'The specific text from the user document that matched this control';



COMMENT ON COLUMN "public"."user_controls"."mapping_status" IS 'Status of the SCF control mapping (suggested, confirmed, rejected, modified)';



COMMENT ON COLUMN "public"."user_controls"."implementation_status" IS 'Implementation status of the control (not_implemented, planned, in_progress, implemented, needs_review)';



COMMENT ON COLUMN "public"."user_controls"."implementation_notes" IS 'Notes about the implementation or mapping of this control';



COMMENT ON COLUMN "public"."user_controls"."last_reviewed_date" IS 'Date when this control mapping was last reviewed';



CREATE TABLE IF NOT EXISTS "public"."user_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "filename" "text" NOT NULL,
    "file_type" "text" NOT NULL,
    "file_size" bigint NOT NULL,
    "document_type" "text" NOT NULL,
    "standard_name" "text",
    "extracted_text" "text",
    "analysis_results" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'completed'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_documents_status_check" CHECK (("status" = ANY (ARRAY['processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."user_documents" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_documents" IS 'User uploaded documents. Multiple documents with same filename are allowed for re-uploads and versioning.';



CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "full_name" "text",
    "organization" "text",
    "role" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."scf_assessment_objectives"
    ADD CONSTRAINT "scf_assessment_objectives_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scf_authoritative_sources"
    ADD CONSTRAINT "scf_authoritative_sources_mapping_column_header_geography_i_key" UNIQUE ("mapping_column_header", "geography", "import_id");



ALTER TABLE ONLY "public"."scf_authoritative_sources"
    ADD CONSTRAINT "scf_authoritative_sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scf_control_mappings"
    ADD CONSTRAINT "scf_control_mappings_control_id_framework_id_framework_cont_key" UNIQUE ("control_id", "framework_id", "framework_control_id");



ALTER TABLE ONLY "public"."scf_control_mappings"
    ADD CONSTRAINT "scf_control_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scf_controls"
    ADD CONSTRAINT "scf_controls_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scf_domains"
    ADD CONSTRAINT "scf_domains_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scf_evidence_request_list"
    ADD CONSTRAINT "scf_evidence_request_list_erl_id_unique" UNIQUE ("erl_id", "import_id");



ALTER TABLE ONLY "public"."scf_evidence_request_list"
    ADD CONSTRAINT "scf_evidence_request_list_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scf_frameworks"
    ADD CONSTRAINT "scf_frameworks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scf_imports"
    ADD CONSTRAINT "scf_imports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scf_principles"
    ADD CONSTRAINT "scf_principles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_analysis_sessions"
    ADD CONSTRAINT "user_analysis_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_compliance_gaps"
    ADD CONSTRAINT "user_compliance_gaps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_compliance_status"
    ADD CONSTRAINT "user_compliance_status_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_compliance_status"
    ADD CONSTRAINT "user_compliance_status_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_controls"
    ADD CONSTRAINT "user_controls_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_documents"
    ADD CONSTRAINT "user_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_key" UNIQUE ("user_id");



CREATE INDEX "idx_compliance_trends" ON "public"."user_compliance_status" USING "btree" ("user_id", "last_analysis_date" DESC) INCLUDE ("overall_score", "framework_scores");



CREATE INDEX "idx_framework_scores_gin" ON "public"."user_compliance_status" USING "gin" ("framework_scores");



CREATE INDEX "idx_scf_assessment_objectives_ao_id" ON "public"."scf_assessment_objectives" USING "btree" ("scf_ao_id");



CREATE INDEX "idx_scf_assessment_objectives_assessment_status" ON "public"."scf_assessment_objectives" USING "btree" ("assessment_status") WHERE ("assessment_status" IS NOT NULL);



CREATE INDEX "idx_scf_assessment_objectives_control_id" ON "public"."scf_assessment_objectives" USING "btree" ("scf_control_id");



CREATE INDEX "idx_scf_assessment_objectives_scf_version" ON "public"."scf_assessment_objectives" USING "btree" ("scf_version");



CREATE INDEX "idx_scf_authoritative_sources_geography" ON "public"."scf_authoritative_sources" USING "btree" ("geography");



CREATE INDEX "idx_scf_authoritative_sources_source" ON "public"."scf_authoritative_sources" USING "btree" ("source_organization");



CREATE INDEX "idx_scf_control_mappings_control" ON "public"."scf_control_mappings" USING "btree" ("control_id");



CREATE INDEX "idx_scf_control_mappings_framework" ON "public"."scf_control_mappings" USING "btree" ("framework_id");



CREATE INDEX "idx_scf_controls_domain" ON "public"."scf_controls" USING "btree" ("domain_id");



CREATE INDEX "idx_scf_controls_fts" ON "public"."scf_controls" USING "gin" ("search_vector");



CREATE INDEX "idx_scf_controls_search_vector" ON "public"."scf_controls" USING "gin" ("search_vector");



CREATE INDEX "idx_scf_controls_version" ON "public"."scf_controls" USING "btree" ("scf_version");



CREATE INDEX "idx_scf_evidence_request_list_area_of_focus" ON "public"."scf_evidence_request_list" USING "btree" ("area_of_focus");



CREATE INDEX "idx_scf_evidence_request_list_artifact" ON "public"."scf_evidence_request_list" USING "btree" ("documentation_artifact");



CREATE INDEX "idx_scf_evidence_request_list_control_mappings" ON "public"."scf_evidence_request_list" USING "gin" ("scf_control_mappings");



CREATE INDEX "idx_scf_evidence_request_list_erl_id" ON "public"."scf_evidence_request_list" USING "btree" ("erl_id");



CREATE INDEX "idx_scf_evidence_request_list_import_id" ON "public"."scf_evidence_request_list" USING "btree" ("import_id");



CREATE INDEX "idx_scf_evidence_request_list_scf_version" ON "public"."scf_evidence_request_list" USING "btree" ("scf_version");



CREATE INDEX "idx_scf_imports_date" ON "public"."scf_imports" USING "btree" ("imported_at" DESC);



CREATE INDEX "idx_scf_imports_status" ON "public"."scf_imports" USING "btree" ("import_status");



CREATE INDEX "idx_scf_principles_domain" ON "public"."scf_principles" USING "btree" ("domain_code");



CREATE INDEX "idx_user_analysis_sessions_document_name" ON "public"."user_analysis_sessions" USING "btree" ("document_name") WHERE ("document_name" IS NOT NULL);



CREATE INDEX "idx_user_analysis_sessions_extraction_confidence" ON "public"."user_analysis_sessions" USING "btree" ("extraction_confidence") WHERE ("extraction_confidence" IS NOT NULL);



CREATE INDEX "idx_user_analysis_sessions_frameworks_covered" ON "public"."user_analysis_sessions" USING "gin" ("frameworks_covered") WHERE ("frameworks_covered" IS NOT NULL);



CREATE INDEX "idx_user_analysis_sessions_user_date" ON "public"."user_analysis_sessions" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_user_compliance_gaps_coverage_percentage" ON "public"."user_compliance_gaps" USING "btree" ("coverage_percentage") WHERE ("coverage_percentage" IS NOT NULL);



CREATE INDEX "idx_user_compliance_gaps_document_id" ON "public"."user_compliance_gaps" USING "btree" ("document_id");



CREATE INDEX "idx_user_compliance_gaps_priority_level" ON "public"."user_compliance_gaps" USING "btree" ("priority_level") WHERE ("priority_level" IS NOT NULL);



CREATE INDEX "idx_user_compliance_gaps_scf_control_id" ON "public"."user_compliance_gaps" USING "btree" ("scf_control_id") WHERE ("scf_control_id" IS NOT NULL);



CREATE INDEX "idx_user_compliance_gaps_status" ON "public"."user_compliance_gaps" USING "btree" ("status");



CREATE INDEX "idx_user_compliance_gaps_title" ON "public"."user_compliance_gaps" USING "btree" ("control_title") WHERE ("control_title" IS NOT NULL);



CREATE INDEX "idx_user_compliance_gaps_user_document" ON "public"."user_compliance_gaps" USING "btree" ("user_id", "document_id");



CREATE INDEX "idx_user_compliance_gaps_user_framework" ON "public"."user_compliance_gaps" USING "btree" ("user_id", "framework_name");



CREATE INDEX "idx_user_compliance_gaps_user_id" ON "public"."user_compliance_gaps" USING "btree" ("user_id");



CREATE INDEX "idx_user_compliance_status_domains" ON "public"."user_compliance_status" USING "gin" ("domains_covered") WHERE ("domains_covered" IS NOT NULL);



CREATE INDEX "idx_user_compliance_status_framework_scores" ON "public"."user_compliance_status" USING "gin" ("framework_scores") WHERE ("framework_scores" IS NOT NULL);



CREATE INDEX "idx_user_compliance_status_frameworks_covered" ON "public"."user_compliance_status" USING "gin" ("frameworks_covered") WHERE ("frameworks_covered" IS NOT NULL);



CREATE INDEX "idx_user_compliance_status_last_analysis_date" ON "public"."user_compliance_status" USING "btree" ("last_analysis_date") WHERE ("last_analysis_date" IS NOT NULL);



CREATE INDEX "idx_user_compliance_status_overall_score" ON "public"."user_compliance_status" USING "btree" ("overall_score");



CREATE INDEX "idx_user_compliance_status_total_controls" ON "public"."user_compliance_status" USING "btree" ("total_controls_mapped") WHERE ("total_controls_mapped" IS NOT NULL);



CREATE INDEX "idx_user_compliance_status_user_id" ON "public"."user_compliance_status" USING "btree" ("user_id");



CREATE INDEX "idx_user_controls_document_id" ON "public"."user_controls" USING "btree" ("document_id");



CREATE INDEX "idx_user_controls_implementation_status" ON "public"."user_controls" USING "btree" ("implementation_status");



CREATE INDEX "idx_user_controls_mapping_status" ON "public"."user_controls" USING "btree" ("mapping_status");



CREATE INDEX "idx_user_controls_scf_control_id" ON "public"."user_controls" USING "btree" ("scf_control_id") WHERE ("scf_control_id" IS NOT NULL);



CREATE INDEX "idx_user_controls_scf_domain" ON "public"."user_controls" USING "btree" ("scf_domain") WHERE ("scf_domain" IS NOT NULL);



CREATE INDEX "idx_user_controls_user_id" ON "public"."user_controls" USING "btree" ("user_id");



CREATE INDEX "idx_user_controls_user_text_match" ON "public"."user_controls" USING "btree" ("user_text_match") WHERE ("user_text_match" IS NOT NULL);



CREATE INDEX "idx_user_documents_created_at" ON "public"."user_documents" USING "btree" ("created_at");



CREATE INDEX "idx_user_documents_document_type" ON "public"."user_documents" USING "btree" ("document_type");



CREATE INDEX "idx_user_documents_status" ON "public"."user_documents" USING "btree" ("status");



CREATE INDEX "idx_user_documents_user_filename" ON "public"."user_documents" USING "btree" ("user_id", "filename");



CREATE INDEX "idx_user_documents_user_id" ON "public"."user_documents" USING "btree" ("user_id");



CREATE INDEX "idx_user_profiles_organization" ON "public"."user_profiles" USING "btree" ("organization");



CREATE INDEX "idx_user_profiles_user_id" ON "public"."user_profiles" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "scf_assessment_objectives_updated_at" BEFORE UPDATE ON "public"."scf_assessment_objectives" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "scf_evidence_request_list_updated_at" BEFORE UPDATE ON "public"."scf_evidence_request_list" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "trig_scf_controls_search_vector" BEFORE INSERT OR UPDATE ON "public"."scf_controls" FOR EACH ROW EXECUTE FUNCTION "public"."update_scf_controls_search_vector"();



CREATE OR REPLACE TRIGGER "update_scf_controls_search_vector_trigger" BEFORE INSERT OR UPDATE ON "public"."scf_controls" FOR EACH ROW EXECUTE FUNCTION "public"."update_scf_controls_search_vector"();



ALTER TABLE ONLY "public"."scf_assessment_objectives"
    ADD CONSTRAINT "scf_assessment_objectives_scf_control_id_fkey" FOREIGN KEY ("scf_control_id") REFERENCES "public"."scf_controls"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scf_authoritative_sources"
    ADD CONSTRAINT "scf_authoritative_sources_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "public"."scf_imports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scf_control_mappings"
    ADD CONSTRAINT "scf_control_mappings_control_id_fkey" FOREIGN KEY ("control_id") REFERENCES "public"."scf_controls"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scf_control_mappings"
    ADD CONSTRAINT "scf_control_mappings_framework_id_fkey" FOREIGN KEY ("framework_id") REFERENCES "public"."scf_frameworks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scf_controls"
    ADD CONSTRAINT "scf_controls_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "public"."scf_domains"("id");



ALTER TABLE ONLY "public"."scf_controls"
    ADD CONSTRAINT "scf_controls_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "public"."scf_imports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scf_domains"
    ADD CONSTRAINT "scf_domains_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "public"."scf_imports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scf_evidence_request_list"
    ADD CONSTRAINT "scf_evidence_request_list_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "public"."scf_imports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scf_frameworks"
    ADD CONSTRAINT "scf_frameworks_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "public"."scf_imports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scf_imports"
    ADD CONSTRAINT "scf_imports_imported_by_fkey" FOREIGN KEY ("imported_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."scf_principles"
    ADD CONSTRAINT "scf_principles_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "public"."scf_imports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_analysis_sessions"
    ADD CONSTRAINT "user_analysis_sessions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."user_documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_analysis_sessions"
    ADD CONSTRAINT "user_analysis_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_compliance_gaps"
    ADD CONSTRAINT "user_compliance_gaps_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."user_documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_compliance_gaps"
    ADD CONSTRAINT "user_compliance_gaps_scf_control_id_fkey" FOREIGN KEY ("scf_control_id") REFERENCES "public"."scf_controls"("id") ON DELETE SET NULL;



COMMENT ON CONSTRAINT "user_compliance_gaps_scf_control_id_fkey" ON "public"."user_compliance_gaps" IS 'Ensures compliance gaps reference valid SCF controls';



ALTER TABLE ONLY "public"."user_compliance_gaps"
    ADD CONSTRAINT "user_compliance_gaps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_compliance_status"
    ADD CONSTRAINT "user_compliance_status_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_controls"
    ADD CONSTRAINT "user_controls_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."user_documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_controls"
    ADD CONSTRAINT "user_controls_scf_control_id_fkey" FOREIGN KEY ("scf_control_id") REFERENCES "public"."scf_controls"("id") ON DELETE SET NULL;



COMMENT ON CONSTRAINT "user_controls_scf_control_id_fkey" ON "public"."user_controls" IS 'Ensures user controls reference valid SCF controls';



ALTER TABLE ONLY "public"."user_controls"
    ADD CONSTRAINT "user_controls_scf_domain_fkey" FOREIGN KEY ("scf_domain") REFERENCES "public"."scf_domains"("id") ON DELETE SET NULL;



COMMENT ON CONSTRAINT "user_controls_scf_domain_fkey" ON "public"."user_controls" IS 'Ensures user controls reference valid SCF domains';



ALTER TABLE ONLY "public"."user_controls"
    ADD CONSTRAINT "user_controls_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_documents"
    ADD CONSTRAINT "user_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Allow public insert access" ON "public"."scf_authoritative_sources" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public insert access" ON "public"."scf_principles" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public read access" ON "public"."scf_authoritative_sources" FOR SELECT USING (true);



CREATE POLICY "Allow public read access" ON "public"."scf_principles" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can import SCF data" ON "public"."scf_imports" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert SCF assessment objectives" ON "public"."scf_assessment_objectives" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert SCF controls" ON "public"."scf_controls" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert SCF domains" ON "public"."scf_domains" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert SCF evidence request list" ON "public"."scf_evidence_request_list" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert SCF frameworks" ON "public"."scf_frameworks" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert SCF mappings" ON "public"."scf_control_mappings" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can update SCF assessment objectives" ON "public"."scf_assessment_objectives" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can update SCF evidence request list" ON "public"."scf_evidence_request_list" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Users can delete their own compliance gaps" ON "public"."user_compliance_gaps" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own documents" ON "public"."user_documents" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own analysis sessions" ON "public"."user_analysis_sessions" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own compliance gaps" ON "public"."user_compliance_gaps" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own compliance status" ON "public"."user_compliance_status" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own documents" ON "public"."user_documents" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own compliance gaps" ON "public"."user_compliance_gaps" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own controls" ON "public"."user_controls" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own documents" ON "public"."user_documents" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own profile" ON "public"."user_profiles" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own analysis sessions" ON "public"."user_analysis_sessions" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own compliance gaps" ON "public"."user_compliance_gaps" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own compliance status" ON "public"."user_compliance_status" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own documents" ON "public"."user_documents" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view SCF assessment objectives" ON "public"."scf_assessment_objectives" FOR SELECT USING (true);



CREATE POLICY "Users can view SCF controls" ON "public"."scf_controls" FOR SELECT USING (true);



CREATE POLICY "Users can view SCF data" ON "public"."scf_imports" FOR SELECT USING (true);



CREATE POLICY "Users can view SCF domains" ON "public"."scf_domains" FOR SELECT USING (true);



CREATE POLICY "Users can view SCF evidence request list" ON "public"."scf_evidence_request_list" FOR SELECT USING (true);



CREATE POLICY "Users can view SCF frameworks" ON "public"."scf_frameworks" FOR SELECT USING (true);



CREATE POLICY "Users can view SCF mappings" ON "public"."scf_control_mappings" FOR SELECT USING (true);



CREATE POLICY "Users can view their own analysis sessions" ON "public"."user_analysis_sessions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own compliance gaps" ON "public"."user_compliance_gaps" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own compliance status" ON "public"."user_compliance_status" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own documents" ON "public"."user_documents" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."scf_assessment_objectives" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scf_authoritative_sources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scf_control_mappings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scf_controls" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scf_domains" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scf_evidence_request_list" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scf_frameworks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scf_imports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scf_principles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_analysis_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_compliance_gaps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_compliance_status" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_controls" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."begin_compliance_transaction"("p_user_id" "uuid", "p_document_id" "uuid", "p_session_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."begin_compliance_transaction"("p_user_id" "uuid", "p_document_id" "uuid", "p_session_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."begin_compliance_transaction"("p_user_id" "uuid", "p_document_id" "uuid", "p_session_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."commit_compliance_transaction"("p_session_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."commit_compliance_transaction"("p_session_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."commit_compliance_transaction"("p_session_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_user_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_compliance_views"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_compliance_views"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_compliance_views"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rollback_compliance_transaction"("p_session_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rollback_compliance_transaction"("p_session_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rollback_compliance_transaction"("p_session_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_refresh_views"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_refresh_views"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_refresh_views"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_scf_controls_search_vector"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_scf_controls_search_vector"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_scf_controls_search_vector"() TO "service_role";


















GRANT ALL ON TABLE "public"."scf_assessment_objectives" TO "anon";
GRANT ALL ON TABLE "public"."scf_assessment_objectives" TO "authenticated";
GRANT ALL ON TABLE "public"."scf_assessment_objectives" TO "service_role";



GRANT ALL ON TABLE "public"."scf_authoritative_sources" TO "anon";
GRANT ALL ON TABLE "public"."scf_authoritative_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."scf_authoritative_sources" TO "service_role";



GRANT ALL ON TABLE "public"."scf_control_mappings" TO "anon";
GRANT ALL ON TABLE "public"."scf_control_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."scf_control_mappings" TO "service_role";



GRANT ALL ON TABLE "public"."scf_controls" TO "anon";
GRANT ALL ON TABLE "public"."scf_controls" TO "authenticated";
GRANT ALL ON TABLE "public"."scf_controls" TO "service_role";



GRANT ALL ON TABLE "public"."scf_domains" TO "anon";
GRANT ALL ON TABLE "public"."scf_domains" TO "authenticated";
GRANT ALL ON TABLE "public"."scf_domains" TO "service_role";



GRANT ALL ON TABLE "public"."scf_evidence_request_list" TO "anon";
GRANT ALL ON TABLE "public"."scf_evidence_request_list" TO "authenticated";
GRANT ALL ON TABLE "public"."scf_evidence_request_list" TO "service_role";



GRANT ALL ON TABLE "public"."scf_evidence_control_mappings" TO "anon";
GRANT ALL ON TABLE "public"."scf_evidence_control_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."scf_evidence_control_mappings" TO "service_role";



GRANT ALL ON TABLE "public"."scf_frameworks" TO "anon";
GRANT ALL ON TABLE "public"."scf_frameworks" TO "authenticated";
GRANT ALL ON TABLE "public"."scf_frameworks" TO "service_role";



GRANT ALL ON TABLE "public"."scf_imports" TO "anon";
GRANT ALL ON TABLE "public"."scf_imports" TO "authenticated";
GRANT ALL ON TABLE "public"."scf_imports" TO "service_role";



GRANT ALL ON TABLE "public"."scf_principles" TO "anon";
GRANT ALL ON TABLE "public"."scf_principles" TO "authenticated";
GRANT ALL ON TABLE "public"."scf_principles" TO "service_role";



GRANT ALL ON TABLE "public"."user_analysis_sessions" TO "anon";
GRANT ALL ON TABLE "public"."user_analysis_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_analysis_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."user_compliance_gaps" TO "anon";
GRANT ALL ON TABLE "public"."user_compliance_gaps" TO "authenticated";
GRANT ALL ON TABLE "public"."user_compliance_gaps" TO "service_role";



GRANT ALL ON TABLE "public"."user_compliance_status" TO "anon";
GRANT ALL ON TABLE "public"."user_compliance_status" TO "authenticated";
GRANT ALL ON TABLE "public"."user_compliance_status" TO "service_role";



GRANT ALL ON TABLE "public"."user_controls" TO "anon";
GRANT ALL ON TABLE "public"."user_controls" TO "authenticated";
GRANT ALL ON TABLE "public"."user_controls" TO "service_role";



GRANT ALL ON TABLE "public"."user_documents" TO "anon";
GRANT ALL ON TABLE "public"."user_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."user_documents" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;
