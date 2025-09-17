"use client";
import React from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";

export default function StatCard({ href, title, value }) {
  const Wrapper = href ? "a" : "div";
  return (
    <Wrapper href={href} className="w-full h-28">
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-5xl text-primary pt-0">{value}</CardContent>
      </Card>
    </Wrapper>
  );
}
