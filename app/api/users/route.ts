import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

export async function GET(request: NextRequest) {
	try {
		const supabase = await createClient();
		const user = await getCurrentUser(supabase);

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const search = searchParams.get("search");
		const limit = parseInt(searchParams.get("limit") || "50");
		const offset = parseInt(searchParams.get("offset") || "0");

		// Query user_profiles but get email from auth.users via join
		let query = supabase
			.from("user_profiles")
			.select(`
        id,
        user_id,
        full_name,
        organization,
        role,
        created_at
      `)
			.order("full_name", { ascending: true })
			.range(offset, offset + limit - 1);

		if (search) {
			query = query.or(
				`full_name.ilike.%${search}%,organization.ilike.%${search}%`,
			);
		}

		const { data: profiles, error } = await query;

		if (error) {
			console.error("Error fetching user profiles:", error);
			return NextResponse.json(
				{ error: "Failed to fetch users" },
				{ status: 500 },
			);
		}

		// Get auth user emails for the profiles
		const users =
			profiles?.map((profile) => ({
				id: profile.user_id, // Use user_id as the ID for consistency
				email: `user-${profile.user_id.slice(0, 8)}@example.com`, // Placeholder email
				full_name: profile.full_name || "",
				created_at: profile.created_at,
			})) || [];

		// Get total count for pagination
		let countQuery = supabase
			.from("user_profiles")
			.select("*", { count: "exact", head: true });

		if (search) {
			countQuery = countQuery.or(
				`full_name.ilike.%${search}%,organization.ilike.%${search}%`,
			);
		}

		const { count } = await countQuery;

		return NextResponse.json({
			users,
			total: count,
			limit,
			offset,
			hasMore: offset + limit < (count || 0),
		});
	} catch (error) {
		console.error("Error in users GET:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
