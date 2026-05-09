import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

type AssignmentUpdateData = Record<string, unknown>;

export async function GET(request: NextRequest) {
	try {
		const supabase = await createClient();
		const user = await getCurrentUser(supabase);

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const assessmentId = searchParams.get("assessment_id");
		const assignedTo = searchParams.get("assigned_to");
		const status = searchParams.get("status");
		const type = searchParams.get("type");
		const limit = parseInt(searchParams.get("limit") || "50");
		const offset = parseInt(searchParams.get("offset") || "0");

		let query = supabase
			.from("assessment_assignments")
			.select(
				`
        *,
        assessment:assessments(
          id,
          scf_control_id,
          assessment_status,
          assessment_result,
          scf_control:scf_controls(id, title, description)
        ),
        assigned_to,
        assigned_by
      `,
			)
			.order("created_at", { ascending: false })
			.range(offset, offset + limit - 1);

		// Filter by user involvement (either assigned to them, assigned by them, or they own the assessment)
		query = query.or(`assigned_to.eq.${user.id},assigned_by.eq.${user.id}`);

		if (assessmentId) {
			query = query.eq("assessment_id", assessmentId);
		}

		if (assignedTo) {
			query = query.eq("assigned_to", assignedTo);
		}

		if (status) {
			query = query.eq("assignment_status", status);
		}

		if (type) {
			query = query.eq("assignment_type", type);
		}

		const { data: assignments, error } = await query;

		if (error) {
			console.error("Error fetching assignment:", error);
			return NextResponse.json(
				{ error: "Failed to fetch assignments" },
				{ status: 500 },
			);
		}

		// Get total count for pagination
		let countQuery = supabase
			.from("assessment_assignments")
			.select("*", { count: "exact", head: true })
			.or(`assigned_to.eq.${user.id},assigned_by.eq.${user.id}`);

		if (assessmentId) {
			countQuery = countQuery.eq("assessment_id", assessmentId);
		}

		if (assignedTo) {
			countQuery = countQuery.eq("assigned_to", assignedTo);
		}

		if (status) {
			countQuery = countQuery.eq("assignment_status", status);
		}

		if (type) {
			countQuery = countQuery.eq("assignment_type", type);
		}

		const { count } = await countQuery;

		return NextResponse.json({
			assignments,
			total: count,
			limit,
			offset,
			hasMore: offset + limit < (count || 0),
		});
	} catch (error) {
		console.error("Error in assignments GET:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
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
			assessment_id,
			assigned_to,
			assignment_type = "primary",
			due_date,
			priority = "medium",
			assignment_notes,
			estimated_hours,
		} = body;

		if (!assessment_id || !assigned_to) {
			return NextResponse.json(
				{
					error: "assessment_id and assigned_to are required",
				},
				{ status: 400 },
			);
		}

		// Validate the user owns the assessment
		const { data: assessment, error: assessmentError } = await supabase
			.from("assessments")
			.select("user_id, scf_control_id")
			.eq("id", assessment_id)
			.single();

		if (assessmentError || !assessment) {
			return NextResponse.json(
				{
					error: "Assessment not found",
				},
				{ status: 404 },
			);
		}

		if (assessment.user_id !== user.id) {
			return NextResponse.json(
				{
					error: "Unauthorized to assign this assessment",
				},
				{ status: 403 },
			);
		}

		// Validate assigned_to user exists
		const { data: assigneeCheck, error: assigneeError } = await supabase
			.from("user_profiles")
			.select("user_id")
			.eq("user_id", assigned_to)
			.single();

		if (assigneeError || !assigneeCheck) {
			return NextResponse.json(
				{
					error: "Invalid user to assign to",
				},
				{ status: 400 },
			);
		}

		// Check for existing assignment of the same type
		const { data: existingAssignment } = await supabase
			.from("assessment_assignments")
			.select("id")
			.eq("assessment_id", assessment_id)
			.eq("assigned_to", assigned_to)
			.eq("assignment_type", assignment_type)
			.eq("assignment_status", "assigned")
			.single();

		if (existingAssignment) {
			return NextResponse.json(
				{
					error:
						"User already has an active assignment of this type for this assessment",
				},
				{ status: 400 },
			);
		}

		// Create assignment record
		const { data: assignmentData, error: assignmentError } = await supabase
			.from("assessment_assignments")
			.insert({
				assessment_id,
				assigned_to,
				assigned_by: user.id,
				assignment_type,
				assignment_status: "assigned",
				due_date: due_date || null,
				priority,
				assignment_notes: assignment_notes || null,
				estimated_hours: estimated_hours || null,
			})
			.select(
				`
        *,
        assessment:assessments(
          id,
          scf_control_id,
          assessment_status,
          scf_control:scf_controls(id, title, description)
        ),
        assigned_to,
        assigned_by
      `,
			)
			.single();

		if (assignmentError) {
			console.error("Error creating assignment:", assignmentError);
			return NextResponse.json(
				{ error: "Failed to create assignment" },
				{ status: 500 },
			);
		}

		// Update the assessment with the assignee if it's a primary assignment
		if (assignment_type === "primary") {
			await supabase
				.from("assessments")
				.update({ assigned_to })
				.eq("id", assessment_id);
		}

		return NextResponse.json({
			success: true,
			assignment: assignmentData,
			message: "Assignment created successfully",
		});
	} catch (error) {
		console.error("Error in assignments POST:", error);
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Failed to create assignment",
			},
			{ status: 500 },
		);
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
		const assignmentId = searchParams.get("id");

		if (!assignmentId) {
			return NextResponse.json(
				{ error: "Assignment ID is required" },
				{ status: 400 },
			);
		}

		const body = await request.json();
		const {
			assignment_status,
			completion_notes,
			actual_hours,
			due_date,
			priority,
			assignment_notes,
		} = body;

		// Validate the user is involved in this assignment
		const { data: assignmentCheck, error: checkError } = await supabase
			.from("assessment_assignments")
			.select("assigned_to, assigned_by, assignment_status")
			.eq("id", assignmentId)
			.single();

		if (checkError || !assignmentCheck) {
			return NextResponse.json(
				{ error: "Assignment not found" },
				{ status: 404 },
			);
		}

		if (
			assignmentCheck.assigned_to !== user.id &&
			assignmentCheck.assigned_by !== user.id
		) {
			return NextResponse.json(
				{ error: "Unauthorized to update this assignment" },
				{ status: 403 },
			);
		}

		// Prepare update data
		const updateData: AssignmentUpdateData = {
			updated_at: new Date().toISOString(),
		};

		if (assignment_status) {
			updateData.assignment_status = assignment_status;

			if (
				assignment_status === "accepted" &&
				assignmentCheck.assignment_status === "assigned"
			) {
				updateData.accepted_at = new Date().toISOString();
			} else if (assignment_status === "completed") {
				updateData.completed_at = new Date().toISOString();
			}
		}

		// Update other fields
		const fieldsToUpdate = {
			completion_notes,
			actual_hours,
			due_date,
			priority,
			assignment_notes,
		};

		Object.entries(fieldsToUpdate).forEach(([key, value]) => {
			if (value !== undefined) {
				updateData[key] = value;
			}
		});

		// Update assignment record
		const { data: updatedAssignment, error: updateError } = await supabase
			.from("assessment_assignments")
			.update(updateData)
			.eq("id", assignmentId)
			.select(
				`
        *,
        assessment:assessments(
          id,
          scf_control_id,
          assessment_status,
          scf_control:scf_controls(id, title, description)
        ),
        assigned_to,
        assigned_by
      `,
			)
			.single();

		if (updateError) {
			console.error("Error updating assignment:", updateError);
			return NextResponse.json(
				{ error: "Failed to update assignment" },
				{ status: 500 },
			);
		}

		return NextResponse.json({
			success: true,
			assignment: updatedAssignment,
			message: "Assignment updated successfully",
		});
	} catch (error) {
		console.error("Error in assignments PUT:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
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
		const assignmentId = searchParams.get("id");

		if (!assignmentId) {
			return NextResponse.json(
				{ error: "Assignment ID is required" },
				{ status: 400 },
			);
		}

		// Get assignment details
		const { data: assignment, error: fetchError } = await supabase
			.from("assessment_assignments")
			.select("assigned_by, assignment_status, assignment_type, assessment_id")
			.eq("id", assignmentId)
			.single();

		if (fetchError || !assignment) {
			return NextResponse.json(
				{ error: "Assignment not found" },
				{ status: 404 },
			);
		}

		// Only the person who created the assignment can delete it
		if (assignment.assigned_by !== user.id) {
			return NextResponse.json(
				{ error: "Unauthorized to delete this assignment" },
				{ status: 403 },
			);
		}

		// Prevent deletion of completed assignments
		if (assignment.assignment_status === "completed") {
			return NextResponse.json(
				{
					error: "Cannot delete completed assignments",
				},
				{ status: 400 },
			);
		}

		// If this was a primary assignment, clear the assigned_to field in the assessment
		if (assignment.assignment_type === "primary") {
			await supabase
				.from("assessments")
				.update({ assigned_to: null })
				.eq("id", assignment.assessment_id);
		}

		// Delete assignment record
		const { error: deleteError } = await supabase
			.from("assessment_assignments")
			.delete()
			.eq("id", assignmentId);

		if (deleteError) {
			console.error("Error deleting assignment:", deleteError);
			return NextResponse.json(
				{ error: "Failed to delete assignment" },
				{ status: 500 },
			);
		}

		return NextResponse.json({
			success: true,
			message: "Assignment deleted successfully",
		});
	} catch (error) {
		console.error("Error in assignments DELETE:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
