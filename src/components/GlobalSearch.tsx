"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Loader2,
  Box,
  User,
  Puzzle,
  Key,
  Package,
  MapPin,
  Factory,
} from "lucide-react";

interface SearchResult {
  id: string;
  type: string;
  label: string;
  sublabel?: string;
  href: string;
}

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getTypeIcon(type: string) {
  switch (type) {
    case "asset":
      return <Box className="h-4 w-4" />;
    case "user":
      return <User className="h-4 w-4" />;
    case "accessory":
      return <Puzzle className="h-4 w-4" />;
    case "license":
      return <Key className="h-4 w-4" />;
    case "consumable":
      return <Package className="h-4 w-4" />;
    case "location":
      return <MapPin className="h-4 w-4" />;
    case "manufacturer":
      return <Factory className="h-4 w-4" />;
    default:
      return <Box className="h-4 w-4" />;
  }
}

function getTypeBadge(type: string) {
  const colors: Record<string, string> = {
    asset: "bg-blue-100 text-blue-700",
    user: "bg-green-100 text-green-700",
    accessory: "bg-purple-100 text-purple-700",
    license: "bg-yellow-100 text-yellow-700",
    consumable: "bg-orange-100 text-orange-700",
    location: "bg-teal-100 text-teal-700",
    manufacturer: "bg-pink-100 text-pink-700",
  };

  return (
    <Badge
      variant="outline"
      className={colors[type] || "bg-gray-100 text-gray-700"}
    >
      {type}
    </Badge>
  );
}

export default function GlobalSearch({
  open,
  onOpenChange,
}: GlobalSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const search = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery)}`,
      );
      const data = await response.json();
      setResults(data.results || []);
      setSelectedIndex(0);
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      search(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, search]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (results[selectedIndex]) {
          router.push(results[selectedIndex].href);
          onOpenChange(false);
        }
        break;
      case "Escape":
        onOpenChange(false);
        break;
    }
  };

  const handleResultClick = (result: SearchResult) => {
    router.push(result.href);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Global Search</DialogTitle>
        </DialogHeader>

        <div className="flex items-center border-b px-4">
          <Search className="text-muted-foreground mr-3 h-5 w-5" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search assets, users, accessories..."
            className="h-14 border-0 text-lg focus-visible:ring-0"
             
            autoFocus
          />
          {isLoading && (
            <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
          )}
        </div>

        <div className="max-h-[400px] overflow-y-auto p-2">
          {query.length > 0 && query.length < 2 && (
            <p className="text-muted-foreground py-8 text-center">
              Type at least 2 characters to search
            </p>
          )}

          {query.length >= 2 && !isLoading && results.length === 0 && (
            <p className="text-muted-foreground py-8 text-center">
              No results found for &quot;{query}&quot;
            </p>
          )}

          {results.length > 0 && (
            <div className="space-y-4">
              {Object.entries(
                results.reduce(
                  (acc, result) => {
                    if (!acc[result.type]) acc[result.type] = [];
                    acc[result.type].push(result);
                    return acc;
                  },
                  {} as Record<string, typeof results>,
                ),
              ).map(([type, items]) => (
                <div key={type} className="space-y-1">
                  <div className="text-muted-foreground text-lg font-semibold first-letter:uppercase">
                    {type}
                  </div>
                  {items.map((result) => (
                    <button
                      type="button"
                      key={`${result.type}-${result.id}`}
                      className={`flex w-full cursor-pointer items-center gap-3 rounded-lg p-3 text-left transition-colors ${
                        selectedIndex === results.indexOf(result)
                          ? "bg-neutral-100"
                          : "hover:bg-neutral-100"
                      }`}
                      onClick={() => handleResultClick(result)}
                      onMouseEnter={() =>
                        setSelectedIndex(results.indexOf(result))
                      }
                    >
                      <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-lg">
                        {getTypeIcon(result.type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{result.label}</p>
                        {result.sublabel && (
                          <p className="text-muted-foreground truncate text-sm">
                            {result.sublabel}
                          </p>
                        )}
                      </div>
                      {getTypeBadge(result.type)}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-muted-foreground flex items-center justify-between border-t px-4 py-3 text-xs">
          <div className="flex items-center gap-4">
            <span>
              <kbd className="bg-muted rounded px-1.5 py-0.5 text-xs">↑</kbd>
              <kbd className="bg-muted ml-1 rounded px-1.5 py-0.5 text-xs">
                ↓
              </kbd>
              <span className="ml-2">Navigate</span>
            </span>
            <span>
              <kbd className="bg-muted rounded px-1.5 py-0.5 text-xs">
                Enter
              </kbd>
              <span className="ml-2">Select</span>
            </span>
            <span>
              <kbd className="bg-muted rounded px-1.5 py-0.5 text-xs">Esc</kbd>
              <span className="ml-2">Close</span>
            </span>
          </div>
          <span>
            Press{" "}
            <kbd className="bg-muted rounded px-1.5 py-0.5 text-xs">⌘K</kbd> to
            open
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
