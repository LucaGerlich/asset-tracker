"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
      {Array.from({ length: count }).map((_, i) => (
        <Card
          key={i}
          className="w-full h-auto min-h-20 sm:min-h-24 md:min-h-28 lg:min-h-32"
        >
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent className="pt-0">
            <Skeleton className="h-8 sm:h-10 md:h-12 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
