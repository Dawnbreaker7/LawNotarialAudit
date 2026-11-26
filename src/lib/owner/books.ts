import { createAdminClient } from "@/lib/supabase/admin";
import { getBranchDisplayName } from "@/lib/auth/session";
import type { NotarialBook, OperatingBranchCode } from "@/types/database";

export interface OwnerBookRow extends NotarialBook {
  branch_code: OperatingBranchCode;
  branch_name: string;
  entry_count: number;
}

export interface OwnerBranchSummary {
  id: string;
  branch_code: OperatingBranchCode;
  branch_name: string;
}

export async function fetchOwnerBooksSnapshot(): Promise<{
  branches: OwnerBranchSummary[];
  books: OwnerBookRow[];
}> {
  const supabase = createAdminClient();

  const [branchesRes, booksRes, entriesRes] = await Promise.all([
    supabase
      .from("branches")
      .select("id, branch_code, branch_name")
      .in("branch_code", ["GENSAN", "MALUNGON"]),
    supabase
      .from("notarial_books")
      .select(
        "id, branch_id, notary_name, jurisdiction, appointment_date, commission_expiry, book_no, series_year, is_active"
      )
      .order("is_active", { ascending: false })
      .order("series_year", { ascending: false })
      .order("book_no", { ascending: false }),
    supabase.from("notarial_entries").select("book_id"),
  ]);

  if (branchesRes.error) throw new Error(branchesRes.error.message);
  if (booksRes.error) throw new Error(booksRes.error.message);
  if (entriesRes.error) throw new Error(entriesRes.error.message);

  const branches: OwnerBranchSummary[] = (branchesRes.data ?? [])
    .filter(
      (b): b is { id: string; branch_code: OperatingBranchCode; branch_name: string } =>
        b.branch_code === "GENSAN" || b.branch_code === "MALUNGON"
    )
    .map((b) => ({
      id: b.id,
      branch_code: b.branch_code,
      branch_name: getBranchDisplayName(b),
    }))
    .sort((a, b) => a.branch_code.localeCompare(b.branch_code));

  const branchMap = new Map(branches.map((b) => [b.id, b]));
  const entryCounts = new Map<string, number>();
  for (const e of entriesRes.data ?? []) {
    entryCounts.set(e.book_id, (entryCounts.get(e.book_id) ?? 0) + 1);
  }

  const books: OwnerBookRow[] = [];
  for (const bk of booksRes.data ?? []) {
    const branch = branchMap.get(bk.branch_id);
    if (!branch) continue;
    books.push({
      ...bk,
      branch_code: branch.branch_code,
      branch_name: branch.branch_name,
      entry_count: entryCounts.get(bk.id) ?? 0,
    });
  }

  return { branches, books };
}
