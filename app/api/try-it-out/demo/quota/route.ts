import { type NextRequest, NextResponse } from "next/server";
import { getDemoQuota } from "@/lib/demo/demo-quota";
import { getClientIpAddress } from "@/lib/security/rate-limit";

export async function GET(request: NextRequest) {
  const ip = getClientIpAddress(request.headers) ?? "unknown";
  const { remaining, max } = await getDemoQuota(ip);
  return NextResponse.json({ remaining, max });
}
