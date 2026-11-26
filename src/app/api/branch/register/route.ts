import { NextRequest, NextResponse } from "next/server";
import { canAccessBranchPortal, getValidSession } from "@/lib/auth/session";
import { fetchBranchRegisterSnapshot, MAX_PAGE_NO } from "@/lib/branch/register";

export const preferredRegion = "sin1";

export async function GET(request: NextRequest) {
  try {
    const valid = await getValidSession();
    if (!valid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canAccessBranchPortal(valid)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const sp = request.nextUrl.searchParams;
    const scope = sp.get("scope") === "book" ? "book" : "page";
    const lockToken = sp.get("lockToken");
    const rawPage = sp.get("page");
    let page: number | undefined;
    if (rawPage) {
      const parsed = Number(rawPage);
      if (Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_PAGE_NO) {
        page = parsed;
      }
    }

    const snapshot = await fetchBranchRegisterSnapshot(valid, {
      scope,
      page,
      lockToken,
    });
    return NextResponse.json(snapshot);
  } catch (err) {
    console.error("GET /api/branch/register failed:", err);
    return NextResponse.json(
      { error: "Failed to load branch register." },
      { status: 500 }
    );
  }
}
