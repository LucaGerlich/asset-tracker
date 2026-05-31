"use client";

import { useState, useMemo } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface QuickCreateOption {
  id: string;
  label: string;
}

interface SelectWithQuickCreateProps {
  /** Current value */
  value: string;
  /** Called when a value is selected */
  onValueChange: (value: string) => void;
  /** Options to display */
  options: QuickCreateOption[];
  /** Called when a new item is created — should add it to the options */
  onItemCreated: (item: QuickCreateOption) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Label for the select */
  label?: string;
  /** HTML id for the trigger */
  id?: string;
  /** API endpoint to POST to */
  apiEndpoint: string;
  /** Field name for the name value in the POST body */
  nameField: string;
  /** Field name for the ID in the response */
  idField: string;
  /** Label shown in the quick-create dialog */
  entityLabel: string;
}

export default function SelectWithQuickCreate({
  value,
  onValueChange,
  options,
  onItemCreated,
  placeholder = "Select...",
  label: _label,
  id,
  apiEndpoint,
  nameField,
  idField,
  entityLabel,
}: SelectWithQuickCreateProps) {
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const selectedLabel = useMemo(
    () => options.find((opt) => opt.id === value)?.label,
    [options, value],
  );

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [nameField]: newName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Failed to create ${entityLabel}`);
      }
      const created = await res.json();
      const newItem: QuickCreateOption = {
        id: created[idField],
        label: created[nameField],
      };
      onItemCreated(newItem);
      onValueChange(newItem.id);
      toast.success(`${entityLabel} created`, { description: newItem.label });
      setDialogOpen(false);
      setNewName("");
    } catch (err) {
      toast.error(`Failed to create ${entityLabel}`, {
        description: (err as Error).message,
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="flex gap-1.5">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            { }
            <Button
              id={id}
              variant="outline"
              role="combobox"
              aria-expanded={open}
              aria-controls={`${id}-listbox`}
              className="h-9 flex-1 justify-between font-normal"
            >
              <span
                className={cn(
                  "truncate",
                  !selectedLabel && "text-muted-foreground",
                )}
              >
                {selectedLabel || placeholder}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[--radix-popover-trigger-width] p-0"
            align="start"
          >
            <Command>
              <CommandInput
                placeholder={`Search ${entityLabel.toLowerCase()}...`}
              />
              <CommandList id={`${id}-listbox`}>
                <CommandEmpty>
                  No {entityLabel.toLowerCase()} found.
                </CommandEmpty>
                <CommandGroup>
                  {options.map((opt) => (
                    <CommandItem
                      key={opt.id}
                      value={opt.label}
                      onSelect={() => {
                        onValueChange(opt.id);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === opt.id ? "opacity-100" : "opacity-0",
                        )}
                      />
                      {opt.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => setDialogOpen(true)}
          title={`Create new ${entityLabel}`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create {entityLabel}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="quick-create-name">{entityLabel} Name</Label>
            <Input
              id="quick-create-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={`Enter ${entityLabel.toLowerCase()} name`}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreate();
                }
              }}
               
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setNewName("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
            >
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
