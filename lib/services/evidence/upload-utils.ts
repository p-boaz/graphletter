import { createClient as createServiceClient } from "@supabase/supabase-js";

const MAX_EVIDENCE_FILE_BYTES = 50 * 1024 * 1024;

const ALLOWED_EVIDENCE_FILE_TYPES = new Set([
	"application/pdf",
	"application/msword",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/vnd.ms-excel",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"text/plain",
	"text/csv",
	"image/png",
	"image/jpeg",
	"image/gif",
]);

export function validateEvidenceUploadFile(file: File | null | undefined): {
	isValid: boolean;
	error?: string;
} {
	if (!file) {
		return { isValid: false, error: "File is required" };
	}

	if (file.size > MAX_EVIDENCE_FILE_BYTES) {
		return { isValid: false, error: "File size must be less than 50MB" };
	}

	if (!ALLOWED_EVIDENCE_FILE_TYPES.has(file.type)) {
		return {
			isValid: false,
			error:
				"Unsupported file type. Please upload PDF, Word, Excel, text, or image files.",
		};
	}

	return { isValid: true };
}

export function createEvidenceServiceClient() {
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!supabaseUrl || !serviceRoleKey) {
		throw new Error("Missing Supabase service-role configuration");
	}

	return createServiceClient(supabaseUrl, serviceRoleKey, {
		auth: { autoRefreshToken: false, persistSession: false },
	});
}
