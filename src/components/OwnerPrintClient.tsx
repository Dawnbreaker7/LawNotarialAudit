"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Maximize2, Minimize2, Printer } from "lucide-react";
import RegisterPrintSheet, {
  ENTRIES_PER_PAGE,
  ScaledPrintPreview,
} from "@/components/RegisterPrintSheet";
import type { AuditBookOption, AuditEntryItem } from "@/lib/owner/audit";
import type { OperatingBranchCode } from "@/types/database";

interface OwnerPrintClientProps {
  books: AuditBookOption[];
  entries: AuditEntryItem[];
  initialBranchCode?: OperatingBranchCode;
  initialBookId?: string;
}

export default function OwnerPrintClient({
  books,
  entries,
  initialBranchCode = "GENSAN",
  initialBookId,
}: OwnerPrintClientProps) {
  const initialBook =
    books.find((b) => b.id === initialBookId) ??
    books.find((b) => b.branch_code === initialBranchCode && b.is_active) ??
    books.find((b) => b.branch_code === initialBranchCode) ??
    books[0];

  const [selectedBranch, setSelectedBranch] = useState<OperatingBranchCode>(
    initialBook?.branch_code ?? initialBranchCode
  );
  const [selectedBookId, setSelectedBookId] = useState<string>(
    initialBook?.id ?? ""
  );
  const [selectedPage, setSelectedPage] = useState<string>("all");
  const [fitToScreen, setFitToScreen] = useState(true);

  const branchBooks = useMemo(
    () => books.filter((b) => b.branch_code === selectedBranch),
    [books, selectedBranch]
  );

  const activeBook = useMemo(
    () =>
      branchBooks.find((b) => b.id === selectedBookId) ??
      branchBooks.find((b) => b.is_active) ??
      branchBooks[0] ??
      null,
    [branchBooks, selectedBookId]
  );

  const pages = useMemo(() => {
    if (!activeBook) {
      return [{ pageNo: 2, entries: [] as AuditEntryItem[] }];
    }

    const bookEntries = entries
      .filter((e) => e.book_id === activeBook.id)
      .sort((a, b) => a.entry_number - b.entry_number);

    const byPage = new Map<number, AuditEntryItem[]>();
    for (const entry of bookEntries) {
      if (entry.page_no < 2 || entry.page_no > 106) continue;
      const list = byPage.get(entry.page_no) ?? [];
      list.push(entry);
      byPage.set(entry.page_no, list);
    }

    if (byPage.size === 0) {
      byPage.set(2, []);
    }

    return Array.from(byPage.entries())
      .sort(([a], [b]) => a - b)
      .map(([pageNo, pageEntries]) => ({
        pageNo,
        entries: pageEntries,
      }));
  }, [entries, activeBook]);

  const visiblePages = useMemo(() => {
    if (selectedPage === "all") return pages;
    const pageNum = Number(selectedPage);
    const matched = pages.filter((p) => p.pageNo === pageNum);
    return matched.length > 0 ? matched : pages;
  }, [pages, selectedPage]);

  function handleBranchChange(nextBranch: OperatingBranchCode) {
    setSelectedBranch(nextBranch);
    const nextBranchBooks = books.filter((b) => b.branch_code === nextBranch);
    const nextDefault =
      nextBranchBooks.find((b) => b.is_active) ?? nextBranchBooks[0];
    setSelectedBookId(nextDefault?.id ?? "");
    setSelectedPage("all");
  }

  function handleBookChange(nextBookId: string) {
    setSelectedBookId(nextBookId);
    setSelectedPage("all");
  }

  const branchName =
    selectedBranch === "GENSAN" ? "GenSan Branch" : "Malungon Branch";

  return (
    <div className="min-h-screen bg-[#F7F4EE] px-3 py-4 sm:px-4 sm:py-6 print:min-h-0 print:bg-white print:p-0">
      {/* Screen-only Toolbar */}
      <div className="mx-auto mb-4 flex max-w-[1150px] flex-col gap-3 rounded-xl border border-[#DFD7C8] bg-white p-3.5 shadow-xs print:hidden">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/owner/audit"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[#D8D0C0] bg-white px-3.5 py-2 text-sm font-medium text-[#1B2A4A] transition hover:bg-[#FAF7F1]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Master Audit
            </Link>
            <span className="inline-flex min-h-[36px] items-center rounded-full border border-[#B48A3E]/50 bg-[#1B2A4A] px-3 py-1 text-xs font-semibold text-[#F4DDA8]">
              {branchName}
            </span>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setFitToScreen((prev) => !prev)}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[#D8D0C0] bg-white px-3.5 py-2 text-sm font-medium text-[#1B2A4A] transition hover:bg-[#FAF7F1]"
            >
              {fitToScreen ? (
                <>
                  <Maximize2 className="h-4 w-4" />
                  100% Zoom
                </>
              ) : (
                <>
                  <Minimize2 className="h-4 w-4" />
                  Fit to Screen
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#1B2A4A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#121D36]"
            >
              <Printer className="h-4 w-4 text-[#DFBE78]" />
              Print / Save PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 border-t border-[#EAE3D5] pt-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Branch
            </label>
            <select
              value={selectedBranch}
              onChange={(e) =>
                handleBranchChange(e.target.value as OperatingBranchCode)
              }
              className="min-h-[44px] w-full rounded-lg border border-[#D8D0C0] bg-white px-3 py-2 text-base text-slate-900 focus:border-[#1B2A4A] focus:outline-none md:text-sm"
            >
              <option value="GENSAN">GenSan Branch</option>
              <option value="MALUNGON">Malungon Branch</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Notarial Book
            </label>
            <select
              value={activeBook?.id ?? ""}
              onChange={(e) => handleBookChange(e.target.value)}
              className="min-h-[44px] w-full rounded-lg border border-[#D8D0C0] bg-white px-3 py-2 font-mono text-base tabular-nums text-slate-900 focus:border-[#1B2A4A] focus:outline-none md:text-sm"
            >
              {branchBooks.length === 0 ? (
                <option value="">No books found</option>
              ) : (
                branchBooks.map((bk) => (
                  <option key={bk.id} value={bk.id}>
                    Book {bk.book_no} &mdash; Series {bk.series_year}
                    {bk.is_active ? " (Active)" : ""}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Register Page
            </label>
            <select
              value={selectedPage}
              onChange={(e) => setSelectedPage(e.target.value)}
              className="min-h-[44px] w-full rounded-lg border border-[#D8D0C0] bg-white px-3 py-2 font-mono text-base tabular-nums text-slate-900 focus:border-[#1B2A4A] focus:outline-none md:text-sm"
            >
              <option value="all">All Pages ({pages.length})</option>
              {pages.map((p) => {
                const first = (p.pageNo - 2) * ENTRIES_PER_PAGE + 1;
                const last = (p.pageNo - 1) * ENTRIES_PER_PAGE;
                return (
                  <option key={p.pageNo} value={String(p.pageNo)}>
                    Page {p.pageNo} (Entries {first}&ndash;{last})
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Auto-Scaled Register Sheets */}
      {visiblePages.map(({ pageNo, entries: pageEntries }) => (
        <ScaledPrintPreview
          key={`${activeBook?.id ?? "none"}-${pageNo}`}
          fitToScreen={fitToScreen}
        >
          <RegisterPrintSheet
            branchName={branchName}
            book={activeBook}
            pageNo={pageNo}
            entries={pageEntries}
          />
        </ScaledPrintPreview>
      ))}
    </div>
  );
}
