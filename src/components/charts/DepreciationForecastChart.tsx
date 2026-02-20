"use client";

import React from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DepreciationForecastChartProps {
  data: {
    currentTotal: number;
    projections: Array<{ year: string; value: number }>;
  };
}

export default function DepreciationForecastChart({
  data,
}: DepreciationForecastChartProps) {
  const chartData = data.projections.map((p) => ({
    ...p,
    currentReference: data.currentTotal,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Depreciation Forecast</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey="value"
              fill="#93c5fd"
              stroke="#3b82f6"
              fillOpacity={0.4}
              name="Projected Value"
            />
            <Line
              type="monotone"
              dataKey="currentReference"
              stroke="#ef4444"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name="Current Value Reference"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
