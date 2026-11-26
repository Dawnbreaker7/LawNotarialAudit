import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/auth/crypto";
import { requireApprovedOwnerApi } from "@/lib/owner/auth";
import { getBranchDisplayName } from "@/lib/auth/session";
import type { OperatingBranchCode } from "@/types/database";

export const preferredRegion = "sin1";

const STAFF_SAFE_SELECT =
  "id, branch_id, full_name, username, is_active, created_at, revoked_at";

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
        { error: "Staff account ID is required." },
        { status: 400 }
      );
    }

    const body = (await request.json().catch(() => null)) as {
      action?: unknown;
      newPassword?: unknown;
    } | null;

    const action = typeof body?.action === "string" ? body.action.trim() : "";
    if (
      action !== "revoke" &&
      action !== "restore" &&
      action !== "reset_password"
    ) {
      return NextResponse.json(
        { error: "Action must be 'revoke', 'restore', or 'reset_password'." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { data: existing, error: fetchError } = await supabase
      .from("branch_users")
      .select(STAFF_SAFE_SELECT)
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      throw new Error(fetchError.message);
    }
    if (!existing) {
      return NextResponse.json(
        { error: "Staff account not found." },
        { status: 404 }
      );
    }

    const { data: branchRow } = await supabase
      .from("branches")
      .select("id, branch_code, branch_name")
      .eq("id", existing.branch_id)
      .maybeSingle();

    const branchCode = (branchRow?.branch_code ?? "GENSAN") as OperatingBranchCode;
    const branchName = branchRow
      ? getBranchDisplayName(branchRow)
      : branchCode === "MALUNGON"
        ? "Malungon Branch"
        : "GenSan Branch";

    if (action === "revoke") {
      const revokedAt = new Date().toISOString();
      const { data: updated, error: updateError } = await supabase
        .from("branch_users")
        .update({
          is_active: false,
          revoked_at: revokedAt,
        })
        .eq("id", id)
        .select(STAFF_SAFE_SELECT)
        .single();

      if (updateError || !updated) {
        throw new Error(updateError?.message ?? "Failed to revoke access.");
      }

      // Immediately kill all active sessions for this staff user.
      await supabase
        .from("device_sessions")
        .delete()
        .eq("branch_user_id", id);

      await supabase.from("audit_logs").insert({
        branch_id: existing.branch_id,
        session_id: auth.valid.session.id,
        action: "STAFF_ACCESS_REVOKED",
        target_id: id,
        old_data: {
          is_active: existing.is_active,
          revoked_at: existing.revoked_at,
        },
        new_data: {
          branch_code: branchCode,
          branch_name: branchName,
          full_name: updated.full_name,
          username: updated.username,
          is_active: false,
          revoked_at: revokedAt,
          revoked_by: auth.valid.branch.branch_code,
        },
      });

      return NextResponse.json({
        staff: {
          ...updated,
          branch_code: branchCode,
          branch_name: branchName,
        },
      });
    }

    if (action === "restore") {
      const { data: updated, error: updateError } = await supabase
        .from("branch_users")
        .update({
          is_active: true,
          revoked_at: null,
        })
        .eq("id", id)
        .select(STAFF_SAFE_SELECT)
        .single();

      if (updateError || !updated) {
        throw new Error(updateError?.message ?? "Failed to restore access.");
      }

      await supabase.from("audit_logs").insert({
        branch_id: existing.branch_id,
        session_id: auth.valid.session.id,
        action: "STAFF_ACCESS_RESTORED",
        target_id: id,
        old_data: {
          is_active: existing.is_active,
          revoked_at: existing.revoked_at,
        },
        new_data: {
          branch_code: branchCode,
          branch_name: branchName,
          full_name: updated.full_name,
          username: updated.username,
          is_active: true,
          restored_by: auth.valid.branch.branch_code,
        },
      });

      return NextResponse.json({
        staff: {
          ...updated,
          branch_code: branchCode,
          branch_name: branchName,
        },
      });
    }

    // action === "reset_password"
    const newPassword =
      typeof body?.newPassword === "string" ? body.newPassword : "";
    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(newPassword);
    const { data: updated, error: updateError } = await supabase
      .from("branch_users")
      .update({ password_hash: passwordHash })
      .eq("id", id)
      .select(STAFF_SAFE_SELECT)
      .single();

    if (updateError || !updated) {
      throw new Error(updateError?.message ?? "Failed to reset password.");
    }

    // Force staff user to sign in again with the newly assigned password.
    await supabase
      .from("device_sessions")
      .delete()
      .eq("branch_user_id", id);

    await supabase.from("audit_logs").insert({
      branch_id: existing.branch_id,
      session_id: auth.valid.session.id,
      action: "STAFF_PASSWORD_RESET",
      target_id: id,
      old_data: null,
      new_data: {
        branch_code: branchCode,
        branch_name: branchName,
        full_name: updated.full_name,
        username: updated.username,
        reset_by: auth.valid.branch.branch_code,
      },
    });

    return NextResponse.json({
      staff: {
        ...updated,
        branch_code: branchCode,
        branch_name: branchName,
      },
    });
  } catch (err) {
    console.error("PATCH /api/owner/staff/[id] failed:", err);
    return NextResponse.json(
      { error: "Failed to update branch staff account." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApprovedOwnerApi();
    if (auth.error) return auth.error;

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { error: "Staff account ID is required." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { data: existing, error: fetchError } = await supabase
      .from("branch_users")
      .select(STAFF_SAFE_SELECT)
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      throw new Error(fetchError.message);
    }
    if (!existing) {
      return NextResponse.json(
        { error: "Staff account not found." },
        { status: 404 }
      );
    }

    await supabase
      .from("device_sessions")
      .delete()
      .eq("branch_user_id", id);

    const { error: deleteError } = await supabase
      .from("branch_users")
      .delete()
      .eq("id", id);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    await supabase.from("audit_logs").insert({
      branch_id: existing.branch_id,
      session_id: auth.valid.session.id,
      action: "STAFF_ACCOUNT_DELETED",
      target_id: id,
      old_data: {
        full_name: existing.full_name,
        username: existing.username,
        is_active: existing.is_active,
        revoked_at: existing.revoked_at,
      },
      new_data: {
        deleted_by: auth.valid.branch.branch_code,
      },
    });

    return NextResponse.json({ deletedId: id });
  } catch (err) {
    console.error("DELETE /api/owner/staff/[id] failed:", err);
    return NextResponse.json(
      { error: "Failed to delete branch staff account." },
      { status: 500 }
    );
  }
}
