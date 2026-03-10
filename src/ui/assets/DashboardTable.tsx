"use client";
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useUrlState } from "@/hooks/useUrlState";
import { usePersistentState } from "@/hooks/usePersistentState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import {
  AssignIcon,
  PlusIcon,
  EditIcon,
  SearchIcon,
  EyeIcon,
  DeleteIcon,
  QrCode,
  Label,
  Info,
  Status,
  MoreVertical,
  ChevronDownIcon,
} from "../Icons";
import { capitalize } from "../../utils/utils";
import QRCode from "react-qr-code";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { Toaster, toast } from "sonner";
import { asset } from "@/components/testData";
import SavedFilters from "@/components/SavedFilters";
import PrintLabelDialog from "@/components/PrintLabelDialog";
import { Card, CardContent } from "@/components/ui/card";

const statusColorMap = {
  Active: "default",
  Available: "default",
  Pending: "secondary",
  "Lost/Stolen": "destructive",
  "Out for Repair": "secondary",
  Archived: "secondary",
};

const statusOptions = [
  { name: "Active", uid: "active" },
  { name: "Available", uid: "available" },
  { name: "Pending", uid: "pending" },
  { name: "Lost/Stolen", uid: "lost" },
  { name: "Out for Repair", uid: "repair" },
  { name: "Archived", uid: "archived" },
];

const INITIAL_VISIBLE_COLUMNS = [
  "assetname",
  "assettag",
  "serialnumber",
  "manufacturerid",
  "belongsto",
  "modelid",
  "statustypeid",
  "assetcategorytypeid",
  "actions",
  "locationid",
];

export default function App({
  data,
  locations,
  status,
  user,
  manufacturers,
  models,
  categories,
  columns,
  selectOptions,
  userAssets,
}) {
  // -- URL-synced state for shareable filter / pagination / sort URLs --
  const allStatusUids = statusOptions.map((s) => s.uid).join(",");
  const [urlState, setUrlState] = useUrlState({
    search: "",
    page: "1",
    pageSize: selectOptions[0].value,
    sortCol: "assettag",
    sortDir: "ascending",
    status: allStatusUids,
  });

  // Derived values from URL state
  const filterValue = urlState.search;
  const showAll = urlState.pageSize === "all";
  const page = showAll ? 1 : Number(urlState.page) || 1;
  const rowsPerPage = showAll ? Infinity : Number(urlState.pageSize) || Number(selectOptions[0].value);
  const sortDescriptor = useMemo(
    () => ({ column: urlState.sortCol, direction: urlState.sortDir }),
    [urlState.sortCol, urlState.sortDir]
  );
  const statusFilter = useMemo<Set<string>>(
    () => new Set(urlState.status ? urlState.status.split(",") : []),
    [urlState.status]
  );

  // Convenience setters that update URL state
  const setFilterValue = useCallback(
    (v: string) => setUrlState({ search: v, page: "1" }),
    [setUrlState]
  );
  const setPage = useCallback(
    (p: number) => setUrlState({ page: String(p) }),
    [setUrlState]
  );
  const setRowsPerPage = useCallback(
    (v: string) => setUrlState({ pageSize: v, page: "1" }),
    [setUrlState]
  );
  const setSortDescriptor = useCallback(
    (desc: { column: string; direction: string }) =>
      setUrlState({ sortCol: desc.column, sortDir: desc.direction }),
    [setUrlState]
  );
  const setStatusFilter = useCallback(
    (s: Set<string>) => setUrlState({ status: Array.from(s).join(",") }),
    [setUrlState]
  );

  // -- Local-only state (not shareable via URL) --
  const [selectedKeys, setSelectedKeys] = useState(new Set([]));
  const [deleteButtonActive, setDeleteButtonActive] = useState(false);
  const [persistedColumns, setPersistedColumns] = usePersistentState<string[]>(
    "columns:assets",
    INITIAL_VISIBLE_COLUMNS
  );
  const visibleColumns = useMemo(() => new Set(persistedColumns), [persistedColumns]);
  const setVisibleColumns = useCallback(
    (s: Set<string>) => setPersistedColumns(Array.from(s)),
    [setPersistedColumns]
  );
  const [assetsData, setAssetsData] = useState(data);
  const [userAssetsData, setUserAssetsData] = useState(userAssets);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [now, setNow] = useState(null);
  const [mounted, setMounted] = useState(false);
  
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isQRCodeModalOpen, setIsQRCodeModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [deleteMode, setDeleteMode] = useState("single");
  const [confirmAssigned, setConfirmAssigned] = useState(false);

  // Virtual scrolling setup for "All" mode
  const virtualScrollRef = useRef<HTMLDivElement>(null);

  const handleStatusUpdate = useCallback(
    async (assetId, statusId) => {
      try {
        const res = await fetch("/api/asset/updateStatus", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetId, statusTypeId: statusId }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || "Failed to update status");
        }
        const updated = await res.json();
        toast.success("Status updated", { description: updated.assettag });
        setAssetsData((prev) =>
          prev.map((a) => (a.assetid === assetId ? { ...a, statustypeid: updated.statustypeid } : a))
        );
      } catch (e) {
        console.error(e);
        toast.error("Status update failed", { description: e.message });
      }
    },
    [setAssetsData]
  );

  const hasSearchFilter = Boolean(filterValue);

  const handleDelete = useCallback(
    async (assetId) => {
      try {
        const response = await fetch("/api/asset/deleteAsset/", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ assetId }),
        });

        if (!response.ok) {
          toast.error("Error deleting asset");
          throw new Error("Error deleting asset");
        }

        const result = await response.json();

        toast.success(result.message, {
          description: `${assetId} deleted successfully`,
        });

        setAssetsData((prevItems) => prevItems.filter((item) => item.assetid !== assetId));
        setUserAssetsData((prev) => prev.filter((ua) => ua.assetid !== assetId));
      } catch (error) {
        toast.error("Error deleting asset", { description: error });
        console.error(error);
      }
    },
    [setAssetsData, setUserAssetsData]
  );

  const handleAssign = useCallback(
    async (assetId, userId) => {
      try {
        const response = await fetch("/api/userAssets/assign/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ assetId: assetId, userId: userId }),
        });

        if (!response.ok) {
          toast.error("Error assigning asset");
          const errorData = await response.json();
          throw new Error(errorData.error || "Error assigning asset");
        }

        const result = await response.json();
        toast.success("Entry assigned successfully");
        // Update local userAssets mapping so UI reflects change immediately
        setUserAssetsData((prev) => {
          const existing = prev.find((ua) => ua.assetid === assetId);
          if (existing) {
            return prev.map((ua) =>
              ua.assetid === assetId ? { ...ua, userid: userId, change_date: new Date().toISOString() } : ua
            );
          }
          return [
            ...prev,
            {
              userassetsid: result?.userAsset?.userassetsid || `${assetId}-${userId}`,
              assetid: assetId,
              userid: userId,
              creation_date: new Date().toISOString(),
              change_date: new Date().toISOString(),
            },
          ];
        });
        // Also reflect status = Active locally if we can resolve it
        const active = status.find((s) => s.statustypename?.toLowerCase() === "active");
        if (active) {
          setAssetsData((prev) =>
            prev.map((a) => (a.assetid === assetId ? { ...a, statustypeid: active.statustypeid } : a))
          );
        }
      } catch (error) {
        console.error("Error:", error);
      }
    },
    [setAssetsData, setUserAssetsData, status]
  );


  const handleUnassign = useCallback(
    async (assetId, userId) => {
      try {
        const response = await fetch("/api/userAssets/unassign/", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ assetId, userId }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Error unassigning asset");
        }

        const result = await response.json();
        // Remove mapping locally
        setUserAssetsData((prev) => prev.filter((ua) => ua.assetid !== assetId));
        // Reflect status = Available locally if we can resolve it
        const available = status.find((s) => s.statustypename?.toLowerCase() === "available");
        if (available) {
          setAssetsData((prev) =>
            prev.map((a) => (a.assetid === assetId ? { ...a, statustypeid: available.statustypeid } : a))
          );
        }
      } catch (error) {
        console.error("Error:", error);
      }
    },
    [setAssetsData, setUserAssetsData, status]
  );

  const handleUserSelection = (value) => {
    // Check if value is empty or null and set selectedUser accordingly
    if (!value || value.size === 0 || (typeof value === 'string' && !value)) {
      setSelectedUser(null);
    } else if (value instanceof Set) {
      // If it's a Set, get the first value
      setSelectedUser(value.values().next().value || (value as any).anchorKey);
    } else {
      // Otherwise use the value directly (string from Select)
      setSelectedUser(value);
    }
  };

  //does not work
  const qrRef = useRef(null);
  const handleDownload = useCallback(() => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (canvas) {
      const url = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = url;
      link.download = `QRCode_${selectedAsset?.assettag}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      console.error("Canvas not found");
    }
  }, [selectedAsset]);

  useEffect(() => {
    setDeleteButtonActive(selectedKeys.size > 0);
  }, [selectedKeys]);

  const handleOpenModal = useCallback(
    (asset, target) => {
      switch (target) {
        case "assign":
          setSelectedAsset(asset);
          setIsAssignModalOpen(true);
          break;
        case "status":
          setSelectedAsset(asset);
          setIsStatusModalOpen(true);
          break;
        case "delete":
          setSelectedAsset(asset);
          setDeleteMode("single");
          setIsDeleteModalOpen(true);
          break;
        case "delete-bulk":
          setSelectedAsset(null);
          setDeleteMode("bulk");
          setIsDeleteModalOpen(true);
          break;
        case "qrcode":
          setSelectedAsset(asset);
          setIsQRCodeModalOpen(true);
          break;
        case "label":
          setSelectedAsset(asset);
          setIsLabelModalOpen(true);
          break;
        default:
          break;
      }
    },
    []
  );

  const headerColumns = useMemo(() => {
    if (visibleColumns.size === columns?.length) return columns;

    return columns?.filter((column) =>
      Array.from(visibleColumns).includes(column.uid)
    );
  }, [visibleColumns, columns]);

  const filteredItems = useMemo(() => {
    let filteredAssets = [...assetsData];

    if (hasSearchFilter) {
      filteredAssets = filteredAssets.filter(
        (data) =>
          data.assetname.toLowerCase().includes(filterValue.toLowerCase()) ||
          data.assettag.toLowerCase().includes(filterValue.toLowerCase()) ||
          data.serialnumber.toLowerCase().includes(filterValue.toLowerCase())
      );
    }
    if (statusFilter.size !== statusOptions.length) {
      filteredAssets = filteredAssets.filter((asset) => {
        const assetStatus = status.find(
          (stat) => stat.statustypeid === asset.statustypeid
        );
        return (
          assetStatus &&
          statusFilter.has(assetStatus.statustypename.toLowerCase())
        );
      });
    }

    return filteredAssets;
  }, [assetsData, status, filterValue, statusFilter, hasSearchFilter]);

  const pages = Math.ceil(filteredItems.length / rowsPerPage);

  const items = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredItems.slice(start, start + rowsPerPage);
  }, [page, filteredItems, rowsPerPage]);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      let first, second;
      switch (sortDescriptor.column) {
        case "locationid":
          const locationA = locations.find(
            (loc) => loc.locationid === a.locationid
          );
          const locationB = locations.find(
            (loc) => loc.locationid === b.locationid
          );
          first = locationA ? locationA.locationname : "";
          second = locationB ? locationB.locationname : "";
          break;
        case "manufacturerid":
          const manufacturerA = manufacturers.find(
            (manu) => manu.manufacturerid === a.manufacturerid
          );
          const manufacturerB = manufacturers.find(
            (manu) => manu.manufacturerid === b.manufacturerid
          );
          first = manufacturerA ? manufacturerA.manufacturername : "";
          second = manufacturerB ? manufacturerB.manufacturername : "";
          break;
        case "modelid":
          const modelA = models.find((mod) => mod.modelid === a.modelid);
          const modelB = models.find((mod) => mod.modelid === b.modelid);
          first = modelA ? modelA.modelname : "";
          second = modelB ? modelB.modelname : "";
          break;
        case "assetcategorytypeid":
          const categoryA = categories.find(
            (cat) => cat.assetcategorytypeid === a.assetcategorytypeid
          );
          const categoryB = categories.find(
            (cat) => cat.assetcategorytypeid === b.assetcategorytypeid
          );
          first = categoryA ? categoryA.assetcategorytypename : "";
          second = categoryB ? categoryB.assetcategorytypename : "";
          break;
        case "statustypeid":
          const statusA = status.find(
            (st) => st.statustypeid === a.statustypeid
          );
          const statusB = status.find(
            (st) => st.statustypeid === b.statustypeid
          );
          first = statusA ? statusA.statustypename : "";
          second = statusB ? statusB.statustypename : "";
          break;
        case "mobile":
        case "requestable":
          first = a[sortDescriptor.column] ? 1 : 0;
          second = b[sortDescriptor.column] ? 1 : 0;
          break;
        default:
          first = a[sortDescriptor.column] || "";
          second = b[sortDescriptor.column] || "";
          break;
      }
      const cmp =
        typeof first === "string"
          ? first.localeCompare(second, undefined, {
              numeric: true,
              sensitivity: "base",
            })
          : first - second;
      return sortDescriptor.direction === "descending" ? -cmp : cmp;
    });
  }, [
    sortDescriptor,
    items,
    locations,
    manufacturers,
    models,
    status,
    categories,
  ]);

  const virtualizer = useVirtualizer({
    count: showAll ? sortedItems.length : 0,
    getScrollElement: () => virtualScrollRef.current,
    estimateSize: () => 48,
    overscan: 15,
  });

  const virtualMeasureRef = useCallback(
    (node: HTMLTableRowElement | null) => {
      if (node) {
        const index = Number(node.dataset.index);
        if (!isNaN(index)) {
          virtualizer.measureElement(node);
        }
      }
    },
    [virtualizer],
  );

  const renderCell = useCallback(
    (asset, columnKey) => {
      const cellValue = asset[columnKey];

      switch (columnKey) {
        case "assetid":
          return (
            <div className="flex flex-col">
              <p className="text-bold text-small select-all">{asset.assetid}</p>
            </div>
          );
        case "assetname":
          return (
            <div className="flex flex-col">
              <p className="text-bold text-small capitalize">
                {asset.assetname}
              </p>
            </div>
          );
        case "assettag":
          return (
            <div className="flex flex-col">
              <p className="text-bold text-small capitalize">
                {asset.assettag}
              </p>
            </div>
          );
        case "serialnumber":
          return (
            <div className="flex flex-col">
              <p className="text-bold  text-small capitalize ">
                {asset.serialnumber}
              </p>
            </div>
          );
        case "belongsto":
          const userAssetEntry = userAssetsData.find(
            (ua) => ua.assetid === asset.assetid
          );
          if (!userAssetEntry) {
            return (
              <div className="flex flex-col">
                <p className="text-bold text-small capitalize">-</p>
              </div>
            );
          }
          const belongingUser = user.find(
            (user) => user.userid === userAssetEntry.userid
          );
          const userName = belongingUser
            ? belongingUser.firstname + " " + belongingUser.lastname
            : "-";

          return (
            <div className="flex flex-col">
              <p className="text-bold text-small capitalize">{userName}</p>
            </div>
          );
        case "manufacturerid":
          const manu = manufacturers.find(
            (manu) => manu.manufacturerid === asset.manufacturerid
          );
          return (
            <div className="flex flex-col">
              <p className="text-bold text-small capitalize">
                {manu ? manu.manufacturername : "-"}
              </p>
            </div>
          );
        case "modelid":
          const mod = models.find((mod) => mod.modelid === asset.modelid);
          return (
            <div className="flex flex-col">
              <p className="text-bold text-small capitalize">
                {mod ? mod.modelname : "-"}
              </p>
            </div>
          );
        case "specs":
          return (
            <div className="flex flex-col">
              <p className="text-bold text-small capitalize">{asset.specs}</p>
            </div>
          );
        case "notes":
          return (
            <div className="flex flex-col">
              <p className="text-bold text-small capitalize">
                {asset.notes ? asset.notes : "-"}
              </p>
            </div>
          );
        case "statustypeid":
          const stat = status.find(
            (s) => s.statustypeid === asset.statustypeid
          );
          const badgeVariant = statusColorMap[stat?.statustypename] || "default";
          return (
            <Badge className="capitalize" variant={badgeVariant}>
              {stat?.statustypename || "Unknown"}
            </Badge>
          );
        case "assetcategorytypeid":
          const cat = categories.find(
            (cat) => cat.assetcategorytypeid === asset.assetcategorytypeid
          );
          return (
            <div className="flex flex-col">
              <p className="text-bold text-small capitalize">
                {cat ? cat.assetcategorytypename : "Unknown"}
              </p>
            </div>
          );
        case "requestable":
          return (
            <Badge variant={asset.requestable ? "default" : "destructive"}>
              {asset.requestable.toString()}
            </Badge>
          );
        case "mobile":
          return (
            <Badge variant={asset.mobile ? "default" : "destructive"}>
              {asset.mobile.toString()}
            </Badge>
          );
        case "locationid":
          // Find the matching location object based on the asset's locationid
          const location = locations.find(
            (loc) => loc.locationid === asset.locationid
          );
          return (
            <div className="flex flex-col">
              <p className="text-bold text-small capitalize">
                {location ? location.locationname : "Unknown"}
              </p>
            </div>
          );
        case "price":
          return (
            <div className="flex flex-col">
              <p className="text-bold text-small capitalize">
                {asset.purchaseprice + "€"}
              </p>
            </div>
          );
        case "actions":
          return (
            <div className="relative flex items-center gap-0">
              <Button
                className="text-lg text-muted-foreground cursor-pointer hover:opacity-80 h-6 w-6"
                asChild
                size="icon"
                variant="ghost"
              >
                <Link href={`assets/${asset.assetid}/`}>
                  <EyeIcon />
                </Link>
              </Button>
              <Button
                className="text-lg text-muted-foreground cursor-pointer hover:opacity-80 h-6 w-6"
                asChild
                size="icon"
                variant="ghost"
              >
                <Link href={`assets/${asset.assetid}/edit`}>
                  <EditIcon />
                </Link>
              </Button>
              <Button
                className="text-lg text-muted-foreground cursor-pointer hover:opacity-80 h-6 w-6"
                size="icon"
                variant="ghost"
                onClick={() => handleOpenModal(asset, "assign")}
                disabled={!asset.requestable}
              >
                <AssignIcon />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    className="text-lg text-muted-foreground cursor-pointer hover:opacity-80 h-6 w-6"
                    size="icon"
                    variant="ghost"
                  >
                    <MoreVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => handleOpenModal(asset, "delete")}
                  >
                    <DeleteIcon className="mr-2 h-4 w-4" />
                    Delete Item
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleOpenModal(asset, "status")}
                  >
                    <Status className="mr-2 h-4 w-4" />
                    Change Status
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleOpenModal(asset, "qrcode")}
                  >
                    <QrCode className="mr-2 h-4 w-4" />
                    Generate QR-Code
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleOpenModal(asset, "label")}
                  >
                    <Label className="mr-2 h-4 w-4" />
                    Generate Label
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        default:
          return cellValue;
      }
    },
    [
      locations,
      status,
      manufacturers,
      models,
      categories,
      user,
      userAssetsData,
      handleOpenModal,
    ]
  );

  const onRowsPerPageChange = useCallback((e) => {
    setRowsPerPage(e.target.value);
  }, [setRowsPerPage]);

  const onSearchChange = useCallback((value) => {
    setFilterValue(value);
  }, [setFilterValue]);

  const onClear = useCallback(() => {
    setFilterValue("");
  }, [setFilterValue]);

  const refreshData = useCallback(async (auto = false) => {
    try {
      setIsRefreshing(true);
      const [assetsRes, userAssetsRes] = await Promise.all([
        fetch("/api/asset"),
        fetch("/api/userAssets"),
      ]);
      if (!assetsRes.ok) throw new Error("Failed to refresh assets");
      if (!userAssetsRes.ok) throw new Error("Failed to refresh assignments");
      const [assetsJson, userAssetsJson] = await Promise.all([
        assetsRes.json(),
        userAssetsRes.json(),
      ]);
      setAssetsData(assetsJson || []);
      setUserAssetsData(userAssetsJson || []);
      setLastUpdated(new Date());
      if (auto) {
        toast("Table refreshed");
      }
    } catch (e) {
      console.error(e);
      toast.error("Refresh failed", { description: e.message });
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Auto refresh when returning to tab or when page becomes visible
  useEffect(() => {
    const onFocus = () => refreshData(true);
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshData(true);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshData]);

  // Initialize lastUpdated and mount flag on client
  useEffect(() => {
    setLastUpdated(new Date());
    setMounted(true);
  }, []);

  // Keep a ticking clock for relative time display
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Keyboard shortcut: press "r" to refresh (ignored while typing in inputs)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== "r" && e.key !== "R") return;
      const target = e.target;
      const tag = target?.tagName?.toLowerCase();
      const isEditable = target?.isContentEditable || tag === "input" || tag === "textarea" || tag === "select";
      if (isEditable) return;
      e.preventDefault();
      refreshData();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [refreshData]);

  const formatRelativeTime = useCallback((from, to) => {
    if (!from) return "-";
    const diff = Math.max(0, Math.floor((to - from) / 1000)); // seconds
    if (diff < 5) return "just now";
    if (diff < 60) return `${diff}s ago`;
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }, []);

  const topContent = useMemo(() => {
    const handleStatusToggle = (statusUid: string) => {
      const currentFilter = new Set(statusFilter);
      if (currentFilter.has(statusUid)) {
        currentFilter.delete(statusUid);
      } else {
        currentFilter.add(statusUid);
      }
      setStatusFilter(currentFilter);
    };

    const handleColumnToggle = (columnUid: string) => {
      const currentColumns = new Set(visibleColumns);
      if (currentColumns.has(columnUid)) {
        currentColumns.delete(columnUid);
      } else {
        currentColumns.add(columnUid);
      }
      setVisibleColumns(currentColumns);
    };

    const currentStatusSet = statusFilter;
    const currentColumnsSet = visibleColumns;

    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-between gap-3 items-end">
          <div className="relative w-full sm:max-w-[44%]">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search for an Item..."
              value={filterValue}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild className="hidden sm:flex">
                <Button variant="outline">
                  Status
                  <ChevronDownIcon className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {statusOptions.map((status) => (
                  <DropdownMenuItem
                    key={status.uid}
                    className="capitalize"
                    onSelect={(e) => {
                      e.preventDefault();
                      handleStatusToggle(status.uid);
                    }}
                  >
                    <Checkbox
                      checked={currentStatusSet.has(status.uid)}
                      onCheckedChange={() => handleStatusToggle(status.uid)}
                      className="mr-2"
                    />
                    {capitalize(status.name)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild className="hidden sm:flex">
                <Button variant="outline">
                  Columns
                  <ChevronDownIcon className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {columns.map((column) => (
                  <DropdownMenuItem
                    key={column.uid}
                    className="capitalize"
                    onSelect={(e) => {
                      e.preventDefault();
                      handleColumnToggle(column.uid);
                    }}
                  >
                    <Checkbox
                      checked={currentColumnsSet.has(column.uid)}
                      onCheckedChange={() => handleColumnToggle(column.uid)}
                      className="mr-2"
                    />
                    {capitalize(column.name)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <SavedFilters
              entity="asset"
              currentFilters={{
                search: filterValue,
                statuses: Array.from(statusFilter),
                columns: Array.from(visibleColumns),
              }}
              onApplyFilter={(filters: Record<string, unknown>) => {
                if (filters.search !== undefined) setFilterValue(filters.search as string);
                if (filters.statuses) setStatusFilter(new Set(filters.statuses as string[]));
                if (filters.columns) setVisibleColumns(new Set(filters.columns as string[]));
              }}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={!deleteButtonActive}>
                  Bulk Edit
                  <ChevronDownIcon className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Edit Entries</DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => handleOpenModal(null, "delete-bulk")}
                >
                  Delete Entries
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" onClick={() => refreshData()} disabled={isRefreshing}>
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </Button>
            <Button asChild>
              <Link href="assets/create/">
                <PlusIcon className="mr-2 h-4 w-4" />
                Add New
              </Link>
            </Button>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">
            Total: {assetsData.length} Entries
          </span>
          <span className="text-sm text-muted-foreground" suppressHydrationWarning>
            Last updated: {mounted && now ? formatRelativeTime(lastUpdated, now) : "-"}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page:</span>
            <Select value={showAll ? "all" : String(rowsPerPage)} onValueChange={(value) => { setRowsPerPage(value); }}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {selectOptions.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    );
  }, [
    filterValue,
    statusFilter,
    visibleColumns,
    onSearchChange,
    deleteButtonActive,
    columns,
    rowsPerPage,
    assetsData.length,
    selectOptions,
    handleOpenModal,
    isRefreshing,
    refreshData,
    mounted,
    now,
    lastUpdated,
    formatRelativeTime,
  ]);

  const bottomContent = useMemo(() => {
    return (
      <div className="flex items-center justify-between px-2 py-2">
        <span className="text-sm text-muted-foreground">
          {selectedKeys.size === assetsData.length && assetsData.length > 0
            ? "All items selected"
            : `${selectedKeys.size} of ${assetsData.length} selected`}
        </span>
        {!showAll && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {page} of {pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(pages, page + 1))}
              disabled={page === pages}
            >
              Next
            </Button>
          </div>
        )}
        {showAll && (
          <span className="text-sm text-muted-foreground">
            Showing all {filteredItems.length} entries (virtual scroll)
          </span>
        )}
      </div>
    );
  }, [selectedKeys, page, pages, assetsData.length, showAll, filteredItems.length]);

  return (
    <div className="w-full space-y-4">
      {topContent}
      {/* Mobile: Card view */}
      <div className="block lg:hidden space-y-3">
        {sortedItems.length === 0 ? (
          <div className="rounded-md border p-8 text-center">
            <p className="text-sm text-muted-foreground">No assets found</p>
          </div>
        ) : (
          sortedItems.map((item) => {
            const stat = status.find((s) => s.statustypeid === item.statustypeid);
            const cat = categories.find((c) => c.assetcategorytypeid === item.assetcategorytypeid);
            const loc = locations.find((l) => l.locationid === item.locationid);
            const manu = manufacturers.find((m) => m.manufacturerid === item.manufacturerid);
            const userAssetEntry = userAssetsData.find((ua) => ua.assetid === item.assetid);
            const assignedUser = userAssetEntry ? user.find((u) => u.userid === userAssetEntry.userid) : null;
            const badgeVariant = statusColorMap[stat?.statustypename] || "default";

            return (
              <Card key={item.assetid} className="overflow-hidden">
                <CardContent className="px-4 py-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0 flex-1">
                      <Link href={`assets/${item.assetid}/`} className="font-semibold text-sm hover:underline">
                        {item.assetname}
                      </Link>
                      <p className="text-xs text-muted-foreground">{item.assettag}</p>
                    </div>
                    <Badge className="capitalize shrink-0 ml-2" variant={badgeVariant}>
                      {stat?.statustypename || "Unknown"}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Serial</span>
                      <span className="truncate ml-2">{item.serialnumber}</span>
                    </div>
                    {cat && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Category</span>
                        <span>{cat.assetcategorytypename}</span>
                      </div>
                    )}
                    {loc && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Location</span>
                        <span>{loc.locationname}</span>
                      </div>
                    )}
                    {manu && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Manufacturer</span>
                        <span>{manu.manufacturername}</span>
                      </div>
                    )}
                    {assignedUser && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Assigned To</span>
                        <span>{assignedUser.firstname} {assignedUser.lastname}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-3 pt-2 border-t">
                    <Button size="sm" variant="ghost" asChild className="h-8 px-2">
                      <Link href={`assets/${item.assetid}/`}>
                        <EyeIcon className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button size="sm" variant="ghost" asChild className="h-8 px-2">
                      <Link href={`assets/${item.assetid}/edit`}>
                        <EditIcon className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2"
                      onClick={() => handleOpenModal(item, "assign")}
                      disabled={!item.requestable}
                    >
                      <AssignIcon className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-8 px-2 ml-auto">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenModal(item, "delete")} className="text-destructive focus:text-destructive">
                          <DeleteIcon className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenModal(item, "status")}>
                          <Status className="mr-2 h-4 w-4" /> Change Status
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenModal(item, "qrcode")}>
                          <QrCode className="mr-2 h-4 w-4" /> QR Code
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenModal(item, "label")}>
                          <Label className="mr-2 h-4 w-4" /> Label
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Desktop: Table view */}
      {showAll ? (
        <div
          ref={virtualScrollRef}
          className="hidden lg:block w-full overflow-auto rounded-md border"
          style={{ maxHeight: 600 }}
        >
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={sortedItems.length > 0 && sortedItems.every((i) => selectedKeys.has(i.assetid))}
                    ref={(el) => {
                      if (el) {
                        const some = sortedItems.some((i) => selectedKeys.has(i.assetid));
                        const all = sortedItems.length > 0 && sortedItems.every((i) => selectedKeys.has(i.assetid));
                        (el as unknown as HTMLInputElement).indeterminate = some && !all;
                      }
                    }}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedKeys(new Set(sortedItems.map((i) => i.assetid)));
                      } else {
                        setSelectedKeys(new Set());
                      }
                    }}
                  />
                </TableHead>
                {headerColumns.map((column) => (
                  <TableHead
                    key={column.uid}
                    className={column.uid === "actions" ? "text-center" : ""}
                  >
                    {column.name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={headerColumns.length + 1} className="text-center">
                    No assets found
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {virtualizer.getVirtualItems().length > 0 && (
                    <tr>
                      <td
                        colSpan={headerColumns.length + 1}
                        style={{ height: virtualizer.getVirtualItems()[0].start, padding: 0 }}
                      />
                    </tr>
                  )}
                  {virtualizer.getVirtualItems().map((virtualRow) => {
                    const item = sortedItems[virtualRow.index];
                    return (
                      <TableRow key={item.assetid} data-index={virtualRow.index} ref={virtualMeasureRef}>
                        <TableCell>
                          <Checkbox
                            checked={selectedKeys.has(item.assetid)}
                            onCheckedChange={(checked) => {
                              const next = new Set(selectedKeys);
                              if (checked) {
                                next.add(item.assetid);
                              } else {
                                next.delete(item.assetid);
                              }
                              setSelectedKeys(next);
                            }}
                          />
                        </TableCell>
                        {headerColumns.map((column) => (
                          <TableCell key={column.uid}>
                            {renderCell(item, column.uid)}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                  {virtualizer.getVirtualItems().length > 0 && (
                    <tr>
                      <td
                        colSpan={headerColumns.length + 1}
                        style={{
                          height:
                            virtualizer.getTotalSize() -
                            virtualizer.getVirtualItems()[virtualizer.getVirtualItems().length - 1].end,
                          padding: 0,
                        }}
                      />
                    </tr>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="hidden lg:block w-full overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={sortedItems.length > 0 && sortedItems.every((i) => selectedKeys.has(i.assetid))}
                    ref={(el) => {
                      if (el) {
                        const some = sortedItems.some((i) => selectedKeys.has(i.assetid));
                        const all = sortedItems.length > 0 && sortedItems.every((i) => selectedKeys.has(i.assetid));
                        (el as unknown as HTMLInputElement).indeterminate = some && !all;
                      }
                    }}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedKeys(new Set(sortedItems.map((i) => i.assetid)));
                      } else {
                        setSelectedKeys(new Set());
                      }
                    }}
                  />
                </TableHead>
                {headerColumns.map((column) => (
                  <TableHead
                    key={column.uid}
                    className={column.uid === "actions" ? "text-center" : ""}
                  >
                    {column.name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={headerColumns.length + 1} className="text-center">
                    No assets found
                  </TableCell>
                </TableRow>
              ) : (
                sortedItems.map((item) => (
                  <TableRow key={item.assetid}>
                    <TableCell>
                      <Checkbox
                        checked={selectedKeys.has(item.assetid)}
                        onCheckedChange={(checked) => {
                          const next = new Set(selectedKeys);
                          if (checked) {
                            next.add(item.assetid);
                          } else {
                            next.delete(item.assetid);
                          }
                          setSelectedKeys(next);
                        }}
                      />
                    </TableCell>
                    {headerColumns.map((column) => (
                      <TableCell key={column.uid}>
                        {renderCell(item, column.uid)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
      {bottomContent}
      <Dialog
        open={isAssignModalOpen}
        onOpenChange={setIsAssignModalOpen}
      >
        <DialogContent className="sm:max-w-lg">
          {(() => {
            const assignedUser = userAssetsData.find(
              (ua) => ua.assetid === selectedAsset?.assetid
            );
            const assignedUserId = assignedUser ? assignedUser.userid : null;

            return (
              <>
                <DialogHeader>
                  <DialogTitle>
                    {assignedUser && selectedAsset
                      ? `Update User for ${selectedAsset?.assetname} from ${
                          user.find((user) => user.userid === assignedUser.userid)
                            .firstname
                        }`
                      : `Assign User to ${selectedAsset?.assetname}`}
                  </DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <Select
                    value={selectedUser ? String(selectedUser) : assignedUserId ? String(assignedUserId) : ""}
                    onValueChange={(value) => handleUserSelection(new Set([value]))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {user.map((u) => (
                        <SelectItem key={u.userid} value={String(u.userid)}>
                          {u.firstname + " " + u.lastname}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAssignModalOpen(false)}>
                    Close
                  </Button>
                  {assignedUser ? (
                    <>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          handleUnassign(
                            selectedAsset?.assetid,
                            assignedUser.userid
                          );
                          setTimeout(() => {
                            setSelectedUser(null);
                          }, 500);
                          setIsAssignModalOpen(false);
                        }}
                      >
                        Remove
                      </Button>
                      <Button
                        disabled={!selectedUser}
                        onClick={() => {
                          handleAssign(selectedAsset?.assetid, selectedUser);
                          setTimeout(() => {
                            setSelectedUser(null);
                          }, 500);
                          setIsAssignModalOpen(false);
                        }}
                      >
                        Update
                      </Button>
                    </>
                  ) : (
                    <Button
                      disabled={!selectedUser}
                      onClick={() => {
                        handleAssign(selectedAsset?.assetid, selectedUser);
                        setTimeout(() => {
                          setSelectedUser(null);
                        }, 500);
                        setIsAssignModalOpen(false);
                      }}
                    >
                      Assign
                    </Button>
                  )}
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
      <Dialog
        open={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deleteMode === "bulk"
                ? `Delete ${selectedKeys.size === assetsData.length ? assetsData.length : selectedKeys.size} selected item(s)?`
                : `Delete ${selectedAsset?.assetname || "this item"}?`}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              This action permanently removes the asset and its user assignment. This cannot be undone.
            </p>
            {deleteMode === "single" && selectedAsset ? (() => {
              const assigned = userAssetsData.find((ua) => ua.assetid === selectedAsset.assetid);
              if (!assigned) return null;
              const u = user.find((x) => x.userid === assigned.userid);
              return (
                <p className="text-sm text-destructive">This asset is currently assigned to {u ? `${u.firstname} ${u.lastname}` : "a user"}.</p>
              );
            })() : null}
            {deleteMode === "bulk" ? (() => {
              const ids = Array.from(selectedKeys);
              const assignedCount = userAssetsData.filter((ua) => ids.includes(ua.assetid)).length;
              if (!assignedCount) return null;
              return (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-destructive">{assignedCount} selected item(s) are currently assigned to users.</p>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={confirmAssigned} onCheckedChange={(checked) => setConfirmAssigned(checked === true)} />
                    I understand and want to delete them anyway
                  </label>
                </div>
              );
            })() : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMode === "bulk" && (() => {
                const ids = Array.from(selectedKeys);
                const assignedCount = userAssetsData.filter((ua) => ids.includes(ua.assetid)).length;
                return assignedCount > 0 && !confirmAssigned;
              })()}
              onClick={async () => {
                if (deleteMode === "bulk") {
                  const ids = Array.from(selectedKeys);
                  for (const id of ids) {
                    await handleDelete(id);
                  }
                  setSelectedKeys(new Set());
                  setConfirmAssigned(false);
                } else if (selectedAsset) {
                  await handleDelete(selectedAsset.assetid);
                }
                setIsDeleteModalOpen(false);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={isQRCodeModalOpen}
        onOpenChange={setIsQRCodeModalOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="bg-white text-black">
              QR-Code for {selectedAsset?.assettag}
            </DialogTitle>
          </DialogHeader>
          <div ref={qrRef} className="flex justify-center items-center bg-white py-4">
            <QRCodeCanvas
              value={`http://192.168.0.81:3000/assets/${selectedAsset?.assetid}`}
              size={256}
              bgColor={"#ffffff"}
              fgColor={"#000000"}
              level={"H"}
              includeMargin={false}
            />
          </div>
          <DialogFooter className="bg-white">
            <Button variant="outline" onClick={() => setIsQRCodeModalOpen(false)}>
              Close
            </Button>
            <Button onClick={handleDownload}>
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isStatusModalOpen}
        onOpenChange={setIsStatusModalOpen}
      >
        <DialogContent className="sm:max-w-lg">
          {(() => {
            const assignedStatus = status.find(
              (stat) => stat.statustypeid === selectedAsset?.statustypeid
            );

            const assignedUser = userAssetsData.find(
              (ua) => ua.assetid === selectedAsset?.assetid
            );

            const disabledKeys = new Set(
              assignedStatus ? [assignedStatus.statustypeid] : []
            );

            if (assignedUser) {
              const availableStatus = status.find(
                (stat) => stat.statustypename.toLowerCase() === "available"
              );
              if (availableStatus) {
                disabledKeys.add(availableStatus.statustypeid);
              }
            } else {
              const activeStatus = status.find(
                (stat) => stat.statustypename.toLowerCase() === "active"
              );
              if (activeStatus) {
                disabledKeys.add(activeStatus.statustypeid);
              }
            }

            return (
              <>
                <DialogHeader>
                  <DialogTitle>
                    {selectedAsset &&
                      `Update Status for ${selectedAsset?.assetname}`}
                  </DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <Select
                    value={selectedUser ? String(selectedUser) : assignedStatus ? String(assignedStatus.statustypeid) : ""}
                    onValueChange={(value) => setSelectedUser(value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a status" />
                    </SelectTrigger>
                    <SelectContent>
                      {status.map((s) => (
                        <SelectItem
                          key={s.statustypeid}
                          value={String(s.statustypeid)}
                          disabled={disabledKeys.has(s.statustypeid)}
                        >
                          {s?.statustypename || "Unknown"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    <Info className="inline mr-1" />
                    Note: The current status and &quot;Available&quot; status cannot be
                    selected again. If the asset is not assigned to any user, it
                    cannot be set to &quot;Active.&quot;
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsStatusModalOpen(false)}>
                    Close
                  </Button>
                  <Button
                    disabled={!selectedUser}
                    onClick={async () => {
                      await handleStatusUpdate(selectedAsset?.assetid, selectedUser);
                      setTimeout(() => setSelectedUser(null), 300);
                      setIsStatusModalOpen(false);
                    }}
                  >
                    Update
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <PrintLabelDialog
        open={isLabelModalOpen}
        onOpenChange={setIsLabelModalOpen}
        assets={selectedAsset ? [selectedAsset] : []}
        manufacturers={manufacturers}
        models={models}
        locations={locations}
        categories={categories}
      />

      <Toaster position="bottom-right" expand={false} richColors closeButton />
    </div>
  );
}
