import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  canAccessBranchPortal,
  getBranchDisplayName,
  getValidSession,
} from "@/lib/auth/session";
import { MAX_ENTRY_NUMBER } from "@/lib/branch/register";

export const preferredRegion = "sin1";

const DEFAULT_LOCK_TTL_SECONDS = 120;

interface LockRequestBody {
  action?: unknown;
  bookId?: unknown;
  entryNumber?: unknown;
  lockToken?: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const valid = await getValidSession({ touchLastSeen: false });
    if (!valid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canAccessBranchPortal(valid)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rawText = await request.text().catch(() => "");
    let body: LockRequestBody | null = null;
    if (rawText) {
      try {
        body = JSON.parse(rawText) as LockRequestBody;
      } catch {
        body = null;
      }
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid lock request payload." },
        { status: 400 }
      );
    }

    const action = body.action === "release" ? "release" : "acquire";
    const bookId = typeof body.bookId === "string" ? body.bookId.trim() : "";
    const entryNumber = Number(body.entryNumber);
    const lockToken =
      typeof body.lockToken === "string" && body.lockToken.trim() !== ""
        ? body.lockToken.trim()
        : valid.session.id;

    if (!bookId) {
      return NextResponse.json(
        { error: "Active bookId is required." },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(entryNumber) ||
      entryNumber < 1 ||
      entryNumber > MAX_ENTRY_NUMBER
    ) {
      return NextResponse.json(
        { error: "Entry No. must be between 1 and 525." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Verify book belongs to this authenticated branch.
    const { data: bookRow, error: bookError } = await supabase
      .from("notarial_books")
      .select("id, branch_id")
      .eq("id", bookId)
      .eq("branch_id", valid.branch.id)
      .maybeSingle();

    if (bookError) {
      throw new Error(bookError.message);
    }
    if (!bookRow) {
      return NextResponse.json(
        { error: "Notarial book not found for this branch." },
        { status: 404 }
      );
    }

    const userId = valid.branch_user_id ?? null;
    const userName =
      valid.staff_name || getBranchDisplayName(valid.branch) || "Branch Staff";

    if (action === "release") {
      const { error: releaseError } = await supabase.rpc("release_entry_lock", {
        p_book_id: bookRow.id,
        p_entry_number: entryNumber,
        p_user_id: userId,
        p_session_token: lockToken,
      });

      if (releaseError) {
        throw new Error(releaseError.message);
      }

      return NextResponse.json({ released: true });
    }

    const { data: rpcResult, error: acquireError } = await supabase.rpc(
      "acquire_entry_lock",
      {
        p_book_id: bookRow.id,
        p_branch_id: valid.branch.id,
        p_entry_number: entryNumber,
        p_user_id: userId,
        p_user_name: userName,
        p_session_token: lockToken,
        p_ttl_seconds: DEFAULT_LOCK_TTL_SECONDS,
      }
    );

    if (acquireError) {
      throw new Error(acquireError.message);
    }

    const result = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
    const acquired = Boolean(result?.acquired);
    const lockedByName =
      typeof result?.locked_by_name === "string" && result.locked_by_name
        ? result.locked_by_name
        : "another user";
    const expiresAt =
      typeof result?.expires_at === "string"
        ? result.expires_at
        : new Date(Date.now() + DEFAULT_LOCK_TTL_SECONDS * 1000).toISOString();

    if (!acquired) {
      return NextResponse.json(
        {
          acquired: false,
          reason: result?.reason ?? "locked_by_other",
          locked_by_name: lockedByName,
          expires_at: expiresAt,
          message: `Entry #${entryNumber} is currently being used by ${lockedByName}.`,
        },
        { status: 423 }
      );
    }

    return NextResponse.json({
      acquired: true,
      locked_by_name: lockedByName,
      expires_at: expiresAt,
    });
  } catch (err) {
    console.error("POST /api/branch/entries/lock failed:", err);
    return NextResponse.json(
      { error: "Failed to process entry number lock." },
      { status: 500 }
    );
  }
}

