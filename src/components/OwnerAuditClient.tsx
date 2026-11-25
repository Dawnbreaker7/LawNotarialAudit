"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import {
  CheckCircle2,
  Clock,
  Eye,
  FileSpreadsheet,
  Filter,
  Flag,
  History,
  Monitor,
  Paperclip,
  Pencil,
  Printer,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import AttachmentViewerPane from "@/components/AttachmentViewerPane";
import type {
  AuditBookOption,
  AuditEntryItem,
  AuditTotals,
  EnrichedAuditLog,
  OwnerAuditResult,
} from "@/lib/owner/audit";
import type { PaymentType } from "@/types/database";

const NOTARIAL_ACT_TYPES = [
  "Acknowledgment",
  "Jurat",
  "Oath / Affirmation",
  "Copy Certification",
  "Signature Witnessing",
] as const;

interface OwnerAuditClientProps {
  initialData: OwnerAuditResult;
  initialBranchCode?: string;
  initialStatus?: string;
  initialPaymentType?: string;
  initialDateFrom?: string;
  initialDateTo?: string;
  initialReviewId?: string;
}

function renderAuditPaymentBadge(paymentType: PaymentType) {
  if (paymentType === "partial") {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">
        Partial Payment
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-900">
      Full Amount
    </span>
  );
}

function renderAuditReviewBadge(entry: AuditEntryItem) {
  if (entry.review_status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-900">
        <CheckCircle2 className="h-3 w-3" />
        Approved
      </span>
    );
  }
  if (entry.review_status === "flagged") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-900">
        <Flag className="h-3 w-3" />
        Flagged
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
      <Clock className="h-3 w-3" />
      For Review
    </span>
  );
}

interface EditModalState {
  entry: AuditEntryItem;
  entry_number: string;
  page_no: string;
  instrument_title: string;
  parties: string;
  secondary_parties: string;
  competent_evidence_id: string;
  notarized_at: string;
  notarial_act_type: string;
  amount_paid: string;
  payment_type: PaymentType;
  acknowledgement_receipt: string;
  place_and_remarks: string;
  edit_reason: string;
}

const DIFF_FIELDS: Array<{ key: string; label: string }> = [
  { key: "entry_number", label: "Entry No." },
  { key: "page_no", label: "Page No." },
  { key: "instrument_title", label: "Instrument Title" },
  { key: "parties", label: "Names & Addresses of Parties" },
  {
    key: "secondary_parties",
    label: "Names & Addresses of Parties (Optional)",
  },
  { key: "competent_evidence_id", label: "Competent Evidence ID" },
  { key: "notarized_at", label: "Date & Time" },
  { key: "notarial_act_type", label: "Notarial Act Type" },
  { key: "amount_paid", label: "Amount Paid (PHP)" },
  { key: "payment_type", label: "Payment Type" },
  { key: "acknowledgement_receipt", label: "Acknowledgement Receipt" },
  { key: "place_and_remarks", label: "Place / Remarks" },
];

function formatPhp(amount: number): string {
  const safe = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(safe);
}

function formatDateTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toLocalDateTimeInputValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDiffValue(key: string, val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  if (key === "notarized_at" && typeof val === "string") {
    return formatDateTime(val);
  }
  if (key === "amount_paid" && !Number.isNaN(Number(val))) {
    return formatPhp(Number(val));
  }
  if (key === "payment_type") {
    return val === "partial" ? "Partial Payment" : "Full Amount";
  }
  return String(val);
}

export default function OwnerAuditClient({
  initialData,
  initialBranchCode = "ALL",
  initialStatus = "ALL",
  initialPaymentType = "ALL",
  initialDateFrom = "",
  initialDateTo = "",
  initialReviewId,
}: OwnerAuditClientProps) {
  const initialReviewTarget = initialReviewId
    ? (initialData.entries.find((item) => item.id === initialReviewId) ?? null)
    : null;

  const [entries, setEntries] = useState<AuditEntryItem[]>(initialData.entries);
  const [books] = useState<AuditBookOption[]>(initialData.books);
  const [totals, setTotals] = useState<AuditTotals>(initialData.totals);

  const [branchCode, setBranchCode] = useState(initialBranchCode);
  const [bookId, setBookId] = useState("ALL");
  const [reviewStatus, setReviewStatus] = useState(initialStatus);
  const [paymentTypeFilter, setPaymentTypeFilter] = useState(initialPaymentType);
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [reviewEntry, setReviewEntry] = useState<AuditEntryItem | null>(
    initialReviewTarget
  );
  const [reviewNotesInput, setReviewNotesInput] = useState(
    initialReviewTarget?.review_notes ?? ""
  );
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const [editModal, setEditModal] = useState<EditModalState | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [historyEntry, setHistoryEntry] = useState<AuditEntryItem | null>(null);
  const [historyLogs, setHistoryLogs] = useState<EnrichedAuditLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function applyFilters(overrides?: {
    branch_code?: string;
    book_id?: string;
    status?: string;
    payment_type?: string;
    date_from?: string;
    date_to?: string;
    search?: string;
  }) {
    const nextBranch = overrides?.branch_code ?? branchCode;
    const nextBook = overrides?.book_id ?? bookId;
    const nextStatus = overrides?.status ?? reviewStatus;
    const nextPaymentType = overrides?.payment_type ?? paymentTypeFilter;
    const nextFrom = overrides?.date_from ?? dateFrom;
    const nextTo = overrides?.date_to ?? dateTo;
    const nextSearch = overrides?.search ?? search;

    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams();
      if (nextBranch && nextBranch !== "ALL") {
        params.set("branch_code", nextBranch);
      }
      if (nextBook && nextBook !== "ALL") {
        params.set("book_id", nextBook);
      }
      if (nextStatus && nextStatus !== "ALL") {
        params.set("status", nextStatus);
      }
      if (nextPaymentType && nextPaymentType !== "ALL") {
        params.set("payment_type", nextPaymentType);
      }
      if (nextFrom) params.set("date_from", nextFrom);
      if (nextTo) params.set("date_to", nextTo);
      if (nextSearch.trim()) params.set("search", nextSearch.trim());

      const res = await fetch(`/api/owner/audit?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as OwnerAuditResult & { error?: string };
      if (!res.ok) {
        setErrorMsg(data.error ?? "Failed to filter audit entries.");
        return;
      }
      setEntries(data.entries);
      setTotals(data.totals);
    } catch {
      setErrorMsg("Network error while loading master audit.");
    } finally {
      setLoading(false);
    }
  }

  function handleFilterSubmit(e: FormEvent) {
    e.preventDefault();
    void applyFilters();
  }

  function handleClearFilters() {
    setBranchCode("ALL");
    setBookId("ALL");
    setReviewStatus("ALL");
    setPaymentTypeFilter("ALL");
    setDateFrom("");
    setDateTo("");
    setSearch("");
    void applyFilters({
      branch_code: "ALL",
      book_id: "ALL",
      status: "ALL",
      payment_type: "ALL",
      date_from: "",
      date_to: "",
      search: "",
    });
  }

  function openReviewModal(entry: AuditEntryItem) {
    setReviewError(null);
    setReviewNotesInput(entry.review_notes ?? "");
    setReviewEntry(entry);
  }

  async function handleSubmitReview(action: "approve" | "flag") {
    if (!reviewEntry) return;
    const trimmedNotes = reviewNotesInput.trim();
    if (action === "flag" && !trimmedNotes) {
      setReviewError(
        "Please enter a review note explaining why this entry is flagged."
      );
      return;
    }

    setReviewSaving(true);
    setReviewError(null);
    try {
      const res = await fetch(`/api/owner/entries/${reviewEntry.id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          review_notes: trimmedNotes,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        setReviewError(payload.error ?? "Failed to update review status.");
        setReviewSaving(false);
        return;
      }

      setReviewEntry(null);
      await applyFilters();
    } catch {
      setReviewError("Network error while submitting review.");
    } finally {
      setReviewSaving(false);
    }
  }

  function openEditModal(entry: AuditEntryItem) {
    setEditError(null);
    setEditModal({
      entry,
      entry_number: String(entry.entry_number),
      page_no: String(entry.page_no),
      instrument_title: entry.instrument_title,
      parties: entry.parties,
      secondary_parties: entry.secondary_parties ?? "",
      competent_evidence_id: entry.competent_evidence_id,
      notarized_at: toLocalDateTimeInputValue(entry.notarized_at),
      notarial_act_type: entry.notarial_act_type,
      amount_paid: String(entry.amount_paid),
      payment_type: entry.payment_type,
      acknowledgement_receipt: entry.acknowledgement_receipt ?? "",
      place_and_remarks: entry.place_and_remarks ?? "",
      edit_reason: "",
    });
  }

  const parsedEditEntryNo = editModal ? Number(editModal.entry_number) : 0;
  const parsedEditPageNo = editModal ? Number(editModal.page_no) : 0;
  const isEditEntryOutOfRange =
    Boolean(editModal) &&
    (!Number.isInteger(parsedEditEntryNo) ||
      parsedEditEntryNo < 1 ||
      parsedEditEntryNo > 500);
  const isEditPageOutOfRange =
    Boolean(editModal) &&
    (!Number.isInteger(parsedEditPageNo) ||
      parsedEditPageNo < 1 ||
      parsedEditPageNo > 100);

  async function handleSaveOwnerEdit(e: FormEvent) {
    e.preventDefault();
    if (!editModal) return;

    if (!editModal.edit_reason.trim()) {
      setEditError("Reason for edit is required.");
      return;
    }

    if (isEditEntryOutOfRange) {
      setEditError(
        "Entry No. must be between 1 and 500. This Notarial Book has a maximum capacity of 500 entries."
      );
      return;
    }

    if (isEditPageOutOfRange) {
      setEditError("Page No. must be an integer between 1 and 100.");
      return;
    }

    setEditSaving(true);
    setEditError(null);

    try {
      const res = await fetch(`/api/owner/entries/${editModal.entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry_number: Number(editModal.entry_number),
          page_no: Number(editModal.page_no),
          instrument_title: editModal.instrument_title.trim(),
          parties: editModal.parties.trim(),
          secondary_parties: editModal.secondary_parties.trim() || null,
          competent_evidence_id: editModal.competent_evidence_id.trim(),
          notarized_at: new Date(editModal.notarized_at).toISOString(),
          notarial_act_type: editModal.notarial_act_type,
          amount_paid: Number(editModal.amount_paid),
          payment_type: editModal.payment_type,
          acknowledgement_receipt:
            editModal.acknowledgement_receipt.trim() || null,
          place_and_remarks: editModal.place_and_remarks.trim() || null,
          edit_reason: editModal.edit_reason.trim(),
        }),
      });

      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        setEditError(payload.error ?? "Failed to save edit.");
        setEditSaving(false);
        return;
      }

      setEditModal(null);
      await applyFilters();
    } catch {
      setEditError("Network error while saving changes.");
    } finally {
      setEditSaving(false);
    }
  }

  async function openHistoryModal(entry: AuditEntryItem) {
    setHistoryEntry(entry);
    setHistoryLogs([]);
    setHistoryLoading(true);

    try {
      const res = await fetch(
        `/api/owner/logs?target_id=${encodeURIComponent(entry.id)}&limit=50`,
        { cache: "no-store" }
      );
      const data = (await res.json()) as { logs?: EnrichedAuditLog[] };
      setHistoryLogs(data.logs ?? []);
    } catch {
      setHistoryLogs([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  function handleExportExcel() {
    const headerRow = [
      "Branch",
      "Book No.",
      "Series Year",
      "Page No.",
      "Entry No.",
      "Date & Time",
      "Instrument Title",
      "Names & Addresses of Parties",
      "Names & Addresses of Parties (Optional)",
      "Competent Evidence of ID",
      "Notarial Act Type",
      "Amount Paid (PHP)",
      "Payment Type",
      "Acknowledgement Receipt",
      "Place & Remarks",
      "Encoded By (PC)",
    ];

    const dataRows = entries.map((e) => [
      e.branch_name,
      e.book_no,
      e.series_year,
      e.page_no,
      e.entry_number,
      formatDateTime(e.notarized_at),
      e.instrument_title,
      e.parties,
      e.secondary_parties ?? "",
      e.competent_evidence_id,
      e.notarial_act_type,
      e.amount_paid,
      e.payment_type === "partial" ? "Partial Payment" : "Full Amount",
      e.acknowledgement_receipt ?? "",
      e.place_and_remarks ?? "",
      e.encoded_by_label,
    ]);

    const totalRow = [
      "TOTAL",
      "",
      "",
      "",
      `${totals.total_entries} entries`,
      "",
      "",
      "",
      "",
      "",
      "",
      totals.total_amount_paid,
      `Full: ${totals.full_count} | Partial: ${totals.partial_count}`,
      "",
      "",
      "",
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([
      headerRow,
      ...dataRows,
      [],
      totalRow,
    ]);

    worksheet["!cols"] = [
      { wch: 18 },
      { wch: 10 },
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
      { wch: 22 },
      { wch: 28 },
      { wch: 32 },
      { wch: 32 },
      { wch: 26 },
      { wch: 20 },
      { wch: 18 },
      { wch: 18 },
      { wch: 24 },
      { wch: 24 },
      { wch: 24 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Master Audit");

    const todayStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Notarial-Master-Audit-${todayStr}.xlsx`);
  }

  const printQuery = new URLSearchParams();
  if (branchCode === "GENSAN" || branchCode === "MALUNGON") {
    printQuery.set("branch_code", branchCode);
  }
  if (bookId && bookId !== "ALL") {
    printQuery.set("book_id", bookId);
  }
  const printHref = `/owner/audit/print${
    printQuery.toString() ? `?${printQuery.toString()}` : ""
  }`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-xl font-bold text-[#1B2A4A] sm:text-2xl">
            Master Register Audit
          </h1>
          <p className="text-sm text-slate-600">
            Inspect all entries across GenSan Branch and Malungon Branch, view
            edit history, make audited owner corrections, and export to Excel.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link
            href={printHref}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-[#D8D0C0] bg-white px-4 py-2 text-sm font-semibold text-[#1B2A4A] transition hover:bg-[#FAF7F1] sm:w-auto"
          >
            <Printer className="h-4 w-4 text-[#9A722C]" />
            Print / PDF Sheet
          </Link>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={entries.length === 0}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <form
        onSubmit={handleFilterSubmit}
        className="rounded-xl border border-[#DFD7C8] bg-white p-4 shadow-xs"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              Branch
            </label>
            <select
              value={branchCode}
              onChange={(e) => {
                setBranchCode(e.target.value);
                void applyFilters({ branch_code: e.target.value });
              }}
              className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-slate-900 focus:outline-none md:text-sm"
            >
              <option value="ALL">All Branches</option>
              <option value="GENSAN">GenSan Branch</option>
              <option value="MALUNGON">Malungon Branch</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              Book
            </label>
            <select
              value={bookId}
              onChange={(e) => {
                setBookId(e.target.value);
                void applyFilters({ book_id: e.target.value });
              }}
              className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-slate-900 focus:outline-none md:text-sm"
            >
              <option value="ALL">All Books</option>
              {books.map((bk) => (
                <option key={bk.id} value={bk.id}>
                  {bk.branch_name} &mdash; Book {bk.book_no} ({bk.series_year})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              Review Status
            </label>
            <select
              value={reviewStatus}
              onChange={(e) => {
                setReviewStatus(e.target.value);
                void applyFilters({ status: e.target.value });
              }}
              className="min-h-[44px] w-full rounded-lg border border-[#D8D0C0] bg-white px-3 py-2 text-base text-slate-900 focus:border-[#1B2A4A] focus:outline-none md:text-sm"
            >
              <option value="ALL">All Statuses</option>
              <option value="for_review">For Review</option>
              <option value="approved">Approved</option>
              <option value="flagged">Flagged</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              Payment Type
            </label>
            <select
              value={paymentTypeFilter}
              onChange={(e) => {
                setPaymentTypeFilter(e.target.value);
                void applyFilters({ payment_type: e.target.value });
              }}
              className="min-h-[44px] w-full rounded-lg border border-[#D8D0C0] bg-white px-3 py-2 text-base text-slate-900 focus:border-[#1B2A4A] focus:outline-none md:text-sm"
            >
              <option value="ALL">All Payments</option>
              <option value="full">Full Amount</option>
              <option value="partial">Partial Payment</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              Date From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="min-h-[44px] w-full rounded-lg border border-[#D8D0C0] bg-white px-3 py-2 font-mono text-base tabular-nums text-slate-900 focus:border-[#1B2A4A] focus:outline-none md:text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              Date To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-900 focus:outline-none md:text-sm"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-6">
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              Search
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Entry #, Party, Title, or Acknowledgement Receipt"
                  className="min-h-[44px] w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-base text-slate-900 placeholder:text-slate-500 focus:border-slate-900 focus:outline-none md:text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-[#1B2A4A] px-4 py-2 text-sm font-medium text-white hover:bg-[#121D36] disabled:opacity-60"
                >
                  <Filter className="h-4 w-4 text-[#DFBE78]" />
                  Apply
                </button>
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="min-h-[44px] rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>

      {errorMsg && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          <ShieldAlert className="h-4 w-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Totals Bar */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#DFD7C8] bg-white p-4 shadow-xs">
          <div className="text-xs font-semibold uppercase text-slate-500">
            Filtered Total ({totals.total_entries} entries)
          </div>
          <div className="mt-1 font-mono text-xl font-bold tabular-nums text-emerald-800">
            {formatPhp(totals.total_amount_paid)}{" "}
            <span className="font-sans text-xs font-normal text-slate-500">paid</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs tabular-nums">
            <span className="font-medium text-emerald-800">
              Full ({totals.full_count}): {formatPhp(totals.full_amount_paid)}
            </span>
            <span className="text-slate-400">&bull;</span>
            <span className="font-medium text-amber-800">
              Partial ({totals.partial_count}): {formatPhp(totals.partial_amount_paid)}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-[#DFD7C8] bg-white p-4 shadow-xs">
          <div className="text-xs font-semibold uppercase text-sky-900">
            GenSan Branch ({totals.gensan.total_entries} entries)
          </div>
          <div className="mt-1 font-mono text-xl font-bold tabular-nums text-[#1B2A4A]">
            {formatPhp(totals.gensan.total_amount_paid)}{" "}
            <span className="font-sans text-xs font-normal text-slate-500">paid</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs tabular-nums">
            <span className="font-medium text-emerald-800">
              Full ({totals.gensan.full_count}):{" "}
              {formatPhp(totals.gensan.full_amount_paid)}
            </span>
            <span className="text-slate-400">&bull;</span>
            <span className="font-medium text-amber-800">
              Partial ({totals.gensan.partial_count}):{" "}
              {formatPhp(totals.gensan.partial_amount_paid)}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-[#DFD7C8] bg-white p-4 shadow-xs">
          <div className="text-xs font-semibold uppercase text-emerald-900">
            Malungon Branch ({totals.malungon.total_entries} entries)
          </div>
          <div className="mt-1 font-mono text-xl font-bold tabular-nums text-[#1B2A4A]">
            {formatPhp(totals.malungon.total_amount_paid)}{" "}
            <span className="font-sans text-xs font-normal text-slate-500">paid</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs tabular-nums">
            <span className="font-medium text-emerald-800">
              Full ({totals.malungon.full_count}):{" "}
              {formatPhp(totals.malungon.full_amount_paid)}
            </span>
            <span className="text-slate-400">&bull;</span>
            <span className="font-medium text-amber-800">
              Partial ({totals.malungon.partial_count}):{" "}
              {formatPhp(totals.malungon.partial_amount_paid)}
            </span>
          </div>
        </div>
      </div>

      {/* Mobile Stacked Entry Cards (< 768px Cover Screen) */}
      <div className="space-y-3 md:hidden">
        {entries.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500 shadow-xs">
            {loading ? "Loading entries..." : "No entries match your filters."}
          </div>
        ) : (
            entries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-xl border border-[#DFD7C8] bg-white p-4 shadow-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAE3D5] pb-2.5">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold text-white ${
                    entry.branch_code === "GENSAN"
                      ? "bg-[#1B2A4A]"
                      : "bg-emerald-800"
                  }`}
                >
                  {entry.branch_name}
                </span>
                <span className="font-mono text-xs font-semibold tabular-nums text-[#1B2A4A]">
                  Entry #{entry.entry_number} &bull; Page {entry.page_no} &bull;
                  Book {entry.book_no}
                </span>
              </div>

              <div className="mt-3 space-y-2 text-sm">
                <div>
                  <div className="font-semibold text-[#1B2A4A]">
                    {entry.instrument_title}
                  </div>
                  <div className="font-mono text-xs tabular-nums text-slate-600">
                    {entry.notarial_act_type} &bull;{" "}
                    {formatDateTime(entry.notarized_at)}
                  </div>
                </div>

                <div className="rounded-lg border border-[#EAE3D5] bg-[#FAF7F1] p-2.5 text-xs text-slate-700">
                  <div className="font-semibold uppercase text-slate-500">
                    Names &amp; Addresses of Parties
                  </div>
                  <div className="mt-0.5 whitespace-pre-line">
                    {entry.parties}
                  </div>
                  {entry.secondary_parties && (
                    <div className="mt-2 border-t border-[#EAE3D5] pt-1.5">
                      <div className="font-semibold uppercase text-slate-500">
                        Names &amp; Addresses of Parties (Optional)
                      </div>
                      <div className="mt-0.5 whitespace-pre-line">
                        {entry.secondary_parties}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs tabular-nums">
                  <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-2.5">
                    <div>
                      <div className="text-emerald-900">Amount Paid</div>
                      <div className="font-mono font-bold text-emerald-800">
                        {formatPhp(entry.amount_paid)}
                      </div>
                    </div>
                    {renderAuditPaymentBadge(entry.payment_type)}
                  </div>
                  <div className="col-span-2 rounded-lg border border-[#EAE3D5] bg-[#FAF7F1]/70 px-2.5 py-1.5">
                    <span className="text-slate-500">
                      Acknowledgement Receipt:{" "}
                    </span>
                    <span className="font-mono font-medium text-[#1B2A4A]">
                      {entry.acknowledgement_receipt || "—"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                  <div className="flex flex-wrap items-center gap-2">
                    {renderAuditReviewBadge(entry)}
                    {entry.attachments && entry.attachments.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                        <Paperclip className="h-3 w-3 text-slate-500" />
                        {entry.attachments.length}{" "}
                        {entry.attachments.length === 1 ? "file" : "files"}
                      </span>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                    <Monitor className="h-3 w-3 text-slate-500" />
                    {entry.encoded_by_label}
                  </span>
                </div>

                {entry.review_notes && (
                  <div
                    className={`rounded-lg border px-2.5 py-2 text-xs ${
                      entry.review_status === "flagged"
                        ? "border-red-200 bg-red-50 text-red-900"
                        : "border-slate-200 bg-slate-50 text-slate-700"
                    }`}
                  >
                    <span className="font-semibold">Lawyer Note: </span>
                    {entry.review_notes}
                  </div>
                )}
              </div>

              <div className="mt-3 space-y-2 border-t border-[#EAE3D5] pt-3">
                <button
                  type="button"
                  onClick={() => openReviewModal(entry)}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg bg-[#1B2A4A] px-3 py-2 text-sm font-semibold text-white hover:bg-[#121D36]"
                >
                  <Eye className="h-4 w-4 text-[#DFBE78]" />
                  Review &amp; Verify
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(entry)}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void openHistoryModal(entry)}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <History className="h-4 w-4" />
                    History
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Master Register Table (>= 768px Unfolded / Desktop) */}
      <div className="hidden overflow-x-auto rounded-xl border border-[#DFD7C8] bg-white shadow-xs md:block">
        <table className="min-w-full divide-y divide-[#EAE3D5] text-left text-sm">
          <thead className="bg-[#F4EFE4] text-xs font-semibold uppercase tracking-wider text-[#1B2A4A]">
            <tr>
              <th className="px-4 py-3">Branch</th>
              <th className="px-4 py-3">Book / Page / Entry</th>
              <th className="px-4 py-3">Instrument &amp; Act</th>
              <th className="px-4 py-3">Names &amp; Addresses of Parties</th>
              <th className="px-4 py-3">Date &amp; Time</th>
              <th className="px-4 py-3">Amount Paid</th>
              <th className="px-4 py-3">Review Status</th>
              <th className="px-4 py-3">Encoded By</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-slate-500"
                >
                  {loading
                    ? "Loading entries..."
                    : "No entries match your filters."}
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="align-top hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold text-white ${
                        entry.branch_code === "GENSAN"
                          ? "bg-sky-900"
                          : "bg-emerald-800"
                      }`}
                    >
                      {entry.branch_name}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs tabular-nums">
                    <div className="font-bold text-[#1B2A4A]">
                      Entry #{entry.entry_number}
                    </div>
                    <div className="text-slate-600">
                      Book {entry.book_no} &bull; Page {entry.page_no}
                    </div>
                    <div className="text-slate-500">
                      Series {entry.series_year}
                    </div>
                  </td>
                  <td className="max-w-[220px] px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {entry.instrument_title}
                    </div>
                    <div className="text-xs text-slate-500">
                      {entry.notarial_act_type}
                    </div>
                  </td>
                  <td className="max-w-[240px] px-4 py-3 text-xs text-slate-700">
                    <div className="whitespace-pre-line">{entry.parties}</div>
                    {entry.secondary_parties && (
                      <div className="mt-1.5 whitespace-pre-line border-t border-[#EAE3D5] pt-1 text-slate-600">
                        {entry.secondary_parties}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-slate-700">
                    {formatDateTime(entry.notarized_at)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums">
                    <div className="flex flex-col items-start gap-1">
                      <div>
                        Paid:{" "}
                        <span className="font-mono font-bold text-emerald-800">
                          {formatPhp(entry.amount_paid)}
                        </span>
                      </div>
                      {renderAuditPaymentBadge(entry.payment_type)}
                      {entry.acknowledgement_receipt && (
                        <div className="text-slate-600">
                          AR:{" "}
                          <span className="font-mono font-medium text-slate-800">
                            {entry.acknowledgement_receipt}
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="max-w-[180px] px-4 py-3 text-xs">
                    <div className="flex flex-col items-start gap-1">
                      {renderAuditReviewBadge(entry)}
                      {entry.attachments && entry.attachments.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
                          <Paperclip className="h-3 w-3" />
                          {entry.attachments.length}{" "}
                          {entry.attachments.length === 1 ? "file" : "files"}
                        </span>
                      )}
                      {entry.review_notes && (
                        <p
                          title={entry.review_notes}
                          className={`line-clamp-2 text-[11px] ${
                            entry.review_status === "flagged"
                              ? "text-red-800"
                              : "text-slate-500"
                          }`}
                        >
                          {entry.review_notes}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                      <Monitor className="h-3 w-3 text-slate-500" />
                      {entry.encoded_by_label}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openReviewModal(entry)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#1B2A4A] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#121D36]"
                      >
                        <Eye className="h-3.5 w-3.5 text-[#DFBE78]" />
                        Review &amp; Verify
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(entry)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void openHistoryModal(entry)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <History className="h-3.5 w-3.5" />
                        History
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Side-by-Side Lawyer Review Modal */}
      {reviewEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lawyer-review-title"
        >
          <div className="max-h-[92vh] w-[95vw] overflow-y-auto rounded-xl border border-[#DFD7C8] bg-white shadow-xl sm:max-w-6xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAE3D5] bg-[#FAF7F1] px-5 py-4 sm:px-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold text-white ${
                      reviewEntry.branch_code === "GENSAN"
                        ? "bg-[#1B2A4A]"
                        : "bg-emerald-800"
                    }`}
                  >
                    {reviewEntry.branch_name}
                  </span>
                  <span className="font-mono text-xs font-semibold tabular-nums text-slate-700">
                    Book {reviewEntry.book_no} &bull; Page {reviewEntry.page_no}{" "}
                    &bull; Entry #{reviewEntry.entry_number}
                  </span>
                  {renderAuditReviewBadge(reviewEntry)}
                </div>
                <h2
                  id="lawyer-review-title"
                  className="mt-1 font-serif text-lg font-bold text-[#1B2A4A]"
                >
                  Lawyer Verification &mdash; {reviewEntry.instrument_title}
                </h2>
              </div>
              <button
                type="button"
                disabled={reviewSaving}
                onClick={() => setReviewEntry(null)}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-1.5 text-slate-500 hover:bg-white"
                aria-label="Close review modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-6 p-5 sm:p-6 lg:grid-cols-12">
              {/* Left Column: Scanned Instrument / ID Preview */}
              <div className="space-y-3 lg:col-span-7">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Scanned Instrument &amp; IDs (
                    {reviewEntry.attachments?.length ?? 0})
                  </h3>
                </div>
                <AttachmentViewerPane
                  attachments={reviewEntry.attachments ?? []}
                />
              </div>

              {/* Right Column: Encoded Register Fields + Review Decision */}
              <div className="space-y-4 lg:col-span-5">
                <dl className="grid grid-cols-1 gap-3 rounded-xl border border-[#DFD7C8] bg-[#FAF7F1] p-4 text-sm sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-semibold uppercase text-slate-600">
                      Title / Description
                    </dt>
                    <dd className="font-semibold text-[#1B2A4A]">
                      {reviewEntry.instrument_title}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase text-slate-600">
                      Notarial Act
                    </dt>
                    <dd className="font-medium text-slate-900">
                      {reviewEntry.notarial_act_type}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase text-slate-600">
                      Date &amp; Time
                    </dt>
                    <dd className="font-mono text-xs tabular-nums text-slate-900">
                      {formatDateTime(reviewEntry.notarized_at)}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-semibold uppercase text-slate-500">
                      Names &amp; Addresses of Parties
                    </dt>
                    <dd className="whitespace-pre-line font-medium text-slate-900">
                      {reviewEntry.parties}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-semibold uppercase text-slate-500">
                      Names &amp; Addresses of Parties (Optional)
                    </dt>
                    <dd className="whitespace-pre-line text-slate-800">
                      {reviewEntry.secondary_parties || "—"}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-semibold uppercase text-slate-500">
                      Competent Evidence of ID
                    </dt>
                    <dd className="text-slate-800">
                      {reviewEntry.competent_evidence_id || "—"}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-semibold uppercase text-slate-500">
                      Amount Paid
                    </dt>
                    <dd className="mt-0.5 flex flex-wrap items-center gap-2 font-mono font-bold tabular-nums text-emerald-800">
                      <span>{formatPhp(reviewEntry.amount_paid)}</span>
                      {renderAuditPaymentBadge(reviewEntry.payment_type)}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-semibold uppercase text-slate-500">
                      Acknowledgement Receipt
                    </dt>
                    <dd className="font-medium text-slate-900">
                      {reviewEntry.acknowledgement_receipt || "—"}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-semibold uppercase text-slate-500">
                      Place / Remarks
                    </dt>
                    <dd className="text-slate-800">
                      {reviewEntry.place_and_remarks || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase text-slate-500">
                      Encoded By
                    </dt>
                    <dd className="text-slate-800">
                      {reviewEntry.encoded_by_label}
                    </dd>
                  </div>
                  {reviewEntry.reviewed_at && (
                    <div>
                      <dt className="text-xs font-semibold uppercase text-slate-500">
                        Last Reviewed
                      </dt>
                      <dd className="text-slate-800">
                        {formatDateTime(reviewEntry.reviewed_at)}
                      </dd>
                    </div>
                  )}
                </dl>

                {/* Review Controls */}
                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                  {reviewError && (
                    <div
                      role="alert"
                      className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-900"
                    >
                      {reviewError}
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="lawyer_review_notes"
                      className="mb-1 block text-xs font-semibold uppercase text-slate-600"
                    >
                      Lawyer Review Note (Required to Flag)
                    </label>
                    <textarea
                      id="lawyer_review_notes"
                      rows={3}
                      placeholder="e.g. Verified against attached notarized Deed and IDs, or note discrepancies to correct..."
                      value={reviewNotesInput}
                      onChange={(e) => setReviewNotesInput(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 placeholder:text-slate-500 focus:border-slate-900 focus:outline-none md:text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={reviewSaving}
                      onClick={() => void handleSubmitReview("approve")}
                      className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {reviewSaving ? "Saving..." : "Approve Entry"}
                    </button>
                    <button
                      type="button"
                      disabled={reviewSaving}
                      onClick={() => void handleSubmitReview("flag")}
                      className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                    >
                      <Flag className="h-4 w-4" />
                      {reviewSaving ? "Saving..." : "Flag with Note"}
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={reviewSaving}
                    onClick={() => {
                      const target = reviewEntry;
                      setReviewEntry(null);
                      openEditModal(target);
                    }}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit Details
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Owner Edit Modal */}
      {editModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-[94vw] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl sm:max-w-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
              <div>
                <span className="inline-flex rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white">
                  {editModal.entry.branch_name}
                </span>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  Owner Edit &mdash; Entry #{editModal.entry.entry_number} (Book{" "}
                  {editModal.entry.book_no})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditModal(null)}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveOwnerEdit}
              className="space-y-4 p-5 sm:p-6"
            >
              {editError && (
                <div className="rounded-lg border border-red-300 bg-red-50 px-3.5 py-2.5 text-sm text-red-900">
                  {editError}
                </div>
              )}

              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
                All owner edits are permanently recorded in{" "}
                <strong>audit_logs</strong> with a full before/after diff.
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-700">
                  Reason for Edit (Required) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Typo in party surname reported by GenSan Front Desk"
                  value={editModal.edit_reason}
                  onChange={(e) =>
                    setEditModal({ ...editModal, edit_reason: e.target.value })
                  }
                  className="min-h-[44px] w-full rounded-lg border border-[#D8D0C0] bg-white px-3 py-2 text-base focus:border-[#1B2A4A] focus:outline-none md:text-sm"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">
                    Entry No. (1&ndash;500)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    step={1}
                    required
                    value={editModal.entry_number}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const num = Number(raw);
                      setEditModal({
                        ...editModal,
                        entry_number: raw,
                        page_no:
                          Number.isInteger(num) && num >= 1 && num <= 500
                            ? String(Math.min(100, Math.ceil(num / 5)))
                            : editModal.page_no,
                      });
                    }}
                    className={`min-h-[44px] w-full rounded-lg border bg-white px-3 py-2 font-mono text-base tabular-nums focus:outline-none md:text-sm ${
                      isEditEntryOutOfRange
                        ? "border-red-500 bg-red-50 focus:border-red-600"
                        : "border-[#D8D0C0] focus:border-[#1B2A4A]"
                    }`}
                  />
                  {isEditEntryOutOfRange && (
                    <p
                      role="alert"
                      className="mt-1 text-xs font-medium text-red-700"
                    >
                      Entry No. cannot exceed 500 per book.
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">
                    Page No. (1&ndash;100)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    required
                    value={editModal.page_no}
                    onChange={(e) =>
                      setEditModal({
                        ...editModal,
                        page_no: e.target.value,
                      })
                    }
                    className={`min-h-[44px] w-full rounded-lg border bg-white px-3 py-2 font-mono text-base tabular-nums focus:outline-none md:text-sm ${
                      isEditPageOutOfRange
                        ? "border-red-500 bg-red-50 focus:border-red-600"
                        : "border-[#D8D0C0] focus:border-[#1B2A4A]"
                    }`}
                  />
                  {isEditPageOutOfRange && (
                    <p
                      role="alert"
                      className="mt-1 text-xs font-medium text-red-700"
                    >
                      Page No. must be between 1 and 100.
                    </p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">
                    Instrument Title
                  </label>
                  <input
                    type="text"
                    required
                    value={editModal.instrument_title}
                    onChange={(e) =>
                      setEditModal({
                        ...editModal,
                        instrument_title: e.target.value,
                      })
                    }
                    className="min-h-[44px] w-full rounded-lg border border-[#D8D0C0] bg-white px-3 py-2 text-base focus:border-[#1B2A4A] focus:outline-none md:text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">
                    Names &amp; Addresses of Parties
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={editModal.parties}
                    onChange={(e) =>
                      setEditModal({ ...editModal, parties: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#D8D0C0] bg-white px-3 py-2 text-base focus:border-[#1B2A4A] focus:outline-none md:text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">
                    Names &amp; Addresses of Parties (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={editModal.secondary_parties}
                    onChange={(e) =>
                      setEditModal({
                        ...editModal,
                        secondary_parties: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-[#D8D0C0] bg-white px-3 py-2 text-base focus:border-[#1B2A4A] focus:outline-none md:text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">
                    Competent Evidence ID
                  </label>
                  <input
                    type="text"
                    value={editModal.competent_evidence_id}
                    onChange={(e) =>
                      setEditModal({
                        ...editModal,
                        competent_evidence_id: e.target.value,
                      })
                    }
                    className="min-h-[44px] w-full rounded-lg border border-[#D8D0C0] bg-white px-3 py-2 text-base focus:border-[#1B2A4A] focus:outline-none md:text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">
                    Date &amp; Time
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={editModal.notarized_at}
                    onChange={(e) =>
                      setEditModal({
                        ...editModal,
                        notarized_at: e.target.value,
                      })
                    }
                    className="min-h-[44px] w-full rounded-lg border border-[#D8D0C0] bg-white px-3 py-2 font-mono text-base tabular-nums focus:border-[#1B2A4A] focus:outline-none md:text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">
                    Notarial Act Type
                  </label>
                  <select
                    value={editModal.notarial_act_type}
                    onChange={(e) =>
                      setEditModal({
                        ...editModal,
                        notarial_act_type: e.target.value,
                      })
                    }
                    className="min-h-[44px] w-full rounded-lg border border-[#D8D0C0] bg-white px-3 py-2 text-base focus:border-[#1B2A4A] focus:outline-none md:text-sm"
                  >
                    {NOTARIAL_ACT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">
                    Amount Paid (₱)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={editModal.amount_paid}
                    onChange={(e) =>
                      setEditModal({
                        ...editModal,
                        amount_paid: e.target.value,
                      })
                    }
                    className="min-h-[44px] w-full rounded-lg border border-[#D8D0C0] bg-white px-3 py-2 font-mono text-base tabular-nums focus:border-[#1B2A4A] focus:outline-none md:text-sm"
                  />
                </div>

                <div>
                  <span className="mb-1 block text-xs font-semibold uppercase text-slate-600">
                    Payment Type
                  </span>
                  <div
                    role="radiogroup"
                    aria-label="Payment Type"
                    className="grid grid-cols-2 gap-1.5 rounded-lg border border-[#D8D0C0] bg-[#FAF7F1] p-1"
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={editModal.payment_type === "full"}
                      onClick={() =>
                        setEditModal({ ...editModal, payment_type: "full" })
                      }
                      className={`min-h-[36px] rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                        editModal.payment_type === "full"
                          ? "bg-emerald-700 text-white shadow-xs"
                          : "text-slate-700 hover:bg-white"
                      }`}
                    >
                      Full Amount
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={editModal.payment_type === "partial"}
                      onClick={() =>
                        setEditModal({ ...editModal, payment_type: "partial" })
                      }
                      className={`min-h-[36px] rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                        editModal.payment_type === "partial"
                          ? "bg-amber-600 text-white shadow-xs"
                          : "text-slate-700 hover:bg-white"
                      }`}
                    >
                      Partial Payment
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">
                    Acknowledgement Receipt
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. AR-2026-001"
                    value={editModal.acknowledgement_receipt}
                    onChange={(e) =>
                      setEditModal({
                        ...editModal,
                        acknowledgement_receipt: e.target.value,
                      })
                    }
                    className="min-h-[44px] w-full rounded-lg border border-[#D8D0C0] bg-white px-3 py-2 font-mono text-base tabular-nums focus:border-[#1B2A4A] focus:outline-none md:text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">
                    Remarks
                  </label>
                  <input
                    type="text"
                    value={editModal.place_and_remarks}
                    onChange={(e) =>
                      setEditModal({
                        ...editModal,
                        place_and_remarks: e.target.value,
                      })
                    }
                    className="min-h-[44px] w-full rounded-lg border border-[#D8D0C0] bg-white px-3 py-2 text-base focus:border-[#1B2A4A] focus:outline-none md:text-sm"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-[#EAE3D5] pt-4 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  disabled={editSaving}
                  onClick={() => setEditModal(null)}
                  className="min-h-[44px] w-full rounded-lg border border-[#D8D0C0] bg-white px-4 py-2 text-sm font-medium text-[#1B2A4A] hover:bg-[#FAF7F1] sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    editSaving || isEditEntryOutOfRange || isEditPageOutOfRange
                  }
                  className="min-h-[44px] w-full rounded-lg bg-[#1B2A4A] px-5 py-2 text-sm font-semibold text-white hover:bg-[#121D36] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {editSaving ? "Saving..." : "Save Audited Edit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History / Diff Modal */}
      {historyEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-[94vw] overflow-y-auto rounded-xl border border-[#DFD7C8] bg-white shadow-xl sm:max-w-3xl">
            <div className="flex items-center justify-between border-b border-[#EAE3D5] bg-[#FAF7F1] px-5 py-4 sm:px-6">
              <div>
                <span className="inline-flex rounded-full bg-[#1B2A4A] px-2.5 py-0.5 text-xs font-semibold text-[#F4DDA8]">
                  {historyEntry.branch_name}
                </span>
                <h2 className="mt-1 font-serif text-lg font-bold text-[#1B2A4A]">
                  Audit History &mdash; Entry #{historyEntry.entry_number} (Book{" "}
                  {historyEntry.book_no})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setHistoryEntry(null)}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-1.5 text-slate-500 hover:bg-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              {historyLoading ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  Loading audit logs...
                </p>
              ) : historyLogs.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  No audit history found for this entry.
                </p>
              ) : (
                historyLogs.map((log) => {
                  const newObj = log.new_data ?? {};
                  const oldObj = log.old_data ?? {};
                  const reason =
                    typeof newObj.edit_reason === "string"
                      ? newObj.edit_reason
                      : null;

                  const changedFields =
                    log.action === "EDIT_ENTRY"
                      ? DIFF_FIELDS.filter(
                          (f) =>
                            formatDiffValue(f.key, oldObj[f.key]) !==
                            formatDiffValue(f.key, newObj[f.key])
                        )
                      : [];

                  return (
                    <div
                      key={log.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            log.action === "EDIT_ENTRY"
                              ? "bg-indigo-100 text-indigo-800"
                              : log.action === "FLAG_ENTRY"
                                ? "bg-red-100 text-red-800"
                                : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {log.action}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatDateTime(log.created_at)}
                        </span>
                      </div>

                      {reason && (
                        <p className="mt-2 text-xs font-medium text-slate-800">
                          Reason: <span className="font-normal">{reason}</span>
                        </p>
                      )}

                      {log.action === "EDIT_ENTRY" && (
                        <div className="mt-3 overflow-x-auto rounded border border-slate-200 bg-white">
                          {changedFields.length === 0 ? (
                            <p className="p-3 text-xs text-slate-500">
                              No field value differences detected.
                            </p>
                          ) : (
                            <table className="min-w-full divide-y divide-slate-200 text-xs">
                              <thead className="bg-slate-50 text-left font-semibold text-slate-600">
                                <tr>
                                  <th className="px-3 py-2">Field</th>
                                  <th className="px-3 py-2">Before (Old)</th>
                                  <th className="px-3 py-2">After (New)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {changedFields.map((f) => (
                                  <tr key={f.key}>
                                    <td className="px-3 py-2 font-medium text-slate-800">
                                      {f.label}
                                    </td>
                                    <td className="bg-red-50/70 px-3 py-2 text-red-900">
                                      {formatDiffValue(f.key, oldObj[f.key])}
                                    </td>
                                    <td className="bg-emerald-50/70 px-3 py-2 font-medium text-emerald-900">
                                      {formatDiffValue(f.key, newObj[f.key])}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}

                      {log.action === "CREATE_ENTRY" && (
                        <p className="mt-2 text-xs text-slate-600">
                          Initial upload by branch workstation (permanently
                          locked on branch side).
                        </p>
                      )}

                      {(log.action === "APPROVE_ENTRY" ||
                        log.action === "FLAG_ENTRY") && (
                        <p className="mt-2 text-xs text-slate-700">
                          {log.action === "APPROVE_ENTRY"
                            ? "Lawyer approved entry."
                            : "Lawyer flagged entry."}
                          {typeof newObj.review_notes === "string" &&
                          newObj.review_notes.trim()
                            ? ` Note: ${newObj.review_notes}`
                            : ""}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
