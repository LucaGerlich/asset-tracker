"use client";

import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, PolarAngleAxis, PolarGrid, Radar, RadarChart, PolarRadiusAxis} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

const COLORS = ["#2563eb", "#22c55e", "#f97316", "#14b8a6", "#a855f7", "#e11d48", "#4b5563"];

function AssetStatusChart({ data }) {
  const hasData = data?.length && data.some((item) => item.value > 0);

  if (!hasData) {
    return (
      <section className="rounded-lg border border-default-200 bg-content1 p-6">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Asset status overview</h2>
        </header>
        <p className="text-sm text-foreground-500">No assets to display yet.</p>
      </section>
    );
  }

  const total = data.reduce((sum, item) => sum + item.value, 0);
  const chartData = data.map((item) => ({
    ...item,
    percentage: total === 0 ? 0 : ((item.value / total) * 100).toFixed(1),
  }));

  const chartConfig = {
    desktop: {
      label: "Desktop",
      color: "var(--chart-1)",
    },
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>Asset status overview</CardTitle>
        <CardDescription>Total assets: {total}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[250px] px-0"
        >
          <PieChart>
            <ChartTooltip
              content={<ChartTooltipContent nameKey="value" hideLabel />}
            />
            <Pie
              data={chartData}
              dataKey="value"
              labelLine={true}
              label={({ payload, ...props }) => {
                return (
                  <text
                    cx={props.cx}
                    cy={props.cy}
                    x={props.x}
                    y={props.y}
                    textAnchor={props.textAnchor}
                    dominantBaseline={props.dominantBaseline}
                    fill="hsla(var(--foreground))"
                  >
                    {payload.value}
                  </text>
                )
              }}
              nameKey="value"
            >
              {chartData.map((sum, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
      {/* <CardFooter className="flex-col gap-2 text-sm">
        <div className="flex items-center gap-2 leading-none font-medium">
          Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Showing total visitors for the last 6 months
        </div>
      </CardFooter> */}
    </Card>



  );
}

export default AssetStatusChart;
