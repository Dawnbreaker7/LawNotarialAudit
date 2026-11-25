import { createAdminClient } from "@/lib/supabase/admin";
import type { PublicBranch } from "@/lib/auth/session";
import type {
  AuthorizedDevice,
  BranchCode,
  DeviceSession,
} from "@/types/database";

const BRANCH_ORDER: Record<BranchCode, number> = {
  "Bong@29": 0,
  OWNER: 0,
  DEV: 1,
  GENSAN: 2,
  MALUNGON: 3,
};

export async function fetchOwnerDevicesSnapshot() {
  const supabase = createAdminClient();

  const [branchesRes, devicesRes, sessionsRes] = await Promise.all([
    supabase
      .from("branches")
      .select(
        "id, branch_code, branch_name, role, is_dev, allow_mobile_login, require_device_approval, max_devices, created_at"
      ),
    supabase
      .from("authorized_devices")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("device_sessions")
      .select("*")
      .eq("is_active", true)
      .is("revoked_at", null)
      .order("last_seen_at", { ascending: false }),
  ]);

  if (branchesRes.error) {
    throw new Error(branchesRes.error.message);
  }
  if (devicesRes.error) {
    throw new Error(devicesRes.error.message);
  }
  if (sessionsRes.error) {
    throw new Error(sessionsRes.error.message);
  }

  const branches = ([...(branchesRes.data ?? [])] as PublicBranch[]).sort(
    (a, b) =>
      (BRANCH_ORDER[a.branch_code] ?? 99) -
      (BRANCH_ORDER[b.branch_code] ?? 99)
  );

  return {
    branches,
    devices: (devicesRes.data ?? []) as AuthorizedDevice[],
    activeSessions: (sessionsRes.data ?? []) as DeviceSession[],
  };
}
