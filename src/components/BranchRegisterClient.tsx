"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeftRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck2,
  FilePlus2,
  FileText,
  Flag,
  Lock,
  LogOut,
  Monitor,
  Paperclip,
  Printer,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type {
  BranchRegisterSnapshot,
  LockedEntrySummary,
} from "@/lib/branch/register";
import type {
  EntryAttachment,
  NotarialEntry,
  PaymentType,
  ReviewStatus,
} from "@/types/database";
import AttachmentViewerPane from "@/components/AttachmentViewerPane";
import {
  AttachmentSkeleton,
  EntryListSkeleton,
  TableRowsSkeleton,
} from "@/components/Skeletons";

const NOTARIAL_ACT_TYPES = [
  "Acknowledgment",
  "Jurat",
  "Oath / Affirmation",
  "Copy Certification",
  "Signature Witnessing",
] as const;

interface BranchRegisterClientProps {
  initialSnapshot: BranchRegisterSnapshot;
}

interface EntryFormState {
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
}

type BranchWorkspaceTab = "encode" | "entries";
type SummaryScope = "page" | "book";
type StatusFilter = "ALL" | ReviewStatus;

function toLocalDateTimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const PHP_FORMATTER = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
});

const DATE_ONLY_FORMATTER = new Intl.DateTimeFormat("en-PH", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-PH", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatPhp(amount: number): string {
  const safe = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  return PHP_FORMATTER.format(safe);
}

function formatDateOnly(isoOrDate: string | null): string {
  if (!isoOrDate) return "Not specified";
  const parsed = new Date(isoOrDate);
  if (Number.isNaN(parsed.getTime())) return isoOrDate;
  return DATE_ONLY_FORMATTER.format(parsed);
}

function formatDateTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return DATE_TIME_FORMATTER.format(parsed);
}

function toLocalDateFilterKey(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(
    parsed.getDate()
  )}`;
}

function getManilaTodayDateKey(): string {
  const manilaMs = Date.now() + 8 * 60 * 60 * 1000;
  return new Date(manilaMs).toISOString().slice(0, 10);
}

const MIN_PAGE_NO = 2;
const MAX_PAGE_NO = 106;
const MAX_ENTRY_NUMBER = 525;

function getPageForEntry(entryNumber: number): number {
  return Math.min(
    MAX_PAGE_NO,
    Math.max(MIN_PAGE_NO, Math.ceil(entryNumber / 5) + 1)
  );
}

function createBlankForm(nextEntryNumber: number | null): EntryFormState {
  return {
    entry_number: nextEntryNumber !== null ? String(nextEntryNumber) : "",
    page_no:
      nextEntryNumber !== null ? String(getPageForEntry(nextEntryNumber)) : "",
    instrument_title: "",
    parties: "",
    secondary_parties: "",
    competent_evidence_id: "",
    notarized_at: "",
    notarial_act_type: "Acknowledgment",
    amount_paid: "",
    payment_type: "full",
    acknowledgement_receipt: "",
    place_and_remarks: "",
  };
}

function findNextAvailable(
  usedSet: Set<number>,
  blockedSet?: Set<number>
): number | null {
  for (let candidate = 1; candidate <= MAX_ENTRY_NUMBER; candidate += 1) {
    if (!usedSet.has(candidate) && !blockedSet?.has(candidate)) {
      return candidate;
    }
  }
  return null;
}

const LOCK_TOKEN_STORAGE_KEY = "notarial_entry_lock_token";
const LOCK_HEARTBEAT_MS = 30_000;

type EntryLockState =
  | { status: "idle" }
  | { status: "acquiring"; entryNumber: number }
  | {
      status: "acquired";
      entryNumber: number;
      lockedByName: string;
      expiresAt: string;
    }
  | {
      status: "locked_by_other";
      entryNumber: number;
      lockedByName: string;
      expiresAt?: string;
    };

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

interface PendingAttachmentFile {
  id: string;
  file: File;
  previewUrl: string | null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function renderPaymentTypeBadge(paymentType: PaymentType) {
  if (paymentType === "partial") {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-300 bg-[#FFFBEB] px-2 py-0.5 text-xs font-semibold text-[#78350F]">
        Partial Payment
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-emerald-300 bg-[#ECFDF5] px-2 py-0.5 text-xs font-semibold text-[#065F46]">
      Full Amount
    </span>
  );
}

function renderReviewBadge(entry: NotarialEntry) {
  if (entry.review_status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-[#ECFDF5] px-2.5 py-0.5 text-xs font-semibold text-[#065F46]">
        <CheckCircle2 className="h-3 w-3" />
        Approved
      </span>
    );
  }
  if (entry.review_status === "flagged") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-[#FEF2F2] px-2.5 py-0.5 text-xs font-semibold text-[#7F1D1D]">
        <Flag className="h-3 w-3" />
        Flagged
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-[#FFFBEB] px-2.5 py-0.5 text-xs font-semibold text-[#78350F]">
      <Clock className="h-3 w-3" />
      For Review
    </span>
  );
}

export default function BranchRegisterClient({
  initialSnapshot,
}: BranchRegisterClientProps) {
  const [snapshot, setSnapshot] =
    useState<BranchRegisterSnapshot>(initialSnapshot);
  const [usedEntryNumbers, setUsedEntryNumbers] = useState<number[]>(
    initialSnapshot.usedEntryNumbers
  );
  const [lockedEntries, setLockedEntries] = useState<LockedEntrySummary[]>(
    initialSnapshot.lockedEntries ?? []
  );
  const lockTokenRef = useRef<string>("");
  const [lockReady, setLockReady] = useState(false);
  const [lockState, setLockState] = useState<EntryLockState>({
    status: "idle",
  });
  const heldLockRef = useRef<{
    bookId: string;
    entryNumber: number;
    lockToken: string;
  } | null>(null);
  const lockSeqRef = useRef(0);
  const [isCustomEntryMode, setIsCustomEntryMode] = useState(false);
  const [form, setForm] = useState<EntryFormState>(() =>
    createBlankForm(initialSnapshot.nextAvailableEntryNumber)
  );

  const [activeTab, setActiveTab] = useState<BranchWorkspaceTab>("encode");
  const [summaryScope, setSummaryScope] = useState<SummaryScope>(
    initialSnapshot.scope ?? "page"
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [pageFilter, setPageFilter] = useState<string>("ALL");

  const pageCacheRef = useRef<Map<number, NotarialEntry[]>>(
    new Map([[initialSnapshot.latestPageNo, initialSnapshot.entries]])
  );
  const bookEntriesCacheRef = useRef<NotarialEntry[] | null>(
    initialSnapshot.scope === "book" ? initialSnapshot.entries : null
  );
  const hydratedDetailsRef = useRef<Map<string, NotarialEntry>>(
    new Map(
      initialSnapshot.entries
        .filter((entry) => Array.isArray(entry.attachments))
        .map((entry) => [entry.id, entry])
    )
  );
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [loadingSelectedAttachments, setLoadingSelectedAttachments] =
    useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [conflictNextEntry, setConflictNextEntry] = useState<number | null>(
    null
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const todayDateKey = getManilaTodayDateKey();
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<string>("");

  const [selectedFiles, setSelectedFiles] = useState<PendingAttachmentFile[]>(
    []
  );
  const [filePickerError, setFilePickerError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<NotarialEntry | null>(
    null
  );

  useEffect(() => {
    setForm((prev) =>
      prev.notarized_at
        ? prev
        : { ...prev, notarized_at: toLocalDateTimeInputValue(new Date()) }
    );
  }, []);

  // Lock background scroll & enable Escape key dismissal when any modal is open.
  useEffect(() => {
    if (!showConfirmModal && !selectedEntry) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (selectedEntry) {
          setSelectedEntry(null);
        } else if (showConfirmModal && !submitting) {
          setShowConfirmModal(false);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [showConfirmModal, selectedEntry, submitting]);

  const branchDisplay = snapshot.branch.display_name;
  const usedEntrySet = useMemo(
    () => new Set(usedEntryNumbers),
    [usedEntryNumbers]
  );
  const lockedByOtherMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const item of lockedEntries) {
      if (!item.is_own_lock) {
        map.set(item.entry_number, item.locked_by_name);
      }
    }
    return map;
  }, [lockedEntries]);
  const lockedByOtherSet = useMemo(
    () => new Set(lockedByOtherMap.keys()),
    [lockedByOtherMap]
  );
  const parsedEntryNumber = Number(form.entry_number);
  const isOutOfBoundsEntry =
    form.entry_number.trim() !== "" &&
    (!Number.isInteger(parsedEntryNumber) ||
      parsedEntryNumber < 1 ||
      parsedEntryNumber > MAX_ENTRY_NUMBER);
  const isDuplicateSelected =
    !isOutOfBoundsEntry &&
    Number.isInteger(parsedEntryNumber) &&
    parsedEntryNumber >= 1 &&
    usedEntrySet.has(parsedEntryNumber);
  const isLockedByOtherSelected =
    !isOutOfBoundsEntry &&
    !isDuplicateSelected &&
    Number.isInteger(parsedEntryNumber) &&
    parsedEntryNumber >= 1 &&
    ((lockState.status === "locked_by_other" &&
      lockState.entryNumber === parsedEntryNumber) ||
      lockedByOtherMap.has(parsedEntryNumber));
  const lockedByOtherName =
    lockState.status === "locked_by_other" &&
    lockState.entryNumber === parsedEntryNumber
      ? lockState.lockedByName
      : (lockedByOtherMap.get(parsedEntryNumber) ?? "another user");

  const nextUnlockedEntryNumber = useMemo(
    () => findNextAvailable(usedEntrySet, lockedByOtherSet),
    [usedEntrySet, lockedByOtherSet]
  );

  // Initialize a persistent per-tab lock token inside sessionStorage.
  useEffect(() => {
    try {
      let existing = window.sessionStorage.getItem(LOCK_TOKEN_STORAGE_KEY);
      if (!existing) {
        existing =
          typeof crypto !== "undefined" &&
          typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        window.sessionStorage.setItem(LOCK_TOKEN_STORAGE_KEY, existing);
      }
      lockTokenRef.current = existing;
    } catch {
      lockTokenRef.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    setLockReady(true);
  }, []);

  const releaseEntryLockRequest = useCallback(
    async (bookId: string, entryNumber: number, lockToken: string) => {
      try {
        await fetch("/api/branch/entries/lock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            action: "release",
            bookId,
            entryNumber,
            lockToken,
          }),
        });
      } catch {
        // Non-fatal: lock TTL will expire automatically if offline.
      }
    },
    []
  );

  const acquireEntryLockRequest = useCallback(
    async (
      bookId: string,
      entryNumber: number,
      lockToken: string,
      seq: number
    ) => {
      try {
        const res = await fetch("/api/branch/entries/lock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "acquire",
            bookId,
            entryNumber,
            lockToken,
          }),
        });
        const payload = (await res.json().catch(() => ({}))) as {
          acquired?: boolean;
          locked_by_name?: string;
          expires_at?: string;
        };

        if (seq !== lockSeqRef.current) return;

        if (res.ok && payload.acquired) {
          heldLockRef.current = { bookId, entryNumber, lockToken };
          setLockState({
            status: "acquired",
            entryNumber,
            lockedByName: payload.locked_by_name ?? "Your Account",
            expiresAt: payload.expires_at ?? "",
          });
          setLockedEntries((prev) =>
            prev.filter((item) => item.entry_number !== entryNumber)
          );
          return;
        }

        if (res.status === 423 || payload.acquired === false) {
          heldLockRef.current = null;
          const holderName = payload.locked_by_name ?? "another user";
          setLockState({
            status: "locked_by_other",
            entryNumber,
            lockedByName: holderName,
            expiresAt: payload.expires_at,
          });
          setLockedEntries((prev) => {
            const without = prev.filter(
              (item) => item.entry_number !== entryNumber
            );
            return [
              ...without,
              {
                entry_number: entryNumber,
                locked_by_name: holderName,
                is_own_lock: false,
              },
            ].sort((a, b) => a.entry_number - b.entry_number);
          });
        }
      } catch {
        // Non-fatal network hiccup; keep current UI responsive.
      }
    },
    []
  );

  // Acquire/switch live lock whenever active entry_number changes.
  useEffect(() => {
    if (!lockReady || !lockTokenRef.current) return;
    const bookId = snapshot.book?.id;
    const lockToken = lockTokenRef.current;

    const prevHeld = heldLockRef.current;
    const canLockCurrent =
      Boolean(bookId) &&
      !snapshot.isBookFull &&
      !isOutOfBoundsEntry &&
      !isDuplicateSelected &&
      Number.isInteger(parsedEntryNumber) &&
      parsedEntryNumber >= 1;

    if (
      prevHeld &&
      (!canLockCurrent ||
        prevHeld.bookId !== bookId ||
        prevHeld.entryNumber !== parsedEntryNumber)
    ) {
      heldLockRef.current = null;
      void releaseEntryLockRequest(
        prevHeld.bookId,
        prevHeld.entryNumber,
        prevHeld.lockToken
      );
    }

    if (!canLockCurrent || !bookId) {
      setLockState({ status: "idle" });
      return;
    }

    const seq = ++lockSeqRef.current;
    setLockState((prev) =>
      prev.status === "acquired" && prev.entryNumber === parsedEntryNumber
        ? prev
        : { status: "acquiring", entryNumber: parsedEntryNumber }
    );

    void acquireEntryLockRequest(bookId, parsedEntryNumber, lockToken, seq);
  }, [
    lockReady,
    snapshot.book?.id,
    snapshot.isBookFull,
    parsedEntryNumber,
    isOutOfBoundsEntry,
    isDuplicateSelected,
    acquireEntryLockRequest,
    releaseEntryLockRequest,
  ]);

  // 30-second heartbeat to keep active lock alive while encoder works on the form.
  useEffect(() => {
    if (!lockReady || !snapshot.book?.id || snapshot.isBookFull) return;
    const bookId = snapshot.book.id;
    const lockToken = lockTokenRef.current;
    if (
      !lockToken ||
      isOutOfBoundsEntry ||
      isDuplicateSelected ||
      !Number.isInteger(parsedEntryNumber) ||
      parsedEntryNumber < 1
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      if (!heldLockRef.current) return;
      if (
        heldLockRef.current.bookId !== bookId ||
        heldLockRef.current.entryNumber !== parsedEntryNumber
      ) {
        return;
      }
      const seq = lockSeqRef.current;
      void acquireEntryLockRequest(bookId, parsedEntryNumber, lockToken, seq);
    }, LOCK_HEARTBEAT_MS);

    return () => window.clearInterval(timer);
  }, [
    lockReady,
    snapshot.book?.id,
    snapshot.isBookFull,
    parsedEntryNumber,
    isOutOfBoundsEntry,
    isDuplicateSelected,
    acquireEntryLockRequest,
  ]);

  // Release held lock reliably via sendBeacon on tab close / navigation away.
  useEffect(() => {
    function releaseViaBeacon() {
      const held = heldLockRef.current;
      if (!held) return;
      heldLockRef.current = null;
      const body = JSON.stringify({
        action: "release",
        bookId: held.bookId,
        entryNumber: held.entryNumber,
        lockToken: held.lockToken,
      });
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/branch/entries/lock",
          new Blob([body], { type: "application/json" })
        );
      }
    }

    window.addEventListener("pagehide", releaseViaBeacon);
    window.addEventListener("beforeunload", releaseViaBeacon);
    return () => {
      window.removeEventListener("pagehide", releaseViaBeacon);
      window.removeEventListener("beforeunload", releaseViaBeacon);
      releaseViaBeacon();
    };
  }, []);

  function handleSwitchToNextAvailableEntry() {
    if (nextUnlockedEntryNumber === null) {
      setFormError(
        "All remaining entry numbers are currently used or reserved by other staff accounts."
      );
      return;
    }
    setFormError(null);
    setSubmitError(null);
    setIsCustomEntryMode(false);
    setForm((prev) => ({
      ...prev,
      entry_number: String(nextUnlockedEntryNumber),
      page_no: String(getPageForEntry(nextUnlockedEntryNumber)),
    }));
  }

  const parsedPageNo = Number(form.page_no);
  const isOutOfBoundsPage =
    form.page_no.trim() !== "" &&
    (!Number.isInteger(parsedPageNo) ||
      parsedPageNo < MIN_PAGE_NO ||
      parsedPageNo > MAX_PAGE_NO);

  const entryOptions = useMemo(
    () => Array.from({ length: MAX_ENTRY_NUMBER }, (_, idx) => idx + 1),
    []
  );

  const previewPageNo =
    Number.isInteger(parsedPageNo) &&
    parsedPageNo >= MIN_PAGE_NO &&
    parsedPageNo <= MAX_PAGE_NO
      ? parsedPageNo
      : Number.isInteger(parsedEntryNumber) &&
          parsedEntryNumber >= 1 &&
          parsedEntryNumber <= MAX_ENTRY_NUMBER
        ? getPageForEntry(parsedEntryNumber)
        : snapshot.nextAvailableEntryNumber !== null
          ? getPageForEntry(snapshot.nextAvailableEntryNumber)
          : MAX_PAGE_NO;

  const availablePageNumbers = useMemo(() => {
    const source =
      snapshot.availablePageNumbers && snapshot.availablePageNumbers.length > 0
        ? snapshot.availablePageNumbers
        : snapshot.entries.map((entry) => entry.page_no);
    const pages = new Set<number>();
    for (const page of source) {
      if (page >= MIN_PAGE_NO && page <= MAX_PAGE_NO) {
        pages.add(page);
      }
    }
    return Array.from(pages).sort((a, b) => b - a);
  }, [snapshot.availablePageNumbers, snapshot.entries]);

  // Global counts for toolbar badges — sourced from lightweight server counts
  // so initial Current Page boot never needs all 500 rows downloaded.
  const globalCounts = useMemo(() => {
    if (snapshot.counts) {
      return {
        total: snapshot.counts.total,
        approved: snapshot.counts.approved,
        flagged: snapshot.counts.flagged,
        forReview: snapshot.counts.for_review,
      };
    }
    let approved = 0;
    let flagged = 0;
    let forReview = 0;
    for (const entry of snapshot.entries) {
      if (entry.review_status === "approved") approved += 1;
      else if (entry.review_status === "flagged") flagged += 1;
      else forReview += 1;
    }
    return {
      total: snapshot.entries.length,
      approved,
      flagged,
      forReview,
    };
  }, [snapshot.counts, snapshot.entries]);

  // Summary metrics scoped to Current Page vs. Entire Book
  const scopedEntries = useMemo(() => {
    if (summaryScope === "page") {
      return snapshot.entries.filter(
        (entry) => entry.page_no === snapshot.latestPageNo
      );
    }
    return snapshot.entries;
  }, [snapshot.entries, summaryScope, snapshot.latestPageNo]);

  const summaryStats = useMemo(() => {
    if (summaryScope === "book" && snapshot.counts && !bookEntriesCacheRef.current) {
      return {
        totalUploaded: snapshot.counts.total,
        approved: snapshot.counts.approved,
        forReview: snapshot.counts.for_review,
        flagged: snapshot.counts.flagged,
      };
    }
    let approved = 0;
    let forReview = 0;
    let flagged = 0;

    for (const entry of scopedEntries) {
      if (entry.review_status === "approved") approved += 1;
      else if (entry.review_status === "flagged") flagged += 1;
      else forReview += 1;
    }

    return {
      totalUploaded: scopedEntries.length,
      approved,
      forReview,
      flagged,
    };
  }, [scopedEntries, summaryScope, snapshot.counts]);

  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return snapshot.entries.filter((entry) => {
      if (summaryScope === "page" && entry.page_no !== snapshot.latestPageNo) {
        return false;
      }
      if (statusFilter !== "ALL" && entry.review_status !== statusFilter) {
        return false;
      }
      if (pageFilter !== "ALL" && entry.page_no !== Number(pageFilter)) {
        return false;
      }
      if (dateFilter) {
        const entryDateKey = toLocalDateFilterKey(entry.notarized_at);
        if (entryDateKey !== dateFilter) {
          return false;
        }
      }
      if (!query) return true;
      return (
        String(entry.entry_number).includes(query) ||
        entry.parties.toLowerCase().includes(query) ||
        (entry.secondary_parties ?? "").toLowerCase().includes(query) ||
        entry.instrument_title.toLowerCase().includes(query) ||
        (entry.acknowledgement_receipt ?? "").toLowerCase().includes(query)
      );
    });
  }, [
    snapshot.entries,
    snapshot.latestPageNo,
    summaryScope,
    statusFilter,
    pageFilter,
    dateFilter,
    searchQuery,
  ]);

  const hasValidAmountPaid =
    form.amount_paid.trim() !== "" &&
    Number.isFinite(Number(form.amount_paid)) &&
    Number(form.amount_paid) >= 0;

  function handleSelectFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setFilePickerError(null);

    const added: PendingAttachmentFile[] = [];
    const errors: string[] = [];

    for (const file of Array.from(fileList)) {
      if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) {
        errors.push(
          `"${file.name}" skipped: only JPG, PNG, WebP, or PDF files are allowed.`
        );
        continue;
      }
      if (file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES) {
        errors.push(`"${file.name}" skipped: maximum file size is 10 MB.`);
        continue;
      }

      const previewUrl = file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : null;

      added.push({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl,
      });
    }

    if (errors.length > 0) {
      setFilePickerError(errors.join(" "));
    }
    if (added.length > 0) {
      setSelectedFiles((prev) => [...prev, ...added]);
    }
  }

  function handleRemoveSelectedFile(fileId: string) {
    setSelectedFiles((prev) => {
      const target = prev.find((item) => item.id === fileId);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== fileId);
    });
  }

  function clearSelectedFiles() {
    setSelectedFiles((prev) => {
      for (const item of prev) {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      }
      return [];
    });
    setFilePickerError(null);
  }

  function handleReviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSubmitError(null);
    setConflictNextEntry(null);
    setSuccessMessage(null);

    if (!snapshot.book) {
      setFormError("No active notarial book is assigned to this branch.");
      return;
    }

    if (snapshot.isBookFull) {
      setFormError(
        `Book ${snapshot.bookDisplayNo} (Series ${snapshot.book.series_year}) has reached the maximum 525 entries (Pages 2–106) for ${branchDisplay}. Please notify the Owner to open a new Notarial Book.`
      );
      return;
    }

    const entryNum = Number(form.entry_number);
    if (
      !Number.isInteger(entryNum) ||
      entryNum < 1 ||
      entryNum > MAX_ENTRY_NUMBER
    ) {
      setFormError("Entry No. must be between 1 and 525.");
      return;
    }

    const pageNum = Number(form.page_no);
    if (
      !Number.isInteger(pageNum) ||
      pageNum < MIN_PAGE_NO ||
      pageNum > MAX_PAGE_NO
    ) {
      setFormError("Page No. must be between 2 and 106.");
      return;
    }

    if (usedEntrySet.has(entryNum)) {
      setFormError(
        `Entry No. #${entryNum} is already used by ${branchDisplay} and cannot be selected.`
      );
      return;
    }

    if (isLockedByOtherSelected) {
      setFormError(
        `Entry #${entryNum} is currently being used by ${lockedByOtherName}. You cannot proceed while this entry is in use.`
      );
      return;
    }

    if (!form.instrument_title.trim()) {
      setFormError("Title / Description of Instrument is required.");
      return;
    }

    if (!form.parties.trim()) {
      setFormError("Names & Addresses of Parties is required.");
      return;
    }

    if (
      !form.notarized_at.trim() ||
      Number.isNaN(new Date(form.notarized_at).getTime())
    ) {
      setFormError("Valid Date & Time of Notarization is required.");
      return;
    }

    if (!form.notarial_act_type.trim()) {
      setFormError("Type of Notarial Act is required.");
      return;
    }

    const paidNum = Number(form.amount_paid);
    if (
      form.amount_paid.trim() === "" ||
      !Number.isFinite(paidNum) ||
      paidNum < 0
    ) {
      setFormError("Amount Paid must be a valid amount (0 or more).");
      return;
    }

    setShowConfirmModal(true);
  }

  async function handleConfirmUpload(overrideEntryNumber?: number) {
    const targetEntryNumber = overrideEntryNumber ?? Number(form.entry_number);
    const targetPageNumber =
      overrideEntryNumber !== undefined
        ? getPageForEntry(overrideEntryNumber)
        : Number(form.page_no);
    if (overrideEntryNumber !== undefined) {
      setForm((prev) => ({
        ...prev,
        entry_number: String(overrideEntryNumber),
        page_no: String(targetPageNumber),
      }));
    }

    setSubmitting(true);
    setSubmitError(null);
    setConflictNextEntry(null);

    try {
      let uploadedAttachments: EntryAttachment[] = [];

      if (selectedFiles.length > 0) {
        const uploadFormData = new FormData();
        uploadFormData.append("entry_number", String(targetEntryNumber));
        for (const item of selectedFiles) {
          uploadFormData.append("files", item.file);
        }

        const uploadResponse = await fetch("/api/branch/upload", {
          method: "POST",
          body: uploadFormData,
        });

        const uploadPayload = (await uploadResponse
          .json()
          .catch(() => ({}))) as {
          attachments?: EntryAttachment[];
          error?: string;
        };

        if (!uploadResponse.ok || !uploadPayload.attachments) {
          setSubmitError(
            uploadPayload.error ?? "Failed to upload scanned attachments."
          );
          setSubmitting(false);
          return;
        }

        uploadedAttachments = uploadPayload.attachments;
      }

      const response = await fetch("/api/branch/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry_number: targetEntryNumber,
          page_no: targetPageNumber,
          instrument_title: form.instrument_title.trim(),
          parties: form.parties.trim(),
          secondary_parties: form.secondary_parties.trim(),
          competent_evidence_id: form.competent_evidence_id.trim(),
          notarized_at: new Date(form.notarized_at).toISOString(),
          notarial_act_type: form.notarial_act_type,
          amount_paid: Number(form.amount_paid),
          payment_type: form.payment_type,
          acknowledgement_receipt: form.acknowledgement_receipt.trim(),
          place_and_remarks: form.place_and_remarks.trim(),
          attachments: uploadedAttachments,
          lock_token: lockTokenRef.current,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        entry?: NotarialEntry;
        error?: string;
        locked_by_name?: string;
        nextAvailableEntryNumber?: number;
      };

      if (response.status === 423) {
        heldLockRef.current = null;
        const holderName = payload.locked_by_name ?? "another user";
        setLockState({
          status: "locked_by_other",
          entryNumber: targetEntryNumber,
          lockedByName: holderName,
        });
        setLockedEntries((prev) => {
          const without = prev.filter(
            (item) => item.entry_number !== targetEntryNumber
          );
          return [
            ...without,
            {
              entry_number: targetEntryNumber,
              locked_by_name: holderName,
              is_own_lock: false,
            },
          ].sort((a, b) => a.entry_number - b.entry_number);
        });
        if (typeof payload.nextAvailableEntryNumber === "number") {
          setConflictNextEntry(payload.nextAvailableEntryNumber);
        }
        setSubmitError(
          payload.error ??
            `Cannot save: Entry #${targetEntryNumber} is currently being used by ${holderName}.`
        );
        return;
      }

      if (response.status === 409) {
        heldLockRef.current = null;
        setUsedEntryNumbers((prev) =>
          prev.includes(targetEntryNumber)
            ? prev
            : [...prev, targetEntryNumber].sort((a, b) => a - b)
        );
        if (typeof payload.nextAvailableEntryNumber === "number") {
          setConflictNextEntry(payload.nextAvailableEntryNumber);
        }
        setSubmitError(
          payload.error ??
            `Entry No. ${targetEntryNumber} is already used by ${branchDisplay}.`
        );
        return;
      }

      if (!response.ok || !payload.entry) {
        setSubmitError(payload.error ?? "Failed to upload entry.");
        return;
      }

      heldLockRef.current = null;
      const createdEntry = payload.entry;
      const createdNumber = createdEntry.entry_number;
      const nextUsedList = usedEntryNumbers.includes(createdNumber)
        ? usedEntryNumbers
        : [...usedEntryNumbers, createdNumber].sort((a, b) => a - b);
      setUsedEntryNumbers(nextUsedList);

      const usedAfterSave = new Set(nextUsedList);
      const isBookNowFull = findNextAvailable(usedAfterSave) === null;
      const nextEntryNum = findNextAvailable(usedAfterSave, lockedByOtherSet);
      const nextLatestPage = Math.max(
        snapshot.latestPageNo,
        createdEntry.page_no
      );
      const nextAvailablePages = snapshot.availablePageNumbers.includes(
        createdEntry.page_no
      )
        ? snapshot.availablePageNumbers
        : [...snapshot.availablePageNumbers, createdEntry.page_no].sort(
            (a, b) => b - a
          );

      // Update client caches immediately (zero redundant GET /api/branch/register roundtrip)
      hydratedDetailsRef.current.set(createdEntry.id, createdEntry);

      if (bookEntriesCacheRef.current !== null) {
        const dedupedBook = bookEntriesCacheRef.current.filter(
          (item) => item.id !== createdEntry.id
        );
        bookEntriesCacheRef.current = [createdEntry, ...dedupedBook].sort(
          (a, b) => b.entry_number - a.entry_number
        );
      }

      const existingCachedPage = pageCacheRef.current.get(createdEntry.page_no);
      if (existingCachedPage) {
        const dedupedPage = existingCachedPage.filter(
          (item) => item.id !== createdEntry.id
        );
        pageCacheRef.current.set(
          createdEntry.page_no,
          [createdEntry, ...dedupedPage].sort(
            (a, b) => b.entry_number - a.entry_number
          )
        );
      } else if (!snapshot.availablePageNumbers.includes(createdEntry.page_no)) {
        pageCacheRef.current.set(createdEntry.page_no, [createdEntry]);
      }

      setSnapshot((prev) => {
        const prevCounts = prev.counts ?? {
          total: prev.entries.length,
          approved: 0,
          for_review: 0,
          flagged: 0,
        };
        const nextCounts = {
          total: prevCounts.total + 1,
          approved:
            prevCounts.approved +
            (createdEntry.review_status === "approved" ? 1 : 0),
          for_review:
            prevCounts.for_review +
            (createdEntry.review_status === "for_review" ? 1 : 0),
          flagged:
            prevCounts.flagged +
            (createdEntry.review_status === "flagged" ? 1 : 0),
        };

        let nextEntries: NotarialEntry[];
        if (summaryScope === "book") {
          nextEntries =
            bookEntriesCacheRef.current ??
            [createdEntry, ...prev.entries.filter((e) => e.id !== createdEntry.id)];
        } else if (nextLatestPage === prev.latestPageNo) {
          nextEntries =
            pageCacheRef.current.get(nextLatestPage) ??
            [createdEntry, ...prev.entries.filter((e) => e.id !== createdEntry.id)];
        } else {
          nextEntries =
            pageCacheRef.current.get(nextLatestPage) ?? [createdEntry];
        }

        return {
          ...prev,
          entries: nextEntries,
          usedEntryNumbers: nextUsedList,
          availablePageNumbers: nextAvailablePages,
          counts: nextCounts,
          nextAvailableEntryNumber: nextEntryNum,
          nextEntryNumber: nextEntryNum,
          isBookFull: isBookNowFull,
          latestPageNo: nextLatestPage,
          currentPageNo: nextLatestPage,
        };
      });

      setForm({
        ...createBlankForm(nextEntryNum),
        notarized_at: toLocalDateTimeInputValue(new Date()),
      });

      clearSelectedFiles();
      setIsCustomEntryMode(false);
      setShowConfirmModal(false);
      setConflictNextEntry(null);
      setSuccessMessage(
        `Entry #${createdEntry.entry_number} (Page ${createdEntry.page_no}) submitted for lawyer review, locked, and saved to ${branchDisplay}.`
      );
    } catch {
      setSubmitError("Network error while uploading entry. Please retry.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleScopeChange(nextScope: SummaryScope) {
    setSummaryScope(nextScope);
    if (nextScope === "page") {
      setPageFilter("ALL");
      const targetPage = snapshot.latestPageNo;
      const cachedPage =
        pageCacheRef.current.get(targetPage) ??
        (bookEntriesCacheRef.current
          ? bookEntriesCacheRef.current.filter((e) => e.page_no === targetPage)
          : undefined);
      if (cachedPage) {
        pageCacheRef.current.set(targetPage, cachedPage);
        setSnapshot((prev) => ({
          ...prev,
          scope: "page",
          loadedPageNo: targetPage,
          entries: cachedPage,
        }));
        return;
      }

      setLoadingEntries(true);
      try {
        const tokenParam = lockTokenRef.current
          ? `&lockToken=${encodeURIComponent(lockTokenRef.current)}`
          : "";
        const res = await fetch(
          `/api/branch/register?scope=page&page=${targetPage}${tokenParam}`,
          { cache: "no-store" }
        );
        if (res.ok) {
          const nextSnap = (await res.json()) as BranchRegisterSnapshot;
          pageCacheRef.current.set(nextSnap.latestPageNo, nextSnap.entries);
          for (const item of nextSnap.entries) {
            if (Array.isArray(item.attachments)) {
              hydratedDetailsRef.current.set(item.id, item);
            }
          }
          setSnapshot(nextSnap);
          setUsedEntryNumbers(nextSnap.usedEntryNumbers);
          setLockedEntries(nextSnap.lockedEntries ?? []);
        } else {
          setSummaryScope(snapshot.scope);
        }
      } catch {
        setSummaryScope(snapshot.scope);
      } finally {
        setLoadingEntries(false);
      }
      return;
    }

    // nextScope === "book": use cached book entries if already loaded
    if (bookEntriesCacheRef.current) {
      setSnapshot((prev) => ({
        ...prev,
        scope: "book",
        loadedPageNo: null,
        entries: bookEntriesCacheRef.current!,
      }));
      return;
    }

    setLoadingEntries(true);
    try {
      const tokenParam = lockTokenRef.current
        ? `&lockToken=${encodeURIComponent(lockTokenRef.current)}`
        : "";
      const res = await fetch(`/api/branch/register?scope=book${tokenParam}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const nextSnap = (await res.json()) as BranchRegisterSnapshot;
        // Merge any already-hydrated entry attachments from cache
        const merged = nextSnap.entries.map(
          (item) => hydratedDetailsRef.current.get(item.id) ?? item
        );
        bookEntriesCacheRef.current = merged;
        setSnapshot({ ...nextSnap, entries: merged });
        setUsedEntryNumbers(nextSnap.usedEntryNumbers);
        setLockedEntries(nextSnap.lockedEntries ?? []);
      } else {
        setSummaryScope(snapshot.scope);
      }
    } catch {
      setSummaryScope(snapshot.scope);
    } finally {
      setLoadingEntries(false);
    }
  }

  async function handleOpenEntryModal(entry: NotarialEntry) {
    const cached = hydratedDetailsRef.current.get(entry.id);
    if (cached && Array.isArray(cached.attachments)) {
      setSelectedEntry(cached);
      setLoadingSelectedAttachments(false);
      return;
    }

    setSelectedEntry(entry);
    if (Array.isArray(entry.attachments)) {
      hydratedDetailsRef.current.set(entry.id, entry);
      setLoadingSelectedAttachments(false);
      return;
    }

    setLoadingSelectedAttachments(true);
    try {
      const res = await fetch(`/api/branch/entries/${entry.id}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const detail = (await res.json()) as {
          id: string;
          attachments?: EntryAttachment[];
          review_status?: ReviewStatus;
          reviewed_at?: string | null;
          review_notes?: string | null;
        };
        const hydratedEntry: NotarialEntry = {
          ...entry,
          attachments: detail.attachments ?? [],
          review_status: detail.review_status ?? entry.review_status,
          reviewed_at:
            detail.reviewed_at !== undefined
              ? detail.reviewed_at
              : entry.reviewed_at,
          review_notes:
            detail.review_notes !== undefined
              ? detail.review_notes
              : entry.review_notes,
        };
        hydratedDetailsRef.current.set(entry.id, hydratedEntry);
        if (bookEntriesCacheRef.current) {
          bookEntriesCacheRef.current = bookEntriesCacheRef.current.map((row) =>
            row.id === entry.id ? hydratedEntry : row
          );
        }
        setSelectedEntry((current) =>
          current && current.id === entry.id ? hydratedEntry : current
        );
        setSnapshot((prev) => ({
          ...prev,
          entries: prev.entries.map((row) =>
            row.id === entry.id ? hydratedEntry : row
          ),
        }));
      }
    } finally {
      setLoadingSelectedAttachments(false);
    }
  }

  function handleResetEntryFilters() {
    setStatusFilter("ALL");
    setPageFilter("ALL");
    setDateFilter("");
    setSearchQuery("");
  }

  return (
    <div className="min-h-screen bg-[#F7F4EE]">
      {/* Sticky Upper Branch Toolbar */}
      <nav
        aria-label="Branch register navigation"
        className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 px-4 py-2.5 backdrop-blur"
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2.5">
          {/* Left / Center Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("encode")}
              aria-current={activeTab === "encode" ? "page" : undefined}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition sm:text-sm ${
                activeTab === "encode"
                  ? "border-[#1B2A4A] bg-[#1B2A4A] text-white shadow-2xs"
                  : "border-[#DFD7C8] bg-[#FAF7F1] text-[#1B2A4A] hover:bg-[#F4EFE4]"
              }`}
            >
              <FilePlus2
                className={`h-4 w-4 ${
                  activeTab === "encode" ? "text-[#B48A3E]" : "text-[#64748B]"
                }`}
              />
              Encode New Entry
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("entries")}
              aria-current={activeTab === "entries" ? "page" : undefined}
              className={`inline-flex min-h-[44px] flex-wrap items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition sm:text-sm ${
                activeTab === "entries"
                  ? "border-[#1B2A4A] bg-[#1B2A4A] text-white shadow-2xs"
                  : "border-[#DFD7C8] bg-[#FAF7F1] text-[#1B2A4A] hover:bg-[#F4EFE4]"
              }`}
            >
              <BookOpen
                className={`h-4 w-4 ${
                  activeTab === "entries" ? "text-[#B48A3E]" : "text-[#64748B]"
                }`}
              />
              <span>Uploaded Register Entries ({globalCounts.total})</span>
              {globalCounts.flagged > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-[#FFFBEB] px-2 py-0.5 text-xs font-semibold text-[#78350F]">
                  Flagged: {globalCounts.flagged}
                </span>
              ) : globalCounts.forReview > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-[#FFFBEB] px-2 py-0.5 text-xs font-semibold text-[#78350F]">
                  For Review: {globalCounts.forReview}
                </span>
              ) : null}
            </button>
          </div>

          {/* Right Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {snapshot.isDev && (
              <span className="inline-flex min-h-[44px] items-center rounded-full border border-amber-300 bg-[#FFFBEB] px-3 py-1.5 text-xs font-bold tracking-wide text-[#78350F]">
                DEV SANDBOX
              </span>
            )}

            <span className="inline-flex min-h-[44px] items-center rounded-full border border-[#DFD7C8] bg-[#FAF7F1] px-3 py-1.5 font-mono text-xs font-semibold tabular-nums text-[#1B2A4A]">
              {branchDisplay} &bull; Book {snapshot.bookDisplayNo} &bull; Page{" "}
              {snapshot.latestPageNo}
            </span>

            {snapshot.isDev && (
              <Link
                href="/owner/dashboard"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-amber-300 bg-[#FFFBEB] px-3 py-2 text-xs font-semibold text-[#78350F] transition hover:bg-amber-100 sm:text-sm"
              >
                <ArrowLeftRight className="h-4 w-4" />
                Switch to Owner Portal
              </Link>
            )}

            <Link
              href="/branch/register/print"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[#DFD7C8] bg-white px-3.5 py-2 text-xs font-semibold text-[#1B2A4A] transition hover:bg-[#FAF7F1] sm:text-sm"
            >
              <Printer className="h-4 w-4 text-[#B48A3E]" />
              Print Register Sheet
            </Link>

            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-[#1B2A4A] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#121D36] sm:text-sm"
              >
                <LogOut className="h-4 w-4 text-[#B48A3E]" />
                Logout
              </button>
            </form>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {/* Locked Branch & Book Header */}
        <header className="rounded-xl border border-[#DFD7C8] bg-white p-5 shadow-xs sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#EAE3D5] pb-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center rounded-full border border-[#B48A3E]/50 bg-[#1B2A4A] px-3 py-1 text-xs font-semibold text-[#FBF5E8]">
                  {branchDisplay}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#DFD7C8] bg-[#FAF7F1] px-3 py-1 text-xs font-medium text-[#1C2434]">
                  <Monitor className="h-3.5 w-3.5 text-[#B48A3E]" />
                  {snapshot.deviceLabel}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2.5 py-1 text-xs font-medium text-[#065F46]">
                  <Lock className="h-3 w-3" />
                  Append-Only Register
                </span>
              </div>
              <h1 className="font-serif text-xl font-bold text-[#1B2A4A] sm:text-2xl">
                {branchDisplay} &mdash; Notarial Register
              </h1>
            </div>
          </div>

          {/* Read-only Notarial Book Metadata */}
          {snapshot.book ? (
            <dl className="mt-4 grid grid-cols-2 gap-4 rounded-xl border border-[#EAE3D5] bg-[#FAF7F1] p-4 text-sm sm:grid-cols-4 lg:grid-cols-7">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Notary Public
                </dt>
                <dd className="mt-0.5 font-semibold text-[#1B2A4A]">
                  {snapshot.book.notary_name}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Jurisdiction
                </dt>
                <dd className="mt-0.5 font-medium text-slate-800">
                  {snapshot.book.jurisdiction}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Appointment Date
                </dt>
                <dd className="mt-0.5 font-mono text-xs font-medium tabular-nums text-slate-800">
                  {formatDateOnly(snapshot.book.appointment_date)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Commission Expiry
                </dt>
                <dd className="mt-0.5 font-mono text-xs font-medium tabular-nums text-slate-800">
                  {formatDateOnly(snapshot.book.commission_expiry)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Book No.
                </dt>
                <dd className="mt-0.5 font-mono font-bold tabular-nums text-[#1B2A4A]">
                  {snapshot.bookDisplayNo}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Current Page No.
                </dt>
                <dd className="mt-0.5 font-mono font-bold tabular-nums text-[#1B2A4A]">
                  {snapshot.latestPageNo}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Series Year
                </dt>
                <dd className="mt-0.5 font-mono font-bold tabular-nums text-[#1B2A4A]">
                  {snapshot.book.series_year}
                </dd>
              </div>
            </dl>
          ) : (
            <div className="mt-4 rounded-lg border border-amber-200 bg-[#FFFBEB] p-3 text-sm text-[#78350F]">
              No active Notarial Book found for {branchDisplay}. Please contact
              the owner.
            </div>
          )}
        </header>

        {successMessage && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-[#ECFDF5] px-4 py-3 text-sm font-medium text-[#065F46]"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("entries")}
                className="min-h-[44px] rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#065F46] hover:bg-emerald-50"
              >
                View Uploaded Entries &rarr;
              </button>
              <button
                type="button"
                onClick={() => setSuccessMessage(null)}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-emerald-700 hover:bg-emerald-100"
                aria-label="Dismiss message"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* VIEW 1: Encode New Entry */}
        {activeTab === "encode" && (
          <section className="rounded-xl border border-[#DFD7C8] bg-white p-5 shadow-xs sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-[#EAE3D5] pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-[#B48A3E]" />
                <h2 className="font-serif text-lg font-bold text-[#1B2A4A]">
                  Encode New Notarial Entry ({branchDisplay})
                </h2>
              </div>
              <span className="font-mono text-xs font-medium tabular-nums text-[#64748B]">
                5 entries per page &bull; Target Page {previewPageNo}
              </span>
            </div>

            {snapshot.book && snapshot.isBookFull && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-300 bg-[#FEF2F2] px-4 py-3.5 text-sm font-medium text-[#7F1D1D]"
              >
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />
                <span>
                  Book {snapshot.bookDisplayNo} (Series{" "}
                  {snapshot.book.series_year}) has reached the maximum 525
                  entries (Pages 2&ndash;106) for {branchDisplay}. Please notify
                  the Owner to open a new Notarial Book.
                </span>
              </div>
            )}

            {formError && (
              <div
                role="alert"
                className="mb-4 flex items-center gap-2 rounded-lg border border-red-300 bg-[#FEF2F2] px-4 py-3 text-sm text-[#7F1D1D]"
              >
                <ShieldAlert className="h-4 w-4 shrink-0 text-red-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <fieldset
                disabled={!snapshot.book || snapshot.isBookFull}
                className="space-y-4 disabled:opacity-65"
              >
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <div>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <label
                        htmlFor="entry_number"
                        className="block text-xs font-semibold uppercase tracking-wide text-slate-600"
                      >
                        1. Entry No. *
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsCustomEntryMode((prev) => !prev)}
                        className="text-xs font-semibold text-slate-700 underline underline-offset-2 hover:text-slate-950"
                      >
                        {isCustomEntryMode ? "Use Dropdown" : "Custom #"}
                      </button>
                    </div>

                    {isCustomEntryMode ? (
                      <input
                        id="entry_number"
                        type="number"
                        min={1}
                        max={MAX_ENTRY_NUMBER}
                        step={1}
                        required
                        value={form.entry_number}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const num = Number(raw);
                          setForm((prev) => ({
                            ...prev,
                            entry_number: raw,
                            page_no:
                              Number.isInteger(num) &&
                              num >= 1 &&
                              num <= MAX_ENTRY_NUMBER
                                ? String(getPageForEntry(num))
                                : prev.page_no,
                          }));
                        }}
                        className={`min-h-[44px] w-full rounded-lg border px-3 py-2 font-mono text-base font-semibold tabular-nums text-slate-900 focus:outline-none focus:ring-1 md:text-sm ${
                          isDuplicateSelected ||
                          isOutOfBoundsEntry ||
                          isLockedByOtherSelected
                            ? "border-red-500 bg-red-50 focus:border-red-600 focus:ring-red-600"
                            : "border-slate-300 focus:border-slate-900 focus:ring-slate-900"
                        }`}
                      />
                    ) : (
                      <select
                        id="entry_number"
                        required
                        value={form.entry_number}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const num = Number(raw);
                          setForm((prev) => ({
                            ...prev,
                            entry_number: raw,
                            page_no:
                              Number.isInteger(num) &&
                              num >= 1 &&
                              num <= MAX_ENTRY_NUMBER
                                ? String(getPageForEntry(num))
                                : prev.page_no,
                          }));
                        }}
                        className={`min-h-[44px] w-full rounded-lg border px-3 py-2 font-mono text-base font-semibold tabular-nums text-slate-900 focus:outline-none focus:ring-1 md:text-sm ${
                          isLockedByOtherSelected
                            ? "border-red-500 bg-red-50 focus:border-red-600 focus:ring-red-600"
                            : "border-slate-300 bg-white focus:border-slate-900 focus:ring-slate-900"
                        }`}
                      >
                        {snapshot.isBookFull ? (
                          <option value="">Book Full (525 / 525)</option>
                        ) : (
                          entryOptions.map((num) => {
                            const isUsed = usedEntrySet.has(num);
                            const holderName = lockedByOtherMap.get(num);
                            const isLockedOther = Boolean(holderName);
                            return (
                              <option
                                key={num}
                                value={String(num)}
                                disabled={isUsed || isLockedOther}
                              >
                                {isUsed
                                  ? `Entry #${num} — Used (Locked)`
                                  : isLockedOther
                                    ? `Entry #${num} — In use by ${holderName}`
                                    : `Entry #${num} (Available)`}
                              </option>
                            );
                          })
                        )}
                      </select>
                    )}

                    {isOutOfBoundsEntry ? (
                      <p
                        role="alert"
                        className="mt-1 text-xs font-medium text-red-700"
                      >
                        Entry No. cannot exceed 525 per book.
                      </p>
                    ) : isDuplicateSelected ? (
                      <p
                        role="alert"
                        className="mt-1 text-xs font-medium text-red-700"
                      >
                        Entry No. #{parsedEntryNumber} is already used by{" "}
                        {branchDisplay} and cannot be selected.
                      </p>
                    ) : isLockedByOtherSelected ? (
                      <p
                        role="alert"
                        className="mt-1 text-xs font-medium text-red-700"
                      >
                        In use by {lockedByOtherName}.
                      </p>
                    ) : lockState.status === "acquired" &&
                      lockState.entryNumber === parsedEntryNumber ? (
                      <p className="mt-1 inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-[#ECFDF5] px-2 py-0.5 text-xs font-semibold text-[#065F46]">
                        <ShieldCheck className="h-3 w-3 shrink-0" />
                        Reserved for your account &bull; Entry #
                        {parsedEntryNumber}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-slate-500">
                        Max 525 per book (1&ndash;525)
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="page_no"
                      className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600"
                    >
                      Page No. (2&ndash;106) *
                    </label>
                    <input
                      id="page_no"
                      type="number"
                      min={MIN_PAGE_NO}
                      max={MAX_PAGE_NO}
                      step={1}
                      required
                      value={form.page_no}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          page_no: e.target.value,
                        }))
                      }
                      className={`min-h-[44px] w-full rounded-lg border px-3 py-2 font-mono text-base font-semibold tabular-nums text-slate-900 focus:outline-none focus:ring-1 md:text-sm ${
                        isOutOfBoundsPage
                          ? "border-red-500 bg-red-50 focus:border-red-600 focus:ring-red-600"
                          : "border-[#DFD7C8] bg-white focus:border-[#1B2A4A] focus:ring-[#1B2A4A]"
                      }`}
                    />
                    {isOutOfBoundsPage ? (
                      <p
                        role="alert"
                        className="mt-1 text-xs font-medium text-red-700"
                      >
                        Page No. must be between 2 and 106.
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-slate-500">
                        5 entries per page
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-2 lg:col-span-2">
                  <label
                    htmlFor="instrument_title"
                    className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600"
                  >
                    2. Title / Description of Instrument *
                  </label>
                  <input
                    id="instrument_title"
                    type="text"
                    required
                    placeholder="e.g. Deed of Absolute Sale / Affidavit of Loss"
                    value={form.instrument_title}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        instrument_title: e.target.value,
                      }))
                    }
                    className="min-h-[44px] w-full rounded-lg border border-[#DFD7C8] bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-500 focus:border-[#1B2A4A] focus:outline-none md:text-sm"
                  />
                </div>

                <div>
                  <label
                    htmlFor="notarial_act_type"
                    className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600"
                  >
                    7. Type of Notarial Act *
                  </label>
                  <select
                    id="notarial_act_type"
                    required
                    value={form.notarial_act_type}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        notarial_act_type: e.target.value,
                      }))
                    }
                    className="min-h-[44px] w-full rounded-lg border border-[#DFD7C8] bg-white px-3 py-2 text-base text-slate-900 focus:border-[#1B2A4A] focus:outline-none md:text-sm"
                  >
                    {NOTARIAL_ACT_TYPES.map((actType) => (
                      <option key={actType} value={actType}>
                        {actType}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <label
                    htmlFor="parties"
                    className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600"
                  >
                    3. Names &amp; Addresses of Parties *
                  </label>
                  <textarea
                    id="parties"
                    rows={2}
                    required
                    placeholder="e.g. Juan Dela Cruz — Brgy. Lagao, General Santos City"
                    value={form.parties}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, parties: e.target.value }))
                    }
                    className="w-full rounded-lg border border-[#DFD7C8] bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-500 focus:border-[#1B2A4A] focus:outline-none md:text-sm"
                  />
                </div>

                <div>
                  <label
                    htmlFor="secondary_parties"
                    className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600"
                  >
                    4. Names &amp; Addresses of Parties (Optional)
                  </label>
                  <textarea
                    id="secondary_parties"
                    rows={2}
                    placeholder="Additional parties for next register column (leave blank if none)"
                    value={form.secondary_parties}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        secondary_parties: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-[#DFD7C8] bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-500 focus:border-[#1B2A4A] focus:outline-none md:text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="competent_evidence_id"
                    className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600"
                  >
                    5. Competent Evidence of Identity
                  </label>
                  <input
                    id="competent_evidence_id"
                    type="text"
                    placeholder="e.g. PhilSys ID No. 1234-5678-9012 / Driver's License"
                    value={form.competent_evidence_id}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        competent_evidence_id: e.target.value,
                      }))
                    }
                    className="min-h-[44px] w-full rounded-lg border border-[#DFD7C8] bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-500 focus:border-[#1B2A4A] focus:outline-none md:text-sm"
                  />
                </div>

                <div>
                  <label
                    htmlFor="notarized_at"
                    className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600"
                  >
                    6. Date &amp; Time of Notarization *
                  </label>
                  <input
                    id="notarized_at"
                    type="datetime-local"
                    required
                    value={form.notarized_at}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        notarized_at: e.target.value,
                      }))
                    }
                    className="min-h-[44px] w-full rounded-lg border border-[#DFD7C8] bg-white px-3 py-2 font-mono text-base tabular-nums text-slate-900 focus:border-[#1B2A4A] focus:outline-none md:text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label
                    htmlFor="amount_paid"
                    className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600"
                  >
                    8a. Amount Paid (₱) *
                  </label>
                  <input
                    id="amount_paid"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={form.amount_paid}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        amount_paid: e.target.value,
                      }))
                    }
                    className="min-h-[44px] w-full rounded-lg border border-[#DFD7C8] bg-white px-3 py-2 font-mono text-base tabular-nums text-slate-900 placeholder:font-sans placeholder:text-slate-500 focus:border-[#1B2A4A] focus:outline-none md:text-sm"
                  />
                </div>

                <div>
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                    8b. Payment Type *
                  </span>
                  <div
                    role="radiogroup"
                    aria-label="Payment Type"
                    className="grid min-h-[44px] grid-cols-2 gap-1.5 rounded-lg border border-[#DFD7C8] bg-[#FAF7F1] p-1"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({ ...prev, payment_type: "full" }))
                      }
                      aria-pressed={form.payment_type === "full"}
                      className={`rounded-md px-2 py-1.5 text-xs font-semibold transition ${
                        form.payment_type === "full"
                          ? "bg-[#1B2A4A] text-white shadow-2xs"
                          : "text-slate-700 hover:bg-white"
                      }`}
                    >
                      Full Amount
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          payment_type: "partial",
                        }))
                      }
                      aria-pressed={form.payment_type === "partial"}
                      className={`rounded-md px-2 py-1.5 text-xs font-semibold transition ${
                        form.payment_type === "partial"
                          ? "bg-amber-700 text-white shadow-2xs"
                          : "text-slate-700 hover:bg-white"
                      }`}
                    >
                      Partial Payment
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="acknowledgement_receipt"
                    className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600"
                  >
                    8c. Acknowledgement Receipt
                  </label>
                  <input
                    id="acknowledgement_receipt"
                    type="text"
                    placeholder="e.g. AR-2026-001"
                    value={form.acknowledgement_receipt}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        acknowledgement_receipt: e.target.value,
                      }))
                    }
                    className="min-h-[44px] w-full rounded-lg border border-[#DFD7C8] bg-white px-3 py-2 font-mono text-base tabular-nums text-slate-900 placeholder:font-sans placeholder:text-slate-500 focus:border-[#1B2A4A] focus:outline-none md:text-sm"
                  />
                </div>

                <div>
                  <label
                    htmlFor="place_and_remarks"
                    className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600"
                  >
                    9. Place / Remarks (Optional)
                  </label>
                  <input
                    id="place_and_remarks"
                    type="text"
                    placeholder="Other than Notary's office / remarks"
                    value={form.place_and_remarks}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        place_and_remarks: e.target.value,
                      }))
                    }
                    className="min-h-[44px] w-full rounded-lg border border-[#DFD7C8] bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-500 focus:border-[#1B2A4A] focus:outline-none md:text-sm"
                  />
                </div>
              </div>

              {/* Multi-file Attachment Picker */}
              <div className="space-y-3 rounded-xl border border-dashed border-[#DFD7C8] bg-[#FAF7F1] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <label
                      htmlFor="entry_attachments"
                      className="block text-xs font-semibold uppercase tracking-wide text-slate-700"
                    >
                      10. Supporting Scans &amp; IDs (Optional)
                    </label>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Attach scanned instruments, valid IDs, or photos for
                      lawyer review (JPG, PNG, WebP, or PDF &bull; max 10 MB
                      each).
                    </p>
                  </div>
                  <label
                    htmlFor="entry_attachments"
                    className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-2xs transition hover:bg-slate-100"
                  >
                    <Upload className="h-4 w-4" />
                    Attach Files
                    <input
                      id="entry_attachments"
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={(e) => {
                        handleSelectFiles(e.target.files);
                        e.target.value = "";
                      }}
                      className="sr-only"
                    />
                  </label>
                </div>

                {filePickerError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-[#FEF2F2] px-3 py-2 text-xs text-[#7F1D1D]"
                  >
                    {filePickerError}
                  </div>
                )}

                {selectedFiles.length > 0 && (
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {selectedFiles.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5"
                      >
                        {item.previewUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={item.previewUrl}
                            alt={item.file.name}
                            className="h-12 w-12 shrink-0 rounded border border-slate-200 object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-red-200 bg-red-50 text-red-700">
                            <FileText className="h-5 w-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-slate-900">
                            {item.file.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatFileSize(item.file.size)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveSelectedFile(item.id)}
                          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                          aria-label={`Remove ${item.file.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {isLockedByOtherSelected && (
                <div
                  role="alert"
                  className="flex flex-col gap-3 rounded-xl border border-red-300 bg-[#FEF2F2] p-4 text-sm text-[#7F1D1D] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />
                    <span className="font-medium">
                      Entry #{parsedEntryNumber} is currently being used by{" "}
                      <strong>{lockedByOtherName}</strong>. You cannot proceed
                      while this entry is in use.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSwitchToNextAvailableEntry}
                    disabled={nextUnlockedEntryNumber === null}
                    className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-lg bg-[#1B2A4A] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#121D36] disabled:opacity-50"
                  >
                    Switch to Next Available Entry
                    {nextUnlockedEntryNumber !== null
                      ? ` (#${nextUnlockedEntryNumber})`
                      : ""}
                  </button>
                </div>
              )}

              <div className="flex items-center justify-end border-t border-[#EAE3D5] pt-4">
                <button
                  type="submit"
                  disabled={
                    !snapshot.book ||
                    snapshot.isBookFull ||
                    isDuplicateSelected ||
                    isLockedByOtherSelected ||
                    isOutOfBoundsEntry ||
                    isOutOfBoundsPage ||
                    !hasValidAmountPaid
                  }
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-[#1B2A4A] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#121D36] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  <FileCheck2 className="h-4 w-4 text-[#B48A3E]" />
                  Review &amp; Confirm Entry
                </button>
              </div>
              </fieldset>
            </form>
          </section>
        )}

        {/* VIEW 2: Uploaded Register Entries + Summary Bar + Clickable Details Modal */}
        {activeTab === "entries" && (
          <section className="space-y-4">
            {/* Uploaded Register Entries Header & Scope Toggle */}
            <div className="rounded-xl border border-[#DFD7C8] bg-white p-5 shadow-xs sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAE3D5] pb-4">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="font-serif text-lg font-bold text-[#1B2A4A]">
                    Uploaded Register Entries ({filteredEntries.length})
                  </h2>
                  <span className="inline-flex items-center rounded-full border border-[#DFD7C8] bg-[#FAF7F1] px-2.5 py-0.5 text-xs font-semibold text-[#1B2A4A]">
                    {branchDisplay}
                  </span>
                </div>

                {/* Scope Toggle: Current Page vs Entire Book */}
                <div
                  role="radiogroup"
                  aria-label="Summary Scope"
                  className="inline-flex min-h-[44px] rounded-lg border border-[#DFD7C8] bg-[#FAF7F1] p-1"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={summaryScope === "page"}
                    onClick={() => handleScopeChange("page")}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                      summaryScope === "page"
                        ? "bg-[#1B2A4A] text-white shadow-2xs"
                        : "text-[#1B2A4A] hover:bg-white"
                    }`}
                  >
                    Current Page (Page {snapshot.latestPageNo})
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={summaryScope === "book"}
                    onClick={() => handleScopeChange("book")}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                      summaryScope === "book"
                        ? "bg-[#1B2A4A] text-white shadow-2xs"
                        : "text-[#1B2A4A] hover:bg-white"
                    }`}
                  >
                    Entire Book (Book {snapshot.bookDisplayNo})
                  </button>
                </div>
              </div>

              {/* Compact 3-Card Summary Grid */}
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-[#DFD7C8] bg-[#FAF7F1] p-3.5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                    Total Uploaded
                  </div>
                  <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#1B2A4A]">
                    {summaryStats.totalUploaded}
                  </div>
                  <div className="mt-1 font-mono text-xs tabular-nums text-[#64748B]">
                    {summaryScope === "page"
                      ? `Page ${snapshot.latestPageNo} • Book ${snapshot.bookDisplayNo}`
                      : `Book ${snapshot.bookDisplayNo} • Series ${snapshot.book?.series_year ?? "—"}`}
                  </div>
                </div>

                <div className="rounded-xl border border-[#DFD7C8] bg-[#FAF7F1] p-3.5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                    Lawyer Review Status
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-semibold tabular-nums">
                    <span className="rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[#065F46]">
                      Approved: {summaryStats.approved}
                    </span>
                    <span className="rounded-full bg-[#FFFBEB] px-2 py-0.5 text-[#78350F]">
                      For Review: {summaryStats.forReview}
                    </span>
                    <span className="rounded-full bg-[#FEF2F2] px-2 py-0.5 text-[#7F1D1D]">
                      Flagged: {summaryStats.flagged}
                    </span>
                  </div>
                </div>

                <div
                  className={`rounded-xl border p-3.5 ${
                    summaryStats.flagged > 0
                      ? "border-red-300 bg-[#FEF2F2]"
                      : "border-[#DFD7C8] bg-[#FAF7F1]"
                  }`}
                >
                  <div
                    className={`text-xs font-semibold uppercase tracking-wide ${
                      summaryStats.flagged > 0
                        ? "text-[#7F1D1D]"
                        : "text-[#64748B]"
                    }`}
                  >
                    Attention Needed
                  </div>
                  <div
                    className={`mt-1 font-mono text-2xl font-bold tabular-nums ${
                      summaryStats.flagged > 0
                        ? "text-[#7F1D1D]"
                        : "text-[#1B2A4A]"
                    }`}
                  >
                    {summaryStats.flagged}
                  </div>
                  <div
                    className={`mt-1 text-xs ${
                      summaryStats.flagged > 0
                        ? "font-medium text-[#7F1D1D]"
                        : "text-[#64748B]"
                    }`}
                  >
                    {summaryStats.flagged > 0
                      ? "Flagged entries need correction / review"
                      : "No flagged entries in view"}
                  </div>
                </div>
              </div>

              {/* Filter Bar directly below summary cards */}
              <div className="mt-4 grid gap-3 border-t border-[#EAE3D5] pt-4 sm:grid-cols-2 lg:grid-cols-12">
                <div className="lg:col-span-2">
                  <label
                    htmlFor="branch_status_filter"
                    className="mb-1 block text-xs font-semibold uppercase text-[#64748B]"
                  >
                    Status
                  </label>
                  <select
                    id="branch_status_filter"
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as StatusFilter)
                    }
                    className="min-h-[44px] w-full rounded-lg border border-[#DFD7C8] bg-white px-3 py-2 text-base text-[#1C2434] focus:border-[#1B2A4A] focus:outline-none md:text-sm"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="for_review">For Review</option>
                    <option value="approved">Approved</option>
                    <option value="flagged">Flagged</option>
                  </select>
                </div>

                <div className="lg:col-span-2">
                  <label
                    htmlFor="branch_page_filter"
                    className="mb-1 block text-xs font-semibold uppercase text-[#64748B]"
                  >
                    Page No.
                  </label>
                  <select
                    id="branch_page_filter"
                    value={
                      summaryScope === "page"
                        ? String(snapshot.latestPageNo)
                        : pageFilter
                    }
                    disabled={summaryScope === "page"}
                    onChange={(e) => setPageFilter(e.target.value)}
                    className="min-h-[44px] w-full rounded-lg border border-[#DFD7C8] bg-white px-3 py-2 font-mono text-base tabular-nums text-[#1C2434] focus:border-[#1B2A4A] focus:outline-none disabled:bg-[#FAF7F1] disabled:text-[#64748B] md:text-sm"
                  >
                    <option value="ALL">All Pages</option>
                    {availablePageNumbers.map((p) => (
                      <option key={p} value={String(p)}>
                        Page {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="lg:col-span-2">
                  <label
                    htmlFor="branch_date_filter"
                    className="mb-1 block text-xs font-semibold uppercase text-[#64748B]"
                  >
                    Date
                  </label>
                  <input
                    id="branch_date_filter"
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="min-h-[44px] w-full rounded-lg border border-[#DFD7C8] bg-white px-3 py-2 font-mono text-base tabular-nums text-[#1C2434] focus:border-[#1B2A4A] focus:outline-none md:text-sm"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-4">
                  <label
                    htmlFor="branch_entries_search"
                    className="mb-1 block text-xs font-semibold uppercase text-[#64748B]"
                  >
                    Search
                  </label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      id="branch_entries_search"
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Entry #, Party, Title, or Acknowledgement Receipt"
                      className="min-h-[44px] w-full rounded-lg border border-[#DFD7C8] bg-white py-2 pl-9 pr-3 text-base text-[#1C2434] placeholder:text-[#64748B] focus:border-[#1B2A4A] focus:outline-none md:text-sm"
                    />
                  </div>
                </div>

                <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-2">
                  <button
                    type="button"
                    onClick={() =>
                      setDateFilter((prev) =>
                        prev === todayDateKey ? "" : todayDateKey
                      )
                    }
                    className={`min-h-[44px] flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                      dateFilter === todayDateKey
                        ? "border-[#1B2A4A] bg-[#1B2A4A] text-white"
                        : "border-[#DFD7C8] bg-white text-[#1B2A4A] hover:bg-[#FAF7F1]"
                    }`}
                  >
                    {dateFilter === todayDateKey ? "Today Only ✓" : "Today"}
                  </button>
                  {(statusFilter !== "ALL" ||
                    pageFilter !== "ALL" ||
                    dateFilter !== "" ||
                    searchQuery !== "") && (
                    <button
                      type="button"
                      onClick={handleResetEntryFilters}
                      className="min-h-[44px] rounded-lg border border-[#DFD7C8] bg-white px-3 py-2 text-xs font-medium text-[#64748B] hover:bg-[#FAF7F1] hover:text-[#1B2A4A]"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
              {summaryScope === "page" &&
                (searchQuery.trim() !== "" || dateFilter !== "" || statusFilter !== "ALL") &&
                globalCounts.total > snapshot.entries.length && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-[#FFFBEB] px-3 py-2 text-xs text-[#78350F]">
                    <span>
                      Filtering <strong>Current Page (Page {snapshot.latestPageNo})</strong> only.
                    </span>
                    <button
                      type="button"
                      onClick={() => handleScopeChange("book")}
                      className="font-semibold underline hover:text-[#1B2A4A]"
                    >
                      Search Entire Book ({globalCounts.total} entries) &rarr;
                    </button>
                  </div>
                )}
            </div>

            {/* Clickable Entries Container */}
            <div className="rounded-xl border border-[#DFD7C8] bg-white shadow-xs">
              {/* Mobile Stacked Register Cards (< 768px) */}
              <div className="space-y-3 p-4 md:hidden">
                {loadingEntries ? (
                  <EntryListSkeleton rows={4} />
                ) : filteredEntries.length === 0 ? (
                  <div className="rounded-xl border border-[#EAE3D5] bg-[#FAF7F1] px-4 py-8 text-center text-sm text-slate-600">
                    {globalCounts.total === 0 ? (
                      `No entries recorded yet for ${branchDisplay}.`
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <span>No entries match your active filters.</span>
                        <div className="flex flex-wrap justify-center gap-2">
                          <button
                            type="button"
                            onClick={handleResetEntryFilters}
                            className="min-h-[44px] rounded-lg border border-[#DFD7C8] bg-white px-3.5 py-2 text-xs font-semibold text-[#1B2A4A] hover:bg-[#FAF7F1]"
                          >
                            Reset Filters
                          </button>
                          {summaryScope === "page" && (
                            <button
                              type="button"
                              onClick={() => handleScopeChange("book")}
                              className="min-h-[44px] rounded-lg bg-[#1B2A4A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#121D36]"
                            >
                              View Entire Book ({globalCounts.total})
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  filteredEntries.map((entry) => (
                    <div
                      key={entry.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleOpenEntryModal(entry)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleOpenEntryModal(entry);
                        }
                      }}
                      className="cursor-pointer rounded-xl border border-[#DFD7C8] bg-white p-4 shadow-xs transition hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B2A4A]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAE3D5] pb-2.5">
                        <span className="font-mono text-sm font-bold tabular-nums text-[#1B2A4A]">
                          Entry #{entry.entry_number} &bull; Page{" "}
                          {entry.page_no}
                        </span>
                        {renderReviewBadge(entry)}
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
                              <div className="mt-0.5 whitespace-pre-line text-slate-700">
                                {entry.secondary_parties}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="rounded-lg border border-[#EAE3D5] bg-[#FAF7F1]/70 px-2.5 py-1.5 text-xs tabular-nums">
                          <span className="text-slate-600">
                            Acknowledgement Receipt:{" "}
                          </span>
                          <span className="font-mono font-medium text-[#1B2A4A]">
                            {entry.acknowledgement_receipt || "—"}
                          </span>
                        </div>

                        {entry.review_notes && (
                          <div
                            className={`rounded-lg border px-3 py-2 text-xs ${
                              entry.review_status === "flagged"
                                ? "border-red-300 bg-[#FEF2F2] text-[#7F1D1D]"
                                : "border-[#DFD7C8] bg-[#FAF7F1] text-[#1C2434]"
                            }`}
                          >
                            <span className="font-semibold">Lawyer Note: </span>
                            {entry.review_notes}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EAE3D5] pt-2">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800">
                              <Lock className="h-3 w-3" />
                              Locked
                            </span>
                            {entry.attachments &&
                              entry.attachments.length > 0 && (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-[#64748B]">
                                  <Paperclip className="h-3.5 w-3.5 text-[#B48A3E]" />
                                  {entry.attachments.length}{" "}
                                  {entry.attachments.length === 1
                                    ? "file"
                                    : "files"}
                                </span>
                              )}
                          </div>
                          <span className="text-xs font-semibold text-[#1B2A4A]">
                            View Note &amp; Summary &rarr;
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Clickable Table (>= 768px) */}
              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full divide-y divide-[#EAE3D5] text-left text-sm">
                  <thead className="bg-[#F4EFE4] text-xs font-semibold uppercase tracking-wider text-[#1B2A4A]">
                    <tr>
                      <th className="px-4 py-3">Entry / Page</th>
                      <th className="px-4 py-3">Instrument &amp; Act</th>
                      <th className="px-4 py-3">
                        Names &amp; Addresses of Parties
                      </th>
                      <th className="px-4 py-3">Competent ID</th>
                      <th className="px-4 py-3">Date &amp; Time</th>
                      <th className="px-4 py-3">Acknowledgement Receipt</th>
                      <th className="px-4 py-3">Remarks</th>
                      <th className="px-4 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingEntries ? (
                      <TableRowsSkeleton rows={6} columns={8} />
                    ) : filteredEntries.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-4 py-10 text-center text-slate-500"
                        >
                          {globalCounts.total === 0 ? (
                            `No entries recorded yet for ${branchDisplay}.`
                          ) : (
                            <div className="flex flex-col items-center gap-2">
                              <span>No entries match your active filters.</span>
                              <div className="flex flex-wrap justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={handleResetEntryFilters}
                                  className="min-h-[44px] rounded-lg border border-[#DFD7C8] bg-white px-3.5 py-2 text-xs font-semibold text-[#1B2A4A] hover:bg-[#FAF7F1]"
                                >
                                  Reset Filters
                                </button>
                                {summaryScope === "page" && (
                                  <button
                                    type="button"
                                    onClick={() => handleScopeChange("book")}
                                    className="min-h-[44px] rounded-lg bg-[#1B2A4A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#121D36]"
                                  >
                                    View Entire Book ({globalCounts.total})
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredEntries.map((entry) => (
                        <tr
                          key={entry.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleOpenEntryModal(entry)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleOpenEntryModal(entry);
                            }
                          }}
                          className="cursor-pointer align-top transition hover:bg-stone-50 focus-visible:bg-stone-50 focus-visible:outline-none"
                        >
                          <td className="whitespace-nowrap px-4 py-3 font-mono tabular-nums">
                            <div className="font-bold text-[#1B2A4A]">
                              #{entry.entry_number}
                            </div>
                            <div className="text-xs text-slate-500">
                              Page {entry.page_no}
                            </div>
                          </td>
                          <td className="max-w-[220px] px-4 py-3">
                            <div className="font-medium text-slate-900">
                              {entry.instrument_title}
                            </div>
                            <div className="mt-0.5 text-xs text-slate-500">
                              {entry.notarial_act_type}
                            </div>
                          </td>
                          <td className="max-w-[240px] px-4 py-3 text-slate-700">
                            <div className="whitespace-pre-line">
                              {entry.parties}
                            </div>
                            {entry.secondary_parties && (
                              <div className="mt-1.5 whitespace-pre-line border-t border-[#EAE3D5] pt-1 text-xs text-slate-600">
                                {entry.secondary_parties}
                              </div>
                            )}
                          </td>
                          <td className="max-w-[180px] px-4 py-3 text-xs text-slate-700">
                            {entry.competent_evidence_id || "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-slate-700">
                            {formatDateTime(entry.notarized_at)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-xs tabular-nums text-slate-800">
                            {entry.acknowledgement_receipt || "—"}
                          </td>
                          <td className="max-w-[160px] px-4 py-3 text-xs text-slate-600">
                            {entry.place_and_remarks ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex flex-col items-end gap-1.5">
                              {renderReviewBadge(entry)}
                              {entry.review_notes && (
                                <div
                                  title={entry.review_notes}
                                  className={`max-w-[220px] rounded-md border px-2.5 py-1 text-left text-xs ${
                                    entry.review_status === "flagged"
                                      ? "border-red-200 bg-[#FEF2F2] text-[#7F1D1D]"
                                      : "border-[#DFD7C8] bg-[#FAF7F1] text-[#1C2434]"
                                  }`}
                                >
                                  <span className="font-semibold">Note: </span>
                                  <span className="line-clamp-2">
                                    {entry.review_notes}
                                  </span>
                                </div>
                              )}
                              {entry.attachments &&
                                entry.attachments.length > 0 && (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[#64748B]">
                                    <Paperclip className="h-3.5 w-3.5 text-[#B48A3E]" />
                                    {entry.attachments.length}{" "}
                                    {entry.attachments.length === 1
                                      ? "file"
                                      : "files"}
                                  </span>
                                )}
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1B2A4A]">
                                <Eye className="h-3.5 w-3.5 text-[#B48A3E]" />
                                View Note &amp; Summary &rarr;
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Mandatory Pre-Upload Confirmation Modal */}
      {showConfirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-entry-title"
        >
          <div className="max-h-[90vh] w-[94vw] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl sm:max-w-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <span className="inline-flex rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white">
                  {branchDisplay}
                </span>
                <h3
                  id="confirm-entry-title"
                  className="mt-1.5 text-lg font-bold text-slate-900"
                >
                  Review &amp; Confirm Notarial Entry
                </h3>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowConfirmModal(false)}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-[#FFFBEB] p-3.5 text-sm text-[#78350F]">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                <p>
                  Verify all details carefully. Once confirmed and uploaded,
                  this record is permanently locked and cannot be edited or
                  deleted by the branch.
                </p>
              </div>

              {submitError && (
                <div
                  role="alert"
                  className="space-y-3 rounded-lg border border-red-300 bg-[#FEF2F2] px-4 py-3 text-sm text-[#7F1D1D]"
                >
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    <div>
                      <div className="font-semibold">{submitError}</div>
                      {conflictNextEntry !== null && (
                        <p className="mt-1 text-xs text-red-800">
                          Next available unused Entry No. for {branchDisplay}:{" "}
                          <strong>#{conflictNextEntry}</strong>
                        </p>
                      )}
                    </div>
                  </div>
                  {conflictNextEntry !== null && (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() =>
                        void handleConfirmUpload(conflictNextEntry)
                      }
                      className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 sm:w-auto"
                    >
                      Switch to Entry #{conflictNextEntry} &amp; Upload
                    </button>
                  )}
                </div>
              )}

              <dl className="grid grid-cols-1 gap-3 rounded-xl border border-[#DFD7C8] bg-[#FAF7F1] p-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-600">
                    Branch Name
                  </dt>
                  <dd className="font-semibold text-[#1B2A4A]">
                    {branchDisplay}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-600">
                    Notary Public
                  </dt>
                  <dd className="font-semibold text-[#1B2A4A]">
                    {snapshot.book?.notary_name ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-600">
                    Book / Page / Entry No.
                  </dt>
                  <dd className="font-mono font-semibold tabular-nums text-[#1B2A4A]">
                    Book {snapshot.bookDisplayNo} &bull; Page {previewPageNo}{" "}
                    &bull; Entry #{form.entry_number}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-slate-500">
                    Type of Notarial Act
                  </dt>
                  <dd className="font-semibold text-slate-900">
                    {form.notarial_act_type}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase text-slate-500">
                    Instrument Title
                  </dt>
                  <dd className="font-medium text-slate-900">
                    {form.instrument_title.trim()}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase text-slate-600">
                    Names &amp; Addresses of Parties
                  </dt>
                  <dd className="whitespace-pre-line font-medium text-[#1B2A4A]">
                    {form.parties.trim()}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase text-slate-600">
                    Names &amp; Addresses of Parties (Optional)
                  </dt>
                  <dd className="whitespace-pre-line text-slate-800">
                    {form.secondary_parties.trim() || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-600">
                    Competent Evidence of ID
                  </dt>
                  <dd className="text-slate-800">
                    {form.competent_evidence_id.trim() || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-600">
                    Date &amp; Time of Notarization
                  </dt>
                  <dd className="font-mono text-xs font-medium tabular-nums text-[#1B2A4A]">
                    {formatDateTime(form.notarized_at)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-600">
                    Amount Paid (PHP)
                  </dt>
                  <dd className="mt-0.5 flex flex-wrap items-center gap-2 font-mono font-bold tabular-nums text-emerald-800">
                    <span>{formatPhp(Number(form.amount_paid || 0))}</span>
                    {renderPaymentTypeBadge(form.payment_type)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-600">
                    Acknowledgement Receipt
                  </dt>
                  <dd className="font-mono font-medium tabular-nums text-[#1B2A4A]">
                    {form.acknowledgement_receipt.trim() || "—"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase text-slate-500">
                    Place / Remarks
                  </dt>
                  <dd className="text-slate-800">
                    {form.place_and_remarks.trim() || "—"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase text-slate-500">
                    Supporting Attachments ({selectedFiles.length})
                  </dt>
                  <dd className="mt-1.5">
                    {selectedFiles.length === 0 ? (
                      <span className="text-slate-500">
                        No files attached
                      </span>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {selectedFiles.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white p-2"
                          >
                            {item.previewUrl ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={item.previewUrl}
                                alt={item.file.name}
                                className="h-10 w-10 shrink-0 rounded border border-slate-200 object-cover"
                              />
                            ) : (
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-red-200 bg-red-50 text-red-700">
                                <FileText className="h-4 w-4" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-xs font-medium text-slate-900">
                                {item.file.name}
                              </div>
                              <div className="text-xs text-slate-500">
                                {formatFileSize(item.file.size)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-[#EAE3D5] bg-[#FAF7F1] px-6 py-4 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowConfirmModal(false)}
                className="min-h-[44px] w-full rounded-lg border border-[#DFD7C8] bg-white px-4 py-2 text-sm font-medium text-[#1B2A4A] transition hover:bg-[#FAF7F1] disabled:opacity-50 sm:w-auto"
              >
                Go Back &amp; Edit
              </button>
              <button
                type="button"
                disabled={submitting || isLockedByOtherSelected}
                onClick={() => void handleConfirmUpload()}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                <Lock className="h-4 w-4" />
                {submitting ? "Uploading & Locking..." : "Confirm & Upload"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entry Details & Lawyer Note Modal */}
      {selectedEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="branch-entry-detail-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedEntry(null);
          }}
        >
          <div className="flex max-h-[88vh] w-[94vw] flex-col overflow-hidden rounded-xl border border-[#DFD7C8] bg-white shadow-xl sm:max-w-2xl">
            {/* Sticky Modal Header */}
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#DFD7C8] bg-white px-4 py-3.5 sm:px-6">
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-full bg-[#1B2A4A] px-2.5 py-0.5 text-xs font-semibold text-[#FBF5E8]">
                    {branchDisplay}
                  </span>
                  <span className="font-mono text-xs font-semibold tabular-nums text-[#1B2A4A]">
                    Entry #{selectedEntry.entry_number} &bull; Page{" "}
                    {selectedEntry.page_no} &bull; Book{" "}
                    {snapshot.bookDisplayNo}
                  </span>
                  {renderReviewBadge(selectedEntry)}
                </div>
                <h3
                  id="branch-entry-detail-title"
                  className="font-serif text-lg font-bold text-[#1B2A4A]"
                >
                  {selectedEntry.instrument_title}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border border-transparent text-[#64748B] transition hover:border-[#DFD7C8] hover:bg-[#FAF7F1] hover:text-[#1B2A4A]"
                aria-label="Close entry details"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Internal Scrollable Body */}
            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
              {/* Lawyer Review & Note Callout */}
              <div
                className={`rounded-xl border p-4 text-sm ${
                  selectedEntry.review_status === "flagged"
                    ? "border-red-300 bg-[#FEF2F2] text-[#7F1D1D]"
                    : selectedEntry.review_status === "approved"
                      ? "border-emerald-300 bg-[#ECFDF5] text-[#065F46]"
                      : "border-amber-300 bg-[#FFFBEB] text-[#78350F]"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    Lawyer Review &amp; Note
                  </span>
                  {selectedEntry.reviewed_at && (
                    <span className="font-mono text-xs tabular-nums">
                      Reviewed: {formatDateTime(selectedEntry.reviewed_at)}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 whitespace-pre-line font-medium">
                  {selectedEntry.review_notes?.trim()
                    ? selectedEntry.review_notes
                    : selectedEntry.review_status === "approved"
                      ? "Verified and approved by the Notary / Owner."
                      : selectedEntry.review_status === "flagged"
                        ? "Flagged for correction by the Owner."
                        : "Awaiting review by the Lawyer / Owner."}
                </p>
              </div>

              {/* Complete Encoded Fields Summary */}
              <dl className="grid grid-cols-1 gap-3 rounded-xl border border-[#DFD7C8] bg-[#FAF7F1] p-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase text-[#64748B]">
                    Notarial Act Type
                  </dt>
                  <dd className="font-semibold text-[#1C2434]">
                    {selectedEntry.notarial_act_type}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-[#64748B]">
                    Date &amp; Time Notarized
                  </dt>
                  <dd className="font-mono text-xs font-medium tabular-nums text-[#1B2A4A]">
                    {formatDateTime(selectedEntry.notarized_at)}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase text-[#64748B]">
                    Names &amp; Addresses of Parties
                  </dt>
                  <dd className="mt-0.5 whitespace-pre-line font-medium text-[#1C2434]">
                    {selectedEntry.parties}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase text-[#64748B]">
                    Names &amp; Addresses of Parties (Optional)
                  </dt>
                  <dd className="mt-0.5 whitespace-pre-line text-[#1C2434]">
                    {selectedEntry.secondary_parties || "—"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase text-[#64748B]">
                    Competent Evidence of Identity
                  </dt>
                  <dd className="text-[#1C2434]">
                    {selectedEntry.competent_evidence_id || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-[#64748B]">
                    Acknowledgement Receipt
                  </dt>
                  <dd className="font-mono font-medium tabular-nums text-[#1B2A4A]">
                    {selectedEntry.acknowledgement_receipt || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-[#64748B]">
                    Place / Remarks
                  </dt>
                  <dd className="text-[#1C2434]">
                    {selectedEntry.place_and_remarks || "—"}
                  </dd>
                </div>
                <div className="flex items-center gap-2 border-t border-[#DFD7C8] pt-2 text-xs text-[#64748B] sm:col-span-2">
                  <Lock className="h-3.5 w-3.5 shrink-0 text-[#1B2A4A]" />
                  <span>
                    Locked append-only branch record (only the Owner can edit
                    entries).
                  </span>
                </div>
              </dl>

              {/* Supporting Scanned Attachments */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Supporting Attachments (
                  {loadingSelectedAttachments
                    ? "…"
                    : (selectedEntry.attachments?.length ?? 0)}
                  )
                </h4>
                {loadingSelectedAttachments ? (
                  <AttachmentSkeleton />
                ) : (
                  <AttachmentViewerPane
                    attachments={selectedEntry.attachments ?? []}
                  />
                )}
              </div>
            </div>

            {/* Sticky Modal Footer */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#DFD7C8] bg-[#FAF7F1] px-4 py-3 sm:px-6">
              <Link
                href="/branch/register/print"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[#DFD7C8] bg-white px-3.5 py-2 text-xs font-semibold text-[#1B2A4A] transition hover:bg-[#F4EFE4] sm:text-sm"
              >
                <Printer className="h-4 w-4 text-[#B48A3E]" />
                Print Register Sheet
              </Link>
              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#1B2A4A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#121D36]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
