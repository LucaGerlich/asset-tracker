"use client";

import { useEffect, useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { GripVertical, X, Plus } from "lucide-react";
import { WIDGET_DEFINITIONS } from "./WidgetRegistry";

interface DashboardWidgetData {
  id: string;
  widgetType: string;
  position: number;
  visible: boolean;
  config: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Widget content components
// ---------------------------------------------------------------------------

function StatsWidget() {
  const [stats, setStats] = useState<{
    assets: number;
    accessories: number;
    users: number;
  } | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [assetsRes, accessoriesRes, usersRes] = await Promise.all([
          fetch("/api/asset/getAsset"),
          fetch("/api/accessories"),
          fetch("/api/user/getUser"),
        ]);
        const assets = await assetsRes.json();
        const accessories = await accessoriesRes.json();
        const users = await usersRes.json();
        setStats({
          assets: Array.isArray(assets) ? assets.length : 0,
          accessories: Array.isArray(accessories) ? accessories.length : 0,
          users: Array.isArray(users) ? users.length : 0,
        });
      } catch {
        setStats(null);
      }
    }
    fetchStats();
  }, []);

  if (!stats) {
    return <p className="text-muted-foreground text-sm">Loading stats...</p>;
  }

  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      <div>
        <p className="text-2xl font-bold">{stats.assets}</p>
        <p className="text-muted-foreground text-xs">Assets</p>
      </div>
      <div>
        <p className="text-2xl font-bold">{stats.accessories}</p>
        <p className="text-muted-foreground text-xs">Accessories</p>
      </div>
      <div>
        <p className="text-2xl font-bold">{stats.users}</p>
        <p className="text-muted-foreground text-xs">Users</p>
      </div>
    </div>
  );
}

function AssetsByStatusWidget() {
  return (
    <div className="flex h-24 items-center justify-center">
      <p className="text-muted-foreground text-sm">
        Asset status chart - see chart above
      </p>
    </div>
  );
}

function RecentActivityWidget() {
  const [logs, setLogs] = useState<
    Array<{ id: string; action: string; entity: string; createdAt: string }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLogs() {
      try {
        const res = await fetch(
          "/api/admin/audit-logs?page=1&pageSize=5&sortBy=createdAt&sortOrder=desc",
        );
        const data = await res.json();
        setLogs(data.data ?? []);
      } catch {
        setLogs([]);
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, []);

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading activity...</p>;
  }

  if (logs.length === 0) {
    return <p className="text-muted-foreground text-sm">No recent activity</p>;
  }

  return (
    <ul className="space-y-2">
      {logs.map((log) => (
        <li key={log.id} className="flex justify-between text-sm">
          <span className="truncate">
            <span className="font-medium">{log.action}</span>{" "}
            <span className="text-muted-foreground">{log.entity}</span>
          </span>
          <span className="text-muted-foreground ml-2 text-xs whitespace-nowrap">
            {new Date(log.createdAt).toLocaleDateString()}
          </span>
        </li>
      ))}
    </ul>
  );
}

function UpcomingMaintenanceWidget() {
  const [tasks, setTasks] = useState<
    Array<{ id: string; title: string; nextDueDate: string }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMaintenance() {
      try {
        const res = await fetch(
          "/api/maintenance?page=1&pageSize=5&sortBy=nextDueDate&sortOrder=asc",
        );
        const data = await res.json();
        setTasks(data.data ?? []);
      } catch {
        setTasks([]);
      } finally {
        setLoading(false);
      }
    }
    fetchMaintenance();
  }, []);

  if (loading) {
    return (
      <p className="text-muted-foreground text-sm">
        Loading maintenance tasks...
      </p>
    );
  }

  if (tasks.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No upcoming maintenance</p>
    );
  }

  return (
    <ul className="space-y-2">
      {tasks.map((task) => (
        <li key={task.id} className="flex justify-between text-sm">
          <span className="truncate font-medium">{task.title}</span>
          <span className="text-muted-foreground ml-2 text-xs whitespace-nowrap">
            {new Date(task.nextDueDate).toLocaleDateString()}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ExpiringLicencesWidget() {
  return (
    <div className="flex h-24 items-center justify-center">
      <p className="text-muted-foreground text-sm">
        Expiring licences - Coming soon
      </p>
    </div>
  );
}

function CostOverviewWidget() {
  return (
    <div className="flex h-24 items-center justify-center">
      <p className="text-muted-foreground text-sm">
        Cost overview - Coming soon
      </p>
    </div>
  );
}

function WidgetContent({ widgetType }: { widgetType: string }) {
  switch (widgetType) {
    case "stats":
      return <StatsWidget />;
    case "assetsByStatus":
      return <AssetsByStatusWidget />;
    case "recentActivity":
      return <RecentActivityWidget />;
    case "upcomingMaintenance":
      return <UpcomingMaintenanceWidget />;
    case "expiringLicences":
      return <ExpiringLicencesWidget />;
    case "costOverview":
      return <CostOverviewWidget />;
    default:
      return (
        <p className="text-muted-foreground text-sm">Unknown widget type</p>
      );
  }
}

// ---------------------------------------------------------------------------
// Sortable widget card
// ---------------------------------------------------------------------------

function SortableWidget({
  widget,
  onRemove,
}: {
  widget: DashboardWidgetData;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const definition = WIDGET_DEFINITIONS.find(
    (d) => d.type === widget.widgetType,
  );
  const title = definition?.title ?? widget.widgetType;

  return (
    <div ref={setNodeRef} style={style}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <div className="flex items-center gap-1">
            <button
              className="hover:bg-muted cursor-grab rounded p-1"
              {...attributes}
              {...listeners}
              aria-label="Drag to reorder"
            >
              <GripVertical className="text-muted-foreground h-4 w-4" />
            </button>
            <button
              className="hover:bg-destructive/10 rounded p-1"
              onClick={() => onRemove(widget.id)}
              aria-label="Remove widget"
            >
              <X className="text-muted-foreground h-4 w-4" />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <WidgetContent widgetType={widget.widgetType} />
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main DashboardGrid
// ---------------------------------------------------------------------------

export default function DashboardGrid() {
  const [widgets, setWidgets] = useState<DashboardWidgetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor),
  );

  const fetchWidgets = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/widgets");
      const data = await res.json();
      setWidgets((data as DashboardWidgetData[]).filter((w) => w.visible));
    } catch {
      setWidgets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWidgets();
  }, [fetchWidgets]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = widgets.findIndex((w) => w.id === active.id);
    const newIndex = widgets.findIndex((w) => w.id === over.id);

    const reordered = arrayMove(widgets, oldIndex, newIndex).map((w, i) => ({
      ...w,
      position: i,
    }));

    setWidgets(reordered);

    try {
      await fetch("/api/dashboard/widgets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          widgets: reordered.map((w) => ({
            id: w.id,
            position: w.position,
            visible: w.visible,
          })),
        }),
      });
    } catch (err) {
      console.error("Failed to save widget order:", err);
    }
  };

  const handleRemove = async (id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id));

    try {
      await fetch(`/api/dashboard/widgets?id=${id}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.error("Failed to remove widget:", err);
      fetchWidgets();
    }
  };

  const handleAdd = async (widgetType: string) => {
    try {
      const res = await fetch("/api/dashboard/widgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widgetType }),
      });

      if (res.ok) {
        await fetchWidgets();
      }
    } catch (err) {
      console.error("Failed to add widget:", err);
    }

    setDialogOpen(false);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="bg-muted h-4 w-1/2 rounded" />
            </CardHeader>
            <CardContent>
              <div className="bg-muted h-20 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Determine which widget types are already active so we can filter the add dialog
  const activeTypes = new Set(widgets.map((w) => w.widgetType));
  const availableWidgets = WIDGET_DEFINITIONS.filter(
    (d) => !activeTypes.has(d.type),
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Custom Widgets</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Widget
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Widget</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              {availableWidgets.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  All widgets have been added.
                </p>
              ) : (
                availableWidgets.map((def) => (
                  <button
                    key={def.type}
                    className="hover:bg-muted flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors"
                    onClick={() => handleAdd(def.type)}
                  >
                    <span className="text-sm font-medium">{def.title}</span>
                    <span className="text-muted-foreground text-xs">
                      {def.description}
                    </span>
                  </button>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={widgets.map((w) => w.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {widgets.map((widget) => (
              <SortableWidget
                key={widget.id}
                widget={widget}
                onRemove={handleRemove}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
