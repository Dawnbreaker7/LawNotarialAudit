import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEVICE_COOKIE_MAX_AGE,
  DEVICE_COOKIE_NAME,
  generateRandomToken,
  getAuthCookieOptions,
  getDeviceCookieName,
  hashToken,
  SESSION_COOKIE_MAX_AGE,
  SESSION_COOKIE_NAME,
  verifyPassword,
} from "@/lib/auth/crypto";
import { getClientIp, parseUserAgent } from "@/lib/auth/device";
import { getDefaultRedirect } from "@/lib/auth/session";
import type {
  AuthorizedDevice,
  Branch,
  BranchCode,
} from "@/types/database";

export const preferredRegion = "sin1";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      branch_code?: unknown;
      password?: unknown;
    } | null;

    // Preserve exact case with .trim() only for mixed-case owner/staff usernames.
    const identifier =
      typeof body?.branch_code === "string" ? body.branch_code.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Username / branch code and password are required." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    let branch: Branch | null = null;
    let matchedStaffUser: {
      id: string;
      branch_id: string;
      full_name: string;
      username: string;
      password_hash: string;
      is_active: boolean;
    } | null = null;

    // 1. Check owner accounts first ("Bong@29", "DEV") — never blocked by device-token gates.
    const { data: ownerBranch, error: ownerBranchError } = await supabase
      .from("branches")
      .select("*")
      .eq("branch_code", identifier as BranchCode)
      .eq("role", "owner")
      .maybeSingle();

    if (ownerBranchError) {
      throw new Error(ownerBranchError.message);
    }

    if (ownerBranch) {
      const isPasswordValid = await verifyPassword(
        password,
        ownerBranch.password_hash
      );
      if (!isPasswordValid) {
        return NextResponse.json(
          { error: "Invalid username / branch code or password." },
          { status: 401 }
        );
      }
      branch = ownerBranch;
    } else {
      // 2. Check individual per-branch staff accounts (branch_users).
      const { data: staffUser, error: staffError } = await supabase
        .from("branch_users")
        .select("id, branch_id, full_name, username, password_hash, is_active")
        .eq("username", identifier)
        .maybeSingle();

      if (staffError && staffError.code !== "42501") {
        throw new Error(staffError.message);
      }

      if (staffUser) {
        if (!staffUser.is_active) {
          return NextResponse.json(
            {
              error:
                "Access revoked. This account has been deactivated by the Owner.",
            },
            { status: 403 }
          );
        }

        const isStaffPasswordValid = await verifyPassword(
          password,
          staffUser.password_hash
        );
        if (!isStaffPasswordValid) {
          return NextResponse.json(
            { error: "Invalid username / branch code or password." },
            { status: 401 }
          );
        }

        const { data: assignedBranch, error: assignedBranchError } =
          await supabase
            .from("branches")
            .select("*")
            .eq("id", staffUser.branch_id)
            .maybeSingle();

        if (assignedBranchError || !assignedBranch) {
          return NextResponse.json(
            { error: "Invalid username / branch code or password." },
            { status: 401 }
          );
        }

        branch = assignedBranch;
        matchedStaffUser = staffUser;
      } else {
        // 3. Fallback: shared branch-level credentials ("GENSAN", "MALUNGON").
        const { data: branchRow, error: branchError } = await supabase
          .from("branches")
          .select("*")
          .eq("branch_code", identifier as BranchCode)
          .maybeSingle();

        if (branchError || !branchRow) {
          return NextResponse.json(
            { error: "Invalid username / branch code or password." },
            { status: 401 }
          );
        }

        const isPasswordValid = await verifyPassword(
          password,
          branchRow.password_hash
        );
        if (!isPasswordValid) {
          return NextResponse.json(
            { error: "Invalid username / branch code or password." },
            { status: 401 }
          );
        }

        branch = branchRow;
      }
    }

    const deviceInfo = parseUserAgent(request.headers.get("user-agent"));
    const ipAddress = getClientIp(request.headers);
    const isOwner = branch.role === "owner";

    // Layer 1: Mobile Guard strictly for operating branch accounts
    if (
      branch.role === "branch" &&
      deviceInfo.device_type !== "desktop" &&
      !branch.allow_mobile_login
    ) {
      await supabase.from("audit_logs").insert({
        branch_id: branch.id,
        session_id: null,
        action: "LOGIN_BLOCKED_MOBILE",
        target_id: null,
        old_data: null,
        new_data: {
          branch_code: branch.branch_code,
          branch_name: branch.branch_name,
          device_type: deviceInfo.device_type,
          os_name: deviceInfo.os_name,
          browser_name: deviceInfo.browser_name,
          ip_address: ipAddress,
        },
      });

      return NextResponse.json(
        {
          error:
            "Access denied: Branch accounts can only be accessed from an approved desktop computer.",
        },
        { status: 403 }
      );
    }

    // Layer 2: Device Binding
    // Owner & DEV accounts can sign in from any device without device-token restrictions;
    // their device record is immediately marked approved so sessions remain visible & revocable.
    const branchDeviceCookieName = getDeviceCookieName(branch.branch_code);
    const existingDeviceToken =
      request.cookies.get(branchDeviceCookieName)?.value ??
      request.cookies.get(DEVICE_COOKIE_NAME)?.value ??
      null;

    let device: AuthorizedDevice | null = null;
    let rawDeviceTokenToSet: string | null = existingDeviceToken;

    if (existingDeviceToken) {
      const existingDeviceHash = hashToken(existingDeviceToken);
      const { data: matchedDevice } = await supabase
        .from("authorized_devices")
        .select("*")
        .eq("branch_id", branch.id)
        .eq("device_token_hash", existingDeviceHash)
        .maybeSingle();

      if (matchedDevice) {
        const { data: updatedDevice, error: updateDeviceError } = await supabase
          .from("authorized_devices")
          .update({
            device_type: deviceInfo.device_type,
            os_name: deviceInfo.os_name,
            browser_name: deviceInfo.browser_name,
            last_ip: ipAddress,
            ...(isOwner ? { is_approved: true } : {}),
          })
          .eq("id", matchedDevice.id)
          .select("*")
          .single();

        if (updateDeviceError || !updatedDevice) {
          throw new Error(
            updateDeviceError?.message ?? "Failed to update recognized device."
          );
        }

        device = updatedDevice;
      }
    }

    if (!device) {
      if (!isOwner) {
        const { count: approvedCountRaw, error: countError } = await supabase
          .from("authorized_devices")
          .select("id", { count: "exact", head: true })
          .eq("branch_id", branch.id)
          .eq("is_approved", true);

        if (countError) {
          throw new Error(countError.message);
        }

        const approvedCount = approvedCountRaw ?? 0;

        if (approvedCount >= branch.max_devices) {
          await supabase.from("audit_logs").insert({
            branch_id: branch.id,
            session_id: null,
            action: "LOGIN_BLOCKED_MAX_DEVICES",
            target_id: null,
            old_data: null,
            new_data: {
              branch_code: branch.branch_code,
              branch_name: branch.branch_name,
              approved_count: approvedCount,
              max_devices: branch.max_devices,
              device_type: deviceInfo.device_type,
              os_name: deviceInfo.os_name,
              browser_name: deviceInfo.browser_name,
              ip_address: ipAddress,
            },
          });

          return NextResponse.json(
            {
              error: `Maximum approved devices (${branch.max_devices}) reached for this branch.`,
            },
            { status: 403 }
          );
        }
      }

      const isApproved = isOwner ? true : !branch.require_device_approval;
      const deviceLabel = isOwner
        ? `${branch.is_dev ? "DEV Sandbox" : "Owner"} • ${deviceInfo.os_name} (${deviceInfo.browser_name})`
        : matchedStaffUser
          ? `${matchedStaffUser.full_name} • ${deviceInfo.os_name} (${deviceInfo.browser_name})`
          : `${deviceInfo.os_name} (${deviceInfo.browser_name})`;

      rawDeviceTokenToSet = generateRandomToken();
      const deviceTokenHash = hashToken(rawDeviceTokenToSet);

      const { data: insertedDevice, error: insertDeviceError } = await supabase
        .from("authorized_devices")
        .insert({
          branch_id: branch.id,
          device_token_hash: deviceTokenHash,
          device_label: deviceLabel,
          device_type: deviceInfo.device_type,
          os_name: deviceInfo.os_name,
          browser_name: deviceInfo.browser_name,
          is_approved: isApproved,
          last_ip: ipAddress,
        })
        .select("*")
        .single();

      if (insertDeviceError || !insertedDevice) {
        throw new Error(
          insertDeviceError?.message ?? "Failed to register device."
        );
      }

      device = insertedDevice;
    }

    // Layer 3: Create active device_sessions row + session_token cookie
    const rawSessionToken = generateRandomToken();
    const sessionTokenHash = hashToken(rawSessionToken);
    const nowIso = new Date().toISOString();

    const { data: createdSession, error: sessionInsertError } = await supabase
      .from("device_sessions")
      .insert({
        branch_id: branch.id,
        device_id: device.id,
        branch_user_id: matchedStaffUser?.id ?? null,
        session_token_hash: sessionTokenHash,
        device_type: deviceInfo.device_type,
        os_info: deviceInfo.os_name,
        browser_info: deviceInfo.browser_name,
        ip_address: ipAddress,
        is_active: true,
        last_seen_at: nowIso,
      })
      .select("*")
      .single();

    if (sessionInsertError || !createdSession) {
      throw new Error(
        sessionInsertError?.message ?? "Failed to create device session."
      );
    }

    await supabase.from("audit_logs").insert({
      branch_id: branch.id,
      session_id: createdSession.id,
      action: isOwner ? "OWNER_LOGIN" : "LOGIN_SUCCESS",
      target_id: device.id,
      old_data: null,
      new_data: {
        branch_code: branch.branch_code,
        branch_name: branch.branch_name,
        is_dev: Boolean(branch.is_dev),
        branch_user_id: matchedStaffUser?.id ?? null,
        staff_username: matchedStaffUser?.username ?? null,
        staff_name: matchedStaffUser?.full_name ?? null,
        device_label: device.device_label,
        is_approved: isOwner ? true : device.is_approved,
        device_type: deviceInfo.device_type,
        os_name: deviceInfo.os_name,
        browser_name: deviceInfo.browser_name,
        ip_address: ipAddress,
      },
    });

    const redirectTo = getDefaultRedirect(
      branch.role,
      isOwner ? true : device.is_approved
    );

    const response = NextResponse.json({ redirectTo });
    response.cookies.set(
      SESSION_COOKIE_NAME,
      rawSessionToken,
      getAuthCookieOptions(SESSION_COOKIE_MAX_AGE)
    );
    if (rawDeviceTokenToSet) {
      response.cookies.set(
        branchDeviceCookieName,
        rawDeviceTokenToSet,
        getAuthCookieOptions(DEVICE_COOKIE_MAX_AGE)
      );
    }

    return response;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "Unable to complete login. Please try again." },
      { status: 500 }
    );
  }
}
