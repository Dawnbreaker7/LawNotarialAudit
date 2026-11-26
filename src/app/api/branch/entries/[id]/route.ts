import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessBranchPortal, getValidSession } from "@/lib/auth/session";
import type { EntryAttachment } from "@/types/database";

export const preferredRegion = "sin1";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const valid = await getValidSession({ touchLastSeen: false });
    if (!valid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canAccessBranchPortal(valid)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { error: "Entry ID is required." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("notarial_entries")
      .select("id, attachments, review_status, reviewed_at, review_notes")
      .eq("id", id)
      .eq("branch_id", valid.branch.id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      return NextResponse.json({ error: "Entry not found." }, { status: 404 });
    }

    return NextResponse.json({
      id: data.id,
      attachments: Array.isArray(data.attachments)
        ? (data.attachments as EntryAttachment[])
        : [],
      review_status: data.review_status,
      reviewed_at: data.reviewed_at,
      review_notes: data.review_notes,
    });
  } catch (err) {
    console.error("GET /api/branch/entries/[id] failed:", err);
    return NextResponse.json(
      { error: "Failed to load entry details." },
      { status: 500 }
    );
  }
}
