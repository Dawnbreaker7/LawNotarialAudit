import { NextResponse } from "next/server";
import { requireApprovedOwnerApi } from "@/lib/owner/auth";
import { queryOwnerDashboardData } from "@/lib/owner/audit";

export const preferredRegion = "sin1";

export async function GET() {
  try {
    const auth = await requireApprovedOwnerApi();
    if (auth.error) return auth.error;

    const data = await queryOwnerDashboardData();
    return NextResponse.json(data);
  } catch (err) {
    console.error("GET /api/owner/dashboard failed:", err);
    return NextResponse.json(
      { error: "Failed to load owner dashboard data." },
      { status: 500 }
    );
  }
}
