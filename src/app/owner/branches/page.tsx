import OwnerBranchesClient from "@/components/OwnerBranchesClient";
import { fetchOwnerBranchesSnapshot } from "@/lib/owner/branches";

export const dynamic = "force-dynamic";

export default async function OwnerBranchesPage() {
  const initialBranches = await fetchOwnerBranchesSnapshot();
  return <OwnerBranchesClient initialBranches={initialBranches} />;
}
