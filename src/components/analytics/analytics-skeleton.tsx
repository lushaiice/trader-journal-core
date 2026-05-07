import { Skeleton } from "@/components/ui/skeleton";

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-lg" />
      <div className="grid lg:grid-cols-3 gap-4">
        <Skeleton className="h-56 rounded-lg lg:col-span-2" />
        <Skeleton className="h-56 rounded-lg" />
      </div>
    </div>
  );
}
