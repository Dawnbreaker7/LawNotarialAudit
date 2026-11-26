import { createAdminClient } from "@/lib/supabase/admin";
import { getBranchDisplayName } from "@/lib/auth/session";
import type { OperatingBranchCode } from "@/types/database";

export interface OwnerStaffMember {
  id: string;
  branch_id: string;
  branch_code: OperatingBranchCode;
  branch_name: string;
  full_name: string;
  username: string;
  is_active: boolean;
  created_at: string;
  revoked_at: string | null;
}

export interface StaffBranchOption {
  id: string;
  branch_code: OperatingBranchCode;
  branch_name: string;
}

export async function fetchOwnerStaffSnapshot(): Promise<{
  staff: OwnerStaffMember[];
  branches: StaffBranchOption[];
  permissionError: boolean;
}> {
  const supabase = createAdminClient();

  const [branchesRes, staffRes] = await Promise.all([
    supabase
      .from("branches")
      .select("id, branch_code, branch_name, role, is_dev")
      .eq("role", "branch")
      .eq("is_dev", false)
      .in("branch_code", ["GENSAN", "MALUNGON"]),
    supabase
      .from("branch_users")
      .select(
        "id, branch_id, full_name, username, is_active, created_at, revoked_at"
      )
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  if (branchesRes.error) {
    throw new Error(branchesRes.error.message);
  }

  const branchById = new Map<string, StaffBranchOption>();
  const branches: StaffBranchOption[] = [];

  for (const b of branchesRes.data ?? []) {
    if (b.is_dev || b.role !== "branch") continue;
    if (b.branch_code === "GENSAN" || b.branch_code === "MALUNGON") {
      const option: StaffBranchOption = {
        id: b.id,
        branch_code: b.branch_code as OperatingBranchCode,
        branch_name: getBranchDisplayName(b),
      };
      branchById.set(b.id, option);
      branches.push(option);
    }
  }
  branches.sort((a, b) => a.branch_code.localeCompare(b.branch_code));

  if (staffRes.error) {
    if (staffRes.error.code === "42501") {
      return { staff: [], branches, permissionError: true };
    }
    throw new Error(staffRes.error.message);
  }

  const staff: OwnerStaffMember[] = [];
  for (const row of staffRes.data ?? []) {
    const branch = branchById.get(row.branch_id);
    if (!branch) continue;
    staff.push({
      id: row.id,
      branch_id: row.branch_id,
      branch_code: branch.branch_code,
      branch_name: branch.branch_name,
      full_name: row.full_name,
      username: row.username,
      is_active: Boolean(row.is_active),
      created_at: row.created_at,
      revoked_at: row.revoked_at ?? null,
    });
  }

  return { staff, branches, permissionError: false };
}
