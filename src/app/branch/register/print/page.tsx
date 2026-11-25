import { redirect } from "next/navigation";
import PrintRegisterClient from "@/components/PrintRegisterClient";
import SessionWatcher from "@/components/SessionWatcher";
import { canAccessBranchPortal, getValidSession } from "@/lib/auth/session";
import { fetchBranchRegisterSnapshot } from "@/lib/branch/register";

export const dynamic = "force-dynamic";

interface BranchRegisterPrintPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function BranchRegisterPrintPage({
  searchParams,
}: BranchRegisterPrintPageProps) {
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

  const [snapshot, params] = await Promise.all([
    fetchBranchRegisterSnapshot(valid),
    searchParams,
  ]);

  const rawPage = params.page?.trim().toLowerCase();
  let initialSelectedPage = String(snapshot.latestPageNo);
  if (rawPage === "all") {
    initialSelectedPage = "all";
  } else if (rawPage) {
    const parsedPage = Number(rawPage);
    if (Number.isInteger(parsedPage) && parsedPage >= 1) {
      initialSelectedPage = String(parsedPage);
    }
  }

  return (
    <>
      <SessionWatcher
        sessionId={valid.session.id}
        deviceId={valid.device?.id ?? null}
        isApproved={true}
      />
      <PrintRegisterClient
        snapshot={snapshot}
        initialSelectedPage={initialSelectedPage}
      />
    </>
  );
}
