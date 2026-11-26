import OwnerAuditClient from "@/components/OwnerAuditClient";
import { queryOwnerAuditData, queryOwnerEntryById } from "@/lib/owner/audit";
import {
  getManilaPeriodDateRange,
  normalizeDashboardPeriod,
} from "@/lib/owner/periods";

export const dynamic = "force-dynamic";

interface OwnerAuditPageProps {
  searchParams: Promise<{
    branch?: string;
    branch_code?: string;
    period?: string;
    date_from?: string;
    date_to?: string;
    status?: string;
    payment_type?: string;
    review_id?: string;
  }>;
}

export default async function OwnerAuditPage({
  searchParams,
}: OwnerAuditPageProps) {
  const params = await searchParams;
  const rawBranch = (params.branch ?? params.branch_code)?.trim().toUpperCase();
  const branchCode =
    rawBranch === "GENSAN" || rawBranch === "MALUNGON" ? rawBranch : "ALL";
  const rawStatus = params.status?.trim().toLowerCase();
  const initialStatus =
    rawStatus === "for_review" ||
    rawStatus === "approved" ||
    rawStatus === "flagged"
      ? rawStatus
      : "ALL";
  const rawPaymentType = params.payment_type?.trim().toLowerCase();
  const initialPaymentType =
    rawPaymentType === "full" || rawPaymentType === "partial"
      ? rawPaymentType
      : "ALL";

  const periodRange = params.period
    ? getManilaPeriodDateRange(normalizeDashboardPeriod(params.period))
    : null;
  const initialDateFrom =
    params.date_from?.trim() || periodRange?.date_from || "";
  const initialDateTo = params.date_to?.trim() || periodRange?.date_to || "";
  const initialReviewId = params.review_id?.trim() || undefined;

  const [initialData, initialReviewEntry] = await Promise.all([
    queryOwnerAuditData({
      branch_code: branchCode,
      review_status: initialStatus,
      payment_type: initialPaymentType,
      date_from: initialDateFrom || undefined,
      date_to: initialDateTo || undefined,
      page: 1,
      page_size: 25,
    }),
    initialReviewId ? queryOwnerEntryById(initialReviewId) : Promise.resolve(null),
  ]);

  return (
    <OwnerAuditClient
      initialData={initialData}
      initialBranchCode={branchCode}
      initialStatus={initialStatus}
      initialPaymentType={initialPaymentType}
      initialDateFrom={initialDateFrom}
      initialDateTo={initialDateTo}
      initialReviewId={initialReviewId}
      initialReviewEntry={initialReviewEntry}
    />
  );
}
