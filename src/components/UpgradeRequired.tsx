"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock } from "lucide-react";
import Link from "next/link";

interface UpgradeRequiredProps {
  feature: string;
  requiredPlan?: string;
  description?: string;
}

export function UpgradeRequired({
  feature,
  requiredPlan = "Professional",
  description,
}: UpgradeRequiredProps) {
  return (
    <Card className="border-dashed">
      <CardHeader className="text-center">
        <div className="bg-muted mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full">
          <Lock className="text-muted-foreground h-5 w-5" />
        </div>
        <CardTitle className="text-lg">{feature}</CardTitle>
        <CardDescription>
          {description ??
            `This feature is available on the ${requiredPlan} plan and above.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3">
        <Badge variant="secondary">{requiredPlan} Plan Required</Badge>
        <Button asChild size="sm">
          <Link href="/admin/settings?tab=billing">Upgrade Plan</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
