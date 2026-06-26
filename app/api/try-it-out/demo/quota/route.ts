import { type NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api/error-response";
import { getDemoQuota } from "@/lib/demo/demo-quota";
import { getClientIpAddress } from "@/lib/security/rate-limit";

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIpAddress(request.headers) ?? "unknown";
    const { remaining, max } = await getDemoQuota(ip);
    return NextResponse.json({ remaining, max });
  } catch (error) {
    return apiError("demo.quota_failed", "Demo quota unavailable", 500, error);
  }
}
