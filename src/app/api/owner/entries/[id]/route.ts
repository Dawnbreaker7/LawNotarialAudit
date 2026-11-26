import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApprovedOwnerApi } from "@/lib/owner/auth";
import { queryOwnerEntryById } from "@/lib/owner/audit";
import {
  getPageForEntry,
  MAX_ENTRY_NUMBER,
  MAX_PAGE_NO,
  MIN_PAGE_NO,
} from "@/lib/branch/register";
import type {
  EntryAttachment,
  PaymentType,
  ReviewStatus,
} from "@/types/database";

const ALLOWED_ACT_TYPES = new Set([
  "Acknowledgment",
  "Jurat",
  "Oath / Affirmation",
  "Copy Certification",
  "Signature Witnessing",
]);

export const preferredRegion = "sin1";

function parseNonNegative(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }
  return null;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApprovedOwnerApi();
    if (auth.error) return auth.error;

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { error: "Entry ID is required." },
        { status: 400 }
      );
    }

    const entry = await queryOwnerEntryById(id);
    if (!entry) {
      return NextResponse.json({ error: "Entry not found." }, { status: 404 });
    }

    return NextResponse.json({ entry });
  } catch (err) {
    console.error("GET /api/owner/entries/[id] failed:", err);
    return NextResponse.json(
      { error: "Failed to load notarial entry details." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApprovedOwnerApi();
    if (auth.error) return auth.error;

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { error: "Entry ID is required." },
        { status: 400 }
      );
    }

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body) {
      return NextResponse.json(
        { error: "Invalid request payload." },
        { status: 400 }
      );
    }

    const editReason =
      typeof body.edit_reason === "string" ? body.edit_reason.trim() : "";
    if (!editReason) {
      return NextResponse.json(
        { error: "A reason for editing is required." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { data: existing, error: fetchError } = await supabase
      .from("notarial_entries")
      .select(
        "id, book_id, branch_id, page_no, entry_number, instrument_title, parties, secondary_parties, competent_evidence_id, notarized_at, notarial_act_type, amount_paid, payment_type, acknowledgement_receipt, place_and_remarks, review_status, reviewed_at, review_notes, attachments, created_by_session_id, created_at, updated_at"
      )
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Entry not found." }, { status: 404 });
    }

    const instrumentTitle =
      typeof body.instrument_title === "string"
        ? body.instrument_title.trim()
        : existing.instrument_title;
    const parties =
      typeof body.parties === "string"
        ? body.parties.trim()
        : existing.parties;
    const secondaryParties =
      body.secondary_parties === null
        ? null
        : typeof body.secondary_parties === "string"
          ? body.secondary_parties.trim() || null
          : existing.secondary_parties;
    const competentEvidenceId =
      typeof body.competent_evidence_id === "string"
        ? body.competent_evidence_id.trim()
        : existing.competent_evidence_id;
    const notarialActType =
      typeof body.notarial_act_type === "string"
        ? body.notarial_act_type.trim()
        : existing.notarial_act_type;
    const acknowledgementReceipt =
      body.acknowledgement_receipt === null
        ? null
        : typeof body.acknowledgement_receipt === "string"
          ? body.acknowledgement_receipt.trim() || null
          : existing.acknowledgement_receipt;
    const placeAndRemarks =
      body.place_and_remarks === null
        ? null
        : typeof body.place_and_remarks === "string"
          ? body.place_and_remarks.trim() || null
          : existing.place_and_remarks;

    if (!instrumentTitle || !parties || !notarialActType) {
      return NextResponse.json(
        { error: "Instrument title, parties, and notarial act type are required." },
        { status: 400 }
      );
    }

    if (!ALLOWED_ACT_TYPES.has(notarialActType)) {
      return NextResponse.json(
        { error: "Invalid notarial act type." },
        { status: 400 }
      );
    }

    const notarizedAtIso =
      typeof body.notarized_at === "string" && body.notarized_at.trim() !== ""
        ? new Date(body.notarized_at).toISOString()
        : existing.notarized_at;
    if (Number.isNaN(new Date(notarizedAtIso).getTime())) {
      return NextResponse.json(
        { error: "Invalid notarization date and time." },
        { status: 400 }
      );
    }

    const amountPaid =
      body.amount_paid !== undefined
        ? parseNonNegative(body.amount_paid)
        : Number(existing.amount_paid);

    if (amountPaid === null) {
      return NextResponse.json(
        { error: "Amount paid must be a valid non-negative number." },
        { status: 400 }
      );
    }

    if (
      body.payment_type !== undefined &&
      body.payment_type !== "full" &&
      body.payment_type !== "partial"
    ) {
      return NextResponse.json(
        { error: "Payment type must be 'full' or 'partial'." },
        { status: 400 }
      );
    }
    const paymentType: PaymentType =
      body.payment_type !== undefined
        ? (body.payment_type as PaymentType)
        : existing.payment_type === "partial"
          ? "partial"
          : "full";

    let entryNumber = existing.entry_number;
    if (body.entry_number !== undefined) {
      const parsedEntry = Number(body.entry_number);
      if (
        !Number.isInteger(parsedEntry) ||
        parsedEntry < 1 ||
        parsedEntry > MAX_ENTRY_NUMBER
      ) {
        return NextResponse.json(
          {
            error: "Entry No. must be between 1 and 525.",
          },
          { status: 400 }
        );
      }
      entryNumber = parsedEntry;
    }

    if (entryNumber !== existing.entry_number) {
      const { data: duplicate } = await supabase
        .from("notarial_entries")
        .select("id")
        .eq("book_id", existing.book_id)
        .eq("entry_number", entryNumber)
        .neq("id", id)
        .maybeSingle();

      if (duplicate) {
        return NextResponse.json(
          { error: `Entry No. ${entryNumber} already exists in this book.` },
          { status: 409 }
        );
      }
    }

    let pageNo = getPageForEntry(entryNumber);
    if (
      body.page_no !== undefined &&
      body.page_no !== null &&
      body.page_no !== ""
    ) {
      const parsedPage = Number(body.page_no);
      if (
        !Number.isInteger(parsedPage) ||
        parsedPage < MIN_PAGE_NO ||
        parsedPage > MAX_PAGE_NO
      ) {
        return NextResponse.json(
          { error: "Page No. must be between 2 and 106." },
          { status: 400 }
        );
      }
      pageNo = parsedPage;
    }
    if (
      !Number.isInteger(pageNo) ||
      pageNo < MIN_PAGE_NO ||
      pageNo > MAX_PAGE_NO
    ) {
      return NextResponse.json(
        { error: "Page No. must be between 2 and 106." },
        { status: 400 }
      );
    }
    const updatedAt = new Date().toISOString();

    const { data: updatedRow, error: updateError } = await supabase
      .from("notarial_entries")
      .update({
        entry_number: entryNumber,
        page_no: pageNo,
        instrument_title: instrumentTitle,
        parties,
        secondary_parties: secondaryParties,
        competent_evidence_id: competentEvidenceId,
        notarized_at: notarizedAtIso,
        notarial_act_type: notarialActType,
        amount_paid: amountPaid,
        payment_type: paymentType,
        acknowledgement_receipt: acknowledgementReceipt,
        place_and_remarks: placeAndRemarks,
        updated_at: updatedAt,
      })
      .eq("id", id)
      .select(
        "id, book_id, branch_id, page_no, entry_number, instrument_title, parties, secondary_parties, competent_evidence_id, notarized_at, notarial_act_type, amount_paid, payment_type, acknowledgement_receipt, place_and_remarks, review_status, reviewed_at, review_notes, attachments, created_by_session_id, created_at, updated_at"
      )
      .single();

    if (updateError || !updatedRow) {
      throw new Error(updateError?.message ?? "Failed to update entry.");
    }

    const normalizedOld = {
      ...existing,
      secondary_parties: existing.secondary_parties ?? null,
      amount_paid: Number(existing.amount_paid),
      payment_type: (existing.payment_type === "partial"
        ? "partial"
        : "full") as PaymentType,
      acknowledgement_receipt: existing.acknowledgement_receipt ?? null,
      review_status: (existing.review_status ?? "for_review") as ReviewStatus,
      reviewed_at: existing.reviewed_at ?? null,
      review_notes: existing.review_notes ?? null,
      attachments: Array.isArray(existing.attachments)
        ? (existing.attachments as EntryAttachment[])
        : [],
    };
    const normalizedNew = {
      ...updatedRow,
      secondary_parties: updatedRow.secondary_parties ?? null,
      amount_paid: Number(updatedRow.amount_paid),
      payment_type: (updatedRow.payment_type === "partial"
        ? "partial"
        : "full") as PaymentType,
      acknowledgement_receipt: updatedRow.acknowledgement_receipt ?? null,
      review_status: (updatedRow.review_status ?? "for_review") as ReviewStatus,
      reviewed_at: updatedRow.reviewed_at ?? null,
      review_notes: updatedRow.review_notes ?? null,
      attachments: Array.isArray(updatedRow.attachments)
        ? (updatedRow.attachments as EntryAttachment[])
        : [],
    };

    await supabase.from("audit_logs").insert({
      branch_id: existing.branch_id,
      session_id: auth.valid.session.id,
      action: "EDIT_ENTRY",
      target_id: id,
      old_data: normalizedOld,
      new_data: {
        ...normalizedNew,
        edit_reason: editReason,
        edited_by: auth.valid.branch.branch_code,
      },
    });

    return NextResponse.json({ entry: normalizedNew });
  } catch (err) {
    console.error("PATCH /api/owner/entries/[id] failed:", err);
    return NextResponse.json(
      { error: "Failed to update notarial entry." },
      { status: 500 }
    );
  }
}
