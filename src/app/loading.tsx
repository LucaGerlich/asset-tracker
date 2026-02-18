import CardSkeleton from "@/components/skeletons/CardSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <main>
      <Skeleton className="h-8 w-40" />
      <div className="mt-4 sm:mt-6 md:mt-8">
        <CardSkeleton count={3} />
      </div>
      <div className="mt-4 sm:mt-6 md:mt-8">
        {/* Chart skeleton */}
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>
    </main>
  );
}
