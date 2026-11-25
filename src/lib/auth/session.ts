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

export interface ValidSession {
  session: DeviceSession;
  branch: PublicBranch;
  device: AuthorizedDevice | null;
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
    .select("*")
    .eq("session_token_hash", tokenHash)
    .eq("is_active", true)
    .is("revoked_at", null)
    .maybeSingle();

  if (sessionError || !sessionRow) {
    return null;
  }

  const [{ data: branchRow, error: branchError }, deviceResult] =
    await Promise.all([
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
            .select("*")
            .eq("id", sessionRow.device_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

  if (branchError || !branchRow) {
    return null;
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

  return {
    session: sessionRow,
    branch: {
      ...branchRow,
      is_dev: isDev,
    },
    device: deviceResult.data ?? null,
    is_dev: isDev,
  };
}
