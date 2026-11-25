"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Maximize2, Minimize2, Printer } from "lucide-react";
import RegisterPrintSheet, {
  ENTRIES_PER_PAGE,
  ScaledPrintPreview,
} from "@/components/RegisterPrintSheet";
import type { BranchRegisterSnapshot } from "@/lib/branch/register";
import type { NotarialEntry } from "@/types/database";

interface PrintRegisterClientProps {
  snapshot: BranchRegisterSnapshot;
  initialSelectedPage?: string;
}

export default function PrintRegisterClient({
  snapshot,
  initialSelectedPage,
}: PrintRegisterClientProps) {
  const pages = useMemo(() => {
    const ascendingEntries = [...snapshot.entries].sort(
      (a, b) => a.entry_number - b.entry_number
    );

    const byPage = new Map<number, NotarialEntry[]>();
    for (const entry of ascendingEntries) {
      const pageNo = entry.page_no;
      const list = byPage.get(pageNo) ?? [];
      list.push(entry);
      byPage.set(pageNo, list);
    }

    if (byPage.size === 0) {
      byPage.set(snapshot.latestPageNo || 1, []);
    }

    return Array.from(byPage.entries())
      .sort(([a], [b]) => a - b)
      .map(([pageNo, pageEntries]) => ({
        pageNo,
        entries: pageEntries,
      }));
  }, [snapshot.entries, snapshot.latestPageNo]);

  const [selectedPage, setSelectedPage] = useState<string>(
    () => initialSelectedPage ?? String(snapshot.latestPageNo || 1)
  );
  const [fitToScreen, setFitToScreen] = useState(true);

  const visiblePages = useMemo(() => {
    if (selectedPage === "all") return pages;
    const pageNum = Number(selectedPage);
    return pages.filter((p) => p.pageNo === pageNum);
  }, [pages, selectedPage]);

  const branchDisplay = snapshot.branch.display_name;

  return (
    <div className="min-h-screen bg-[#F7F4EE] px-3 py-4 sm:px-4 sm:py-6 print:min-h-0 print:bg-white print:p-0">
      {/* Screen-only Toolbar */}
      <div className="mx-auto mb-4 flex max-w-[1150px] flex-col gap-3 rounded-xl border border-[#DFD7C8] bg-white p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/branch/register"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[#D8D0C0] bg-white px-3.5 py-2 text-sm font-medium text-[#1B2A4A] transition hover:bg-[#FAF7F1]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Register
          </Link>
          <span className="inline-flex min-h-[36px] items-center rounded-full border border-[#B48A3E]/50 bg-[#1B2A4A] px-3 py-1 text-xs font-semibold text-[#F4DDA8]">
            {branchDisplay}
          </span>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <span className="shrink-0 font-medium text-[#1B2A4A]">Page:</span>
            <select
              value={selectedPage}
              onChange={(e) => setSelectedPage(e.target.value)}
              className="min-h-[44px] w-full rounded-lg border border-[#D8D0C0] bg-white px-3 py-2 font-mono text-base tabular-nums text-slate-900 focus:border-[#1B2A4A] focus:outline-none sm:w-auto sm:text-sm"
            >
              <option value="all">All Pages ({pages.length})</option>
              {pages.map((p) => {
                const first = (p.pageNo - 1) * ENTRIES_PER_PAGE + 1;
                const last = p.pageNo * ENTRIES_PER_PAGE;
                return (
                  <option key={p.pageNo} value={String(p.pageNo)}>
                    Page {p.pageNo} (Entries {first}&ndash;{last})
                  </option>
                );
              })}
            </select>
          </label>

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
            Print Register Page
          </button>
        </div>
      </div>

      {/* Auto-Scaled Register Sheets */}
      {visiblePages.map(({ pageNo, entries }) => (
        <ScaledPrintPreview key={pageNo} fitToScreen={fitToScreen}>
          <RegisterPrintSheet
            branchName={branchDisplay}
            book={snapshot.book}
            pageNo={pageNo}
            entries={entries}
          />
        </ScaledPrintPreview>
      ))}
    </div>
  );
}
