import { SkeletonBlock } from "@/components/Skeletons";

export default function BranchRegisterLoading() {
  return (
    <div className="min-h-screen bg-[#F7F4EE]" aria-busy="true">
      <div className="border-b border-stone-200 bg-white/95 px-4 py-3">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2.5">
          <div className="flex gap-2">
            <SkeletonBlock className="h-11 w-40 rounded-lg" />
            <SkeletonBlock className="h-11 w-52 rounded-lg" />
          </div>
          <div className="flex gap-2">
            <SkeletonBlock className="h-11 w-56 rounded-full" />
            <SkeletonBlock className="h-11 w-40 rounded-lg" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-[#DFD7C8] bg-white p-6 shadow-xs">
          <SkeletonBlock className="mb-4 h-6 w-64" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, idx) => (
              <SkeletonBlock key={idx} className="h-11 rounded-lg" />
            ))}
          </div>
          <div className="mt-6 space-y-4">
            <SkeletonBlock className="h-24 w-full rounded-lg" />
            <SkeletonBlock className="h-24 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
