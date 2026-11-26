"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Flag,
  Monitor,
  PhilippinePeso,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import type {
  AuditEntryItem,
  AuditTotals,
  EnrichedAuditLog,
  OwnerAuditResult,
  OwnerDashboardData,
} from "@/lib/owner/audit";
import {
  getManilaPeriodDateRange,
  type DashboardPeriod,
} from "@/lib/owner/periods";
import type { PaymentType, ReviewStatus } from "@/types/database";
import { EntryListSkeleton } from "@/components/Skeletons";

interface OwnerDashboardClientProps {
  data: OwnerDashboardData;
}

type ActiveModalType = "entries" | "acts" | "logs" | "period" | null;
type EntryBranchFilter = "ALL" | "GENSAN" | "MALUNGON";
type LogCategoryFilter = "ALL" | "ENTRIES" | "REVIEWS" | "SECURITY";

const SECURITY_ACTIONS = new Set([
  "LOGIN_BLOCKED_MOBILE",
  "LOGIN_BLOCKED_MAX_DEVICES",
  "DEVICE_REVOKED",
]);

const ENTRY_ACTIONS = new Set([
  "CREATE_ENTRY",
  "EDIT_ENTRY",
  "DELETE_ENTRY",
]);

const REVIEW_ACTIONS = new Set(["APPROVE_ENTRY", "FLAG_ENTRY"]);

const PHP_FORMATTER = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatPhp(amount: number): string {
  return PHP_FORMATTER.format(Number.isFinite(amount) ? amount : 0);
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return DATE_TIME_FORMATTER.format(d);
}

function renderReviewStatusBadge(status: ReviewStatus) {
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-[#ECFDF5] px-2.5 py-0.5 text-xs font-semibold text-[#065F46]">
        <CheckCircle2 className="h-3 w-3" />
        Approved
      </span>
    );
  }
  if (status === "flagged") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-[#FEF2F2] px-2.5 py-0.5 text-xs font-semibold text-[#7F1D1D]">
        <Flag className="h-3 w-3" />
        Flagged
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-[#FFFBEB] px-2.5 py-0.5 text-xs font-semibold text-[#78350F]">
      <Clock className="h-3 w-3" />
      For Review
    </span>
  );
}

function renderPaymentBadge(paymentType: PaymentType) {
  if (paymentType === "partial") {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-200 bg-[#FFFBEB] px-2 py-0.5 text-xs font-semibold text-[#78350F]">
        Partial Payment
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-[#ECFDF5] px-2 py-0.5 text-xs font-semibold text-[#065F46]">
      Full Amount
    </span>
  );
}

function getLogBadge(log: EnrichedAuditLog) {
  switch (log.action) {
    case "LOGIN_BLOCKED_MOBILE":
    case "LOGIN_BLOCKED_MAX_DEVICES":
      return {
        label: log.action,
        classes: "bg-[#FEF2F2] text-[#7F1D1D] border-red-200",
        isSecurity: true,
      };
    case "DEVICE_REVOKED":
      return {
        label: "DEVICE_REVOKED",
        classes: "bg-[#FFFBEB] text-[#78350F] border-amber-200",
        isSecurity: true,
      };
    case "EDIT_ENTRY":
      return {
        label: "OWNER_EDIT",
        classes: "bg-indigo-50 text-indigo-800 border-indigo-200",
        isSecurity: false,
      };
    case "CREATE_ENTRY":
      return {
        label: "CREATE_ENTRY",
        classes: "bg-[#ECFDF5] text-[#065F46] border-emerald-200",
        isSecurity: false,
      };
    case "APPROVE_ENTRY":
      return {
        label: "LAWYER_APPROVED",
        classes: "bg-[#ECFDF5] text-[#065F46] border-emerald-200",
        isSecurity: false,
      };
    case "FLAG_ENTRY":
      return {
        label: "LAWYER_FLAGGED",
        classes: "bg-[#FEF2F2] text-[#7F1D1D] border-red-200",
        isSecurity: false,
      };
    case "OWNER_LOGIN":
      return {
        label: "OWNER_LOGIN",
        classes: "bg-[#FBF5E8] text-[#78350F] border-[#B48A3E]/50",
        isSecurity: false,
      };
    case "STAFF_ACCOUNT_CREATED":
    case "STAFF_ACCESS_RESTORED":
      return {
        label: log.action,
        classes: "bg-[#ECFDF5] text-[#065F46] border-emerald-200",
        isSecurity: false,
      };
    case "STAFF_ACCESS_REVOKED":
    case "STAFF_ACCOUNT_DELETED":
      return {
        label: log.action,
        classes: "bg-[#FEF2F2] text-[#7F1D1D] border-red-200",
        isSecurity: true,
      };
    case "STAFF_PASSWORD_RESET":
      return {
        label: "STAFF_PASSWORD_RESET",
        classes: "bg-[#FFFBEB] text-[#78350F] border-amber-200",
        isSecurity: true,
      };
    default:
      return {
        label: log.action,
        classes: "bg-[#F1F5F9] text-[#1E293B] border-slate-200",
        isSecurity: false,
      };
  }
}

function summarizeLog(log: EnrichedAuditLog): string {
  const newData = log.new_data ?? {};
  if (log.action === "CREATE_ENTRY") {
    const entry = newData.entry as
      | { entry_number?: number; instrument_title?: string }
      | undefined;
    return `Uploaded Entry #${entry?.entry_number ?? "?"} — ${entry?.instrument_title ?? "Notarial Entry"}`;
  }
  if (log.action === "EDIT_ENTRY") {
    const entryNo = newData.entry_number as number | undefined;
    const reason = newData.edit_reason as string | undefined;
    return `Owner edited Entry #${entryNo ?? "?"}${reason ? ` (Reason: ${reason})` : ""}`;
  }
  if (log.action === "APPROVE_ENTRY") {
    const entryNo = newData.entry_number as number | undefined;
    const notes = newData.review_notes as string | undefined;
    return `Lawyer approved Entry #${entryNo ?? "?"}${notes ? ` (${notes})` : ""}`;
  }
  if (log.action === "FLAG_ENTRY") {
    const entryNo = newData.entry_number as number | undefined;
    const notes = newData.review_notes as string | undefined;
    return `Lawyer flagged Entry #${entryNo ?? "?"}${notes ? ` — ${notes}` : ""}`;
  }
  if (log.action === "LOGIN_BLOCKED_MOBILE") {
    return `Blocked ${String(newData.device_type ?? "mobile")} login (${String(newData.os_name ?? "")} / ${String(newData.browser_name ?? "")})`;
  }
  if (log.action === "LOGIN_BLOCKED_MAX_DEVICES") {
    return `Blocked login: max approved devices (${String(newData.max_devices ?? "?")}) reached`;
  }
  if (log.action === "DEVICE_REVOKED") {
    return newData.deleted
      ? `Deleted device "${String((log.old_data as { device_label?: string } | null)?.device_label ?? "")}"`
      : "Session or device approval revoked";
  }
  if (log.action === "DEVICE_APPROVED") {
    return `Approved device "${String(newData.device_label ?? "")}"`;
  }
  if (log.action === "OWNER_LOGIN") {
    return `${String(newData.branch_code ?? "Owner")} signed in from ${String(newData.device_label ?? newData.device_type ?? "device")}`;
  }
  if (log.action === "LOGIN_SUCCESS") {
    const staffName =
      typeof newData.staff_name === "string" ? newData.staff_name : null;
    return staffName
      ? `${staffName} signed in from ${String(newData.device_label ?? "PC")}`
      : `Signed in from ${String(newData.device_label ?? "PC")}`;
  }
  if (log.action === "STAFF_ACCOUNT_CREATED") {
    return `Created staff account "${String(newData.username ?? "")}" (${String(newData.full_name ?? "")})`;
  }
  if (log.action === "STAFF_ACCESS_REVOKED") {
    return `Removed access for ${String(newData.full_name ?? "")} (${String(newData.username ?? "")})`;
  }
  if (log.action === "STAFF_ACCESS_RESTORED") {
    return `Restored access for ${String(newData.full_name ?? "")} (${String(newData.username ?? "")})`;
  }
  if (log.action === "STAFF_PASSWORD_RESET") {
    return `Reset password for ${String(newData.full_name ?? "")} (${String(newData.username ?? "")})`;
  }
  if (log.action === "STAFF_ACCOUNT_DELETED") {
    const oldData = (log.old_data ?? {}) as Record<string, unknown>;
    return `Deleted staff account "${String(oldData.username ?? "")}" (${String(oldData.full_name ?? "")})`;
  }
  return log.action;
}

function KpiCard({
  title,
  period,
  totals,
  onSelect,
}: {
  title: string;
  period: DashboardPeriod;
  totals: AuditTotals;
  onSelect: (period: DashboardPeriod) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(period)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(period);
        }
      }}
      className="group cursor-pointer rounded-xl border border-[#DFD7C8] bg-white p-5 shadow-xs transition hover:border-emerald-700/50 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B2A4A] active:scale-[0.99]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#B48A3E]">
          {title}
        </span>
        <span className="rounded-full border border-[#DFD7C8] bg-[#FAF7F1] px-2.5 py-0.5 text-xs font-semibold text-[#1B2A4A]">
          {totals.total_entries}{" "}
          {totals.total_entries === 1 ? "entry" : "entries"}
        </span>
      </div>

      <div className="mt-3 space-y-1.5">
        <div>
          <div className="text-xs text-[#64748B]">Total Amount Paid</div>
          <div className="font-serif text-2xl font-bold tabular-nums text-[#065F46]">
            {formatPhp(totals.total_amount_paid)}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs tabular-nums">
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-[#ECFDF5] px-2 py-0.5 font-medium text-[#065F46]">
            Full ({totals.full_count}):{" "}
            <strong className="font-mono">
              {formatPhp(totals.full_amount_paid)}
            </strong>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-[#FFFBEB] px-2 py-0.5 font-medium text-[#78350F]">
            Partial ({totals.partial_count}):{" "}
            <strong className="font-mono">
              {formatPhp(totals.partial_amount_paid)}
            </strong>
          </span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#DFD7C8] pt-3 text-xs">
        <div>
          <div className="text-[#64748B]">GenSan Branch</div>
          <div className="font-mono font-semibold tabular-nums text-[#1B2A4A]">
            {formatPhp(totals.gensan.total_amount_paid)}
          </div>
          <div className="font-mono text-xs tabular-nums text-[#64748B]">
            {totals.gensan.total_entries} entries
          </div>
        </div>
        <div>
          <div className="text-[#64748B]">Malungon Branch</div>
          <div className="font-mono font-semibold tabular-nums text-[#1B2A4A]">
            {formatPhp(totals.malungon.total_amount_paid)}
          </div>
          <div className="font-mono text-xs tabular-nums text-[#64748B]">
            {totals.malungon.total_entries} entries
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end border-t border-[#DFD7C8]/70 pt-2.5 text-xs font-medium text-[#64748B] transition group-hover:text-emerald-800">
        View Breakdown &rarr;
      </div>
    </div>
  );
}

function DashboardModalShell({
  title,
  subtitle,
  countLabel,
  filterBar,
  footerLinkHref,
  footerLinkLabel,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  countLabel?: string;
  filterBar: ReactNode;
  footerLinkHref: string;
  footerLinkLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-[94vw] flex-col overflow-hidden rounded-xl border border-[#DFD7C8] bg-white shadow-xl sm:max-w-2xl">
        {/* Sticky Modal Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#DFD7C8] bg-white px-4 py-3.5 sm:px-6">
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-lg font-bold text-[#1B2A4A]">
                {title}
              </h2>
              {countLabel && (
                <span className="inline-flex items-center rounded-full border border-[#DFD7C8] bg-[#FAF7F1] px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-[#1B2A4A]">
                  {countLabel}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="font-mono text-xs text-[#64748B]">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border border-transparent text-[#64748B] transition hover:border-[#DFD7C8] hover:bg-[#FAF7F1] hover:text-[#1B2A4A]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Quick Search / Filter Bar */}
        <div className="shrink-0 border-b border-[#DFD7C8] bg-[#FAF7F1] px-4 py-3 sm:px-6">
          {filterBar}
        </div>

        {/* Internal Scrollable Body */}
        <div className="flex-1 divide-y divide-[#DFD7C8] overflow-y-auto px-4 sm:px-6">
          {children}
        </div>

        {/* Sticky Modal Footer */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#DFD7C8] bg-[#FAF7F1] px-4 py-3 sm:px-6">
          <Link
            href={footerLinkHref}
            onClick={onClose}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-[#1B2A4A] transition hover:text-[#121D36] hover:underline"
          >
            {footerLinkLabel}
            <ArrowRight className="h-4 w-4 text-[#B48A3E]" />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[#DFD7C8] bg-white px-4 py-2 text-sm font-semibold text-[#1B2A4A] transition hover:bg-[#F4EFE4]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function EntrySummaryRow({
  entry,
  onNavigate,
}: {
  entry: AuditEntryItem;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#1B2A4A] px-2.5 py-0.5 text-xs font-semibold text-[#FBF5E8]">
            {entry.branch_name}
          </span>
          <span className="font-mono text-xs font-semibold tabular-nums text-[#1B2A4A]">
            Entry #{entry.entry_number} &middot; Book {entry.book_no}
          </span>
          {renderReviewStatusBadge(entry.review_status)}
          {renderPaymentBadge(entry.payment_type)}
        </div>
        <div className="text-sm font-semibold text-[#1C2434]">
          {entry.instrument_title}
        </div>
        <div className="break-words text-xs text-[#64748B]">
          <span>Parties: {entry.parties}</span>
          {entry.secondary_parties ? (
            <span> &bull; {entry.secondary_parties}</span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 sm:justify-end">
        <div className="text-left sm:text-right">
          <div className="font-mono text-sm font-bold tabular-nums text-[#065F46]">
            {formatPhp(entry.amount_paid)}
          </div>
          <div className="font-mono text-xs tabular-nums text-[#64748B]">
            {formatDateTime(entry.notarized_at)}
          </div>
        </div>
        <Link
          href={`/owner/audit?review_id=${encodeURIComponent(entry.id)}`}
          onClick={onNavigate}
          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-[#1B2A4A] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#121D36]"
        >
          <Eye className="h-3.5 w-3.5 text-[#B48A3E]" />
          Review &amp; Verify
        </Link>
      </div>
    </div>
  );
}

function LogRow({ log }: { log: EnrichedAuditLog }) {
  const badge = getLogBadge(log);
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#1B2A4A] px-2.5 py-0.5 text-xs font-semibold text-[#FBF5E8]">
            {log.branch_name}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.classes}`}
          >
            {badge.isSecurity && <AlertTriangle className="h-3 w-3" />}
            {badge.label}
          </span>
          {log.device_label && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#DFD7C8] bg-[#FAF7F1] px-2 py-0.5 text-xs font-medium text-[#1E293B]">
              <Monitor className="h-3 w-3 text-[#64748B]" />
              {log.device_label}
            </span>
          )}
        </div>
        <p className="break-words text-[#1C2434]">{summarizeLog(log)}</p>
      </div>

      <span className="whitespace-nowrap font-mono text-xs tabular-nums text-[#64748B]">
        {formatDateTime(log.created_at)}
      </span>
    </div>
  );
}

export default function OwnerDashboardClient({
  data,
}: OwnerDashboardClientProps) {
  const {
    kpis,
    recentEntries,
    totalEntriesCount,
    actBreakdown,
    recentLogs,
    totalLogsCount,
    activeBooks,
  } = data;

  const gensanBook = activeBooks.find((b) => b.branch_code === "GENSAN");
  const malungonBook = activeBooks.find((b) => b.branch_code === "MALUNGON");

  // Strictly cap every dashboard card feed/list to at most 5 items.
  const visibleEntries = recentEntries.slice(0, 5);
  const visibleActs = actBreakdown.slice(0, 5);
  const visibleLogs = recentLogs.slice(0, 5);

  const securityAlertCount = recentLogs.filter((l) =>
    SECURITY_ACTIONS.has(l.action)
  ).length;

  const [activeModal, setActiveModal] = useState<ActiveModalType>(null);

  // Modal state: Entries / Lawyer Review
  const [modalEntries, setModalEntries] =
    useState<AuditEntryItem[]>(recentEntries);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entriesError, setEntriesError] = useState<string | null>(null);
  const [entryBranchFilter, setEntryBranchFilter] =
    useState<EntryBranchFilter>("ALL");
  const [entrySearch, setEntrySearch] = useState("");

  // Modal state: Activity & Security Logs
  const [modalLogs, setModalLogs] = useState<EnrichedAuditLog[]>(recentLogs);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logCategory, setLogCategory] = useState<LogCategoryFilter>("ALL");
  const [logSearch, setLogSearch] = useState("");

  // Modal state: Act Type Breakdown
  const [actSearch, setActSearch] = useState("");

  // Modal state: Interactive Period & Branch Summary
  const [selectedPeriod, setSelectedPeriod] = useState<DashboardPeriod | null>(
    null
  );
  const [modalBranch, setModalBranch] = useState<EntryBranchFilter>("ALL");
  const [modalPaymentFilter, setModalPaymentFilter] = useState<
    "ALL" | PaymentType
  >("ALL");
  const [periodEntries, setPeriodEntries] = useState<AuditEntryItem[]>([]);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [periodError, setPeriodError] = useState<string | null>(null);
  const periodRequestRef = useRef(0);
  const periodCacheRef = useRef<Map<string, AuditEntryItem[]>>(new Map());
  const allEntriesCacheRef = useRef<AuditEntryItem[] | null>(null);
  const logsCacheRef = useRef<EnrichedAuditLog[] | null>(null);

  // Lock background page scroll and allow Escape to dismiss active modal.
  useEffect(() => {
    if (!activeModal) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setActiveModal(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeModal]);

  async function openEntriesModal() {
    setEntryBranchFilter("ALL");
    setEntrySearch("");
    setEntriesError(null);
    setActiveModal("entries");
    if (allEntriesCacheRef.current) {
      setModalEntries(allEntriesCacheRef.current);
      setEntriesLoading(false);
      return;
    }

    setEntriesLoading(true);
    try {
      const res = await fetch("/api/owner/audit?page_size=all", {
        cache: "no-store",
      });
      const payload = (await res.json()) as Partial<OwnerAuditResult> & {
        error?: string;
      };
      if (!res.ok) {
        setEntriesError(payload.error ?? "Failed to load all entries.");
      } else if (Array.isArray(payload.entries)) {
        allEntriesCacheRef.current = payload.entries;
        setModalEntries(payload.entries);
      }
    } catch {
      setEntriesError("Network error while loading entries.");
    } finally {
      setEntriesLoading(false);
    }
  }

  async function openLogsModal() {
    setLogCategory("ALL");
    setLogSearch("");
    setLogsError(null);
    setActiveModal("logs");
    if (logsCacheRef.current) {
      setModalLogs(logsCacheRef.current);
      setLogsLoading(false);
      return;
    }

    setLogsLoading(true);
    try {
      const res = await fetch("/api/owner/logs?limit=100", {
        cache: "no-store",
      });
      const payload = (await res.json()) as {
        logs?: EnrichedAuditLog[];
        error?: string;
      };
      if (!res.ok) {
        setLogsError(payload.error ?? "Failed to load recent logs.");
      } else if (Array.isArray(payload.logs)) {
        logsCacheRef.current = payload.logs;
        setModalLogs(payload.logs);
      }
    } catch {
      setLogsError("Network error while loading logs.");
    } finally {
      setLogsLoading(false);
    }
  }

  function openActsModal() {
    setActSearch("");
    setActiveModal("acts");
  }

  async function fetchPeriodEntries(
    period: DashboardPeriod,
    branch: EntryBranchFilter
  ) {
    const cacheKey = `${period}:${branch}`;
    const cached = periodCacheRef.current.get(cacheKey);
    if (cached) {
      setPeriodError(null);
      setPeriodLoading(false);
      setPeriodEntries(cached);
      return;
    }

    const requestId = ++periodRequestRef.current;
    setPeriodLoading(true);
    setPeriodError(null);
    try {
      const { date_from, date_to } = getManilaPeriodDateRange(period);
      const params = new URLSearchParams({ page_size: "all" });
      if (date_from) params.set("date_from", date_from);
      if (date_to) params.set("date_to", date_to);
      if (branch !== "ALL") params.set("branch_code", branch);

      const url = `/api/owner/audit?${params.toString()}`;
      const res = await fetch(url, { cache: "no-store" });
      const payload = (await res.json()) as Partial<OwnerAuditResult> & {
        error?: string;
      };
      if (requestId !== periodRequestRef.current) return;

      if (!res.ok) {
        setPeriodError(payload.error ?? "Failed to load period breakdown.");
      } else if (Array.isArray(payload.entries)) {
        periodCacheRef.current.set(cacheKey, payload.entries);
        setPeriodEntries(payload.entries);
      }
    } catch {
      if (requestId === periodRequestRef.current) {
        setPeriodError("Network error while loading period breakdown.");
      }
    } finally {
      if (requestId === periodRequestRef.current) {
        setPeriodLoading(false);
      }
    }
  }

  function openPeriodModal(period: DashboardPeriod) {
    setSelectedPeriod(period);
    setModalBranch("ALL");
    setModalPaymentFilter("ALL");
    setPeriodEntries([]);
    setActiveModal("period");
    void fetchPeriodEntries(period, "ALL");
  }

  function handleSelectModalBranch(branch: EntryBranchFilter) {
    setModalBranch(branch);
    if (selectedPeriod) {
      void fetchPeriodEntries(selectedPeriod, branch);
    }
  }

  const filteredModalEntries = useMemo(() => {
    const q = entrySearch.trim().toLowerCase();
    return modalEntries.filter((entry) => {
      if (
        entryBranchFilter !== "ALL" &&
        entry.branch_code !== entryBranchFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        String(entry.entry_number).includes(q) ||
        entry.parties.toLowerCase().includes(q) ||
        (entry.secondary_parties ?? "").toLowerCase().includes(q) ||
        entry.instrument_title.toLowerCase().includes(q) ||
        entry.notarial_act_type.toLowerCase().includes(q)
      );
    });
  }, [modalEntries, entryBranchFilter, entrySearch]);

  const filteredModalLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    return modalLogs.filter((log) => {
      if (logCategory === "ENTRIES" && !ENTRY_ACTIONS.has(log.action)) {
        return false;
      }
      if (logCategory === "REVIEWS" && !REVIEW_ACTIONS.has(log.action)) {
        return false;
      }
      if (logCategory === "SECURITY" && !SECURITY_ACTIONS.has(log.action)) {
        return false;
      }
      if (!q) return true;
      const summary = summarizeLog(log).toLowerCase();
      return (
        log.branch_name.toLowerCase().includes(q) ||
        (log.branch_code ?? "").toLowerCase().includes(q) ||
        (log.device_label ?? "").toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        summary.includes(q)
      );
    });
  }, [modalLogs, logCategory, logSearch]);

  const filteredModalActs = useMemo(() => {
    const q = actSearch.trim().toLowerCase();
    if (!q) return actBreakdown;
    return actBreakdown.filter((item) =>
      item.act_type.toLowerCase().includes(q)
    );
  }, [actBreakdown, actSearch]);

  const periodMeta = useMemo(
    () =>
      selectedPeriod ? getManilaPeriodDateRange(selectedPeriod) : null,
    [selectedPeriod]
  );

  const periodDisplayEntries = useMemo(() => {
    if (modalPaymentFilter === "ALL") return periodEntries;
    return periodEntries.filter(
      (entry) => entry.payment_type === modalPaymentFilter
    );
  }, [periodEntries, modalPaymentFilter]);

  const periodSummary = useMemo(() => {
    let totalAmountPaid = 0;
    let fullCount = 0;
    let fullAmountPaid = 0;
    let partialCount = 0;
    let partialAmountPaid = 0;
    let forReviewCount = 0;
    let approvedCount = 0;
    let flaggedCount = 0;
    const actMap = new Map<
      string,
      { act_type: string; count: number; amount_paid: number }
    >();

    for (const entry of periodDisplayEntries) {
      totalAmountPaid += entry.amount_paid;
      if (entry.payment_type === "partial") {
        partialCount += 1;
        partialAmountPaid += entry.amount_paid;
      } else {
        fullCount += 1;
        fullAmountPaid += entry.amount_paid;
      }

      if (entry.review_status === "approved") approvedCount += 1;
      else if (entry.review_status === "flagged") flaggedCount += 1;
      else forReviewCount += 1;

      const existing = actMap.get(entry.notarial_act_type) ?? {
        act_type: entry.notarial_act_type,
        count: 0,
        amount_paid: 0,
      };
      existing.count += 1;
      existing.amount_paid += entry.amount_paid;
      actMap.set(entry.notarial_act_type, existing);
    }

    const actChips = Array.from(actMap.values()).sort(
      (a, b) => b.count - a.count || b.amount_paid - a.amount_paid
    );

    return {
      totalAmountPaid,
      totalEntries: periodDisplayEntries.length,
      fullCount,
      fullAmountPaid,
      partialCount,
      partialAmountPaid,
      forReviewCount,
      approvedCount,
      flaggedCount,
      actChips,
    };
  }, [periodDisplayEntries]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-xl font-bold text-[#1B2A4A] sm:text-2xl">
            Owner Financial &amp; Audit Dashboard
          </h1>
          <p className="text-sm text-[#64748B]">
            Consolidated oversight across GenSan Branch and Malungon Branch.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {kpis.allTime.partial_count > 0 && (
            <Link
              href="/owner/audit?payment_type=partial"
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-[#FFFBEB] px-3.5 py-2 text-xs font-semibold text-[#78350F] transition hover:bg-amber-100 sm:w-auto"
            >
              Partial Payments ({kpis.allTime.partial_count})
            </Link>
          )}
          <Link
            href="/owner/audit"
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg bg-[#1B2A4A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#121D36] sm:w-auto"
          >
            Open Master Audit
            <ArrowRight className="h-4 w-4 text-[#B48A3E]" />
          </Link>
        </div>
      </div>

      {/* Lawyer Review Queue KPI Card */}
      <section>
        <Link
          href="/owner/audit?status=for_review"
          className="group flex flex-col gap-3 rounded-xl border border-[#B48A3E] bg-[#FBF5E8] p-5 shadow-xs transition hover:bg-[#F4EFE4] sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#B48A3E]">
                For Lawyer Review
              </span>
              {data.reviewCounts.flagged > 0 && (
                <span className="rounded-full bg-[#FEF2F2] px-2.5 py-0.5 text-xs font-semibold text-[#7F1D1D]">
                  {data.reviewCounts.flagged} flagged
                </span>
              )}
              <span className="rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-xs font-semibold text-[#065F46]">
                {data.reviewCounts.approved} approved
              </span>
            </div>
            <div className="flex items-baseline gap-2.5">
              <span className="font-serif text-3xl font-bold tabular-nums text-[#1B2A4A]">
                {data.reviewCounts.forReview}
              </span>
              <span className="text-sm text-[#1C2434]">
                {data.reviewCounts.forReview === 1
                  ? "entry awaiting verification"
                  : "entries awaiting verification"}
              </span>
            </div>
            <p className="text-xs text-[#64748B]">
              GenSan:{" "}
              <strong className="text-[#1B2A4A]">
                {data.reviewCounts.gensanForReview}
              </strong>{" "}
              &bull; Malungon:{" "}
              <strong className="text-[#1B2A4A]">
                {data.reviewCounts.malungonForReview}
              </strong>
            </p>
          </div>

          <span className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#1B2A4A] px-4 py-2 text-sm font-semibold text-white transition group-hover:bg-[#121D36]">
            Review &amp; Verify Queue
            <ArrowRight className="h-4 w-4 text-[#B48A3E]" />
          </span>
        </Link>
      </section>

      {/* KPI Summary Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Today"
          period="today"
          totals={kpis.today}
          onSelect={openPeriodModal}
        />
        <KpiCard
          title="This Week"
          period="week"
          totals={kpis.week}
          onSelect={openPeriodModal}
        />
        <KpiCard
          title="This Month"
          period="month"
          totals={kpis.month}
          onSelect={openPeriodModal}
        />
        <KpiCard
          title="All-Time"
          period="all"
          totals={kpis.allTime}
          onSelect={openPeriodModal}
        />
      </section>

      {/* Side-by-Side Branch Comparison */}
      <section className="grid gap-4 lg:grid-cols-2">
        {[
          {
            code: "GENSAN" as const,
            name: "GenSan Branch",
            book: gensanBook,
            today: kpis.today.gensan,
            month: kpis.month.gensan,
            allTime: kpis.allTime.gensan,
            badgeClass: "bg-[#1B2A4A] text-white",
          },
          {
            code: "MALUNGON" as const,
            name: "Malungon Branch",
            book: malungonBook,
            today: kpis.today.malungon,
            month: kpis.month.malungon,
            allTime: kpis.allTime.malungon,
            badgeClass: "bg-[#065F46] text-white",
          },
        ].map((branch) => (
          <div
            key={branch.code}
            className="rounded-xl border border-[#DFD7C8] bg-white p-6 shadow-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DFD7C8] pb-4">
              <div className="flex items-center gap-2.5">
                <Building2 className="h-5 w-5 text-[#B48A3E]" />
                <h2 className="font-serif text-lg font-bold text-[#1B2A4A]">
                  {branch.name}
                </h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${branch.badgeClass}`}
                >
                  {branch.code}
                </span>
              </div>
              <Link
                href={`/owner/audit?branch_code=${branch.code}`}
                className="inline-flex min-h-[44px] items-center text-xs font-semibold text-[#1B2A4A] underline-offset-2 hover:underline"
              >
                View Entries &rarr;
              </Link>
            </div>

            {branch.book && (
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#64748B]">
                <span className="inline-flex items-center gap-1 font-medium text-[#1B2A4A]">
                  <BookOpen className="h-3.5 w-3.5 text-[#B48A3E]" />
                  Book {branch.book.book_no} (Series of {branch.book.series_year}
                  )
                </span>
                <span>&bull;</span>
                <span>{branch.book.notary_name}</span>
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { label: "Today", stats: branch.today },
                { label: "This Month", stats: branch.month },
                { label: "All-Time", stats: branch.allTime },
              ].map((col) => (
                <div
                  key={col.label}
                  className="rounded-lg border border-[#DFD7C8] bg-[#FAF7F1] p-3"
                >
                  <div className="text-xs font-medium text-[#64748B]">
                    {col.label}
                  </div>
                  <div className="mt-1 font-mono text-base font-bold tabular-nums text-[#1B2A4A]">
                    {formatPhp(col.stats.total_amount_paid)}
                  </div>
                  <div className="mt-1 font-mono text-xs tabular-nums text-[#64748B]">
                    Full: {col.stats.full_count} &bull; Partial:{" "}
                    {col.stats.partial_count}
                  </div>
                  <div className="mt-0.5 font-mono text-xs font-medium tabular-nums text-[#64748B]">
                    {col.stats.total_entries} entries
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Entries For Lawyer Review / Recent Entries (Capped at 5) */}
      <section className="rounded-xl border border-[#DFD7C8] bg-white p-5 shadow-xs sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Eye className="h-5 w-5 shrink-0 text-[#B48A3E]" />
            <h2 className="font-serif text-lg font-bold text-[#1B2A4A]">
              Entries For Lawyer Review / Recent Entries
            </h2>
          </div>

          {totalEntriesCount > 0 && (
            <button
              type="button"
              onClick={() => void openEntriesModal()}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-[#DFD7C8] bg-[#FAF7F1] px-3.5 py-2 text-xs font-semibold text-[#1B2A4A] transition hover:bg-[#F4EFE4]"
            >
              View All ({totalEntriesCount})
            </button>
          )}
        </div>

        {visibleEntries.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#64748B]">
            No notarized entries recorded yet.
          </p>
        ) : (
          <div className="divide-y divide-[#DFD7C8]">
            {visibleEntries.map((entry) => (
              <EntrySummaryRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Breakdown by Notarial Act Type (Capped at 5) */}
        <section className="rounded-xl border border-[#DFD7C8] bg-white p-5 shadow-xs sm:p-6 lg:col-span-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#B48A3E]" />
              <h2 className="font-serif text-lg font-bold text-[#1B2A4A]">
                Breakdown by Notarial Act
              </h2>
            </div>

            {actBreakdown.length > 0 && (
              <button
                type="button"
                onClick={openActsModal}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[#DFD7C8] bg-[#FAF7F1] px-3 py-2 text-xs font-semibold text-[#1B2A4A] transition hover:bg-[#F4EFE4]"
              >
                View All ({actBreakdown.length})
              </button>
            )}
          </div>

          {visibleActs.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#64748B]">
              No notarized entries recorded yet.
            </p>
          ) : (
            <div className="space-y-3">
              {visibleActs.map((item) => (
                <div
                  key={item.act_type}
                  className="rounded-lg border border-[#DFD7C8] bg-[#FAF7F1] p-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[#1C2434]">
                      {item.act_type}
                    </span>
                    <span className="rounded-full bg-[#F1F5F9] px-2.5 py-0.5 text-xs font-semibold text-[#1E293B]">
                      {item.total_entries} total
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748B]">
                    <span>
                      GenSan: <strong>{item.gensan_entries}</strong> &bull;
                      Malungon: <strong>{item.malungon_entries}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono font-semibold tabular-nums text-[#065F46]">
                      <PhilippinePeso className="h-3.5 w-3.5" />
                      {formatPhp(item.total_amount_paid)} paid
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent Activity & Security Alerts (Capped at 5) */}
        <section className="rounded-xl border border-[#DFD7C8] bg-white p-5 shadow-xs sm:p-6 lg:col-span-7">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Activity className="h-5 w-5 text-[#B48A3E]" />
              <h2 className="font-serif text-lg font-bold text-[#1B2A4A]">
                Recent Activity &amp; Security Alerts
              </h2>
              {securityAlertCount > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#FEF2F2] px-2.5 py-0.5 text-xs font-semibold text-[#7F1D1D]">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  {securityAlertCount} security{" "}
                  {securityAlertCount === 1 ? "event" : "events"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-xs font-semibold text-[#065F46]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  No recent alerts
                </span>
              )}
            </div>

            {totalLogsCount > 0 && (
              <button
                type="button"
                onClick={() => void openLogsModal()}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[#DFD7C8] bg-[#FAF7F1] px-3 py-2 text-xs font-semibold text-[#1B2A4A] transition hover:bg-[#F4EFE4]"
              >
                View All ({totalLogsCount})
              </button>
            )}
          </div>

          {visibleLogs.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#64748B]">
              No activity logged yet.
            </p>
          ) : (
            <div className="divide-y divide-[#DFD7C8]">
              {visibleLogs.map((log) => (
                <LogRow key={log.id} log={log} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Modal 1: Entries / For Lawyer Review */}
      {activeModal === "entries" && (
        <DashboardModalShell
          title="Entries & Lawyer Review"
          countLabel={`${filteredModalEntries.length} / ${modalEntries.length} entries`}
          onClose={() => setActiveModal(null)}
          footerLinkHref="/owner/audit"
          footerLinkLabel="Open Master Audit"
          filterBar={
            <div className="space-y-2.5">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { value: "ALL", label: "All" },
                    { value: "GENSAN", label: "GenSan Branch" },
                    { value: "MALUNGON", label: "Malungon Branch" },
                  ] as const
                ).map((tab) => {
                  const active = entryBranchFilter === tab.value;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setEntryBranchFilter(tab.value)}
                      className={`inline-flex min-h-[44px] items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                        active
                          ? "border-[#1B2A4A] bg-[#1B2A4A] text-white"
                          : "border-[#DFD7C8] bg-white text-[#1B2A4A] hover:bg-[#F4EFE4]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                <input
                  type="search"
                  value={entrySearch}
                  onChange={(e) => setEntrySearch(e.target.value)}
                  placeholder="Search Entry No., Party Name, or Instrument Title..."
                  className="min-h-[44px] w-full rounded-lg border border-[#DFD7C8] bg-white py-2 pl-9 pr-3 text-base text-[#1C2434] placeholder:text-[#64748B] focus:border-[#1B2A4A] focus:outline-none md:text-sm"
                />
              </div>
            </div>
          }
        >
          {entriesLoading ? (
            <div className="py-4">
              <EntryListSkeleton rows={4} />
            </div>
          ) : entriesError ? (
            <div className="my-4 rounded-lg border border-red-200 bg-[#FEF2F2] px-4 py-3 text-sm text-[#7F1D1D]">
              {entriesError}
            </div>
          ) : filteredModalEntries.length === 0 ? (
            <div className="py-10 text-center text-sm text-[#64748B]">
              No entries match your filter.
            </div>
          ) : (
            filteredModalEntries.map((entry) => (
              <EntrySummaryRow
                key={entry.id}
                entry={entry}
                onNavigate={() => setActiveModal(null)}
              />
            ))
          )}
        </DashboardModalShell>
      )}

      {/* Modal 2: Notarial Act Type Breakdown */}
      {activeModal === "acts" && (
        <DashboardModalShell
          title="Notarial Act Type Breakdown"
          countLabel={`${filteredModalActs.length} / ${actBreakdown.length} types`}
          onClose={() => setActiveModal(null)}
          footerLinkHref="/owner/audit"
          footerLinkLabel="Open Master Audit"
          filterBar={
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
              <input
                type="search"
                value={actSearch}
                onChange={(e) => setActSearch(e.target.value)}
                placeholder="Search notarial act type..."
                className="min-h-[44px] w-full rounded-lg border border-[#DFD7C8] bg-white py-2 pl-9 pr-3 text-base text-[#1C2434] placeholder:text-[#64748B] focus:border-[#1B2A4A] focus:outline-none md:text-sm"
              />
            </div>
          }
        >
          {filteredModalActs.length === 0 ? (
            <div className="py-10 text-center text-sm text-[#64748B]">
              No act types match your search.
            </div>
          ) : (
            filteredModalActs.map((item) => (
              <div key={item.act_type} className="space-y-1.5 py-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[#1C2434]">
                    {item.act_type}
                  </span>
                  <span className="rounded-full bg-[#F1F5F9] px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-[#1E293B]">
                    {item.total_entries} total
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748B]">
                  <span>
                    GenSan: <strong>{item.gensan_entries}</strong> &bull;
                    Malungon: <strong>{item.malungon_entries}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono font-semibold tabular-nums text-[#065F46]">
                    <PhilippinePeso className="h-3.5 w-3.5" />
                    {formatPhp(item.total_amount_paid)} paid
                  </span>
                </div>
              </div>
            ))
          )}
        </DashboardModalShell>
      )}

      {/* Modal 3: Activity & Security Logs */}
      {activeModal === "logs" && (
        <DashboardModalShell
          title="Activity & Security Logs"
          countLabel={`${filteredModalLogs.length} / ${modalLogs.length} recent${totalLogsCount > modalLogs.length ? ` (${totalLogsCount} total)` : ""}`}
          onClose={() => setActiveModal(null)}
          footerLinkHref="/owner/devices"
          footerLinkLabel="Manage Authorized Devices"
          filterBar={
            <div className="space-y-2.5">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { value: "ALL", label: "All" },
                    { value: "ENTRIES", label: "Entries" },
                    { value: "REVIEWS", label: "Approvals/Flags" },
                    { value: "SECURITY", label: "Security Alerts" },
                  ] as const
                ).map((tab) => {
                  const active = logCategory === tab.value;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setLogCategory(tab.value)}
                      className={`inline-flex min-h-[44px] items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                        active
                          ? "border-[#1B2A4A] bg-[#1B2A4A] text-white"
                          : "border-[#DFD7C8] bg-white text-[#1B2A4A] hover:bg-[#F4EFE4]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                <input
                  type="search"
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  placeholder="Search by branch, PC label, or action..."
                  className="min-h-[44px] w-full rounded-lg border border-[#DFD7C8] bg-white py-2 pl-9 pr-3 text-base text-[#1C2434] placeholder:text-[#64748B] focus:border-[#1B2A4A] focus:outline-none md:text-sm"
                />
              </div>
            </div>
          }
        >
          {logsLoading ? (
            <div className="py-4">
              <EntryListSkeleton rows={4} />
            </div>
          ) : logsError ? (
            <div className="my-4 rounded-lg border border-red-200 bg-[#FEF2F2] px-4 py-3 text-sm text-[#7F1D1D]">
              {logsError}
            </div>
          ) : filteredModalLogs.length === 0 ? (
            <div className="py-10 text-center text-sm text-[#64748B]">
              No activity or security logs match your filter.
            </div>
          ) : (
            filteredModalLogs.map((log) => <LogRow key={log.id} log={log} />)
          )}
        </DashboardModalShell>
      )}

      {/* Modal 4: Interactive Period & Branch Summary */}
      {activeModal === "period" && selectedPeriod && periodMeta && (
        <DashboardModalShell
          title={periodMeta.title}
          subtitle={periodMeta.subtitle}
          countLabel={
            periodLoading
              ? "Loading..."
              : `${periodSummary.totalEntries} ${periodSummary.totalEntries === 1 ? "entry" : "entries"}`
          }
          onClose={() => setActiveModal(null)}
          footerLinkHref={`/owner/audit?branch=${modalBranch}&period=${selectedPeriod}${modalPaymentFilter !== "ALL" ? `&payment_type=${modalPaymentFilter}` : ""}`}
          footerLinkLabel="Open in Master Audit"
          filterBar={
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { value: "ALL", label: "All Branches" },
                    { value: "GENSAN", label: "GenSan Branch" },
                    { value: "MALUNGON", label: "Malungon Branch" },
                  ] as const
                ).map((tab) => {
                  const active = modalBranch === tab.value;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => handleSelectModalBranch(tab.value)}
                      className={`inline-flex min-h-[44px] items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                        active
                          ? "border-[#1B2A4A] bg-[#1B2A4A] text-white"
                          : "border-[#DFD7C8] bg-white text-[#1B2A4A] hover:bg-[#F4EFE4]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { value: "ALL", label: "All Payments" },
                    { value: "full", label: "Full Amount" },
                    { value: "partial", label: "Partial Payment" },
                  ] as const
                ).map((pill) => {
                  const active = modalPaymentFilter === pill.value;
                  return (
                    <button
                      key={pill.value}
                      type="button"
                      onClick={() => setModalPaymentFilter(pill.value)}
                      className={`inline-flex min-h-[44px] items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        active
                          ? "border-[#B48A3E] bg-[#FBF5E8] text-[#1B2A4A]"
                          : "border-[#DFD7C8] bg-white text-[#64748B] hover:bg-[#F4EFE4] hover:text-[#1B2A4A]"
                      }`}
                    >
                      {pill.label}
                    </button>
                  );
                })}
              </div>
            </div>
          }
        >
          {/* Live Summary Breakdown */}
          <div className="-mx-4 border-b border-[#DFD7C8] bg-[#FAF7F1]/70 px-4 py-4 sm:-mx-6 sm:px-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-[#DFD7C8] bg-white p-3">
                <div className="text-xs text-[#64748B]">Total Amount Paid</div>
                <div className="mt-0.5 font-serif text-xl font-bold tabular-nums text-[#065F46]">
                  {formatPhp(periodSummary.totalAmountPaid)}
                </div>
              </div>

              <div className="rounded-lg border border-[#DFD7C8] bg-white p-3">
                <div className="text-xs text-[#64748B]">Total Entries</div>
                <div className="mt-0.5 font-mono text-xl font-bold tabular-nums text-[#1B2A4A]">
                  {periodSummary.totalEntries}
                </div>
              </div>

              <div className="col-span-2 rounded-lg border border-[#DFD7C8] bg-white p-3 sm:col-span-1">
                <div className="text-xs text-[#64748B]">Review Status</div>
                <div className="mt-1 flex flex-wrap gap-1.5 text-xs font-semibold tabular-nums">
                  <span className="rounded-full bg-[#FFFBEB] px-2 py-0.5 text-[#78350F]">
                    For Review: {periodSummary.forReviewCount}
                  </span>
                  <span className="rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[#065F46]">
                    Approved: {periodSummary.approvedCount}
                  </span>
                  {periodSummary.flaggedCount > 0 && (
                    <span className="rounded-full bg-[#FEF2F2] px-2 py-0.5 text-[#7F1D1D]">
                      Flagged: {periodSummary.flaggedCount}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs tabular-nums">
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-[#ECFDF5] px-2.5 py-1 font-medium text-[#065F46]">
                Full ({periodSummary.fullCount}):{" "}
                <strong className="font-mono">
                  {formatPhp(periodSummary.fullAmountPaid)}
                </strong>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-[#FFFBEB] px-2.5 py-1 font-medium text-[#78350F]">
                Partial ({periodSummary.partialCount}):{" "}
                <strong className="font-mono">
                  {formatPhp(periodSummary.partialAmountPaid)}
                </strong>
              </span>
            </div>

            {periodSummary.actChips.length > 0 && (
              <div className="mt-3 border-t border-[#DFD7C8] pt-3">
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  By Notarial Act Type
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {periodSummary.actChips.map((chip) => (
                    <span
                      key={chip.act_type}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#DFD7C8] bg-white px-2.5 py-1 text-xs text-[#1C2434]"
                    >
                      <span className="font-semibold">{chip.act_type}</span>
                      <span className="font-mono text-[#64748B] tabular-nums">
                        ({chip.count})
                      </span>
                      <span className="font-mono font-semibold text-[#065F46] tabular-nums">
                        {formatPhp(chip.amount_paid)}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {periodLoading ? (
            <div className="py-4">
              <EntryListSkeleton rows={4} />
            </div>
          ) : periodError ? (
            <div className="my-4 rounded-lg border border-red-200 bg-[#FEF2F2] px-4 py-3 text-sm text-[#7F1D1D]">
              {periodError}
            </div>
          ) : periodDisplayEntries.length === 0 ? (
            <div className="py-10 text-center text-sm text-[#64748B]">
              No transactions found for this branch and period.
            </div>
          ) : (
            periodDisplayEntries.map((entry) => (
              <EntrySummaryRow
                key={entry.id}
                entry={entry}
                onNavigate={() => setActiveModal(null)}
              />
            ))
          )}
        </DashboardModalShell>
      )}
    </div>
  );
}
