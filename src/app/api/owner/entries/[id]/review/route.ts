import { NextResponse } from "next/server";
import { requireApprovedOwnerApi } from "@/lib/owner/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EntryAttachment, PaymentType, ReviewStatus } from "@/types/database";

const ENTRY_SELECT =
  "id, book_id, branch_id, page_no, entry_number, instrument_title, parties, secondary_parties, competent_evidence_id, notarized_at, notarial_act_type, amount_paid, payment_type, acknowledgement_receipt, place_and_remarks, review_status, reviewed_at, review_notes, attachments, created_by_session_id, created_at, updated_at";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApprovedOwnerApi();
    if ("error" in auth) {
      return auth.error;
    }

    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as {
      action?: unknown;
      review_notes?: unknown;
    } | null;

    if (!body || (body.action !== "approve" && body.action !== "flag")) {
      return NextResponse.json(
        { error: "Invalid review action. Must be 'approve' or 'flag'." },
        { status: 400 }
      );
    }

    const trimmedNotes =
      typeof body.review_notes === "string" ? body.review_notes.trim() : "";

    if (body.action === "flag" && !trimmedNotes) {
      return NextResponse.json(
        { error: "Please enter a review note explaining why this entry is flagged." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: existing, error: fetchError } = await supabase
      .from("notarial_entries")
      .select(ENTRY_SELECT)
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: "Entry not found." }, { status: 404 });
    }

    const nextStatus: ReviewStatus =
      body.action === "approve" ? "approved" : "flagged";
    const reviewedAt = new Date().toISOString();
    const reviewNotes = trimmedNotes ? trimmedNotes : null;

    const { data: updated, error: updateError } = await supabase
      .from("notarial_entries")
      .update({
        review_status: nextStatus,
        reviewed_at: reviewedAt,
        review_notes: reviewNotes,
      })
      .eq("id", id)
      .select(ENTRY_SELECT)
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        { error: updateError?.message ?? "Failed to update review status." },
        { status: 500 }
      );
    }

    await supabase.from("audit_logs").insert({
      branch_id: existing.branch_id,
      session_id: auth.valid.session.id,
      action: body.action === "approve" ? "APPROVE_ENTRY" : "FLAG_ENTRY",
      target_id: id,
      old_data: {
        entry_number: existing.entry_number,
        review_status: existing.review_status,
        reviewed_at: existing.reviewed_at,
        review_notes: existing.review_notes,
      },
      new_data: {
        entry_number: updated.entry_number,
        review_status: updated.review_status,
        reviewed_at: updated.reviewed_at,
        review_notes: updated.review_notes,
      },
    });

    return NextResponse.json({
      entry: {
        ...updated,
        amount_paid: Number(updated.amount_paid),
        payment_type: (updated.payment_type === "partial"
          ? "partial"
          : "full") as PaymentType,
        acknowledgement_receipt: updated.acknowledgement_receipt ?? null,
        review_status: (updated.review_status ?? "for_review") as ReviewStatus,
        reviewed_at: updated.reviewed_at ?? null,
        review_notes: updated.review_notes ?? null,
        attachments: Array.isArray(updated.attachments)
          ? (updated.attachments as EntryAttachment[])
          : [],
      },
    });
  } catch (error) {
    console.error("Owner review error:", error);
    return NextResponse.json(
      { error: "Unable to submit entry review." },
      { status: 500 }
    );
  }
}
