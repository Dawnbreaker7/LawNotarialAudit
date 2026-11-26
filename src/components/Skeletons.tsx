import type { ReactNode } from "react";

export function SkeletonBlock({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-stone-200/75 ${className}`}
    />
  );
}

export function EntryListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-[#DFD7C8]" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap gap-2">
              <SkeletonBlock className="h-5 w-24 rounded-full" />
              <SkeletonBlock className="h-5 w-28" />
              <SkeletonBlock className="h-5 w-20 rounded-full" />
            </div>
            <SkeletonBlock className="h-4 w-3/5" />
            <SkeletonBlock className="h-3.5 w-4/5" />
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <SkeletonBlock className="h-8 w-20" />
            <SkeletonBlock className="h-10 w-28 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableRowsSkeleton({
  rows = 5,
  columns = 8,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} aria-hidden="true" className="align-top">
          {Array.from({ length: columns }, (__, c) => (
            <td key={c} className="px-4 py-3.5">
              <SkeletonBlock
                className={`h-4 ${c === 0 ? "w-14" : c === columns - 1 ? "ml-auto w-24" : "w-full max-w-[140px]"}`}
              />
              {c < 3 && <SkeletonBlock className="mt-1.5 h-3 w-16" />}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function AttachmentSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="space-y-3 rounded-xl border border-[#DFD7C8] bg-[#FAF7F1] p-4"
    >
      <div className="flex gap-2">
        <SkeletonBlock className="h-9 w-36 rounded-lg" />
        <SkeletonBlock className="h-9 w-36 rounded-lg" />
      </div>
      <SkeletonBlock className="h-64 w-full rounded-lg" />
    </div>
  );
}

export function PageShellSkeleton({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading content">
      {children}
    </div>
  );
}
