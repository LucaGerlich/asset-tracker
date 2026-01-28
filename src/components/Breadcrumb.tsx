"use client";
import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const Breadcrumb = ({ options }) => {
  return (
    <nav aria-label="breadcrumb">
      <ol className="flex items-center gap-2 text-sm text-muted-foreground">
        {options.map((option, index) => (
          <li key={index} className="flex items-center gap-2">
            {index > 0 && <ChevronRight className="h-4 w-4" />}
            {index === options.length - 1 ? (
              <span className="font-medium text-foreground">{option.label}</span>
            ) : (
              <Link 
                href={option.href} 
                className="hover:text-foreground transition-colors"
              >
                {option.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumb;
