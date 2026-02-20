"use client";

import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AssetLifecycleChartProps {
  data: Array<{ month: string; acquisitions: number; disposals: number }>;
}

export default function AssetLifecycleChart({
  data,
}: AssetLifecycleChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Asset Lifecycle</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey="acquisitions"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.3}
              name="Acquisitions"
            />
            <Area
              type="monotone"
              dataKey="disposals"
              stroke="#f97316"
              fill="#f97316"
              fillOpacity={0.3}
              name="Disposals"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
