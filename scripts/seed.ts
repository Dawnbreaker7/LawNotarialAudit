import path from "node:path";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { createAdminClient } from "../src/lib/supabase/admin";
import type { BranchCode, BranchRole } from "../src/types/database";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });

interface BranchSeedInput {
  branch_code: BranchCode;
  branch_name: string;
  plainPassword: string;
  role: BranchRole;
  allow_mobile_login: boolean;
  require_device_approval: boolean;
  max_devices: number;
}

interface BookSeedInput {
  branch_code: "GENSAN" | "MALUNGON";
  notary_name: string;
  jurisdiction: string;
  book_no: number;
  series_year: number;
  is_active: boolean;
}

const BCRYPT_ROUNDS = 12;

const BRANCH_SEEDS: BranchSeedInput[] = [
  {
    branch_code: "OWNER",
    branch_name: "Owner Admin",
    plainPassword: process.env.SEED_OWNER_PASSWORD ?? "Owner@2026!",
    role: "owner",
    allow_mobile_login: true,
    require_device_approval: false,
    max_devices: 2,
  },
  {
    branch_code: "GENSAN",
    branch_name: "GenSan Branch",
    plainPassword: process.env.SEED_GENSAN_PASSWORD ?? "GenSan@2026!",
    role: "branch",
    allow_mobile_login: false,
    require_device_approval: true,
    max_devices: 4,
  },
  {
    branch_code: "MALUNGON",
    branch_name: "Malungon Branch",
    plainPassword: process.env.SEED_MALUNGON_PASSWORD ?? "Malungon@2026!",
    role: "branch",
    allow_mobile_login: false,
    require_device_approval: true,
    max_devices: 4,
  },
];

const BOOK_SEEDS: BookSeedInput[] = [
  {
    branch_code: "GENSAN",
    notary_name: "Atty. Venchito M. Bangayan",
    jurisdiction: "General Santos City, Philippines",
    book_no: 63,
    series_year: 2026,
    is_active: true,
  },
  {
    branch_code: "MALUNGON",
    notary_name: "Atty. Venchito M. Bangayan",
    jurisdiction: "Malungon, Sarangani, Philippines",
    book_no: 1,
    series_year: 2026,
    is_active: true,
  },
];

async function seed(): Promise<void> {
  const supabase = createAdminClient();

  const branchIdByCode = new Map<BranchCode, string>();

  for (const branch of BRANCH_SEEDS) {
    const password_hash = await bcrypt.hash(branch.plainPassword, BCRYPT_ROUNDS);

    const { data, error } = await supabase
      .from("branches")
      .upsert(
        {
          branch_code: branch.branch_code,
          branch_name: branch.branch_name,
          password_hash,
          role: branch.role,
          allow_mobile_login: branch.allow_mobile_login,
          require_device_approval: branch.require_device_approval,
          max_devices: branch.max_devices,
        },
        { onConflict: "branch_code" }
      )
      .select("id, branch_code, branch_name")
      .single();

    if (error || !data) {
      throw new Error(
        `Failed to upsert branch ${branch.branch_code}: ${error?.message ?? "No data returned"}`
      );
    }

    branchIdByCode.set(branch.branch_code, data.id);
    console.log(
      `Upserted branch: ${data.branch_code} (${data.branch_name}) [${data.id}]`
    );
  }

  for (const book of BOOK_SEEDS) {
    const branchId = branchIdByCode.get(book.branch_code);
    if (!branchId) {
      throw new Error(`Missing branch ID for ${book.branch_code}`);
    }

    const { data: existingBook, error: lookupError } = await supabase
      .from("notarial_books")
      .select("id")
      .eq("branch_id", branchId)
      .eq("book_no", book.book_no)
      .eq("series_year", book.series_year)
      .maybeSingle();

    if (lookupError) {
      throw new Error(
        `Failed to look up notarial book for ${book.branch_code}: ${lookupError.message}`
      );
    }

    if (existingBook) {
      const { error: updateError } = await supabase
        .from("notarial_books")
        .update({
          notary_name: book.notary_name,
          jurisdiction: book.jurisdiction,
          is_active: book.is_active,
        })
        .eq("id", existingBook.id);

      if (updateError) {
        throw new Error(
          `Failed to update notarial book for ${book.branch_code}: ${updateError.message}`
        );
      }

      console.log(
        `Updated book: ${book.branch_code} — Book ${book.book_no}, Series of ${book.series_year} [${existingBook.id}]`
      );
    } else {
      const { data: insertedBook, error: insertError } = await supabase
        .from("notarial_books")
        .insert({
          branch_id: branchId,
          notary_name: book.notary_name,
          jurisdiction: book.jurisdiction,
          book_no: book.book_no,
          series_year: book.series_year,
          is_active: book.is_active,
        })
        .select("id")
        .single();

      if (insertError || !insertedBook) {
        throw new Error(
          `Failed to insert notarial book for ${book.branch_code}: ${insertError?.message ?? "No data returned"}`
        );
      }

      console.log(
        `Inserted book: ${book.branch_code} — Book ${book.book_no}, Series of ${book.series_year} [${insertedBook.id}]`
      );
    }
  }

  console.log("Phase 1 seed completed successfully.");
}

seed().catch((err) => {
  console.error("Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
