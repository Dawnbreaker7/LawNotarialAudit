import { createAdminClient } from "@/lib/supabase/admin";
import { getBranchDisplayName, type ValidSession } from "@/lib/auth/session";
import type {
  EntryAttachment,
  NotarialBook,
  NotarialEntry,
  PaymentType,
  ReviewStatus,
} from "@/types/database";

export const ENTRIES_PER_PAGE = 5;
export const MIN_PAGE_NO = 2;
export const MAX_PAGE_NO = 106;
export const MAX_ENTRY_NUMBER = 525;

const BOOK_SELECT =
  "id, branch_id, notary_name, jurisdiction, appointment_date, commission_expiry, book_no, series_year, is_active";

const TABLE_ENTRY_SELECT =
  "id, book_id, branch_id, page_no, entry_number, instrument_title, parties, secondary_parties, competent_evidence_id, notarized_at, notarial_act_type, amount_paid, payment_type, acknowledgement_receipt, place_and_remarks, review_status, reviewed_at, review_notes, created_by_session_id, created_at, updated_at";

const FULL_ENTRY_SELECT = `${TABLE_ENTRY_SELECT}, attachments`;

export interface BranchEntryCounts {
  total: number;
  approved: number;
  for_review: number;
  flagged: number;
}

export interface LockedEntrySummary {
  entry_number: number;
  locked_by_name: string;
  is_own_lock: boolean;
}

export interface BranchRegisterSnapshot {
  branch: {
    id: string;
    branch_code: string;
    branch_name: string;
    display_name: string;
  };
  deviceLabel: string;
  isDev: boolean;
  bookDisplayNo: string;
  book: NotarialBook | null;
  scope: "page" | "book";
  loadedPageNo: number | null;
  entries: NotarialEntry[];
  usedEntryNumbers: number[];
  lockedEntries: LockedEntrySummary[];
  availablePageNumbers: number[];
  counts: BranchEntryCounts;
  nextAvailableEntryNumber: number | null;
  nextEntryNumber: number | null;
  isBookFull: boolean;
  latestPageNo: number;
  currentPageNo: number;
}

export interface BranchPrintSnapshot {
  branch: {
    id: string;
    branch_code: string;
    branch_name: string;
    display_name: string;
  };
  isDev: boolean;
  bookDisplayNo: string;
  book: NotarialBook | null;
  latestPageNo: number;
  availablePageNumbers: number[];
  initialSelectedPage: string;
  entries: NotarialEntry[];
}

export function getPageForEntry(entryNo: number): number {
  return Math.min(
    MAX_PAGE_NO,
    Math.max(MIN_PAGE_NO, Math.ceil(entryNo / ENTRIES_PER_PAGE) + 1)
  );
}

export const calculatePageNo = getPageForEntry;

export function computeNextAvailableEntryNumber(
  usedNumbers: Iterable<number>,
  blockedNumbers?: Iterable<number>
): number | null {
  const blockedSet = new Set(usedNumbers);
  if (blockedNumbers) {
    for (const num of blockedNumbers) {
      blockedSet.add(num);
    }
  }
  for (let candidate = 1; candidate <= MAX_ENTRY_NUMBER; candidate += 1) {
    if (!blockedSet.has(candidate)) {
      return candidate;
    }
  }
  return null;
}

function normalizeBranchEntry(
  row: Omit<NotarialEntry, "attachments" | "amount_paid" | "payment_type" | "review_status"> & {
    amount_paid: number | string;
    payment_type: string;
    review_status?: string | null;
    attachments?: unknown;
  },
  hasAttachmentsField: boolean
): NotarialEntry {
  return {
    ...row,
    secondary_parties: row.secondary_parties ?? null,
    amount_paid: Number(row.amount_paid),
    payment_type: (row.payment_type === "partial"
      ? "partial"
      : "full") as PaymentType,
    acknowledgement_receipt: row.acknowledgement_receipt ?? null,
    review_status: (row.review_status ?? "for_review") as ReviewStatus,
    reviewed_at: row.reviewed_at ?? null,
    review_notes: row.review_notes ?? null,
    attachments:
      hasAttachmentsField && Array.isArray(row.attachments)
        ? (row.attachments as EntryAttachment[])
        : [],
  };
}

export async function getActiveBranchBook(
  branchId: string
): Promise<NotarialBook | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("notarial_books")
    .select(BOOK_SELECT)
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .order("series_year", { ascending: false })
    .order("book_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

export async function getUsedEntryNumbersForBook(
  branchId: string,
  bookId: string,
  currentLockToken?: string | null
): Promise<{
  usedEntryNumbers: number[];
  nextAvailableEntryNumber: number | null;
  isBookFull: boolean;
}> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  const [entriesRes, locksRes] = await Promise.all([
    supabase
      .from("notarial_entries")
      .select("entry_number")
      .eq("branch_id", branchId)
      .eq("book_id", bookId)
      .order("entry_number", { ascending: true }),
    supabase
      .from("entry_number_locks")
      .select("entry_number, lock_session_token")
      .eq("book_id", bookId)
      .gt("expires_at", nowIso),
  ]);

  if (entriesRes.error) {
    throw new Error(entriesRes.error.message);
  }
  if (locksRes.error) {
    console.warn(
      "Non-fatal warning loading entry_number_locks:",
      locksRes.error.message
    );
  }

  const usedEntryNumbers = (entriesRes.data ?? []).map(
    (row) => row.entry_number
  );
  const blockedByOthers = (locksRes.error ? [] : (locksRes.data ?? []))
    .filter(
      (lock) => !currentLockToken || lock.lock_session_token !== currentLockToken
    )
    .map((lock) => lock.entry_number);

  const isBookFull = computeNextAvailableEntryNumber(usedEntryNumbers) === null;
  const nextAvailableEntryNumber = computeNextAvailableEntryNumber(
    usedEntryNumbers,
    blockedByOthers
  );

  return {
    usedEntryNumbers,
    nextAvailableEntryNumber,
    isBookFull,
  };
}

function summarizeIndexRows(
  rows: Array<{
    entry_number: number;
    page_no: number;
    review_status: string | null;
  }>,
  activeLocks: Array<{
    entry_number: number;
    locked_by_name: string;
    lock_session_token: string;
  }> = [],
  currentLockToken?: string | null
) {
  const usedEntryNumbers: number[] = [];
  const pageSet = new Set<number>();
  const counts: BranchEntryCounts = {
    total: 0,
    approved: 0,
    for_review: 0,
    flagged: 0,
  };
  let maxEntryPageNo = MIN_PAGE_NO;

  for (const row of rows) {
    usedEntryNumbers.push(row.entry_number);
    if (row.page_no >= MIN_PAGE_NO && row.page_no <= MAX_PAGE_NO) {
      pageSet.add(row.page_no);
    }
    if (row.page_no > maxEntryPageNo) maxEntryPageNo = row.page_no;
    counts.total += 1;
    if (row.review_status === "approved") counts.approved += 1;
    else if (row.review_status === "flagged") counts.flagged += 1;
    else counts.for_review += 1;
  }

  usedEntryNumbers.sort((a, b) => a - b);

  const lockedEntries: LockedEntrySummary[] = activeLocks
    .map((lock) => ({
      entry_number: lock.entry_number,
      locked_by_name: lock.locked_by_name,
      is_own_lock: Boolean(
        currentLockToken && lock.lock_session_token === currentLockToken
      ),
    }))
    .sort((a, b) => a.entry_number - b.entry_number);

  const blockedByOthers = lockedEntries
    .filter((lock) => !lock.is_own_lock)
    .map((lock) => lock.entry_number);

  const isBookFull = computeNextAvailableEntryNumber(usedEntryNumbers) === null;
  const nextAvailableEntryNumber = computeNextAvailableEntryNumber(
    usedEntryNumbers,
    blockedByOthers
  );

  const latestPageNo =
    rows.length > 0
      ? Math.min(MAX_PAGE_NO, Math.max(MIN_PAGE_NO, maxEntryPageNo))
      : MIN_PAGE_NO;

  const availablePageNumbers = Array.from(pageSet).sort((a, b) => b - a);

  return {
    usedEntryNumbers,
    lockedEntries,
    availablePageNumbers,
    counts,
    nextAvailableEntryNumber,
    isBookFull,
    latestPageNo,
  };
}

export async function fetchBranchRegisterSnapshot(
  valid: ValidSession,
  options?: { scope?: "page" | "book"; page?: number; lockToken?: string | null }
): Promise<BranchRegisterSnapshot> {
  const displayName = getBranchDisplayName(valid.branch);
  const deviceLabel =
    valid.device?.device_label ??
    (valid.is_dev ? "DEV Sandbox Session" : "Approved Workstation");
  const isDev = Boolean(valid.is_dev || valid.branch.is_dev);
  const scope: "page" | "book" = options?.scope === "book" ? "book" : "page";
  const currentLockToken = options?.lockToken?.trim() || null;
  const book = await getActiveBranchBook(valid.branch.id);

  if (!book) {
    return {
      branch: {
        id: valid.branch.id,
        branch_code: valid.branch.branch_code,
        branch_name: valid.branch.branch_name,
        display_name: displayName,
      },
      deviceLabel,
      isDev,
      bookDisplayNo: "—",
      book: null,
      scope,
      loadedPageNo: scope === "page" ? MIN_PAGE_NO : null,
      entries: [],
      usedEntryNumbers: [],
      lockedEntries: [],
      availablePageNumbers: [],
      counts: { total: 0, approved: 0, for_review: 0, flagged: 0 },
      nextAvailableEntryNumber: 1,
      nextEntryNumber: 1,
      isBookFull: false,
      latestPageNo: MIN_PAGE_NO,
      currentPageNo: MIN_PAGE_NO,
    };
  }

  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  const indexPromise = supabase
    .from("notarial_entries")
    .select("entry_number, page_no, review_status")
    .eq("branch_id", valid.branch.id)
    .eq("book_id", book.id);

  const locksPromise = supabase
    .from("entry_number_locks")
    .select("entry_number, locked_by_name, lock_session_token")
    .eq("book_id", book.id)
    .gt("expires_at", nowIso);

  let rawEntriesData: Record<string, unknown>[] = [];
  let indexRowsData: Array<{
    entry_number: number;
    page_no: number;
    review_status: string | null;
  }> = [];
  let lockRowsData: Array<{
    entry_number: number;
    locked_by_name: string;
    lock_session_token: string;
  }> = [];
  let loadedPageNo: number | null = null;
  let hasAttachmentsField = true;

  if (scope === "book") {
    hasAttachmentsField = false;
    const [indexRes, locksRes, bookEntriesRes] = await Promise.all([
      indexPromise,
      locksPromise,
      supabase
        .from("notarial_entries")
        .select(TABLE_ENTRY_SELECT)
        .eq("branch_id", valid.branch.id)
        .eq("book_id", book.id)
        .order("entry_number", { ascending: false }),
    ]);

    if (indexRes.error) throw new Error(indexRes.error.message);
    if (bookEntriesRes.error) throw new Error(bookEntriesRes.error.message);
    if (locksRes.error) {
      console.warn(
        "Non-fatal warning loading entry_number_locks:",
        locksRes.error.message
      );
    } else {
      lockRowsData = locksRes.data ?? [];
    }
    indexRowsData = indexRes.data ?? [];
    rawEntriesData = (bookEntriesRes.data ?? []) as Record<string, unknown>[];
  } else if (
    options?.page !== undefined &&
    Number.isInteger(options.page) &&
    options.page >= MIN_PAGE_NO
  ) {
    loadedPageNo = Math.min(MAX_PAGE_NO, Math.max(MIN_PAGE_NO, options.page));
    const [indexRes, locksRes, pageEntriesRes] = await Promise.all([
      indexPromise,
      locksPromise,
      supabase
        .from("notarial_entries")
        .select(FULL_ENTRY_SELECT)
        .eq("branch_id", valid.branch.id)
        .eq("book_id", book.id)
        .eq("page_no", loadedPageNo)
        .order("entry_number", { ascending: false }),
    ]);

    if (indexRes.error) throw new Error(indexRes.error.message);
    if (pageEntriesRes.error) throw new Error(pageEntriesRes.error.message);
    if (locksRes.error) {
      console.warn(
        "Non-fatal warning loading entry_number_locks:",
        locksRes.error.message
      );
    } else {
      lockRowsData = locksRes.data ?? [];
    }
    indexRowsData = indexRes.data ?? [];
    rawEntriesData = (pageEntriesRes.data ?? []) as Record<string, unknown>[];
  } else {
    const [indexRes, locksRes] = await Promise.all([indexPromise, locksPromise]);
    if (indexRes.error) throw new Error(indexRes.error.message);
    if (locksRes.error) {
      console.warn(
        "Non-fatal warning loading entry_number_locks:",
        locksRes.error.message
      );
    } else {
      lockRowsData = locksRes.data ?? [];
    }
    indexRowsData = indexRes.data ?? [];
    const summary = summarizeIndexRows(
      indexRowsData,
      lockRowsData,
      currentLockToken
    );
    loadedPageNo = summary.latestPageNo;

    if (indexRowsData.length > 0) {
      const pageEntriesRes = await supabase
        .from("notarial_entries")
        .select(FULL_ENTRY_SELECT)
        .eq("branch_id", valid.branch.id)
        .eq("book_id", book.id)
        .eq("page_no", loadedPageNo)
        .order("entry_number", { ascending: false });

      if (pageEntriesRes.error) throw new Error(pageEntriesRes.error.message);
      rawEntriesData = (pageEntriesRes.data ?? []) as Record<string, unknown>[];
    }
  }

  const summary = summarizeIndexRows(
    indexRowsData,
    lockRowsData,
    currentLockToken
  );
  const entries = rawEntriesData.map((row) =>
    normalizeBranchEntry(
      row as Parameters<typeof normalizeBranchEntry>[0],
      hasAttachmentsField
    )
  );

  return {
    branch: {
      id: valid.branch.id,
      branch_code: valid.branch.branch_code,
      branch_name: valid.branch.branch_name,
      display_name: displayName,
    },
    deviceLabel,
    isDev,
    bookDisplayNo: isDev ? "DEV-01" : String(book.book_no),
    book,
    scope,
    loadedPageNo,
    entries,
    usedEntryNumbers: summary.usedEntryNumbers,
    lockedEntries: summary.lockedEntries,
    availablePageNumbers: summary.availablePageNumbers,
    counts: summary.counts,
    nextAvailableEntryNumber: summary.nextAvailableEntryNumber,
    nextEntryNumber: summary.nextAvailableEntryNumber,
    isBookFull: summary.isBookFull,
    latestPageNo: summary.latestPageNo,
    currentPageNo: summary.latestPageNo,
  };
}

export async function fetchBranchPrintSnapshot(
  valid: ValidSession,
  rawPageParam?: string | null
): Promise<BranchPrintSnapshot> {
  const displayName = getBranchDisplayName(valid.branch);
  const isDev = Boolean(valid.is_dev || valid.branch.is_dev);
  const book = await getActiveBranchBook(valid.branch.id);

  if (!book) {
    return {
      branch: {
        id: valid.branch.id,
        branch_code: valid.branch.branch_code,
        branch_name: valid.branch.branch_name,
        display_name: displayName,
      },
      isDev,
      bookDisplayNo: "—",
      book: null,
      latestPageNo: MIN_PAGE_NO,
      availablePageNumbers: [MIN_PAGE_NO],
      initialSelectedPage: String(MIN_PAGE_NO),
      entries: [],
    };
  }

  const supabase = createAdminClient();
  const normalizedParam = rawPageParam?.trim().toLowerCase() ?? "";
  const isAllPages = normalizedParam === "all";
  const parsedRequested =
    !isAllPages && normalizedParam ? Number(normalizedParam) : NaN;
  const explicitPageNo =
    Number.isInteger(parsedRequested) && parsedRequested >= MIN_PAGE_NO
      ? Math.min(MAX_PAGE_NO, parsedRequested)
      : null;

  const indexPromise = supabase
    .from("notarial_entries")
    .select("entry_number, page_no, review_status")
    .eq("branch_id", valid.branch.id)
    .eq("book_id", book.id);

  let indexRowsData: Array<{
    entry_number: number;
    page_no: number;
    review_status: string | null;
  }> = [];
  let rawEntriesData: Record<string, unknown>[] = [];
  let initialSelectedPage = String(MIN_PAGE_NO);

  if (isAllPages) {
    initialSelectedPage = "all";
    const [indexRes, allEntriesRes] = await Promise.all([
      indexPromise,
      supabase
        .from("notarial_entries")
        .select(TABLE_ENTRY_SELECT)
        .eq("branch_id", valid.branch.id)
        .eq("book_id", book.id)
        .order("entry_number", { ascending: true }),
    ]);
    if (indexRes.error) throw new Error(indexRes.error.message);
    if (allEntriesRes.error) throw new Error(allEntriesRes.error.message);
    indexRowsData = indexRes.data ?? [];
    rawEntriesData = (allEntriesRes.data ?? []) as Record<string, unknown>[];
  } else if (explicitPageNo !== null) {
    initialSelectedPage = String(explicitPageNo);
    const [indexRes, pageEntriesRes] = await Promise.all([
      indexPromise,
      supabase
        .from("notarial_entries")
        .select(TABLE_ENTRY_SELECT)
        .eq("branch_id", valid.branch.id)
        .eq("book_id", book.id)
        .eq("page_no", explicitPageNo)
        .order("entry_number", { ascending: true }),
    ]);
    if (indexRes.error) throw new Error(indexRes.error.message);
    if (pageEntriesRes.error) throw new Error(pageEntriesRes.error.message);
    indexRowsData = indexRes.data ?? [];
    rawEntriesData = (pageEntriesRes.data ?? []) as Record<string, unknown>[];
  } else {
    const indexRes = await indexPromise;
    if (indexRes.error) throw new Error(indexRes.error.message);
    indexRowsData = indexRes.data ?? [];
    const summary = summarizeIndexRows(indexRowsData);
    initialSelectedPage = String(summary.latestPageNo);

    if (indexRowsData.length > 0) {
      const pageEntriesRes = await supabase
        .from("notarial_entries")
        .select(TABLE_ENTRY_SELECT)
        .eq("branch_id", valid.branch.id)
        .eq("book_id", book.id)
        .eq("page_no", summary.latestPageNo)
        .order("entry_number", { ascending: true });
      if (pageEntriesRes.error) throw new Error(pageEntriesRes.error.message);
      rawEntriesData = (pageEntriesRes.data ?? []) as Record<string, unknown>[];
    }
  }

  const summary = summarizeIndexRows(indexRowsData);
  const availablePageNumbers =
    summary.availablePageNumbers.length > 0
      ? [...summary.availablePageNumbers].sort((a, b) => a - b)
      : [summary.latestPageNo];

  const entries = rawEntriesData.map((row) =>
    normalizeBranchEntry(
      row as Parameters<typeof normalizeBranchEntry>[0],
      false
    )
  );

  return {
    branch: {
      id: valid.branch.id,
      branch_code: valid.branch.branch_code,
      branch_name: valid.branch.branch_name,
      display_name: displayName,
    },
    isDev,
    bookDisplayNo: isDev ? "DEV-01" : String(book.book_no),
    book,
    latestPageNo: summary.latestPageNo,
    availablePageNumbers,
    initialSelectedPage,
    entries,
  };
}
