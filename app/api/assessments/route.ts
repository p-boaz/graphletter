import { type NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api/error-response";
import { createLogger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

const log = createLogger("api/assessments");

type AssessmentUpdateData = Record<string, unknown>;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const controlId = searchParams.get("control_id");
    const aoId = searchParams.get("ao_id");
    const status = searchParams.get("status");
    const assignedTo = searchParams.get("assigned_to");
    const assessmentType = searchParams.get("assessment_type");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = supabase
      .from("assessments")
      .select(
        `
        *,
        scf_control:scf_controls(id, title, description, domain_id),
        assessment_objective:scf_assessment_objectives(
          scf_ao_id,
          assessment_objective,
          assessment_procedure,
          expected_results,
          scf_baseline_aos,
          nist_800_53_r5_aos,
          nist_800_171_r2_aos
        ),
        evidence:evidence!evidence_id(
          id,
          file_name,
          evidence_type,
          evidence_status,
          file_size,
          collection_method,
          data_source,
          confidence_score,
          created_at
        ),
        assessment_assignments(
          id,
          assigned_to,
          assignment_type,
          assignment_status,
          due_date,
          priority
        )
      `
      )
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (controlId) {
      query = query.eq("scf_control_id", controlId);
    }

    if (aoId) {
      query = query.eq("scf_ao_id", aoId);
    }

    if (status) {
      query = query.eq("assessment_status", status);
    }

    if (assignedTo) {
      query = query.eq("assigned_to", assignedTo);
    }

    if (assessmentType) {
      query = query.eq("assessment_type", assessmentType);
    }

    const { data: assessments, error } = await query;

    if (error) {
      log.error("assessments.get.fetch_failed", {
        detail: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: "Failed to fetch assessments" }, { status: 500 });
    }

    // Get total count for pagination
    let countQuery = supabase
      .from("assessments")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (controlId) {
      countQuery = countQuery.eq("scf_control_id", controlId);
    }

    if (aoId) {
      countQuery = countQuery.eq("scf_ao_id", aoId);
    }

    if (status) {
      countQuery = countQuery.eq("assessment_status", status);
    }

    if (assignedTo) {
      countQuery = countQuery.eq("assigned_to", assignedTo);
    }

    if (assessmentType) {
      countQuery = countQuery.eq("assessment_type", assessmentType);
    }

    const { count } = await countQuery;

    return NextResponse.json({
      assessments,
      total: count,
      limit,
      offset,
      hasMore: offset + limit < (count || 0),
    });
  } catch (error) {
    log.error("assessments.get.unhandled", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      scf_control_id,
      scf_ao_id,
      assessment_type = "manual",
      assessment_method = "manual",
      assessment_notes,
      evidence_ids = [],
      assigned_to,
    } = body;

    if (!scf_control_id) {
      return NextResponse.json(
        {
          error: "scf_control_id is required",
        },
        { status: 400 }
      );
    }

    // Validate control exists
    const { data: control, error: controlError } = await supabase
      .from("scf_controls")
      .select("id, title")
      .eq("id", scf_control_id)
      .single();

    if (controlError || !control) {
      return NextResponse.json(
        {
          error: "Invalid SCF control ID",
        },
        { status: 400 }
      );
    }

    // If scf_ao_id provided, validate it exists
    if (scf_ao_id) {
      const { data: ao, error: aoError } = await supabase
        .from("scf_assessment_objectives")
        .select("scf_ao_id")
        .eq("scf_ao_id", scf_ao_id)
        .eq("scf_control_id", scf_control_id)
        .single();

      if (aoError || !ao) {
        return NextResponse.json(
          {
            error: "Invalid assessment objective ID for this control",
          },
          { status: 400 }
        );
      }
    }

    // Create assessment record
    const { data: assessmentData, error: assessmentError } = await supabase
      .from("assessments")
      .insert({
        user_id: user.id,
        scf_control_id,
        scf_ao_id: scf_ao_id || null,
        assessment_type,
        assessment_method,
        assessment_status: "not_started",
        assessment_notes: assessment_notes || null,
        assigned_to: assigned_to || user.id,
        metadata: {
          created_by: user.id,
        },
      })
      .select(
        `
        *,
        scf_control:scf_controls(id, title, description, domain_id),
        assessment_objective:scf_assessment_objectives(
          scf_ao_id,
          assessment_objective,
          assessment_procedure,
          expected_results
        )
      `
      )
      .single();

    if (assessmentError) {
      return apiError(
        "assessments.create_failed",
        "Failed to create assessment",
        500,
        assessmentError
      );
    }

    // The assessment exists at this point; failures in the secondary writes
    // below are reported as warnings rather than failing the request.
    const warnings: string[] = [];

    // Link evidence to assessment if provided
    if (evidence_ids.length > 0) {
      // For now, just link the first evidence ID to the assessment record
      // In a future migration, we could create a proper many-to-many junction table
      const { error: linkError } = await supabase
        .from("assessments")
        .update({ evidence_id: evidence_ids[0] })
        .eq("id", assessmentData.id);

      if (linkError) {
        log.warn("assessments.post.evidence_link_failed", {
          detail: linkError instanceof Error ? linkError.message : String(linkError),
        });
        warnings.push("Evidence could not be linked to the assessment");
      }
    }

    // Create assignment record if assigned to someone
    if (assigned_to && assigned_to !== user.id) {
      const { error: assignmentError } = await supabase.from("assessment_assignments").insert({
        assessment_id: assessmentData.id,
        assigned_to,
        assigned_by: user.id,
        assignment_type: "primary",
        assignment_status: "assigned",
        priority: "medium",
      });

      if (assignmentError) {
        log.warn("assessments.post.assignment_create_failed", {
          detail:
            assignmentError instanceof Error ? assignmentError.message : String(assignmentError),
        });
        warnings.push("Assignment record could not be created");
      }
    }

    return NextResponse.json({
      success: true,
      assessment: assessmentData,
      warnings,
      message:
        warnings.length > 0
          ? "Assessment created with partial failures"
          : "Assessment created successfully",
    });
  } catch (error) {
    return apiError("assessments.post_failed", "Failed to create assessment", 500, error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const assessmentId = searchParams.get("id");

    if (!assessmentId) {
      return NextResponse.json({ error: "Assessment ID is required" }, { status: 400 });
    }

    const body = await request.json();
    const {
      assessment_status,
      assessment_result,
      implementation_status,
      assessment_notes,
      recommendations = [],
      risk_rating,
      evidence_ids = [],
    } = body;

    // Validate the user owns this assessment or is assigned to it
    const { data: assessmentCheck, error: checkError } = await supabase
      .from("assessments")
      .select("user_id, assigned_to, assessment_status")
      .eq("id", assessmentId)
      .single();

    if (checkError || !assessmentCheck) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    if (assessmentCheck.user_id !== user.id && assessmentCheck.assigned_to !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized to update this assessment" },
        { status: 403 }
      );
    }

    // Prepare update data
    const updateData: AssessmentUpdateData = {
      updated_at: new Date().toISOString(),
    };

    if (assessment_status) {
      updateData.assessment_status = assessment_status;

      if (
        assessment_status === "in_progress" &&
        assessmentCheck.assessment_status === "not_started"
      ) {
        updateData.started_at = new Date().toISOString();
      } else if (assessment_status === "completed") {
        updateData.completed_at = new Date().toISOString();
      } else if (assessment_status === "under_review") {
        updateData.completed_at = new Date().toISOString();
      } else if (assessment_status === "approved") {
        updateData.approved_by = user.id;
        updateData.approved_at = new Date().toISOString();
      }
    }

    // Update other fields
    const fieldsToUpdate = {
      assessment_result,
      implementation_status,
      assessment_notes,
      recommendations,
      risk_rating,
    };

    Object.entries(fieldsToUpdate).forEach(([key, value]) => {
      if (value !== undefined) {
        updateData[key] = value;
      }
    });

    // Update assessment record
    const { data: updatedAssessment, error: updateError } = await supabase
      .from("assessments")
      .update(updateData)
      .eq("id", assessmentId)
      .select(
        `
        *,
        scf_control:scf_controls(id, title, description, domain_id),
        assessment_objective:scf_assessment_objectives(
          scf_ao_id,
          assessment_objective,
          assessment_procedure,
          expected_results
        ),
        evidence:evidence!evidence_id(
          id,
          file_name,
          evidence_type,
          evidence_status,
          collection_method,
          data_source,
          confidence_score
        )
      `
      )
      .single();

    if (updateError) {
      log.error("assessments.put.update_failed", {
        detail: updateError instanceof Error ? updateError.message : String(updateError),
      });
      return NextResponse.json({ error: "Failed to update assessment" }, { status: 500 });
    }

    // The update succeeded at this point; the evidence-link write below is
    // reported as a warning rather than failing the request.
    const warnings: string[] = [];

    // Update evidence links only when the request explicitly provides the
    // field — an omitted evidence_ids must not clear an existing link.
    // An explicit empty array clears it intentionally.
    if (Array.isArray(body.evidence_ids)) {
      const evidenceId = evidence_ids.length > 0 ? evidence_ids[0] : null;

      const { error: linkError } = await supabase
        .from("assessments")
        .update({ evidence_id: evidenceId })
        .eq("id", assessmentId);

      if (linkError) {
        log.warn("assessments.put.evidence_link_failed", {
          detail: linkError instanceof Error ? linkError.message : String(linkError),
        });
        warnings.push("Evidence links could not be updated");
      }
    }

    return NextResponse.json({
      success: true,
      assessment: updatedAssessment,
      warnings,
      message:
        warnings.length > 0
          ? "Assessment updated with partial failures"
          : "Assessment updated successfully",
    });
  } catch (error) {
    log.error("assessments.put.unhandled", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const assessmentId = searchParams.get("id");

    if (!assessmentId) {
      return NextResponse.json({ error: "Assessment ID is required" }, { status: 400 });
    }

    // Get assessment details
    const { data: assessment, error: fetchError } = await supabase
      .from("assessments")
      .select("user_id, assessment_status")
      .eq("id", assessmentId)
      .single();

    if (fetchError || !assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    if (assessment.user_id !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized to delete this assessment" },
        { status: 403 }
      );
    }

    // Prevent deletion of approved assessments
    if (assessment.assessment_status === "approved") {
      return NextResponse.json(
        {
          error: "Cannot delete approved assessments. Please contact an administrator.",
        },
        { status: 400 }
      );
    }

    // Delete assessment record (this will cascade to assessment_assignments and assessment_status_history)
    const { error: deleteError } = await supabase
      .from("assessments")
      .delete()
      .eq("id", assessmentId);

    if (deleteError) {
      log.error("assessments.delete.delete_failed", {
        detail: deleteError instanceof Error ? deleteError.message : String(deleteError),
      });
      return NextResponse.json({ error: "Failed to delete assessment" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Assessment deleted successfully",
    });
  } catch (error) {
    log.error("assessments.delete.unhandled", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
