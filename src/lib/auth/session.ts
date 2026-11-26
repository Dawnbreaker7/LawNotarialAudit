import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken, SESSION_COOKIE_NAME } from "@/lib/auth/crypto";
import {
  BRANCH_LABELS,
  type AuthorizedDevice,
  type Branch,
  type BranchRole,
  type DeviceSession,
  type OperatingBranchCode,
} from "@/types/database";

export type PublicBranch = Omit<Branch, "password_hash">;
export type PublicSession = Pick<
  DeviceSession,
  | "id"
  | "branch_id"
  | "device_id"
  | "branch_user_id"
  | "is_active"
  | "revoked_at"
  | "device_type"
  | "os_info"
  | "browser_info"
  | "ip_address"
  | "last_seen_at"
>;
export type PublicDevice = Pick<
  AuthorizedDevice,
  | "id"
  | "branch_id"
  | "device_label"
  | "device_type"
  | "os_name"
  | "browser_name"
  | "is_approved"
>;

export interface ValidSession {
  session: PublicSession;
  branch: PublicBranch;
  device: PublicDevice | null;
  branch_user_id: string | null;
  staff_name: string | null;
  staff_username: string | null;
  is_dev: boolean;
}

export function getBranchDisplayName(
  branch: Pick<Branch, "branch_code" | "branch_name">
): string {
  if (branch.branch_code === "GENSAN" || branch.branch_code === "MALUNGON") {
    return BRANCH_LABELS[branch.branch_code as OperatingBranchCode];
  }
  return branch.branch_name;
}

export function getDefaultRedirect(
  role: BranchRole,
  isApproved: boolean
): string {
  if (role === "owner") {
    return "/owner/dashboard";
  }
  if (!isApproved) {
    return "/pending-approval";
  }
  return "/branch/register";
}

export function isSessionApproved(valid: ValidSession): boolean {
  return valid.branch.role === "owner" || Boolean(valid.device?.is_approved);
}

export function canAccessBranchPortal(valid: ValidSession): boolean {
  if (valid.is_dev || valid.branch.is_dev) {
    return true;
  }
  return valid.branch.role === "branch" && Boolean(valid.device?.is_approved);
}

export async function getValidSession(options?: {
  touchLastSeen?: boolean;
}): Promise<ValidSession | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!rawToken) {
    return null;
  }

  const tokenHash = hashToken(rawToken);
  const supabase = createAdminClient();

  const { data: sessionRow, error: sessionError } = await supabase
    .from("device_sessions")
    .select(
      "id, branch_id, device_id, branch_user_id, is_active, revoked_at, device_type, os_info, browser_info, ip_address, last_seen_at"
    )
    .eq("session_token_hash", tokenHash)
    .eq("is_active", true)
    .is("revoked_at", null)
    .maybeSingle();

  if (sessionError || !sessionRow) {
    return null;
  }

  const [
    { data: branchRow, error: branchError },
    deviceResult,
    staffResult,
  ] = await Promise.all([
    supabase
      .from("branches")
      .select(
        "id, branch_code, branch_name, role, is_dev, allow_mobile_login, require_device_approval, max_devices, created_at"
      )
      .eq("id", sessionRow.branch_id)
      .maybeSingle(),
    sessionRow.device_id
      ? supabase
          .from("authorized_devices")
          .select(
            "id, branch_id, device_label, device_type, os_name, browser_name, is_approved"
          )
          .eq("id", sessionRow.device_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    sessionRow.branch_user_id
      ? supabase
          .from("branch_users")
          .select("id, full_name, username, is_active")
          .eq("id", sessionRow.branch_user_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (branchError || !branchRow) {
    return null;
  }

  // Enforce instant staff access revocation: if a staff account was revoked or deleted
  // while still signed in, clear the session cookie and force re-login.
  if (sessionRow.branch_user_id) {
    const staffRow = staffResult.data;
    if (!staffRow || !staffRow.is_active) {
      try {
        cookieStore.delete(SESSION_COOKIE_NAME);
      } catch {
        // Ignore when called inside read-only Server Component render context;
        // middleware & API route handlers also clear the cookie.
      }
      return null;
    }
  }

  if (options?.touchLastSeen !== false) {
    const nowIso = new Date().toISOString();
    await supabase
      .from("device_sessions")
      .update({ last_seen_at: nowIso })
      .eq("id", sessionRow.id);
    sessionRow.last_seen_at = nowIso;
  }

  const isDev = Boolean(branchRow.is_dev);
  const staffRow = staffResult.data;

  return {
    session: sessionRow,
    branch: {
      ...branchRow,
      is_dev: isDev,
    },
    device: deviceResult.data ?? null,
    branch_user_id: staffRow?.id ?? null,
    staff_name: staffRow?.full_name ?? null,
    staff_username: staffRow?.username ?? null,
    is_dev: isDev,
  };
}
