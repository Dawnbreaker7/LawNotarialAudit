import { redirect } from "next/navigation";
import OwnerBranchesClient from "@/components/OwnerBranchesClient";
import { getValidSession } from "@/lib/auth/session";
import { fetchOwnerBranchesSnapshot } from "@/lib/owner/branches";

export const dynamic = "force-dynamic";

export default async function OwnerBranchesPage() {
  const valid = await getValidSession();
  if (!valid || valid.branch.role !== "owner") {
    redirect("/login");
  }

  const initialBranches = await fetchOwnerBranchesSnapshot();
  return <OwnerBranchesClient initialBranches={initialBranches} />;
}
