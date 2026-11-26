import {
  EntryListSkeleton,
  SkeletonBlock,
  TableRowsSkeleton,
} from "@/components/Skeletons";

export default function OwnerDevicesLoading() {
  return (
    <div
      className="space-y-6"
      aria-busy="true"
      aria-label="Loading authorized branch PCs and sessions"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <SkeletonBlock className="h-7 w-72" />
          <SkeletonBlock className="h-4 w-96 max-w-full" />
        </div>
        <SkeletonBlock className="h-11 w-36 rounded-lg" />
      </div>

      <div className="md:hidden">
        <EntryListSkeleton rows={4} />
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-[#DFD7C8] bg-white shadow-xs md:block">
        <table className="min-w-full divide-y divide-[#EAE3D5]">
          <thead className="bg-[#F4EFE4]">
            <tr>
              <th colSpan={6} className="px-4 py-3">
                <SkeletonBlock className="h-4 w-48" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <TableRowsSkeleton rows={5} columns={6} />
          </tbody>
        </table>
      </div>
    </div>
  );
}
