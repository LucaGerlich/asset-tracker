"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface SelectOption {
  value: string;
  label: string;
}

interface CreatableSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  /** Endpoint that accepts a POST and returns the created record. */
  createUrl: string;
  /** Human-readable noun used in the dialog copy, e.g. "category". */
  entityLabel: string;
  /** Build the POST body from the typed name (defaults to `{ name }`). */
  buildBody?: (name: string) => Record<string, unknown>;
  /** Map the create response into a selectable option. */
  parseCreated: (data: unknown) => SelectOption;
}

/**
 * A select that lets the user create a new option inline — without leaving the
 * form. Newly created options are appended locally and auto-selected. The
 * backend enforces permissions; a 403 surfaces as a toast.
 */
export function CreatableSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  required,
  disabled,
  createUrl,
  entityLabel,
  buildBody = (name) => ({ name }),
  parseCreated,
}: CreatableSelectProps) {
  const [extra, setExtra] = useState<SelectOption[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const allOptions = [...options, ...extra];
  const title = `New ${entityLabel}`;

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error(`Enter a ${entityLabel} name`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(createUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(trimmed)),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || `Failed to create ${entityLabel}`);
      }
      const data = await res.json();
      const option = parseCreated(data);
      setExtra((prev) => [...prev, option]);
      onChange(option.value);
      toast.success(`Created ${entityLabel}`, { description: option.label });
      setName("");
      setOpen(false);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : `Failed to create ${entityLabel}`,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Select
          value={value}
          onValueChange={onChange}
          required={required}
          disabled={disabled}
        >
          <SelectTrigger id={id} className="flex-1">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {allOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          onClick={() => setOpen(true)}
          title={title}
          aria-label={title}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="capitalize">{title}</DialogTitle>
            <DialogDescription>
              Add a new {entityLabel} without leaving this form.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="creatable-name">Name</Label>
            <Input
              id="creatable-name"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreate();
                }
              }}
              placeholder={`New ${entityLabel} name`}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleCreate} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
