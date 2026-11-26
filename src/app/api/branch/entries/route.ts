import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  canAccessBranchPortal,
  getBranchDisplayName,
  getValidSession,
} from "@/lib/auth/session";
import {
  getActiveBranchBook,
  getPageForEntry,
  getUsedEntryNumbersForBook,
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

function parseNonNegativeAmount(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const valid = await getValidSession();
    if (!valid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canAccessBranchPortal(valid)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const activeBook = await getActiveBranchBook(valid.branch.id);
    if (!activeBook) {
      return NextResponse.json(
        { error: "No active notarial book is configured for this branch." },
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

    const instrumentTitle =
      typeof body.instrument_title === "string"
        ? body.instrument_title.trim()
        : "";
    const parties =
      typeof body.parties === "string" ? body.parties.trim() : "";
    const secondaryParties =
      typeof body.secondary_parties === "string" &&
      body.secondary_parties.trim() !== ""
        ? body.secondary_parties.trim()
        : null;
    const competentEvidenceId =
      typeof body.competent_evidence_id === "string"
        ? body.competent_evidence_id.trim()
        : "";
    const notarizedAtRaw =
      typeof body.notarized_at === "string" ? body.notarized_at.trim() : "";
    const notarialActType =
      typeof body.notarial_act_type === "string"
        ? body.notarial_act_type.trim()
        : "";
    const amountPaid = parseNonNegativeAmount(body.amount_paid);
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
      body.payment_type === "partial" ? "partial" : "full";
    const acknowledgementReceipt =
      typeof body.acknowledgement_receipt === "string" &&
      body.acknowledgement_receipt.trim() !== ""
        ? body.acknowledgement_receipt.trim()
        : null;
    const placeAndRemarks =
      typeof body.place_and_remarks === "string" &&
      body.place_and_remarks.trim() !== ""
        ? body.place_and_remarks.trim()
        : null;

    if (!instrumentTitle || !parties || !notarizedAtRaw || !notarialActType) {
      return NextResponse.json(
        {
          error:
            "Instrument title, parties, date/time of notarization, and type of notarial act are required.",
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_ACT_TYPES.has(notarialActType)) {
      return NextResponse.json(
        { error: "Invalid notarial act type." },
        { status: 400 }
      );
    }

    const parsedDate = new Date(notarizedAtRaw);
    if (Number.isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid notarization date and time." },
        { status: 400 }
      );
    }

    if (amountPaid === null) {
      return NextResponse.json(
        { error: "Amount paid must be a valid non-negative number." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const branchDisplayName = getBranchDisplayName(valid.branch);
    const lockToken =
      typeof body.lock_token === "string" && body.lock_token.trim() !== ""
        ? body.lock_token.trim()
        : typeof body.lockToken === "string" && body.lockToken.trim() !== ""
          ? body.lockToken.trim()
          : valid.session.id;

    const { usedEntryNumbers, nextAvailableEntryNumber } =
      await getUsedEntryNumbersForBook(
        valid.branch.id,
        activeBook.id,
        lockToken
      );
    const usedSet = new Set(usedEntryNumbers);

    let entryNumber: number;
    if (
      body.entry_number !== undefined &&
      body.entry_number !== null &&
      body.entry_number !== ""
    ) {
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
    } else {
      if (nextAvailableEntryNumber === null) {
        return NextResponse.json(
          {
            error: "Entry No. must be between 1 and 525.",
          },
          { status: 400 }
        );
      }
      entryNumber = nextAvailableEntryNumber;
    }

    if (usedSet.has(entryNumber)) {
      return NextResponse.json(
        {
          error: `Entry No. ${entryNumber} is already used by ${branchDisplayName}.`,
          nextAvailableEntryNumber,
        },
        { status: 409 }
      );
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

    let sanitizedAttachments: EntryAttachment[] = [];
    if (body.attachments !== undefined) {
      if (!Array.isArray(body.attachments)) {
        return NextResponse.json(
          { error: "Attachments must be an array." },
          { status: 400 }
        );
      }

      const expectedPrefix = `${valid.branch.branch_code}/${activeBook.id}/entry-${entryNumber}/`;
      for (const rawAtt of body.attachments) {
        if (!rawAtt || typeof rawAtt !== "object") {
          return NextResponse.json(
            { error: "Invalid attachment metadata." },
            { status: 400 }
          );
        }
        const att = rawAtt as Record<string, unknown>;
        const id = typeof att.id === "string" ? att.id.trim() : "";
        const path = typeof att.path === "string" ? att.path.trim() : "";
        const fileName =
          typeof att.file_name === "string" ? att.file_name.trim() : "";
        const mimeType =
          typeof att.mime_type === "string" ? att.mime_type.trim() : "";
        const size = typeof att.size === "number" ? att.size : NaN;
        const uploadedAt =
          typeof att.uploaded_at === "string"
            ? att.uploaded_at
            : new Date().toISOString();

        if (
          !id ||
          !path ||
          path.includes("..") ||
          !path.startsWith(expectedPrefix) ||
          !fileName ||
          !mimeType ||
          !Number.isFinite(size) ||
          size <= 0
        ) {
          return NextResponse.json(
            { error: "Attachment path or metadata is invalid for this entry." },
            { status: 400 }
          );
        }

        sanitizedAttachments.push({
          id,
          path,
          file_name: fileName,
          mime_type: mimeType,
          size,
          uploaded_at: uploadedAt,
        });
      }
    }

    // Verify or acquire the live entry_number_lock before persisting the record.
    const lockUserId = valid.branch_user_id ?? null;
    const lockUserName =
      valid.staff_name || branchDisplayName || "Branch Staff";
    const { data: lockRpcResult, error: lockAcquireError } = await supabase.rpc(
      "acquire_entry_lock",
      {
        p_book_id: activeBook.id,
        p_branch_id: valid.branch.id,
        p_entry_number: entryNumber,
        p_user_id: lockUserId,
        p_user_name: lockUserName,
        p_session_token: lockToken,
        p_ttl_seconds: 120,
      }
    );

    if (lockAcquireError) {
      throw new Error(lockAcquireError.message);
    }

    const lockResult = Array.isArray(lockRpcResult)
      ? lockRpcResult[0]
      : lockRpcResult;
    if (!lockResult?.acquired) {
      const lockedByName =
        typeof lockResult?.locked_by_name === "string" &&
        lockResult.locked_by_name
          ? lockResult.locked_by_name
          : "another user";
      return NextResponse.json(
        {
          error: `Cannot save: Entry #${entryNumber} is currently being used by ${lockedByName}.`,
          locked_by_name: lockedByName,
          nextAvailableEntryNumber,
        },
        { status: 423 }
      );
    }

    // Strictly bind branch_id, book_id, created_by_session_id, and staff identity from server session.
    const { data: createdEntry, error: insertError } = await supabase
      .from("notarial_entries")
      .insert({
        book_id: activeBook.id,
        branch_id: valid.branch.id,
        page_no: pageNo,
        entry_number: entryNumber,
        instrument_title: instrumentTitle,
        parties,
        secondary_parties: secondaryParties,
        competent_evidence_id: competentEvidenceId,
        notarized_at: parsedDate.toISOString(),
        notarial_act_type: notarialActType,
        fee_amount: 0,
        amount_paid: amountPaid,
        payment_type: paymentType,
        acknowledgement_receipt: acknowledgementReceipt,
        place_and_remarks: placeAndRemarks,
        review_status: "for_review",
        reviewed_at: null,
        review_notes: null,
        attachments: sanitizedAttachments,
        created_by_session_id: valid.session.id,
        encoded_by_user_id: valid.branch_user_id,
        encoded_by_name: valid.staff_name,
      })
      .select(
        "id, book_id, branch_id, page_no, entry_number, instrument_title, parties, secondary_parties, competent_evidence_id, notarized_at, notarial_act_type, amount_paid, payment_type, acknowledgement_receipt, place_and_remarks, review_status, reviewed_at, review_notes, attachments, created_by_session_id, encoded_by_user_id, encoded_by_name, created_at, updated_at"
      )
      .single();

    if (insertError || !createdEntry) {
      if (insertError?.code === "23505") {
        const latest = await getUsedEntryNumbersForBook(
          valid.branch.id,
          activeBook.id,
          lockToken
        );
        return NextResponse.json(
          {
            error: `Entry No. ${entryNumber} is already used by ${branchDisplayName}.`,
            nextAvailableEntryNumber: latest.nextAvailableEntryNumber,
          },
          { status: 409 }
        );
      }
      throw new Error(insertError?.message ?? "Failed to save entry.");
    }

    // Release the live entry lock immediately once the permanent entry row is committed.
    const { error: releaseLockError } = await supabase.rpc(
      "release_entry_lock",
      {
        p_book_id: activeBook.id,
        p_entry_number: entryNumber,
        p_user_id: lockUserId,
        p_session_token: lockToken,
      }
    );
    if (releaseLockError) {
      console.warn(
        "Non-fatal warning releasing entry_number_lock after save:",
        releaseLockError.message
      );
    }

    const normalizedEntry = {
      ...createdEntry,
      secondary_parties: createdEntry.secondary_parties ?? null,
      amount_paid: Number(createdEntry.amount_paid),
      payment_type: (createdEntry.payment_type === "partial"
        ? "partial"
        : "full") as PaymentType,
      acknowledgement_receipt: createdEntry.acknowledgement_receipt ?? null,
      review_status: (createdEntry.review_status ?? "for_review") as ReviewStatus,
      reviewed_at: createdEntry.reviewed_at ?? null,
      review_notes: createdEntry.review_notes ?? null,
      attachments: Array.isArray(createdEntry.attachments)
        ? (createdEntry.attachments as EntryAttachment[])
        : [],
    };

    const nextBookPageNo = Math.max(
      MIN_PAGE_NO,
      activeBook.current_page_no || MIN_PAGE_NO,
      Number(pageNo)
    );
    if ("current_page_no" in activeBook) {
      const { error: bookUpdateError } = await supabase
        .from("notarial_books")
        .update({ current_page_no: nextBookPageNo })
        .eq("id", activeBook.id);
      if (bookUpdateError && bookUpdateError.code !== "42703") {
        console.error(
          "Failed to sync notarial_books.current_page_no:",
          bookUpdateError
        );
      }
    }

    await supabase.from("audit_logs").insert({
      branch_id: valid.branch.id,
      session_id: valid.session.id,
      action: "CREATE_ENTRY",
      target_id: createdEntry.id,
      old_data: null,
      new_data: {
        branch_code: valid.branch.branch_code,
        branch_name: getBranchDisplayName(valid.branch),
        book_no: activeBook.book_no,
        series_year: activeBook.series_year,
        entry: normalizedEntry,
      },
    });

    return NextResponse.json({ entry: normalizedEntry }, { status: 201 });
  } catch (err) {
    console.error("POST /api/branch/entries failed:", err);
    return NextResponse.json(
      { error: "Failed to record notarial entry." },
      { status: 500 }
    );
  }
}
