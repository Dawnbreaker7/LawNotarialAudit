import { redirect } from "next/navigation";
import BranchRegisterClient from "@/components/BranchRegisterClient";
import SessionWatcher from "@/components/SessionWatcher";
import { canAccessBranchPortal, getValidSession } from "@/lib/auth/session";
import { fetchBranchRegisterSnapshot } from "@/lib/branch/register";

export const dynamic = "force-dynamic";

export default async function BranchRegisterPage() {
  const valid = await getValidSession();
  if (!valid) {
    redirect("/login");
  }
  if (!canAccessBranchPortal(valid)) {
    if (valid.branch.role === "branch" && !valid.device?.is_approved) {
      redirect("/pending-approval");
    }
    redirect("/owner/dashboard");
  }

  const initialSnapshot = await fetchBranchRegisterSnapshot(valid);

  return (
    <main className="min-h-screen bg-[#F7F4EE]">
      <SessionWatcher
        sessionId={valid.session.id}
        deviceId={valid.device?.id ?? null}
        isApproved={true}
      />
      <BranchRegisterClient initialSnapshot={initialSnapshot} />
    </main>
  );
}
