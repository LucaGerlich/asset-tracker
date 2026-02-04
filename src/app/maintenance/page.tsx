"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench, Clock } from "lucide-react";

/**
 * Maintenance mode page
 * Display this when MAINTENANCE_MODE feature flag is enabled
 */
export default function MaintenancePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="space-y-4">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/10">
            <Wrench className="h-10 w-10 text-amber-600" />
          </div>
          <CardTitle className="text-2xl font-bold">
            Under Maintenance
          </CardTitle>
          <CardDescription className="text-lg">
            We&apos;ll be back soon!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            We&apos;re currently performing scheduled maintenance to improve your
            experience. Thank you for your patience.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Please check back shortly</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
