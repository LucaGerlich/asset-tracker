"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function DetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Title */}
      <Skeleton className="h-8 w-64" />

      {/* Metadata fields */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5 sm:flex-row sm:gap-4">
              <Skeleton className="h-4 w-28 shrink-0" />
              <Skeleton
                className={`h-4 ${
                  ["w-48", "w-36", "w-56", "w-32"][i % 4]
                }`}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Content area */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
