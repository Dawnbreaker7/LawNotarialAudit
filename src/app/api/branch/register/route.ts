import { NextResponse } from "next/server";
import { canAccessBranchPortal, getValidSession } from "@/lib/auth/session";
import { fetchBranchRegisterSnapshot } from "@/lib/branch/register";

export async function GET() {
  try {
    const valid = await getValidSession();
    if (!valid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canAccessBranchPortal(valid)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const snapshot = await fetchBranchRegisterSnapshot(valid);
    return NextResponse.json(snapshot);
  } catch (err) {
    console.error("GET /api/branch/register failed:", err);
    return NextResponse.json(
      { error: "Failed to load branch register." },
      { status: 500 }
    );
  }
}
