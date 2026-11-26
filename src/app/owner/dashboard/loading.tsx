import { EntryListSkeleton, SkeletonBlock } from "@/components/Skeletons";

export default function OwnerDashboardLoading() {
  return (
    <div
      className="space-y-6"
      aria-busy="true"
      aria-label="Loading owner financial and audit dashboard"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <SkeletonBlock className="h-7 w-72" />
          <SkeletonBlock className="h-4 w-80" />
        </div>
        <SkeletonBlock className="h-11 w-44 rounded-lg" />
      </div>

      {/* Review Queue Banner Skeleton */}
      <div className="rounded-xl border border-[#DFD7C8] bg-[#FBF5E8] p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <SkeletonBlock className="h-4 w-48" />
            <SkeletonBlock className="h-8 w-36" />
            <SkeletonBlock className="h-3.5 w-60" />
          </div>
          <SkeletonBlock className="h-11 w-48 rounded-lg" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, idx) => (
          <div
            key={idx}
            className="space-y-3 rounded-xl border border-[#DFD7C8] bg-white p-5 shadow-xs"
          >
            <SkeletonBlock className="h-4 w-24" />
            <SkeletonBlock className="h-8 w-32" />
            <SkeletonBlock className="h-3.5 w-40" />
          </div>
        ))}
      </div>

      {/* Branch Comparison */}
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, idx) => (
          <div
            key={idx}
            className="space-y-4 rounded-xl border border-[#DFD7C8] bg-white p-6 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <SkeletonBlock className="h-5 w-44" />
              <SkeletonBlock className="h-5 w-24" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <SkeletonBlock className="h-20 rounded-lg" />
              <SkeletonBlock className="h-20 rounded-lg" />
              <SkeletonBlock className="h-20 rounded-lg" />
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Panels */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[#DFD7C8] bg-white p-5 shadow-xs">
          <SkeletonBlock className="mb-4 h-5 w-48" />
          <EntryListSkeleton rows={3} />
        </div>
        <div className="rounded-xl border border-[#DFD7C8] bg-white p-5 shadow-xs">
          <SkeletonBlock className="mb-4 h-5 w-48" />
          <EntryListSkeleton rows={3} />
        </div>
      </div>
    </div>
  );
}
