import { SkeletonBlock } from "@/components/Skeletons";

export default function BranchRegisterPrintLoading() {
  return (
    <div className="min-h-screen bg-[#F7F4EE] p-4 sm:p-8" aria-busy="true">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#DFD7C8] bg-white p-4 shadow-xs">
          <div className="space-y-1.5">
            <SkeletonBlock className="h-5 w-48" />
            <SkeletonBlock className="h-3.5 w-72" />
          </div>
          <div className="flex gap-2">
            <SkeletonBlock className="h-11 w-32 rounded-lg" />
            <SkeletonBlock className="h-11 w-32 rounded-lg" />
          </div>
        </div>

        <div className="rounded-xl border border-[#DFD7C8] bg-white p-6 shadow-xs">
          <SkeletonBlock className="mb-4 h-6 w-72" />
          <div className="space-y-3">
            {Array.from({ length: 5 }, (_, idx) => (
              <SkeletonBlock key={idx} className="h-14 w-full rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
