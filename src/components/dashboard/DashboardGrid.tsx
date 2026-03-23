"use client";

import { useEffect, useState, useCallback, lazy, Suspense } from "react";
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
  rectSortingStrategy,
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

const AssetMap = lazy(() => import("@/components/maps/AssetMap"));

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

function StatsWidget({
  serverStats,
}: {
  serverStats?: { assets: number; accessories: number; users: number };
}) {
  if (!serverStats) {
    return <p className="text-muted-foreground text-sm">No stats available</p>;
  }

  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      <div>
        <p className="text-2xl font-bold">{serverStats.assets}</p>
        <p className="text-muted-foreground text-xs">Assets</p>
      </div>
      <div>
        <p className="text-2xl font-bold">{serverStats.accessories}</p>
        <p className="text-muted-foreground text-xs">Accessories</p>
      </div>
      <div>
        <p className="text-2xl font-bold">{serverStats.users}</p>
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
  const [licences, setLicences] = useState<
    Array<{
      licenceid: string;
      licencekey: string | null;
      licensedtoemail: string | null;
      expirationdate: string | null;
      daysUntilExpiry: number;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLicences() {
      try {
        const res = await fetch("/api/licence");
        const data = await res.json();
        if (!Array.isArray(data)) {
          setLicences([]);
          return;
        }
        const now = new Date();
        const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

        const expiring = data
          .filter((l: { expirationdate: string | null }) => {
            if (!l.expirationdate) return false;
            const exp = new Date(l.expirationdate);
            return exp >= now && exp <= in90Days;
          })
          .map(
            (l: {
              licenceid: string;
              licencekey: string | null;
              licensedtoemail: string | null;
              expirationdate: string;
            }) => {
              const exp = new Date(l.expirationdate);
              const daysUntilExpiry = Math.ceil(
                (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
              );
              return { ...l, daysUntilExpiry };
            },
          )
          .sort(
            (a: { daysUntilExpiry: number }, b: { daysUntilExpiry: number }) =>
              a.daysUntilExpiry - b.daysUntilExpiry,
          )
          .slice(0, 5);

        setLicences(expiring);
      } catch {
        setLicences([]);
      } finally {
        setLoading(false);
      }
    }
    fetchLicences();
  }, []);

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading licences...</p>;
  }

  if (licences.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No licences expiring soon</p>
    );
  }

  return (
    <ul className="space-y-2">
      {licences.map((licence) => {
        let badgeClass = "bg-blue-100 text-blue-800";
        if (licence.daysUntilExpiry < 7) {
          badgeClass = "bg-red-100 text-red-800";
        } else if (licence.daysUntilExpiry < 30) {
          badgeClass = "bg-yellow-100 text-yellow-800";
        }

        return (
          <li
            key={licence.licenceid}
            className="flex items-center justify-between text-sm"
          >
            <div className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                {licence.licencekey
                  ? licence.licencekey.length > 20
                    ? licence.licencekey.slice(0, 20) + "..."
                    : licence.licencekey
                  : "No key"}
              </span>
              <span className="text-muted-foreground block truncate text-xs">
                {licence.licensedtoemail ?? "No email"}
              </span>
            </div>
            <span
              className={`ml-2 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}
            >
              {licence.daysUntilExpiry}d
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function CostOverviewWidget() {
  const [costData, setCostData] = useState<{
    totalAssets: number;
    totalValue: number;
    avgValue: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCostData() {
      try {
        const res = await fetch("/api/asset/getAsset");
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) {
          setCostData(null);
          return;
        }
        const totalAssets = data.length;
        const totalValue = data.reduce(
          (sum: number, a: { purchaseprice: number | null }) =>
            sum + (Number(a.purchaseprice) || 0),
          0,
        );
        const avgValue = totalAssets > 0 ? totalValue / totalAssets : 0;
        setCostData({ totalAssets, totalValue, avgValue });
      } catch {
        setCostData(null);
      } finally {
        setLoading(false);
      }
    }
    fetchCostData();
  }, []);

  if (loading) {
    return (
      <p className="text-muted-foreground text-sm">Loading cost data...</p>
    );
  }

  if (!costData) {
    return (
      <p className="text-muted-foreground text-sm">No cost data available</p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Total Assets</span>
        <span className="font-medium">
          {costData.totalAssets.toLocaleString()}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Total Value</span>
        <span className="font-medium">
          $
          {costData.totalValue.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Avg. Value</span>
        <span className="font-medium">
          $
          {costData.avgValue.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      </div>
    </div>
  );
}

function formatRelativeTime(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function LastEditedWidget() {
  const [assets, setAssets] = useState<
    Array<{
      assetid: string;
      assetname: string;
      assettag: string;
      change_date: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRecentAssets() {
      try {
        const res = await fetch(
          "/api/asset?page=1&pageSize=5&sortBy=change_date&sortOrder=desc",
        );
        const data = await res.json();
        setAssets(data.data ?? []);
      } catch {
        setAssets([]);
      } finally {
        setLoading(false);
      }
    }
    fetchRecentAssets();
  }, []);

  if (loading) {
    return (
      <p className="text-muted-foreground text-sm">Loading recent edits...</p>
    );
  }

  if (assets.length === 0) {
    return <p className="text-muted-foreground text-sm">No recent edits</p>;
  }

  return (
    <ul className="space-y-2">
      {assets.map((asset) => (
        <li key={asset.assetid} className="text-sm">
          <a
            href={`/assets/${asset.assetid}`}
            className="hover:bg-muted -mx-1 flex items-center justify-between rounded px-1 py-0.5 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                {asset.assetname}
              </span>
              <span className="text-muted-foreground block truncate text-xs">
                {asset.assettag}
              </span>
            </div>
            <span className="text-muted-foreground ml-2 text-xs whitespace-nowrap">
              {asset.change_date ? formatRelativeTime(asset.change_date) : "-"}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function AssetMapWidget() {
  const [locations, setLocations] = useState<
    Array<{
      id: string;
      name: string;
      latitude: number;
      longitude: number;
      assetCount: number;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLocations() {
      try {
        const res = await fetch("/api/location");
        const data = await res.json();
        if (!Array.isArray(data)) {
          setLocations([]);
          return;
        }
        const withCoords = data
          .filter(
            (loc: { latitude?: number | null; longitude?: number | null }) =>
              loc.latitude != null && loc.longitude != null,
          )
          .map(
            (loc: {
              locationid: string;
              locationname: string;
              latitude: number;
              longitude: number;
              asset?: unknown[];
            }) => ({
              id: loc.locationid,
              name: loc.locationname,
              latitude: loc.latitude,
              longitude: loc.longitude,
              assetCount: Array.isArray(loc.asset) ? loc.asset.length : 0,
            }),
          );
        setLocations(withCoords);
      } catch {
        setLocations([]);
      } finally {
        setLoading(false);
      }
    }
    fetchLocations();
  }, []);

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading map...</p>;
  }

  return (
    <Suspense
      fallback={<p className="text-muted-foreground text-sm">Loading map...</p>}
    >
      <AssetMap locations={locations} />
    </Suspense>
  );
}

function WidgetContent({
  widgetType,
  serverStats,
}: {
  widgetType: string;
  serverStats?: { assets: number; accessories: number; users: number };
}) {
  switch (widgetType) {
    case "stats":
      return <StatsWidget serverStats={serverStats} />;
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
    case "lastEdited":
      return <LastEditedWidget />;
    case "assetMap":
      return <AssetMapWidget />;
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
  serverStats,
}: {
  widget: DashboardWidgetData;
  onRemove: (id: string) => void;
  serverStats?: { assets: number; accessories: number; users: number };
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
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-destructive/10 h-auto w-auto rounded p-1"
              onClick={() => onRemove(widget.id)}
              aria-label="Remove widget"
            >
              <X className="text-muted-foreground h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <WidgetContent
            widgetType={widget.widgetType}
            serverStats={serverStats}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main DashboardGrid
// ---------------------------------------------------------------------------

export default function DashboardGrid({
  serverStats,
}: {
  serverStats?: { assets: number; accessories: number; users: number };
} = {}) {
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
            <div className="grid max-h-[60vh] gap-3 overflow-y-auto py-4">
              {availableWidgets.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  All widgets have been added.
                </p>
              ) : (
                availableWidgets.map((def) => (
                  <Button
                    key={def.type}
                    variant="outline"
                    className="hover:bg-muted flex h-auto flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors"
                    onClick={() => handleAdd(def.type)}
                  >
                    <span className="text-sm font-medium">{def.title}</span>
                    <span className="text-muted-foreground text-xs">
                      {def.description}
                    </span>
                  </Button>
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
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {widgets.map((widget) => (
              <SortableWidget
                key={widget.id}
                widget={widget}
                onRemove={handleRemove}
                serverStats={serverStats}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
