"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function FormSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <div className="space-y-6">
      {/* Page title */}
      <Skeleton className="h-8 w-48" />

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent className="space-y-6">
          {Array.from({ length: fields }).map((_, i) => (
            <div key={i} className="space-y-2">
              {/* Label */}
              <Skeleton
                className={`h-4 ${["w-20", "w-28", "w-24", "w-32", "w-20", "w-28"][i % 6]}`}
              />
              {/* Input */}
              <Skeleton className="h-10 w-full" />
            </div>
          ))}

          {/* Submit button */}
          <div className="flex gap-3 pt-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-20" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
