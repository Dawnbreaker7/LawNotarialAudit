import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getValidSession } from "@/lib/auth/session";
import { fetchOwnerDevicesSnapshot } from "@/lib/owner/devices";

export const preferredRegion = "sin1";

async function broadcastEvent(
  channelName: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const supabase = createAdminClient();
  const channel = supabase.channel(channelName);
  try {
    await channel.httpSend(event, payload);
  } catch {
    // 5-second fallback polling in SessionWatcher still ensures sync.
  } finally {
    await supabase.removeChannel(channel);
  }
}

async function requireApprovedOwner() {
  const valid = await getValidSession();
  if (!valid) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (valid.branch.role !== "owner") {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { valid };
}

export async function GET() {
  try {
    const auth = await requireApprovedOwner();
    if ("error" in auth && auth.error) {
      return auth.error;
    }

    const snapshot = await fetchOwnerDevicesSnapshot();
    return NextResponse.json({
      ...snapshot,
      currentSessionId: auth.valid.session.id,
      currentDeviceId: auth.valid.device?.id ?? null,
    });
  } catch (err) {
    console.error("GET /api/owner/devices failed:", err);
    return NextResponse.json(
      { error: "Failed to load devices and sessions." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireApprovedOwner();
    if ("error" in auth && auth.error) {
      return auth.error;
    }

    const body = (await request.json().catch(() => null)) as {
      deviceId?: unknown;
      device_label?: unknown;
      is_approved?: unknown;
    } | null;

    const deviceId = typeof body?.deviceId === "string" ? body.deviceId : "";
    if (!deviceId) {
      return NextResponse.json(
        { error: "deviceId is required." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { data: existingDevice, error: deviceFetchError } = await supabase
      .from("authorized_devices")
      .select("*")
      .eq("id", deviceId)
      .maybeSingle();

    if (deviceFetchError || !existingDevice) {
      return NextResponse.json({ error: "Device not found." }, { status: 404 });
    }

    const { data: deviceBranch, error: branchFetchError } = await supabase
      .from("branches")
      .select("id, branch_code, branch_name, max_devices")
      .eq("id", existingDevice.branch_id)
      .single();

    if (branchFetchError || !deviceBranch) {
      return NextResponse.json({ error: "Branch not found." }, { status: 404 });
    }

    const updates: { device_label?: string; is_approved?: boolean } = {};

    if (typeof body?.device_label === "string") {
      const trimmedLabel = body.device_label.trim();
      if (!trimmedLabel) {
        return NextResponse.json(
          { error: "Device label cannot be empty." },
          { status: 400 }
        );
      }
      updates.device_label = trimmedLabel;
    }

    if (typeof body?.is_approved === "boolean") {
      if (
        deviceId === auth.valid.device?.id &&
        body.is_approved === false
      ) {
        return NextResponse.json(
          { error: "You cannot revoke the device you are currently using." },
          { status: 400 }
        );
      }

      if (body.is_approved === true && !existingDevice.is_approved) {
        const { count: approvedCountRaw, error: countError } = await supabase
          .from("authorized_devices")
          .select("id", { count: "exact", head: true })
          .eq("branch_id", existingDevice.branch_id)
          .eq("is_approved", true);

        if (countError) {
          throw new Error(countError.message);
        }

        const approvedCount = approvedCountRaw ?? 0;
        if (approvedCount >= deviceBranch.max_devices) {
          return NextResponse.json(
            {
              error: `Cannot approve: maximum approved devices (${deviceBranch.max_devices}) reached for ${deviceBranch.branch_name}.`,
            },
            { status: 409 }
          );
        }
      }

      updates.is_approved = body.is_approved;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields provided to update." },
        { status: 400 }
      );
    }

    const { data: updatedDevice, error: updateError } = await supabase
      .from("authorized_devices")
      .update(updates)
      .eq("id", deviceId)
      .select("*")
      .single();

    if (updateError || !updatedDevice) {
      throw new Error(updateError?.message ?? "Failed to update device.");
    }

    if (
      typeof updates.is_approved === "boolean" &&
      updates.is_approved !== existingDevice.is_approved
    ) {
      await supabase.from("audit_logs").insert({
        branch_id: existingDevice.branch_id,
        session_id: auth.valid.session.id,
        action: updates.is_approved ? "DEVICE_APPROVED" : "DEVICE_REVOKED",
        target_id: existingDevice.id,
        old_data: {
          is_approved: existingDevice.is_approved,
          device_label: existingDevice.device_label,
        },
        new_data: {
          is_approved: updatedDevice.is_approved,
          device_label: updatedDevice.device_label,
          updated_by: auth.valid.branch.branch_code,
        },
      });

      await broadcastEvent(`device:${existingDevice.id}`, "device_updated", {
        deviceId: existingDevice.id,
        is_approved: updatedDevice.is_approved,
      });
    }

    return NextResponse.json({ device: updatedDevice });
  } catch (err) {
    console.error("PATCH /api/owner/devices failed:", err);
    return NextResponse.json(
      { error: "Failed to update device." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApprovedOwner();
    if ("error" in auth && auth.error) {
      return auth.error;
    }

    const body = (await request.json().catch(() => null)) as {
      action?: unknown;
      sessionId?: unknown;
    } | null;

    if (body?.action !== "force_logout" || typeof body?.sessionId !== "string") {
      return NextResponse.json(
        { error: "Invalid action or sessionId." },
        { status: 400 }
      );
    }

    const sessionId = body.sessionId;
    if (sessionId === auth.valid.session.id) {
      return NextResponse.json(
        { error: "Use the Logout button to end your own active session." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { data: targetSession, error: fetchError } = await supabase
      .from("device_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();

    if (fetchError || !targetSession) {
      return NextResponse.json(
        { error: "Session not found." },
        { status: 404 }
      );
    }

    const nowIso = new Date().toISOString();
    const { error: revokeError } = await supabase
      .from("device_sessions")
      .update({
        is_active: false,
        revoked_at: nowIso,
        revoked_by: auth.valid.branch.branch_code,
      })
      .eq("id", sessionId);

    if (revokeError) {
      throw new Error(revokeError.message);
    }

    await supabase.from("audit_logs").insert({
      branch_id: targetSession.branch_id,
      session_id: auth.valid.session.id,
      action: "DEVICE_REVOKED",
      target_id: targetSession.id,
      old_data: { is_active: targetSession.is_active },
      new_data: {
        is_active: false,
        revoked_at: nowIso,
        revoked_by: auth.valid.branch.branch_code,
        device_id: targetSession.device_id,
      },
    });

    await broadcastEvent(`session:${sessionId}`, "session_revoked", {
      sessionId,
      revokedAt: nowIso,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/owner/devices failed:", err);
    return NextResponse.json(
      { error: "Failed to force logout session." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireApprovedOwner();
    if ("error" in auth && auth.error) {
      return auth.error;
    }

    const body = (await request.json().catch(() => null)) as {
      deviceId?: unknown;
    } | null;
    const deviceId =
      typeof body?.deviceId === "string"
        ? body.deviceId
        : (request.nextUrl.searchParams.get("deviceId") ?? "");

    if (!deviceId) {
      return NextResponse.json(
        { error: "deviceId is required." },
        { status: 400 }
      );
    }

    if (deviceId === auth.valid.device?.id) {
      return NextResponse.json(
        { error: "You cannot delete the device you are currently using." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { data: existingDevice, error: deviceFetchError } = await supabase
      .from("authorized_devices")
      .select("*")
      .eq("id", deviceId)
      .maybeSingle();

    if (deviceFetchError || !existingDevice) {
      return NextResponse.json({ error: "Device not found." }, { status: 404 });
    }

    // Revoke any active sessions tied to this device and notify connected tabs.
    const { data: activeDeviceSessions } = await supabase
      .from("device_sessions")
      .select("id")
      .eq("device_id", deviceId)
      .eq("is_active", true);

    const nowIso = new Date().toISOString();
    if (activeDeviceSessions && activeDeviceSessions.length > 0) {
      await supabase
        .from("device_sessions")
        .update({
          is_active: false,
          revoked_at: nowIso,
          revoked_by: auth.valid.branch.branch_code,
        })
        .eq("device_id", deviceId)
        .eq("is_active", true);

      await Promise.all(
        activeDeviceSessions.map((s) =>
          broadcastEvent(`session:${s.id}`, "session_revoked", {
            sessionId: s.id,
            revokedAt: nowIso,
          })
        )
      );
    }

    // Detach device_id on historical sessions (or delete sessions if device_id is NOT NULL).
    const { error: detachError } = await supabase
      .from("device_sessions")
      .update({ device_id: null })
      .eq("device_id", deviceId);

    if (detachError) {
      await supabase.from("device_sessions").delete().eq("device_id", deviceId);
    }

    const { error: deleteError } = await supabase
      .from("authorized_devices")
      .delete()
      .eq("id", deviceId);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    await supabase.from("audit_logs").insert({
      branch_id: existingDevice.branch_id,
      session_id: auth.valid.session.id,
      action: "DEVICE_REVOKED",
      target_id: existingDevice.id,
      old_data: {
        device_label: existingDevice.device_label,
        is_approved: existingDevice.is_approved,
        os_name: existingDevice.os_name,
        browser_name: existingDevice.browser_name,
      },
      new_data: {
        deleted: true,
        deleted_by: auth.valid.branch.branch_code,
      },
    });

    await broadcastEvent(`device:${deviceId}`, "device_updated", {
      deviceId,
      deleted: true,
    });

    return NextResponse.json({ ok: true, deletedDeviceId: deviceId });
  } catch (err) {
    console.error("DELETE /api/owner/devices failed:", err);
    return NextResponse.json(
      { error: "Failed to delete device." },
      { status: 500 }
    );
  }
}
