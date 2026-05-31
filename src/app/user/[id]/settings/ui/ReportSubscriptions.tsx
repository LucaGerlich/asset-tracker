"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Schedule {
  id: string;
  reportType: string;
  frequency: string;
  format: string;
  isActive: boolean;
  nextRunAt: string;
  lastSentAt: string | null;
}

const REPORT_TYPES = [
  { value: "summary", label: "Summary" },
  { value: "depreciation", label: "Depreciation" },
  { value: "warranty", label: "Warranty" },
  { value: "tco", label: "Total Cost of Ownership" },
];

const FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const FORMATS = [
  { value: "csv", label: "CSV" },
  { value: "xlsx", label: "Excel (XLSX)" },
];

export default function ReportSubscriptions() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newReportType, setNewReportType] = useState("summary");
  const [newFrequency, setNewFrequency] = useState("weekly");
  const [newFormat, setNewFormat] = useState("csv");

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch("/api/report-schedules");
      const data = await res.json();
      setSchedules(Array.isArray(data) ? data : []);
    } catch {
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/report-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportType: newReportType,
          frequency: newFrequency,
          format: newFormat,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to create subscription");
        return;
      }

      toast.success("Report subscription created");
      setShowForm(false);
      await fetchSchedules();
    } catch (err) {
      console.error("Failed to create subscription", err);
      toast.error("Failed to create subscription");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    setSchedules((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isActive } : s)),
    );

    try {
      const res = await fetch("/api/report-schedules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive }),
      });

      if (!res.ok) {
        toast.error("Failed to update subscription");
        await fetchSchedules();
      }
    } catch (err) {
      console.error("Failed to update subscription", err);
      toast.error("Failed to update subscription");
      await fetchSchedules();
    }
  };

  const handleDelete = async (id: string) => {
    setSchedules((prev) => prev.filter((s) => s.id !== id));

    try {
      const res = await fetch(`/api/report-schedules?id=${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        toast.error("Failed to delete subscription");
        await fetchSchedules();
      } else {
        toast.success("Subscription removed");
      }
    } catch (err) {
      console.error("Failed to delete subscription", err);
      toast.error("Failed to delete subscription");
      await fetchSchedules();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4">
        <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        <span className="text-muted-foreground text-sm">
          Loading report subscriptions...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Report Subscriptions</h3>
          <p className="text-muted-foreground text-xs">
            Receive automated reports via email
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      {showForm && (
        <div className="border-default-200 space-y-3 rounded-lg border p-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="mb-1 text-xs">Report Type</Label>
              <Select value={newReportType} onValueChange={setNewReportType}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 text-xs">Frequency</Label>
              <Select value={newFrequency} onValueChange={setNewFrequency}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 text-xs">Format</Label>
              <Select value={newFormat} onValueChange={setNewFormat}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMATS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              Create
            </Button>
          </div>
        </div>
      )}

      {schedules.length === 0 && !showForm ? (
        <p className="text-muted-foreground py-2 text-sm">
          No report subscriptions yet.
        </p>
      ) : (
        <div className="space-y-2">
          {schedules.map((schedule) => {
            const typeLabel =
              REPORT_TYPES.find((t) => t.value === schedule.reportType)
                ?.label ?? schedule.reportType;
            const freqLabel =
              FREQUENCIES.find((f) => f.value === schedule.frequency)?.label ??
              schedule.frequency;
            const formatLabel = schedule.format.toUpperCase();

            return (
              <div
                key={schedule.id}
                className="border-default-200 flex items-center justify-between rounded-lg border px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{typeLabel}</p>
                  <p className="text-muted-foreground text-xs">
                    {freqLabel} &middot; {formatLabel}
                    {schedule.nextRunAt && (
                      <>
                        {" "}
                        &middot; Next:{" "}
                        {new Date(schedule.nextRunAt).toLocaleDateString()}
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={schedule.isActive}
                    onCheckedChange={(checked) =>
                      handleToggle(schedule.id, checked)
                    }
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => handleDelete(schedule.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
