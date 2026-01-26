"use client";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function StatCard({ href, title, value }) {
  const content = (
    <Card className="w-full h-auto min-h-20 sm:min-h-24 md:min-h-28 lg:min-h-32">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl text-primary font-bold">
          {value}
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="w-full block">
        {content}
      </Link>
    );
  }

  return content;
}

