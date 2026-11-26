import { EntryListSkeleton, SkeletonBlock } from "@/components/Skeletons";

export default function OwnerBooksLoading() {
  return (
    <div
      className="space-y-6"
      aria-busy="true"
      aria-label="Loading notarial books management"
    >
      <div className="space-y-2">
        <SkeletonBlock className="h-7 w-72" />
        <SkeletonBlock className="h-4 w-96 max-w-full" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, idx) => (
          <div
            key={idx}
            className="space-y-4 rounded-xl border border-[#DFD7C8] bg-white p-5 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <SkeletonBlock className="h-6 w-40" />
              <SkeletonBlock className="h-11 w-36 rounded-lg" />
            </div>
            <EntryListSkeleton rows={3} />
          </div>
        ))}
      </div>
    </div>
  );
}
