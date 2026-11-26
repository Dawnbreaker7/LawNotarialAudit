import { NextRequest, NextResponse } from "next/server";
import { requireApprovedOwnerApi } from "@/lib/owner/auth";
import { queryOwnerLogs } from "@/lib/owner/audit";

export const preferredRegion = "sin1";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApprovedOwnerApi();
    if (auth.error) return auth.error;

    const sp = request.nextUrl.searchParams;
    const limitParam = sp.get("limit");
    const parsedLimit = limitParam ? Number(limitParam) : 100;
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 100)
      : 100;

    const logs = await queryOwnerLogs({
      limit,
      target_id: sp.get("target_id") ?? undefined,
      action: sp.get("action") ?? undefined,
      branch_code: sp.get("branch_code") ?? undefined,
    });

    return NextResponse.json({ logs });
  } catch (err) {
    console.error("GET /api/owner/logs failed:", err);
    return NextResponse.json(
      { error: "Failed to load audit logs." },
      { status: 500 }
    );
  }
}
