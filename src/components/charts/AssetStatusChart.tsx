"use client";

import * as React from "react";
import { Label, Pie, PieChart } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

/** CSS variable chart palette — matches shadcn defaults (--chart-1 … --chart-5) plus extras */
const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-1) / 0.7)",
  "hsl(var(--chart-2) / 0.7)",
  "hsl(var(--chart-3) / 0.7)",
];

/**
 * Convert a label like "Ready to Deploy" into a slug key like "ready-to-deploy"
 * so it can be used as a chartConfig key and CSS variable name.
 */
function toKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function AssetStatusChart({
  data,
  title = "Asset status overview",
  description,
}: {
  data: Array<{ name: string; value: number }>;
  title?: string;
  description?: string;
}) {
  const hasData = data?.length && data.some((item) => item.value > 0);

  if (!hasData) {
    return (
      <Card className="flex flex-col">
        <CardHeader className="items-center pb-0">
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 items-center justify-center py-10">
          <p className="text-muted-foreground text-sm">
            No data to display yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Filter out zero-value entries so the chart only shows meaningful slices
  const activeData = data.filter((item) => item.value > 0);

  const total = activeData.reduce((sum, item) => sum + item.value, 0);

  // Build the chartConfig dynamically from the data
  const chartConfig: ChartConfig = {
    value: { label: "Count" },
  };
  activeData.forEach((item, i) => {
    const key = toKey(item.name);
    chartConfig[key] = {
      label: item.name,
      color: CHART_COLORS[i % CHART_COLORS.length],
    };
  });

  // Transform data so each item has `fill: "var(--color-key)"` for ChartContainer
  const chartData = activeData.map((item, i) => ({
    status: toKey(item.name),
    value: item.value,
    fill: `var(--color-${toKey(item.name)})`,
  }));

  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[250px]"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="status"
              innerRadius={60}
              strokeWidth={2}
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-3xl font-bold"
                        >
                          {total.toLocaleString()}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 24}
                          className="fill-muted-foreground"
                        >
                          Total
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm">
        <div className="text-muted-foreground leading-none">
          {activeData.map((d, i) => (
            <span key={d.name}>
              {i > 0 && " · "}
              {d.name}: {d.value}
            </span>
          ))}
        </div>
      </CardFooter>
    </Card>
  );
}

export default AssetStatusChart;
