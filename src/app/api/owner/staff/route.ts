import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/auth/crypto";
import { requireApprovedOwnerApi } from "@/lib/owner/auth";
import { getBranchDisplayName } from "@/lib/auth/session";
import { fetchOwnerStaffSnapshot } from "@/lib/owner/staff";
import type { OperatingBranchCode } from "@/types/database";

export const preferredRegion = "sin1";

export async function GET() {
  try {
    const auth = await requireApprovedOwnerApi();
    if (auth.error) return auth.error;

    const snapshot = await fetchOwnerStaffSnapshot();
    if (snapshot.permissionError) {
      return NextResponse.json(
        {
          error:
            "Database permission denied for branch_users. Run scripts/grant_branch_users_permissions.sql in Supabase SQL Editor.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      staff: snapshot.staff,
      branches: snapshot.branches,
    });
  } catch (err) {
    console.error("GET /api/owner/staff failed:", err);
    return NextResponse.json(
      { error: "Failed to load branch staff accounts." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApprovedOwnerApi();
    if (auth.error) return auth.error;

    const body = (await request.json().catch(() => null)) as {
      branch_id?: unknown;
      full_name?: unknown;
      username?: unknown;
      password?: unknown;
    } | null;

    if (!body) {
      return NextResponse.json(
        { error: "Invalid request payload." },
        { status: 400 }
      );
    }

    const branchId =
      typeof body.branch_id === "string" ? body.branch_id.trim() : "";
    const fullName =
      typeof body.full_name === "string" ? body.full_name.trim() : "";
    const username =
      typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!branchId) {
      return NextResponse.json(
        { error: "Assigned branch is required." },
        { status: 400 }
      );
    }

    if (!fullName || fullName.length > 100) {
      return NextResponse.json(
        { error: "Staff name / label is required (max 100 characters)." },
        { status: 400 }
      );
    }

    if (
      username.length < 3 ||
      username.length > 40 ||
      /\s/.test(username)
    ) {
      return NextResponse.json(
        {
          error:
            "Username must be 3 to 40 characters long and cannot contain spaces.",
        },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Verify branch_id belongs to a non-dev operating branch.
    const { data: targetBranch, error: branchError } = await supabase
      .from("branches")
      .select("id, branch_code, branch_name, role, is_dev")
      .eq("id", branchId)
      .maybeSingle();

    if (branchError) {
      throw new Error(branchError.message);
    }

    if (
      !targetBranch ||
      targetBranch.role !== "branch" ||
      targetBranch.is_dev
    ) {
      return NextResponse.json(
        { error: "Selected branch is not valid for staff accounts." },
        { status: 400 }
      );
    }

    // Ensure username is unique across both branches.branch_code and branch_users.username.
    const [{ data: existingBranches }, { data: existingUsers, error: usersErr }] =
      await Promise.all([
        supabase.from("branches").select("branch_code"),
        supabase.from("branch_users").select("username"),
      ]);

    if (usersErr) {
      if (usersErr.code === "42501") {
        return NextResponse.json(
          {
            error:
              "Database permission denied for branch_users. Run scripts/grant_branch_users_permissions.sql in Supabase SQL Editor.",
          },
          { status: 500 }
        );
      }
      throw new Error(usersErr.message);
    }

    const usernameLower = username.toLowerCase();
    const conflictBranch = (existingBranches ?? []).some(
      (b) => b.branch_code.toLowerCase() === usernameLower
    );
    const conflictStaff = (existingUsers ?? []).some(
      (u) => u.username.toLowerCase() === usernameLower
    );

    if (conflictBranch || conflictStaff) {
      return NextResponse.json(
        { error: `Username "${username}" is already taken.` },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const { data: created, error: insertError } = await supabase
      .from("branch_users")
      .insert({
        branch_id: targetBranch.id,
        full_name: fullName,
        username,
        password_hash: passwordHash,
        is_active: true,
        revoked_at: null,
      })
      .select(
        "id, branch_id, full_name, username, is_active, created_at, revoked_at"
      )
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: `Username "${username}" is already taken.` },
          { status: 409 }
        );
      }
      throw new Error(insertError.message);
    }

    const branchDisplay = getBranchDisplayName(targetBranch);

    await supabase.from("audit_logs").insert({
      branch_id: targetBranch.id,
      session_id: auth.valid.session.id,
      action: "STAFF_ACCOUNT_CREATED",
      target_id: created.id,
      old_data: null,
      new_data: {
        branch_code: targetBranch.branch_code,
        branch_name: branchDisplay,
        full_name: created.full_name,
        username: created.username,
        created_by: auth.valid.branch.branch_code,
      },
    });

    return NextResponse.json(
      {
        staff: {
          id: created.id,
          branch_id: created.branch_id,
          branch_code: targetBranch.branch_code as OperatingBranchCode,
          branch_name: branchDisplay,
          full_name: created.full_name,
          username: created.username,
          is_active: Boolean(created.is_active),
          created_at: created.created_at,
          revoked_at: created.revoked_at ?? null,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/owner/staff failed:", err);
    return NextResponse.json(
      { error: "Failed to create branch staff account." },
      { status: 500 }
    );
  }
}
