import { type NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api/error-response";
import { parseJsonBody } from "@/lib/api/json-body";
import { chunkAndBootstrapDocument, resolveEvidenceContent } from "@/lib/graph/service";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

interface ExtractEvidenceBody {
  content?: string;
  extractorVersion?: string;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Document ID is required" }, { status: 400 });
    }

    const parsedBody = await parseJsonBody<ExtractEvidenceBody>(request, {});
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.body;

    const supabase = await createClient();
    const user = await getCurrentUser(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("id, user_id, source_evidence_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (documentError) {
      return NextResponse.json({ error: documentError.message }, { status: 500 });
    }

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    let content = body.content ?? "";
    let scfControlId: string | null = null;

    if (document.source_evidence_id) {
      const { data: evidence } = await supabase
        .from("evidence")
        .select("scf_control_id, extracted_content, processed_content, evidence_data")
        .eq("id", document.source_evidence_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (evidence) {
        scfControlId = evidence.scf_control_id;
        if (!content) {
          content = resolveEvidenceContent(evidence);
        }
      }
    }

    const extraction = await chunkAndBootstrapDocument({
      supabase,
      documentId: document.id,
      userId: user.id,
      content,
      scfControlId,
      extractorVersion: body.extractorVersion,
    });

    return NextResponse.json({
      success: true,
      document_id: document.id,
      extraction,
    });
  } catch (error) {
    return apiError("documents.extract_evidence_failed", "Failed to extract evidence", 500, error);
  }
}
