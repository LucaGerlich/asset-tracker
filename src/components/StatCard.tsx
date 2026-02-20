"use client";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function StatCard({ href, title, value }) {
  const content = (
    <Card className="group h-auto min-h-20 w-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:min-h-24 md:min-h-28 lg:min-h-32">
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground text-xs font-medium sm:text-sm">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-primary origin-left text-xl font-bold transition-transform duration-200 group-hover:scale-105 sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl">
          {value}
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block w-full">
        {content}
      </Link>
    );
  }

  return content;
}
