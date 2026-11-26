import { redirect } from "next/navigation";
import OwnerSettingsClient from "@/components/OwnerSettingsClient";
import { getValidSession } from "@/lib/auth/session";
import { fetchOwnerBranchesSnapshot } from "@/lib/owner/branches";
import { fetchOwnerStaffSnapshot } from "@/lib/owner/staff";

export const dynamic = "force-dynamic";

export default async function OwnerSettingsPage() {
  const valid = await getValidSession();
  if (!valid || valid.branch.role !== "owner") {
    redirect("/login");
  }

  const [staffSnapshot, branchesSnapshot] = await Promise.all([
    fetchOwnerStaffSnapshot(),
    fetchOwnerBranchesSnapshot(),
  ]);

  return (
    <OwnerSettingsClient
      initialStaff={staffSnapshot.staff}
      staffBranches={staffSnapshot.branches}
      initialBranches={branchesSnapshot}
      initialPermissionError={staffSnapshot.permissionError}
    />
  );
}
