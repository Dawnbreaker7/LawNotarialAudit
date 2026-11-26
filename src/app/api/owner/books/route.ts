import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBranchDisplayName } from "@/lib/auth/session";
import { requireApprovedOwnerApi } from "@/lib/owner/auth";
import { fetchOwnerBooksSnapshot } from "@/lib/owner/books";

export const preferredRegion = "sin1";

export async function GET() {
  try {
    const auth = await requireApprovedOwnerApi();
    if (auth.error) return auth.error;

    const snapshot = await fetchOwnerBooksSnapshot();
    return NextResponse.json(snapshot);
  } catch (err) {
    console.error("GET /api/owner/books failed:", err);
    return NextResponse.json(
      { error: "Failed to load notarial books." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApprovedOwnerApi();
    if (auth.error) return auth.error;

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

    const branchCode =
      typeof body.branch_code === "string"
        ? body.branch_code.trim().toUpperCase()
        : "";
    if (branchCode !== "GENSAN" && branchCode !== "MALUNGON") {
      return NextResponse.json(
        { error: "Branch code must be GENSAN or MALUNGON." },
        { status: 400 }
      );
    }

    const notaryName =
      typeof body.notary_name === "string" ? body.notary_name.trim() : "";
    const jurisdiction =
      typeof body.jurisdiction === "string" ? body.jurisdiction.trim() : "";
    const bookNo = Number(body.book_no);
    const seriesYear = Number(body.series_year);
    const appointmentDate =
      typeof body.appointment_date === "string" &&
      body.appointment_date.trim() !== ""
        ? body.appointment_date.trim()
        : null;
    const commissionExpiry =
      typeof body.commission_expiry === "string" &&
      body.commission_expiry.trim() !== ""
        ? body.commission_expiry.trim()
        : null;
    const isActive = body.is_active === undefined ? true : Boolean(body.is_active);

    if (
      !notaryName ||
      !jurisdiction ||
      !Number.isInteger(bookNo) ||
      bookNo < 1 ||
      !Number.isInteger(seriesYear) ||
      seriesYear < 2000
    ) {
      return NextResponse.json(
        {
          error:
            "Notary name, jurisdiction, valid Book No., and valid Series Year are required.",
        },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { data: branch, error: branchErr } = await supabase
      .from("branches")
      .select("id, branch_code, branch_name")
      .eq("branch_code", branchCode)
      .single();

    if (branchErr || !branch) {
      return NextResponse.json({ error: "Branch not found." }, { status: 404 });
    }

    if (isActive) {
      await supabase
        .from("notarial_books")
        .update({ is_active: false })
        .eq("branch_id", branch.id);
    }

    const { data: createdBook, error: insertErr } = await supabase
      .from("notarial_books")
      .insert({
        branch_id: branch.id,
        notary_name: notaryName,
        jurisdiction,
        appointment_date: appointmentDate,
        commission_expiry: commissionExpiry,
        book_no: bookNo,
        series_year: seriesYear,
        is_active: isActive,
      })
      .select("*")
      .single();

    if (insertErr || !createdBook) {
      throw new Error(insertErr?.message ?? "Failed to create book.");
    }

    await supabase.from("audit_logs").insert({
      branch_id: branch.id,
      session_id: auth.valid.session.id,
      action: "BOOK_CREATED",
      target_id: createdBook.id,
      old_data: null,
      new_data: {
        branch_code: branch.branch_code,
        branch_name: getBranchDisplayName(branch),
        ...createdBook,
      },
    });

    return NextResponse.json({ book: createdBook }, { status: 201 });
  } catch (err) {
    console.error("POST /api/owner/books failed:", err);
    return NextResponse.json(
      { error: "Failed to create notarial book." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireApprovedOwnerApi();
    if (auth.error) return auth.error;

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body || typeof body.bookId !== "string" || !body.bookId) {
      return NextResponse.json(
        { error: "bookId is required." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { data: existing, error: fetchErr } = await supabase
      .from("notarial_books")
      .select("*")
      .eq("id", body.bookId)
      .maybeSingle();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "Book not found." }, { status: 404 });
    }

    const notaryName =
      typeof body.notary_name === "string"
        ? body.notary_name.trim()
        : existing.notary_name;
    const jurisdiction =
      typeof body.jurisdiction === "string"
        ? body.jurisdiction.trim()
        : existing.jurisdiction;
    const appointmentDate =
      body.appointment_date === null
        ? null
        : typeof body.appointment_date === "string"
          ? body.appointment_date.trim() || null
          : existing.appointment_date;
    const commissionExpiry =
      body.commission_expiry === null
        ? null
        : typeof body.commission_expiry === "string"
          ? body.commission_expiry.trim() || null
          : existing.commission_expiry;

    const bookNo =
      body.book_no !== undefined ? Number(body.book_no) : existing.book_no;
    const seriesYear =
      body.series_year !== undefined
        ? Number(body.series_year)
        : existing.series_year;
    const isActive =
      typeof body.is_active === "boolean" ? body.is_active : existing.is_active;

    if (
      !notaryName ||
      !jurisdiction ||
      !Number.isInteger(bookNo) ||
      bookNo < 1 ||
      !Number.isInteger(seriesYear) ||
      seriesYear < 2000
    ) {
      return NextResponse.json(
        {
          error:
            "Notary name, jurisdiction, valid Book No., and valid Series Year are required.",
        },
        { status: 400 }
      );
    }

    if (isActive) {
      await supabase
        .from("notarial_books")
        .update({ is_active: false })
        .eq("branch_id", existing.branch_id)
        .neq("id", existing.id);
    }

    const { data: updatedBook, error: updateErr } = await supabase
      .from("notarial_books")
      .update({
        notary_name: notaryName,
        jurisdiction,
        appointment_date: appointmentDate,
        commission_expiry: commissionExpiry,
        book_no: bookNo,
        series_year: seriesYear,
        is_active: isActive,
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (updateErr || !updatedBook) {
      throw new Error(updateErr?.message ?? "Failed to update book.");
    }

    await supabase.from("audit_logs").insert({
      branch_id: existing.branch_id,
      session_id: auth.valid.session.id,
      action: "BOOK_UPDATED",
      target_id: existing.id,
      old_data: existing,
      new_data: {
        ...updatedBook,
        updated_by: auth.valid.branch.branch_code,
      },
    });

    return NextResponse.json({ book: updatedBook });
  } catch (err) {
    console.error("PATCH /api/owner/books failed:", err);
    return NextResponse.json(
      { error: "Failed to update notarial book." },
      { status: 500 }
    );
  }
}
