import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type SupabaseAuthUser = Awaited<
	ReturnType<SupabaseServerClient["auth"]["getUser"]>
>["data"]["user"];

export async function getCurrentUser(supabase?: SupabaseServerClient) {
	const client = supabase || (await createClient());

	const {
		data: { user },
		error,
	} = await client.auth.getUser();

	if (error) {
		throw new Error(`Authentication error: ${error.message}`);
	}

	return user;
}

function parseCsvEnvSet(value: string | undefined): Set<string> {
	if (!value) {
		return new Set();
	}
	return new Set(
		value
			.split(",")
			.map((item) => item.trim())
			.filter(Boolean),
	);
}

export async function isAdminUser(
	user: SupabaseAuthUser,
	supabase?: SupabaseServerClient,
): Promise<boolean> {
	if (!user?.id) {
		return false;
	}

	const adminUserIds = parseCsvEnvSet(process.env.ADMIN_USER_IDS);
	const adminEmails = parseCsvEnvSet(process.env.ADMIN_EMAILS);

	if (adminUserIds.has(user.id)) {
		return true;
	}

	if (user.email && adminEmails.has(user.email)) {
		return true;
	}

	const roleFromMetadata = user.app_metadata?.role || user.user_metadata?.role;
	if (typeof roleFromMetadata === "string") {
		const normalizedRole = roleFromMetadata.toLowerCase();
		if (
			normalizedRole === "admin" ||
			normalizedRole === "owner" ||
			normalizedRole === "super_admin"
		) {
			return true;
		}
	}

	const client = supabase || (await createClient());
	const { data: profile } = await client
		.from("user_profiles")
		.select("role")
		.eq("user_id", user.id)
		.maybeSingle();

	const roleFromProfile =
		typeof profile?.role === "string" ? profile.role.toLowerCase() : null;
	return (
		roleFromProfile === "admin" ||
		roleFromProfile === "owner" ||
		roleFromProfile === "super_admin"
	);
}
