import {
  EntryListSkeleton,
  SkeletonBlock,
  TableRowsSkeleton,
} from "@/components/Skeletons";

export default function OwnerAuditLoading() {
  return (
    <div
      className="space-y-6"
      aria-busy="true"
      aria-label="Loading master register audit"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <SkeletonBlock className="h-7 w-64" />
          <SkeletonBlock className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex gap-2">
          <SkeletonBlock className="h-11 w-36 rounded-lg" />
          <SkeletonBlock className="h-11 w-40 rounded-lg" />
        </div>
      </div>

      {/* Filter Bar Skeleton */}
      <div className="rounded-xl border border-[#DFD7C8] bg-white p-4 shadow-xs">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, idx) => (
            <SkeletonBlock key={idx} className="h-11 rounded-lg" />
          ))}
        </div>
      </div>

      {/* KPI Totals Bar */}
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, idx) => (
          <div
            key={idx}
            className="space-y-2 rounded-xl border border-[#DFD7C8] bg-white p-4 shadow-xs"
          >
            <SkeletonBlock className="h-3.5 w-32" />
            <SkeletonBlock className="h-7 w-40" />
            <SkeletonBlock className="h-3.5 w-48" />
          </div>
        ))}
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden">
        <EntryListSkeleton rows={4} />
      </div>

      {/* Desktop Table */}
      <div className="hidden overflow-hidden rounded-xl border border-[#DFD7C8] bg-white shadow-xs md:block">
        <table className="min-w-full divide-y divide-[#EAE3D5]">
          <thead className="bg-[#F4EFE4]">
            <tr>
              <th colSpan={9} className="px-4 py-3">
                <SkeletonBlock className="h-4 w-48" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <TableRowsSkeleton rows={8} columns={9} />
          </tbody>
        </table>
      </div>
    </div>
  );
}
