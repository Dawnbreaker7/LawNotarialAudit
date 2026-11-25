import { NextRequest, NextResponse } from "next/server";
import { requireApprovedOwnerApi } from "@/lib/owner/auth";
import { queryOwnerAuditData } from "@/lib/owner/audit";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApprovedOwnerApi();
    if (auth.error) return auth.error;

    const sp = request.nextUrl.searchParams;
    const data = await queryOwnerAuditData({
      branch_code: sp.get("branch_code") ?? undefined,
      book_id: sp.get("book_id") ?? undefined,
      date_from: sp.get("date_from") ?? undefined,
      date_to: sp.get("date_to") ?? undefined,
      search: sp.get("search") ?? undefined,
      review_status: sp.get("status") ?? sp.get("review_status") ?? undefined,
      payment_type: sp.get("payment_type") ?? undefined,
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error("GET /api/owner/audit failed:", err);
    return NextResponse.json(
      { error: "Failed to load master audit data." },
      { status: 500 }
    );
  }
}
