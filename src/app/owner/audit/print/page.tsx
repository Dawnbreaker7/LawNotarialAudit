import { redirect } from "next/navigation";
import OwnerPrintClient from "@/components/OwnerPrintClient";
import { getValidSession } from "@/lib/auth/session";
import { queryOwnerAuditData } from "@/lib/owner/audit";

export const dynamic = "force-dynamic";

interface OwnerAuditPrintPageProps {
  searchParams: Promise<{ branch_code?: string; book_id?: string }>;
}

export default async function OwnerAuditPrintPage({
  searchParams,
}: OwnerAuditPrintPageProps) {
  const valid = await getValidSession({ touchLastSeen: false });
  if (!valid || !valid.device?.is_approved || valid.branch.role !== "owner") {
    redirect("/login");
  }

  const params = await searchParams;
  const initialBranchCode =
    params.branch_code === "MALUNGON" ? "MALUNGON" : "GENSAN";

  const auditData = await queryOwnerAuditData();

  return (
    <OwnerPrintClient
      books={auditData.books}
      entries={auditData.entries}
      initialBranchCode={initialBranchCode}
      initialBookId={params.book_id}
    />
  );
}
