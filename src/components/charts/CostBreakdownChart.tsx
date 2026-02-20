"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CostBreakdownChartProps {
  data: Array<{
    category: string;
    assets: number;
    accessories: number;
    consumables: number;
    licences: number;
  }>;
}

export default function CostBreakdownChart({ data }: CostBreakdownChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost Breakdown by Category</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="assets" stackId="a" fill="#3b82f6" name="Assets" />
            <Bar
              dataKey="accessories"
              stackId="a"
              fill="#22c55e"
              name="Accessories"
            />
            <Bar
              dataKey="consumables"
              stackId="a"
              fill="#f59e0b"
              name="Consumables"
            />
            <Bar
              dataKey="licences"
              stackId="a"
              fill="#8b5cf6"
              name="Licences"
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
