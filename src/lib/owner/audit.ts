import { createAdminClient } from "@/lib/supabase/admin";
import { getBranchDisplayName } from "@/lib/auth/session";
import { getManilaBoundaries } from "@/lib/owner/periods";
import type {
  AuditAction,
  AuditLog,
  BranchCode,
  EntryAttachment,
  NotarialBook,
  NotarialEntry,
  OperatingBranchCode,
  PaymentType,
  ReviewStatus,
} from "@/types/database";

const VALID_AUDIT_ACTIONS = new Set<string>([
  "CREATE_ENTRY",
  "EDIT_ENTRY",
  "DELETE_ENTRY",
  "APPROVE_ENTRY",
  "FLAG_ENTRY",
  "OWNER_LOGIN",
  "LOGIN_SUCCESS",
  "LOGIN_BLOCKED_MOBILE",
  "LOGIN_BLOCKED_MAX_DEVICES",
  "DEVICE_APPROVED",
  "DEVICE_REVOKED",
  "BOOK_CREATED",
  "BOOK_UPDATED",
  "BRANCH_UPDATED",
  "STAFF_ACCOUNT_CREATED",
  "STAFF_ACCESS_REVOKED",
  "STAFF_ACCESS_RESTORED",
  "STAFF_PASSWORD_RESET",
  "STAFF_ACCOUNT_DELETED",
]);

function isAuditAction(value: string): value is AuditAction {
  return VALID_AUDIT_ACTIONS.has(value);
}

export interface AuditEntryItem extends NotarialEntry {
  branch_code: OperatingBranchCode;
  branch_name: string;
  book_no: number;
  series_year: number;
  notary_name: string;
  encoded_by_label: string;
  encoded_by_name?: string | null;
  encoded_by_user_id?: string | null;
  attachments_loaded?: boolean;
}

const OWNER_AUDIT_LIST_SELECT =
  "id, book_id, branch_id, page_no, entry_number, instrument_title, parties, secondary_parties, competent_evidence_id, notarized_at, notarial_act_type, amount_paid, payment_type, acknowledgement_receipt, place_and_remarks, review_status, reviewed_at, review_notes, created_by_session_id, encoded_by_user_id, encoded_by_name, created_at, updated_at";

const OWNER_AUDIT_BOOK_SELECT =
  "id, branch_id, book_no, series_year, notary_name, jurisdiction, appointment_date, commission_expiry, is_active";

export interface BranchTotals {
  total_entries: number;
  total_amount_paid: number;
  full_count: number;
  full_amount_paid: number;
  partial_count: number;
  partial_amount_paid: number;
}

export interface AuditTotals extends BranchTotals {
  gensan: BranchTotals;
  malungon: BranchTotals;
}

export interface AuditBookOption {
  id: string;
  branch_id: string;
  branch_code: OperatingBranchCode;
  branch_name: string;
  book_no: number;
  series_year: number;
  notary_name: string;
  jurisdiction: string;
  appointment_date: string | null;
  commission_expiry: string | null;
  is_active: boolean;
}

export interface AuditFilterParams {
  branch_code?: string;
  book_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  review_status?: string;
  payment_type?: string;
  page?: number;
  page_size?: number | "all";
}

export interface OwnerAuditResult {
  entries: AuditEntryItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  books: AuditBookOption[];
  totals: AuditTotals;
}

export interface EnrichedAuditLog {
  id: string;
  branch_id: string | null;
  branch_code: string | null;
  branch_name: string;
  session_id: string | null;
  device_label: string | null;
  action: AuditAction;
  target_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

export interface ActTypeBreakdown {
  act_type: string;
  total_entries: number;
  gensan_entries: number;
  malungon_entries: number;
  total_amount_paid: number;
}

export interface ReviewCounts {
  forReview: number;
  gensanForReview: number;
  malungonForReview: number;
  approved: number;
  flagged: number;
}

export interface OwnerDashboardData {
  kpis: {
    today: AuditTotals;
    week: AuditTotals;
    month: AuditTotals;
    allTime: AuditTotals;
  };
  reviewCounts: ReviewCounts;
  recentEntries: AuditEntryItem[];
  totalEntriesCount: number;
  actBreakdown: ActTypeBreakdown[];
  recentLogs: EnrichedAuditLog[];
  totalLogsCount: number;
  activeBooks: AuditBookOption[];
}

function createEmptyBranchTotals(): BranchTotals {
  return {
    total_entries: 0,
    total_amount_paid: 0,
    full_count: 0,
    full_amount_paid: 0,
    partial_count: 0,
    partial_amount_paid: 0,
  };
}

function createEmptyAuditTotals(): AuditTotals {
  return {
    total_entries: 0,
    total_amount_paid: 0,
    full_count: 0,
    full_amount_paid: 0,
    partial_count: 0,
    partial_amount_paid: 0,
    gensan: createEmptyBranchTotals(),
    malungon: createEmptyBranchTotals(),
  };
}

function addEntryToTotals(
  totals: AuditTotals,
  branchCode: OperatingBranchCode,
  amountPaid: number,
  paymentType: PaymentType
) {
  totals.total_entries += 1;
  totals.total_amount_paid += amountPaid;
  if (paymentType === "partial") {
    totals.partial_count += 1;
    totals.partial_amount_paid += amountPaid;
  } else {
    totals.full_count += 1;
    totals.full_amount_paid += amountPaid;
  }

  const bucket = branchCode === "GENSAN" ? totals.gensan : totals.malungon;
  bucket.total_entries += 1;
  bucket.total_amount_paid += amountPaid;
  if (paymentType === "partial") {
    bucket.partial_count += 1;
    bucket.partial_amount_paid += amountPaid;
  } else {
    bucket.full_count += 1;
    bucket.full_amount_paid += amountPaid;
  }
}

export async function queryOwnerAuditData(
  filters: AuditFilterParams = {}
): Promise<OwnerAuditResult> {
  const supabase = createAdminClient();

  const [branchesRes, booksRes, sessionsRes, devicesRes] = await Promise.all([
    supabase
      .from("branches")
      .select("id, branch_code, branch_name, role, is_dev")
      .eq("is_dev", false)
      .in("branch_code", ["GENSAN", "MALUNGON"]),
    supabase
      .from("notarial_books")
      .select(OWNER_AUDIT_BOOK_SELECT)
      .order("series_year", { ascending: false })
      .order("book_no", { ascending: false }),
    supabase.from("device_sessions").select("id, device_id"),
    supabase.from("authorized_devices").select("id, device_label"),
  ]);

  if (branchesRes.error) throw new Error(branchesRes.error.message);
  if (booksRes.error) throw new Error(booksRes.error.message);
  if (sessionsRes.error) throw new Error(sessionsRes.error.message);
  if (devicesRes.error) throw new Error(devicesRes.error.message);

  const branchById = new Map<
    string,
    { code: OperatingBranchCode; name: string }
  >();
  const branchIdByCode = new Map<OperatingBranchCode, string>();

  for (const b of branchesRes.data ?? []) {
    if (b.is_dev) continue;
    if (b.branch_code === "GENSAN" || b.branch_code === "MALUNGON") {
      const code = b.branch_code as OperatingBranchCode;
      branchById.set(b.id, {
        code,
        name: getBranchDisplayName(b),
      });
      branchIdByCode.set(code, b.id);
    }
  }

  const bookById = new Map<
    string,
    Pick<
      NotarialBook,
      | "id"
      | "branch_id"
      | "book_no"
      | "series_year"
      | "notary_name"
      | "jurisdiction"
      | "appointment_date"
      | "commission_expiry"
      | "is_active"
    >
  >();
  const books: AuditBookOption[] = [];
  for (const bk of booksRes.data ?? []) {
    bookById.set(bk.id, bk);
    const branchInfo = branchById.get(bk.branch_id);
    if (branchInfo) {
      books.push({
        id: bk.id,
        branch_id: bk.branch_id,
        branch_code: branchInfo.code,
        branch_name: branchInfo.name,
        book_no: bk.book_no,
        series_year: bk.series_year,
        notary_name: bk.notary_name,
        jurisdiction: bk.jurisdiction,
        appointment_date: bk.appointment_date,
        commission_expiry: bk.commission_expiry,
        is_active: bk.is_active,
      });
    }
  }

  const deviceLabelById = new Map<string, string>();
  for (const d of devicesRes.data ?? []) {
    deviceLabelById.set(d.id, d.device_label ?? "Approved PC");
  }

  const sessionDeviceLabel = new Map<string, string>();
  for (const s of sessionsRes.data ?? []) {
    if (s.device_id) {
      sessionDeviceLabel.set(
        s.id,
        deviceLabelById.get(s.device_id) ?? "Approved PC"
      );
    }
  }

  let query = supabase
    .from("notarial_entries")
    .select(OWNER_AUDIT_LIST_SELECT)
    .order("notarized_at", { ascending: false })
    .order("entry_number", { ascending: false });

  const normalizedStatus = filters.review_status?.trim().toLowerCase();
  if (
    normalizedStatus === "for_review" ||
    normalizedStatus === "approved" ||
    normalizedStatus === "flagged"
  ) {
    query = query.eq("review_status", normalizedStatus);
  }

  const normalizedPaymentType = filters.payment_type?.trim().toLowerCase();
  if (normalizedPaymentType === "full" || normalizedPaymentType === "partial") {
    query = query.eq("payment_type", normalizedPaymentType);
  }

  const normalizedBranch = filters.branch_code?.trim().toUpperCase();
  if (normalizedBranch === "GENSAN" || normalizedBranch === "MALUNGON") {
    const targetBranchId = branchIdByCode.get(normalizedBranch);
    if (targetBranchId) {
      query = query.eq("branch_id", targetBranchId);
    }
  }

  if (filters.book_id && filters.book_id !== "ALL") {
    query = query.eq("book_id", filters.book_id);
  }

  if (filters.date_from) {
    const fromIso = new Date(`${filters.date_from}T00:00:00+08:00`);
    if (!Number.isNaN(fromIso.getTime())) {
      query = query.gte("notarized_at", fromIso.toISOString());
    }
  }

  if (filters.date_to) {
    const toIso = new Date(`${filters.date_to}T23:59:59.999+08:00`);
    if (!Number.isNaN(toIso.getTime())) {
      query = query.lte("notarized_at", toIso.toISOString());
    }
  }

  const { data: rawEntries, error: entriesError } = await query;
  if (entriesError) throw new Error(entriesError.message);

  const searchLower = filters.search?.trim().toLowerCase() ?? "";
  const allMatched: AuditEntryItem[] = [];
  const totals = createEmptyAuditTotals();

  for (const row of rawEntries ?? []) {
    const branchInfo = branchById.get(row.branch_id);
    if (!branchInfo) continue;

    const bookInfo = bookById.get(row.book_id);
    const amountPaid = Number(row.amount_paid);
    const paymentType: PaymentType =
      row.payment_type === "partial" ? "partial" : "full";

    if (searchLower) {
      const matches =
        String(row.entry_number).includes(searchLower) ||
        row.parties.toLowerCase().includes(searchLower) ||
        (row.secondary_parties ?? "").toLowerCase().includes(searchLower) ||
        row.instrument_title.toLowerCase().includes(searchLower) ||
        row.competent_evidence_id.toLowerCase().includes(searchLower) ||
        (row.acknowledgement_receipt ?? "").toLowerCase().includes(searchLower) ||
        (row.encoded_by_name ?? "").toLowerCase().includes(searchLower);

      if (!matches) continue;
    }

    const encodedByLabel = row.created_by_session_id
      ? (sessionDeviceLabel.get(row.created_by_session_id) ?? "Branch PC")
      : "System";

    allMatched.push({
      ...row,
      secondary_parties: row.secondary_parties ?? null,
      amount_paid: amountPaid,
      payment_type: paymentType,
      acknowledgement_receipt: row.acknowledgement_receipt ?? null,
      review_status: (row.review_status ?? "for_review") as ReviewStatus,
      reviewed_at: row.reviewed_at ?? null,
      review_notes: row.review_notes ?? null,
      attachments: [],
      attachments_loaded: false,
      branch_code: branchInfo.code,
      branch_name: branchInfo.name,
      book_no: bookInfo?.book_no ?? 0,
      series_year: bookInfo?.series_year ?? 0,
      notary_name: bookInfo?.notary_name ?? "—",
      encoded_by_label: encodedByLabel,
      encoded_by_user_id: row.encoded_by_user_id ?? null,
      encoded_by_name: row.encoded_by_name ?? null,
    });

    addEntryToTotals(totals, branchInfo.code, amountPaid, paymentType);
  }

  const totalCount = allMatched.length;
  if (filters.page_size === "all") {
    return {
      entries: allMatched,
      totalCount,
      page: 1,
      pageSize: Math.max(totalCount, 1),
      totalPages: 1,
      books,
      totals,
    };
  }

  const pageSize = Math.min(Math.max(Number(filters.page_size) || 25, 1), 100);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(Math.max(Number(filters.page) || 1, 1), totalPages);
  const startIdx = (safePage - 1) * pageSize;

  return {
    entries: allMatched.slice(startIdx, startIdx + pageSize),
    totalCount,
    page: safePage,
    pageSize,
    totalPages,
    books,
    totals,
  };
}

export async function queryOwnerEntryById(
  entryId: string
): Promise<AuditEntryItem | null> {
  const supabase = createAdminClient();
  const { data: row, error } = await supabase
    .from("notarial_entries")
    .select(
      "id, book_id, branch_id, page_no, entry_number, instrument_title, parties, secondary_parties, competent_evidence_id, notarized_at, notarial_act_type, amount_paid, payment_type, acknowledgement_receipt, place_and_remarks, review_status, reviewed_at, review_notes, attachments, created_by_session_id, encoded_by_user_id, encoded_by_name, created_at, updated_at"
    )
    .eq("id", entryId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row) return null;

  const [branchRes, bookRes, sessionRes] = await Promise.all([
    supabase
      .from("branches")
      .select("id, branch_code, branch_name, role, is_dev")
      .eq("id", row.branch_id)
      .maybeSingle(),
    supabase
      .from("notarial_books")
      .select("id, book_no, series_year, notary_name")
      .eq("id", row.book_id)
      .maybeSingle(),
    row.created_by_session_id
      ? supabase
          .from("device_sessions")
          .select("id, device_id")
          .eq("id", row.created_by_session_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (branchRes.error) throw new Error(branchRes.error.message);
  if (bookRes.error) throw new Error(bookRes.error.message);

  let encodedByLabel = row.created_by_session_id ? "Branch PC" : "System";
  if (sessionRes.data?.device_id) {
    const { data: dev } = await supabase
      .from("authorized_devices")
      .select("device_label")
      .eq("id", sessionRes.data.device_id)
      .maybeSingle();
    if (dev?.device_label) encodedByLabel = dev.device_label;
  }

  const branchCode: OperatingBranchCode =
    branchRes.data?.branch_code === "MALUNGON" ? "MALUNGON" : "GENSAN";
  const branchName = branchRes.data
    ? getBranchDisplayName(branchRes.data)
    : branchCode === "MALUNGON"
      ? "Malungon Branch"
      : "GenSan Branch";

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
    attachments: Array.isArray(row.attachments)
      ? (row.attachments as EntryAttachment[])
      : [],
    attachments_loaded: true,
    branch_code: branchCode,
    branch_name: branchName,
    book_no: bookRes.data?.book_no ?? 0,
    series_year: bookRes.data?.series_year ?? 0,
    notary_name: bookRes.data?.notary_name ?? "—",
    encoded_by_label: encodedByLabel,
    encoded_by_user_id: row.encoded_by_user_id ?? null,
    encoded_by_name: row.encoded_by_name ?? null,
  };
}

export async function queryOwnerLogs(options?: {
  limit?: number;
  target_id?: string;
  action?: string;
  branch_code?: string;
}): Promise<EnrichedAuditLog[]> {
  const supabase = createAdminClient();
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 100);

  const [branchesRes, sessionsRes, devicesRes] = await Promise.all([
    supabase.from("branches").select("id, branch_code, branch_name"),
    supabase.from("device_sessions").select("id, device_id"),
    supabase.from("authorized_devices").select("id, device_label"),
  ]);
  if (branchesRes.error) throw new Error(branchesRes.error.message);
  if (sessionsRes.error) throw new Error(sessionsRes.error.message);
  if (devicesRes.error) throw new Error(devicesRes.error.message);

  const branchById = new Map<
    string,
    { branch_code: BranchCode; branch_name: string }
  >();
  const branchIdByCode = new Map<string, string>();

  for (const b of branchesRes.data ?? []) {
    branchById.set(b.id, {
      branch_code: b.branch_code,
      branch_name: getBranchDisplayName(b),
    });
    branchIdByCode.set(b.branch_code, b.id);
  }

  const deviceLabelById = new Map<string, string>();
  for (const d of devicesRes.data ?? []) {
    if (d.device_label) {
      deviceLabelById.set(d.id, d.device_label);
    }
  }

  const sessionDeviceLabel = new Map<string, string>();
  for (const s of sessionsRes.data ?? []) {
    if (s.device_id) {
      const label = deviceLabelById.get(s.device_id);
      if (label) sessionDeviceLabel.set(s.id, label);
    }
  }

  let query = supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options?.target_id) {
    query = query.eq("target_id", options.target_id);
  }
  if (options?.action && options.action !== "ALL" && isAuditAction(options.action)) {
    query = query.eq("action", options.action);
  }
  if (options?.branch_code && options.branch_code !== "ALL") {
    const bId = branchIdByCode.get(options.branch_code.toUpperCase());
    if (bId) {
      query = query.eq("branch_id", bId);
    }
  }

  const { data: logsData, error: logsErr } = await query;
  if (logsErr) throw new Error(logsErr.message);

  return ((logsData ?? []) as AuditLog[]).map((log) => {
    const branchInfo = log.branch_id ? branchById.get(log.branch_id) : null;
    const newLabel =
      typeof log.new_data?.device_label === "string"
        ? log.new_data.device_label
        : null;
    const oldLabel =
      typeof log.old_data?.device_label === "string"
        ? log.old_data.device_label
        : null;
    const sessionLabel = log.session_id
      ? (sessionDeviceLabel.get(log.session_id) ?? null)
      : null;

    return {
      ...log,
      branch_code: branchInfo?.branch_code ?? null,
      branch_name: branchInfo?.branch_name ?? "System",
      device_label: newLabel || oldLabel || sessionLabel,
    };
  });
}

export async function queryOwnerDashboardData(): Promise<OwnerDashboardData> {
  const supabase = createAdminClient();
  const [
    branchesRes,
    activeBooksRes,
    kpiRowsRes,
    recentEntriesRes,
    recentLogsRes,
    logsCountRes,
    sessionsRes,
    devicesRes,
  ] = await Promise.all([
    supabase
      .from("branches")
      .select("id, branch_code, branch_name, role, is_dev")
      .eq("is_dev", false)
      .in("branch_code", ["GENSAN", "MALUNGON"]),
    supabase
      .from("notarial_books")
      .select(OWNER_AUDIT_BOOK_SELECT)
      .eq("is_active", true)
      .order("series_year", { ascending: false })
      .order("book_no", { ascending: false }),
    supabase
      .from("notarial_entries")
      .select(
        "branch_id, notarized_at, amount_paid, payment_type, review_status, notarial_act_type"
      ),
    supabase
      .from("notarial_entries")
      .select(OWNER_AUDIT_LIST_SELECT)
      .order("notarized_at", { ascending: false })
      .order("entry_number", { ascending: false })
      .limit(12),
    supabase
      .from("audit_logs")
      .select(
        "id, branch_id, session_id, action, target_id, old_data, new_data, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("audit_logs").select("id", { count: "exact", head: true }),
    supabase.from("device_sessions").select("id, device_id"),
    supabase.from("authorized_devices").select("id, device_label"),
  ]);

  if (branchesRes.error) throw new Error(branchesRes.error.message);
  if (activeBooksRes.error) throw new Error(activeBooksRes.error.message);
  if (kpiRowsRes.error) throw new Error(kpiRowsRes.error.message);
  if (recentEntriesRes.error) throw new Error(recentEntriesRes.error.message);
  if (recentLogsRes.error) throw new Error(recentLogsRes.error.message);
  if (sessionsRes.error) throw new Error(sessionsRes.error.message);
  if (devicesRes.error) throw new Error(devicesRes.error.message);

  const operatingBranchById = new Map<
    string,
    { code: OperatingBranchCode; name: string }
  >();
  for (const b of branchesRes.data ?? []) {
    if (b.is_dev) continue;
    if (b.branch_code === "GENSAN" || b.branch_code === "MALUNGON") {
      operatingBranchById.set(b.id, {
        code: b.branch_code as OperatingBranchCode,
        name: getBranchDisplayName(b),
      });
    }
  }

  const bookById = new Map<
    string,
    { book_no: number; series_year: number; notary_name: string }
  >();
  const activeBooks: AuditBookOption[] = [];
  for (const bk of activeBooksRes.data ?? []) {
    bookById.set(bk.id, {
      book_no: bk.book_no,
      series_year: bk.series_year,
      notary_name: bk.notary_name,
    });
    const branchInfo = operatingBranchById.get(bk.branch_id);
    if (branchInfo) {
      activeBooks.push({
        id: bk.id,
        branch_id: bk.branch_id,
        branch_code: branchInfo.code,
        branch_name: branchInfo.name,
        book_no: bk.book_no,
        series_year: bk.series_year,
        notary_name: bk.notary_name,
        jurisdiction: bk.jurisdiction,
        appointment_date: bk.appointment_date,
        commission_expiry: bk.commission_expiry,
        is_active: bk.is_active,
      });
    }
  }

  const deviceLabelById = new Map<string, string>();
  for (const d of devicesRes.data ?? []) {
    if (d.device_label) {
      deviceLabelById.set(d.id, d.device_label);
    }
  }

  const sessionDeviceLabel = new Map<string, string>();
  for (const s of sessionsRes.data ?? []) {
    if (s.device_id) {
      const label = deviceLabelById.get(s.device_id);
      if (label) sessionDeviceLabel.set(s.id, label);
    }
  }

  const { todayStartMs, weekStartMs, monthStartMs } = getManilaBoundaries();
  const today = createEmptyAuditTotals();
  const week = createEmptyAuditTotals();
  const month = createEmptyAuditTotals();
  const allTime = createEmptyAuditTotals();
  const reviewCounts: ReviewCounts = {
    forReview: 0,
    gensanForReview: 0,
    malungonForReview: 0,
    approved: 0,
    flagged: 0,
  };
  const actMap = new Map<string, ActTypeBreakdown>();
  let totalEntriesCount = 0;

  for (const row of kpiRowsRes.data ?? []) {
    const branchInfo = operatingBranchById.get(row.branch_id);
    if (!branchInfo) continue;

    totalEntriesCount += 1;
    const amountPaid = Number(row.amount_paid);
    const paymentType: PaymentType =
      row.payment_type === "partial" ? "partial" : "full";
    const status = (row.review_status ?? "for_review") as ReviewStatus;

    if (status === "approved") {
      reviewCounts.approved += 1;
    } else if (status === "flagged") {
      reviewCounts.flagged += 1;
    } else {
      reviewCounts.forReview += 1;
      if (branchInfo.code === "GENSAN") reviewCounts.gensanForReview += 1;
      else reviewCounts.malungonForReview += 1;
    }

    addEntryToTotals(allTime, branchInfo.code, amountPaid, paymentType);
    const entryMs = new Date(row.notarized_at).getTime();
    if (!Number.isNaN(entryMs)) {
      if (entryMs >= todayStartMs) {
        addEntryToTotals(today, branchInfo.code, amountPaid, paymentType);
      }
      if (entryMs >= weekStartMs) {
        addEntryToTotals(week, branchInfo.code, amountPaid, paymentType);
      }
      if (entryMs >= monthStartMs) {
        addEntryToTotals(month, branchInfo.code, amountPaid, paymentType);
      }
    }

    const existingAct = actMap.get(row.notarial_act_type) ?? {
      act_type: row.notarial_act_type,
      total_entries: 0,
      gensan_entries: 0,
      malungon_entries: 0,
      total_amount_paid: 0,
    };
    existingAct.total_entries += 1;
    if (branchInfo.code === "GENSAN") existingAct.gensan_entries += 1;
    else existingAct.malungon_entries += 1;
    existingAct.total_amount_paid += amountPaid;
    actMap.set(row.notarial_act_type, existingAct);
  }

  const recentEntries: AuditEntryItem[] = [];
  for (const row of recentEntriesRes.data ?? []) {
    const branchInfo = operatingBranchById.get(row.branch_id);
    if (!branchInfo) continue;

    let bookInfo = bookById.get(row.book_id);
    if (!bookInfo) {
      const { data: missingBook } = await supabase
        .from("notarial_books")
        .select("book_no, series_year, notary_name")
        .eq("id", row.book_id)
        .maybeSingle();
      if (missingBook) {
        bookInfo = missingBook;
        bookById.set(row.book_id, missingBook);
      }
    }

    recentEntries.push({
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
      attachments: [],
      attachments_loaded: false,
      branch_code: branchInfo.code,
      branch_name: branchInfo.name,
      book_no: bookInfo?.book_no ?? 0,
      series_year: bookInfo?.series_year ?? 0,
      notary_name: bookInfo?.notary_name ?? "—",
      encoded_by_label: row.created_by_session_id
        ? (sessionDeviceLabel.get(row.created_by_session_id) ?? "Branch PC")
        : "System",
      encoded_by_user_id: row.encoded_by_user_id ?? null,
      encoded_by_name: row.encoded_by_name ?? null,
    });

    if (recentEntries.length >= 5) break;
  }

  const recentLogs: EnrichedAuditLog[] = (
    (recentLogsRes.data ?? []) as AuditLog[]
  ).map((log) => {
    const branchInfo = log.branch_id
      ? operatingBranchById.get(log.branch_id)
      : null;
    const newLabel =
      typeof log.new_data?.device_label === "string"
        ? log.new_data.device_label
        : null;
    const oldLabel =
      typeof log.old_data?.device_label === "string"
        ? log.old_data.device_label
        : null;
    const sessionLabel = log.session_id
      ? (sessionDeviceLabel.get(log.session_id) ?? null)
      : null;

    return {
      ...log,
      branch_code: branchInfo?.code ?? null,
      branch_name: branchInfo?.name ?? "System",
      device_label: newLabel || oldLabel || sessionLabel,
    };
  });

  const actBreakdown = Array.from(actMap.values()).sort(
    (a, b) =>
      b.total_entries - a.total_entries ||
      b.total_amount_paid - a.total_amount_paid
  );

  return {
    kpis: { today, week, month, allTime },
    reviewCounts,
    recentEntries,
    totalEntriesCount,
    actBreakdown,
    recentLogs,
    totalLogsCount: logsCountRes.count ?? recentLogs.length,
    activeBooks,
  };
}
