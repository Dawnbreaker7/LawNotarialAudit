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
export const MAX_ENTRY_NUMBER = 500;
export const MAX_PAGE_NO = 100;

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
  entries: NotarialEntry[];
  usedEntryNumbers: number[];
  nextAvailableEntryNumber: number | null;
  nextEntryNumber: number | null;
  isBookFull: boolean;
  latestPageNo: number;
  currentPageNo: number;
}

export function calculatePageNo(entryNumber: number): number {
  return Math.min(
    MAX_PAGE_NO,
    Math.max(1, Math.ceil(entryNumber / ENTRIES_PER_PAGE))
  );
}

export function computeNextAvailableEntryNumber(
  usedNumbers: Iterable<number>
): number | null {
  const usedSet = new Set(usedNumbers);
  for (let candidate = 1; candidate <= MAX_ENTRY_NUMBER; candidate += 1) {
    if (!usedSet.has(candidate)) {
      return candidate;
    }
  }
  return null;
}

export async function getActiveBranchBook(
  branchId: string
): Promise<NotarialBook | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("notarial_books")
    .select("*")
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
  bookId: string
): Promise<{
  usedEntryNumbers: number[];
  nextAvailableEntryNumber: number | null;
  isBookFull: boolean;
}> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("notarial_entries")
    .select("entry_number")
    .eq("branch_id", branchId)
    .eq("book_id", bookId)
    .order("entry_number", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const usedEntryNumbers = (data ?? []).map((row) => row.entry_number);
  const nextAvailableEntryNumber =
    computeNextAvailableEntryNumber(usedEntryNumbers);

  return {
    usedEntryNumbers,
    nextAvailableEntryNumber,
    isBookFull: nextAvailableEntryNumber === null,
  };
}

export async function fetchBranchRegisterSnapshot(
  valid: ValidSession
): Promise<BranchRegisterSnapshot> {
  const displayName = getBranchDisplayName(valid.branch);
  const deviceLabel =
    valid.device?.device_label ??
    (valid.is_dev ? "DEV Sandbox Session" : "Approved Workstation");
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
      deviceLabel,
      isDev,
      bookDisplayNo: "—",
      book: null,
      entries: [],
      usedEntryNumbers: [],
      nextAvailableEntryNumber: 1,
      nextEntryNumber: 1,
      isBookFull: false,
      latestPageNo: 1,
      currentPageNo: 1,
    };
  }

  const supabase = createAdminClient();
  const { data: rawEntries, error: entriesError } = await supabase
    .from("notarial_entries")
    .select(
      "id, book_id, branch_id, page_no, entry_number, instrument_title, parties, secondary_parties, competent_evidence_id, notarized_at, notarial_act_type, amount_paid, payment_type, acknowledgement_receipt, place_and_remarks, review_status, reviewed_at, review_notes, attachments, created_by_session_id, created_at, updated_at"
    )
    .eq("branch_id", valid.branch.id)
    .eq("book_id", book.id)
    .order("entry_number", { ascending: false });

  if (entriesError) {
    throw new Error(entriesError.message);
  }

  const entries: NotarialEntry[] = (rawEntries ?? []).map((entry) => ({
    ...entry,
    secondary_parties: entry.secondary_parties ?? null,
    amount_paid: Number(entry.amount_paid),
    payment_type: (entry.payment_type === "partial"
      ? "partial"
      : "full") as PaymentType,
    acknowledgement_receipt: entry.acknowledgement_receipt ?? null,
    review_status: (entry.review_status ?? "for_review") as ReviewStatus,
    reviewed_at: entry.reviewed_at ?? null,
    review_notes: entry.review_notes ?? null,
    attachments: Array.isArray(entry.attachments)
      ? (entry.attachments as EntryAttachment[])
      : [],
  }));

  const usedEntryNumbers = entries
    .map((entry) => entry.entry_number)
    .sort((a, b) => a - b);
  const nextAvailableEntryNumber =
    computeNextAvailableEntryNumber(usedEntryNumbers);
  const isBookFull = nextAvailableEntryNumber === null;
  const bookCurrentPageNo = book.current_page_no || 1;

  let latestPageNo = Math.min(MAX_PAGE_NO, Math.max(1, bookCurrentPageNo));
  if (entries.length > 0) {
    const maxEntryPageNo = entries.reduce(
      (max, entry) => (entry.page_no > max ? entry.page_no : max),
      1
    );
    const maxEntryNumber = usedEntryNumbers[usedEntryNumbers.length - 1] ?? 1;
    latestPageNo = Math.min(
      MAX_PAGE_NO,
      Math.max(
        bookCurrentPageNo,
        maxEntryPageNo,
        Math.ceil(maxEntryNumber / ENTRIES_PER_PAGE)
      )
    );
  }

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
    entries,
    usedEntryNumbers,
    nextAvailableEntryNumber,
    nextEntryNumber: nextAvailableEntryNumber,
    isBookFull,
    latestPageNo,
    currentPageNo: latestPageNo,
  };
}
