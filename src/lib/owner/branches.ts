import { createAdminClient } from "@/lib/supabase/admin";
import { getBranchDisplayName, type PublicBranch } from "@/lib/auth/session";

export interface OwnerBranchConfig extends PublicBranch {
  display_name: string;
  approved_device_count: number;
  total_device_count: number;
}

export async function fetchOwnerBranchesSnapshot(): Promise<
  OwnerBranchConfig[]
> {
  const supabase = createAdminClient();

  const [branchesRes, devicesRes] = await Promise.all([
    supabase
      .from("branches")
      .select(
        "id, branch_code, branch_name, role, is_dev, allow_mobile_login, require_device_approval, max_devices, created_at"
      )
      .in("branch_code", ["GENSAN", "MALUNGON"]),
    supabase.from("authorized_devices").select("branch_id, is_approved"),
  ]);

  if (branchesRes.error) throw new Error(branchesRes.error.message);
  if (devicesRes.error) throw new Error(devicesRes.error.message);

  const counts = new Map<string, { approved: number; total: number }>();
  for (const d of devicesRes.data ?? []) {
    const current = counts.get(d.branch_id) ?? { approved: 0, total: 0 };
    current.total += 1;
    if (d.is_approved) current.approved += 1;
    counts.set(d.branch_id, current);
  }

  return (branchesRes.data ?? [])
    .map((b) => {
      const c = counts.get(b.id) ?? { approved: 0, total: 0 };
      return {
        ...b,
        display_name: getBranchDisplayName(b),
        approved_device_count: c.approved,
        total_device_count: c.total,
      };
    })
    .sort((a, b) => a.branch_code.localeCompare(b.branch_code));
}
