"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Printer,
} from "lucide-react";
import RegisterPrintSheet, {
  ENTRIES_PER_PAGE,
  ScaledPrintPreview,
} from "@/components/RegisterPrintSheet";
import { SkeletonBlock } from "@/components/Skeletons";
import type {
  BranchPrintSnapshot,
  BranchRegisterSnapshot,
} from "@/lib/branch/register";
import type { NotarialEntry } from "@/types/database";

const MIN_PAGE_NO = 2;
const MAX_PAGE_NO = 106;

interface PrintRegisterClientProps {
  snapshot: BranchPrintSnapshot;
}

export default function PrintRegisterClient({
  snapshot,
}: PrintRegisterClientProps) {
  const [selectedPage, setSelectedPage] = useState<string>(
    snapshot.initialSelectedPage
  );
  const [fitToScreen, setFitToScreen] = useState(true);
  const [loadingPage, setLoadingPage] = useState(false);

  const pageCacheRef = useRef<Map<number, NotarialEntry[]>>(new Map());
  const allEntriesCacheRef = useRef<NotarialEntry[] | null>(null);

  // Seed initial cache once on render
  if (
    snapshot.initialSelectedPage === "all" &&
    allEntriesCacheRef.current === null
  ) {
    allEntriesCacheRef.current = [...snapshot.entries].sort(
      (a, b) => a.entry_number - b.entry_number
    );
  } else if (snapshot.initialSelectedPage !== "all") {
    const initialNum = Number(snapshot.initialSelectedPage);
    if (
      Number.isInteger(initialNum) &&
      !pageCacheRef.current.has(initialNum)
    ) {
      pageCacheRef.current.set(
        initialNum,
        [...snapshot.entries].sort((a, b) => a.entry_number - b.entry_number)
      );
    }
  }

  const [entriesState, setEntriesState] = useState<NotarialEntry[]>(
    snapshot.entries
  );

  async function handlePageChange(nextValue: string) {
    setSelectedPage(nextValue);

    if (nextValue === "all") {
      if (allEntriesCacheRef.current) {
        setEntriesState(allEntriesCacheRef.current);
        return;
      }
      setLoadingPage(true);
      try {
        const res = await fetch("/api/branch/register?scope=book", {
          cache: "no-store",
        });
        if (res.ok) {
          const data = (await res.json()) as BranchRegisterSnapshot;
          const sorted = [...data.entries].sort(
            (a, b) => a.entry_number - b.entry_number
          );
          allEntriesCacheRef.current = sorted;
          setEntriesState(sorted);
        }
      } finally {
        setLoadingPage(false);
      }
      return;
    }

    const pageNum = Number(nextValue);
    if (
      !Number.isInteger(pageNum) ||
      pageNum < MIN_PAGE_NO ||
      pageNum > MAX_PAGE_NO
    ) {
      return;
    }

    const cached = pageCacheRef.current.get(pageNum);
    if (cached) {
      setEntriesState(cached);
      return;
    }

    setLoadingPage(true);
    try {
      const res = await fetch(
        `/api/branch/register?scope=page&page=${pageNum}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = (await res.json()) as BranchRegisterSnapshot;
        const sorted = [...data.entries].sort(
          (a, b) => a.entry_number - b.entry_number
        );
        pageCacheRef.current.set(pageNum, sorted);
        setEntriesState(sorted);
      }
    } finally {
      setLoadingPage(false);
    }
  }

  const visiblePages = useMemo(() => {
    const ascendingEntries = [...entriesState].sort(
      (a, b) => a.entry_number - b.entry_number
    );

    if (selectedPage === "all") {
      const byPage = new Map<number, NotarialEntry[]>();
      for (const entry of ascendingEntries) {
        const list = byPage.get(entry.page_no) ?? [];
        list.push(entry);
        byPage.set(entry.page_no, list);
      }
      if (byPage.size === 0) {
        byPage.set(Math.max(MIN_PAGE_NO, snapshot.latestPageNo || MIN_PAGE_NO), []);
      }
      return Array.from(byPage.entries())
        .sort(([a], [b]) => a - b)
        .map(([pageNo, pageEntries]) => ({ pageNo, entries: pageEntries }));
    }

    const parsed = Number(selectedPage);
    const pageNum =
      Number.isInteger(parsed) && parsed >= MIN_PAGE_NO && parsed <= MAX_PAGE_NO
        ? parsed
        : Math.max(MIN_PAGE_NO, snapshot.latestPageNo || MIN_PAGE_NO);
    return [
      {
        pageNo: pageNum,
        entries: ascendingEntries.filter((e) => e.page_no === pageNum),
      },
    ];
  }, [entriesState, selectedPage, snapshot.latestPageNo]);

  const branchDisplay = snapshot.branch.display_name;
  const pageOptions = useMemo(() => {
    const set = new Set<number>();
    for (const p of snapshot.availablePageNumbers) {
      if (p >= MIN_PAGE_NO && p <= MAX_PAGE_NO) set.add(p);
    }
    const selNum = Number(selectedPage);
    if (
      Number.isInteger(selNum) &&
      selNum >= MIN_PAGE_NO &&
      selNum <= MAX_PAGE_NO
    ) {
      set.add(selNum);
    }
    if (set.size === 0) {
      set.add(MIN_PAGE_NO);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [snapshot.availablePageNumbers, selectedPage]);

  const currentPageNum =
    selectedPage === "all"
      ? null
      : Math.min(
          MAX_PAGE_NO,
          Math.max(MIN_PAGE_NO, Number(selectedPage) || MIN_PAGE_NO)
        );

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
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={
                loadingPage ||
                currentPageNum === null ||
                currentPageNum <= MIN_PAGE_NO
              }
              onClick={() => {
                if (currentPageNum !== null && currentPageNum > MIN_PAGE_NO) {
                  void handlePageChange(String(currentPageNum - 1));
                }
              }}
              aria-label="Previous Page"
              className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-[#D8D0C0] bg-white px-2.5 py-2 text-xs font-semibold text-[#1B2A4A] transition hover:bg-[#FAF7F1] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </button>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <span className="shrink-0 font-medium text-[#1B2A4A]">Page:</span>
              <select
                value={selectedPage}
                onChange={(e) => void handlePageChange(e.target.value)}
                className="min-h-[44px] w-full rounded-lg border border-[#D8D0C0] bg-white px-3 py-2 font-mono text-base tabular-nums text-slate-900 focus:border-[#1B2A4A] focus:outline-none sm:w-auto sm:text-sm"
              >
                <option value="all">
                  All Pages ({pageOptions.length})
                </option>
                {pageOptions.map((pageNo) => {
                  const first = (pageNo - 2) * ENTRIES_PER_PAGE + 1;
                  const last = (pageNo - 1) * ENTRIES_PER_PAGE;
                  return (
                    <option key={pageNo} value={String(pageNo)}>
                      Page {pageNo} (Entries {first}&ndash;{last})
                    </option>
                  );
                })}
              </select>
            </label>

            <button
              type="button"
              disabled={
                loadingPage ||
                currentPageNum === null ||
                currentPageNum >= MAX_PAGE_NO
              }
              onClick={() => {
                if (currentPageNum !== null && currentPageNum < MAX_PAGE_NO) {
                  void handlePageChange(String(currentPageNum + 1));
                }
              }}
              aria-label="Next Page"
              className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-[#D8D0C0] bg-white px-2.5 py-2 text-xs font-semibold text-[#1B2A4A] transition hover:bg-[#FAF7F1] disabled:cursor-not-allowed disabled:opacity-45"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

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

      {/* Auto-Scaled Register Sheets or Skeleton */}
      {loadingPage ? (
        <div className="mx-auto max-w-[1150px] rounded-xl border border-[#DFD7C8] bg-white p-6 shadow-xs print:hidden">
          <div className="space-y-4">
            <SkeletonBlock className="h-12 w-full" />
            <SkeletonBlock className="h-[520px] w-full rounded-lg" />
          </div>
        </div>
      ) : (
        visiblePages.map(({ pageNo, entries }) => (
          <ScaledPrintPreview key={pageNo} fitToScreen={fitToScreen}>
            <RegisterPrintSheet
              branchName={branchDisplay}
              book={snapshot.book}
              pageNo={pageNo}
              entries={entries}
            />
          </ScaledPrintPreview>
        ))
      )}
    </div>
  );
}
