"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Boxes, Users, Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResult {
  type: "asset" | "user" | "consumable";
  id: string;
  label: string;
  sublabel?: string;
  href: string;
}

interface SearchTypeaheadProps {
  className?: string;
}

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  asset: { label: "Assets", icon: Boxes },
  user: { label: "Users", icon: Users },
  consumable: { label: "Consumables", icon: Package },
};

export default function SearchTypeahead({ className }: SearchTypeaheadProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build a flat list of navigable items for keyboard navigation
  const flatResults = results;

  // Group results by type for rendering
  const grouped = results.reduce<Record<string, SearchResult[]>>(
    (acc, result) => {
      if (!acc[result.type]) acc[result.type] = [];
      acc[result.type].push(result);
      return acc;
    },
    {}
  );

  const search = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery)}`
      );
      if (!response.ok) throw new Error("Search failed");
      const data = await response.json();
      setResults(data.results || []);
      setIsOpen(true);
      setSelectedIndex(-1);
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounce input
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      if (query.length === 0) setIsOpen(false);
      return;
    }

    const timer = setTimeout(() => {
      search(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, search]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navigateToResult = useCallback(
    (result: SearchResult) => {
      router.push(result.href);
      setIsOpen(false);
      setQuery("");
      setResults([]);
      inputRef.current?.blur();
    },
    [router]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          Math.min(prev + 1, flatResults.length - 1)
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && flatResults[selectedIndex]) {
          navigateToResult(flatResults[selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0 && query.length >= 2) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search..."
          className="pl-9 pr-9 h-9 text-sm"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
          {query.length >= 2 && !isLoading && results.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No results found
            </p>
          )}

          {Object.entries(grouped).length > 0 && (
            <div className="max-h-[320px] overflow-y-auto py-1">
              {Object.entries(grouped).map(([type, items]) => {
                const config = TYPE_CONFIG[type];
                if (!config) return null;
                const Icon = config.icon;

                return (
                  <div key={type}>
                    <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                      {config.label}
                    </div>
                    {items.map((result) => {
                      const flatIndex = flatResults.indexOf(result);
                      return (
                        <Link
                          key={`${result.type}-${result.id}`}
                          href={result.href}
                          onClick={(e) => {
                            e.preventDefault();
                            navigateToResult(result);
                          }}
                          onMouseEnter={() => setSelectedIndex(flatIndex)}
                          className={cn(
                            "flex flex-col gap-0.5 px-3 py-2 text-sm cursor-pointer transition-colors",
                            flatIndex === selectedIndex
                              ? "bg-accent text-accent-foreground"
                              : "hover:bg-accent hover:text-accent-foreground"
                          )}
                        >
                          <span className="font-medium truncate">
                            {result.label}
                          </span>
                          {result.sublabel && (
                            <span className="text-xs text-muted-foreground truncate">
                              {result.sublabel}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
