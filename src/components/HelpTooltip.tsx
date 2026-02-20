"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

interface HelpTooltipProps {
  text: string;
  side?: "top" | "right" | "bottom" | "left";
}

export default function HelpTooltip({ text, side = "top" }: HelpTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground ml-1 inline-flex items-center transition-colors"
          aria-label="Help"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs text-sm">
        <p>{text}</p>
      </TooltipContent>
    </Tooltip>
  );
}
