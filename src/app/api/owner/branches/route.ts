import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBranchDisplayName } from "@/lib/auth/session";
import { requireApprovedOwnerApi } from "@/lib/owner/auth";
import { fetchOwnerBranchesSnapshot } from "@/lib/owner/branches";

const BCRYPT_ROUNDS = 12;

export async function GET() {
  try {
    const auth = await requireApprovedOwnerApi();
    if (auth.error) return auth.error;

    const branches = await fetchOwnerBranchesSnapshot();
    return NextResponse.json({ branches });
  } catch (err) {
    console.error("GET /api/owner/branches failed:", err);
    return NextResponse.json(
      { error: "Failed to load branch settings." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireApprovedOwnerApi();
    if (auth.error) return auth.error;

    const body = (await request.json().catch(() => null)) as {
      branchId?: unknown;
      new_password?: unknown;
      max_devices?: unknown;
      allow_mobile_login?: unknown;
      require_device_approval?: unknown;
    } | null;

    const branchId = typeof body?.branchId === "string" ? body.branchId : "";
    if (!branchId) {
      return NextResponse.json(
        { error: "branchId is required." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { data: existing, error: fetchErr } = await supabase
      .from("branches")
      .select("*")
      .eq("id", branchId)
      .maybeSingle();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "Branch not found." }, { status: 404 });
    }

    if (
      existing.branch_code !== "GENSAN" &&
      existing.branch_code !== "MALUNGON"
    ) {
      return NextResponse.json(
        { error: "Only GenSan Branch and Malungon Branch can be configured here." },
        { status: 400 }
      );
    }

    const updates: {
      password_hash?: string;
      max_devices?: number;
      allow_mobile_login?: boolean;
      require_device_approval?: boolean;
    } = {};

    let passwordUpdated = false;
    if (typeof body?.new_password === "string" && body.new_password !== "") {
      if (body.new_password.length < 6) {
        return NextResponse.json(
          { error: "New password must be at least 6 characters." },
          { status: 400 }
        );
      }
      updates.password_hash = await bcrypt.hash(
        body.new_password,
        BCRYPT_ROUNDS
      );
      passwordUpdated = true;
    }

    if (body?.max_devices !== undefined) {
      const maxDevices = Number(body.max_devices);
      if (!Number.isInteger(maxDevices) || maxDevices < 1 || maxDevices > 20) {
        return NextResponse.json(
          { error: "Max devices must be a whole number between 1 and 20." },
          { status: 400 }
        );
      }
      updates.max_devices = maxDevices;
    }

    if (typeof body?.allow_mobile_login === "boolean") {
      updates.allow_mobile_login = body.allow_mobile_login;
    }

    if (typeof body?.require_device_approval === "boolean") {
      updates.require_device_approval = body.require_device_approval;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No changes provided." },
        { status: 400 }
      );
    }

    const { data: updated, error: updateErr } = await supabase
      .from("branches")
      .update(updates)
      .eq("id", existing.id)
      .select(
        "id, branch_code, branch_name, role, allow_mobile_login, require_device_approval, max_devices, created_at"
      )
      .single();

    if (updateErr || !updated) {
      throw new Error(updateErr?.message ?? "Failed to update branch.");
    }

    await supabase.from("audit_logs").insert({
      branch_id: existing.id,
      session_id: auth.valid.session.id,
      action: "BRANCH_UPDATED",
      target_id: existing.id,
      old_data: {
        max_devices: existing.max_devices,
        allow_mobile_login: existing.allow_mobile_login,
        require_device_approval: existing.require_device_approval,
      },
      new_data: {
        branch_code: existing.branch_code,
        branch_name: getBranchDisplayName(existing),
        max_devices: updated.max_devices,
        allow_mobile_login: updated.allow_mobile_login,
        require_device_approval: updated.require_device_approval,
        password_changed: passwordUpdated,
        updated_by: auth.valid.branch.branch_code,
      },
    });

    return NextResponse.json({
      branch: {
        ...updated,
        display_name: getBranchDisplayName(updated),
      },
    });
  } catch (err) {
    console.error("PATCH /api/owner/branches failed:", err);
    return NextResponse.json(
      { error: "Failed to update branch settings." },
      { status: 500 }
    );
  }
}
