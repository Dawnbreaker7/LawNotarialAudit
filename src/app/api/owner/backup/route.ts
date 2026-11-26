import { NextResponse } from "next/server";
import { requireApprovedOwnerApi } from "@/lib/owner/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const preferredRegion = "sin1";

export async function GET() {
  try {
    const auth = await requireApprovedOwnerApi();
    if ("error" in auth) {
      return auth.error;
    }

    const supabase = createAdminClient();

    const [
      branchesRes,
      booksRes,
      entriesRes,
      devicesRes,
      sessionsRes,
      logsRes,
    ] = await Promise.all([
      supabase
        .from("branches")
        .select(
          "id, branch_code, branch_name, role, allow_mobile_login, require_device_approval, max_devices, created_at"
        )
        .order("branch_code", { ascending: true }),
      supabase
        .from("notarial_books")
        .select("*")
        .order("series_year", { ascending: false })
        .order("book_no", { ascending: false }),
      supabase
        .from("notarial_entries")
        .select(
          "id, book_id, branch_id, page_no, entry_number, instrument_title, parties, secondary_parties, competent_evidence_id, notarized_at, notarial_act_type, amount_paid, payment_type, acknowledgement_receipt, place_and_remarks, review_status, reviewed_at, review_notes, attachments, created_by_session_id, created_at, updated_at"
        )
        .order("notarized_at", { ascending: false }),
      supabase
        .from("authorized_devices")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("device_sessions")
        .select(
          "id, branch_id, device_id, ip_address, user_agent, device_type, os_info, browser_info, is_active, created_at, last_seen_at, revoked_at"
        )
        .order("last_seen_at", { ascending: false }),
      supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);

    const firstError =
      branchesRes.error ??
      booksRes.error ??
      entriesRes.error ??
      devicesRes.error ??
      sessionsRes.error ??
      logsRes.error;

    if (firstError) {
      return NextResponse.json(
        { error: firstError.message },
        { status: 500 }
      );
    }

    const payload = {
      exported_at: new Date().toISOString(),
      exported_by: auth.valid.branch.branch_code,
      branches: branchesRes.data ?? [],
      notarial_books: booksRes.data ?? [],
      notarial_entries: entriesRes.data ?? [],
      authorized_devices: devicesRes.data ?? [],
      device_sessions: sessionsRes.data ?? [],
      audit_logs: logsRes.data ?? [],
    };

    const dateTag = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="notarial-system-backup-${dateTag}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("GET /api/owner/backup failed:", err);
    return NextResponse.json(
      { error: "Failed to export full system backup." },
      { status: 500 }
    );
  }
}
