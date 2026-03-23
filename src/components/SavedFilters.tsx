"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Bookmark, Star, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

interface SavedFilter {
  id: string;
  name: string;
  entity: string;
  filters: string;
  isDefault: boolean;
  isGlobal: boolean;
}

interface SavedFiltersProps {
  entity: string;
  currentFilters: Record<string, unknown>;
  onApplyFilter: (filters: Record<string, unknown>) => void;
}

export default function SavedFilters({
  entity,
  currentFilters,
  onApplyFilter,
}: SavedFiltersProps) {
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const fetchFilters = useCallback(async () => {
    try {
      const res = await fetch(`/api/saved-filters?entity=${entity}`);
      if (res.ok) {
        const data = await res.json();
        setSavedFilters(data);
      }
    } catch {
      // Silently fail - saved filters are optional
    }
  }, [entity]);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  // Apply default filter on mount
  useEffect(() => {
    const defaultFilter = savedFilters.find((f) => f.isDefault);
    if (defaultFilter) {
      try {
        const parsed = JSON.parse(defaultFilter.filters);
        onApplyFilter(parsed);
      } catch {
        // Invalid filter data
      }
    }
    // Only on initial load of savedFilters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedFilters.length > 0]);

  const handleSave = async () => {
    if (!filterName.trim()) {
      toast.error("Please enter a filter name");
      return;
    }

    try {
      const res = await fetch("/api/saved-filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: filterName.trim(),
          entity,
          filters: currentFilters,
          isDefault,
        }),
      });

      if (!res.ok) throw new Error("Failed to save");

      toast.success("Filter saved");
      setIsDialogOpen(false);
      setFilterName("");
      setIsDefault(false);
      fetchFilters();
    } catch {
      toast.error("Failed to save filter");
    }
  };

  const handleApply = (filter: SavedFilter) => {
    try {
      const parsed = JSON.parse(filter.filters);
      onApplyFilter(parsed);
      toast.success(`Applied filter: ${filter.name}`);
    } catch {
      toast.error("Invalid filter data");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/saved-filters/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Filter deleted");
      fetchFilters();
    } catch {
      toast.error("Failed to delete filter");
    }
  };

  const handleToggleDefault = async (filter: SavedFilter) => {
    try {
      const res = await fetch(`/api/saved-filters/${filter.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: !filter.isDefault }),
      });
      if (!res.ok) throw new Error("Failed to update");
      fetchFilters();
    } catch {
      toast.error("Failed to update filter");
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Bookmark className="h-4 w-4" />
            Filters
            {savedFilters.length > 0 && (
              <span className="bg-primary/10 ml-1 rounded-full px-1.5 py-0.5 text-xs">
                {savedFilters.length}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {savedFilters.length === 0 ? (
            <div className="text-muted-foreground px-2 py-3 text-center text-sm">
              No saved filters
            </div>
          ) : (
            savedFilters.map((filter) => (
              <DropdownMenuItem
                key={filter.id}
                className="group flex items-center justify-between"
                onSelect={() => handleApply(filter)}
              >
                <span className="flex items-center gap-2 truncate">
                  {filter.isDefault && (
                    <Star className="h-3 w-3 flex-shrink-0 fill-yellow-500 text-yellow-500" />
                  )}
                  <span className="truncate">{filter.name}</span>
                </span>
                <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-auto w-auto p-0.5 hover:text-yellow-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleDefault(filter);
                    }}
                    title={
                      filter.isDefault ? "Remove default" : "Set as default"
                    }
                  >
                    <Star
                      className={`h-3 w-3 ${filter.isDefault ? "fill-yellow-500 text-yellow-500" : ""}`}
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:text-destructive h-auto w-auto p-0.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(filter.id);
                    }}
                    title="Delete filter"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </span>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setIsDialogOpen(true)}>
            <Save className="mr-2 h-4 w-4" />
            Save current filters
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Filter</DialogTitle>
            <DialogDescription>
              Save the current filter settings for quick access later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Input
                placeholder="Filter name"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="default-filter"
                checked={isDefault}
                onCheckedChange={(checked) => setIsDefault(checked === true)}
              />
              <label htmlFor="default-filter" className="text-sm">
                Set as default filter for this page
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
