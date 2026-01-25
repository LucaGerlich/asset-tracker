"use client";
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { asset } from "@/app/components/testData";

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
  const [filterValue, setFilterValue] = useState("");
  const [selectedKeys, setSelectedKeys] = useState(new Set([]));
  const [deleteButtonActive, setDeleteButtonActive] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(
    new Set(INITIAL_VISIBLE_COLUMNS)
  );
  const [statusFilter, setStatusFilter] = useState("all");
  const [assetsData, setAssetsData] = useState(data);
  const [userAssetsData, setUserAssetsData] = useState(userAssets);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [now, setNow] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(selectOptions[0].value);
  const [sortDescriptor, setSortDescriptor] = useState({
    column: "assettag",
    direction: "ascending",
  });
  const [page, setPage] = useState(1);
  
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isQRCodeModalOpen, setIsQRCodeModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [deleteMode, setDeleteMode] = useState("single");
  const [confirmAssigned, setConfirmAssigned] = useState(false);
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
        console.log(result.message);

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
      console.log(`Assigning user ${userId} to asset ${assetId}`);

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
        console.log(result.message);
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

  // DELETE IF NOT NEEDED
  // const handleUpdate = async (device, user) => {
  //   try {
  //     // First fetch the userassetsid based on the assetid
  //     const userAssetResponse = await fetch(`/api/userAssets/findByAssetId`, {
  //       method: "GET",
  //       headers: {
  //         "Content-Type": "application/json",
  //       },
  //       body: JSON.stringify({ assetId: device }),
  //     });

  //     if (!userAssetResponse.ok) {
  //       const errorData = await userAssetResponse.json();
  //       throw new Error(errorData.error || "Error fetching UserAsset");
  //     }

  //     const userAssetData = await userAssetResponse.json();
  //     const userAssetsId = userAssetData.userAsset?.userassetsid;

  //     if (!userAssetsId) {
  //       throw new Error("UserAssets ID not found for the given asset");
  //     }

  //     const updateResponse = await fetch("/api/userAssets/update", {
  //       method: "PUT",
  //       headers: {
  //         "Content-Type": "application/json",
  //       },
  //       body: JSON.stringify({ userAssetsId, userId: user }),
  //     });

  //     if (!updateResponse.ok) {
  //       const errorData = await updateResponse.json();
  //       throw new Error(errorData.error || "Error updating UserAsset");
  //     }

  //     const result = await updateResponse.json();
  //     console.log(result.message);
  //   } catch (error) {
  //     console.error("Error:", error);
  //   }
  // };

  const handleUnassign = useCallback(
    async (assetId, userId) => {
      console.log(`Unassigning user ${userId} from asset ${assetId}`);

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
        console.log(result.message);
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
    console.log("Selected user", value);
    // Check if value is empty or null and set selectedUser accordingly
    if (!value || value.size === 0) {
      setSelectedUser(null);
    } else {
      setSelectedUser(value.anchorKey || value); // Adjust based on actual structure of `value`
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
          break;
        default:
          break;
      }
    },
    []
  );

  const headerColumns = useMemo(() => {
    if (visibleColumns === "all") return columns;

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
    if (
      statusFilter !== "all" &&
      Array.from(statusFilter).length !== statusOptions.length
    ) {
      filteredAssets = filteredAssets.filter((asset) => {
        const assetStatus = status.find(
          (stat) => stat.statustypeid === asset.statustypeid
        );
        return (
          assetStatus &&
          Array.from(statusFilter).includes(
            assetStatus.statustypename.toLowerCase()
          )
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
      handleDelete,
      handleOpenModal,
    ]
  );

  const onRowsPerPageChange = useCallback((e) => {
    setRowsPerPage(Number(e.target.value));
    setPage(1);
  }, []);

  const onSearchChange = useCallback((value) => {
    setFilterValue(value);
    setPage(1);
  }, []);

  const onClear = useCallback(() => {
    setFilterValue("");
    setPage(1);
  }, []);

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
    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-between gap-3 items-end">
          <Input
            isClearable
            className="w-full sm:max-w-[44%]"
            placeholder="Search for an Item..."
            startContent={<SearchIcon />}
            value={filterValue}
            onClear={() => onClear()}
            onValueChange={onSearchChange}
          />
          <div className="flex gap-3">
            <Dropdown>
              <DropdownTrigger className="hidden sm:flex">
                <Button
                  endContent={<ChevronDownIcon className="text-small" />}
                  variant="flat"
                >
                  Status
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                disallowEmptySelection
                aria-label="Table Columns"
                closeOnSelect={false}
                selectedKeys={statusFilter}
                selectionMode="multiple"
                onSelectionChange={setStatusFilter}
              >
                {statusOptions.map((status) => (
                  <DropdownItem key={status.uid} className="capitalize">
                    {capitalize(status.name)}
                  </DropdownItem>
                ))}
              </DropdownMenu>
            </Dropdown>
            <Dropdown>
              <DropdownTrigger className="hidden sm:flex">
                <Button
                  endContent={<ChevronDownIcon className="text-small" />}
                  variant="flat"
                >
                  Columns
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                disallowEmptySelection
                aria-label="Table Columns"
                closeOnSelect={false}
                selectedKeys={visibleColumns}
                selectionMode="multiple"
                onSelectionChange={setVisibleColumns}
              >
                {columns.map((column) => (
                  <DropdownItem key={column.uid} className="capitalize">
                    {capitalize(column.name)}
                  </DropdownItem>
                ))}
              </DropdownMenu>
            </Dropdown>
            <Dropdown>
              <DropdownTrigger>
                <Button
                  variant="bordered"
                  isDisabled={!deleteButtonActive}
                  endContent={<ChevronDownIcon className="text-small" />}
                >
                  Bulk Edit
                </Button>
              </DropdownTrigger>
              <DropdownMenu aria-label="Static Actions">
                <DropdownItem key="edit">Edit Entries</DropdownItem>
                <DropdownItem
                  key="delete"
                  className="text-danger"
                  color="danger"
                  onClick={() => handleOpenModal(null, "delete-bulk")}
                >
                  Delete Entries
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
            <Button
              variant="flat"
              isLoading={isRefreshing}
              onPress={refreshData}
            >
              Refresh
            </Button>
            <Button
              color="primary"
              endContent={<PlusIcon />}
              href={`assets/create/`}
              as={Link}
            >
              Add New
            </Button>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-default-400 text-small">
            Total: {assetsData.length} Entries
          </span>
          <span className="text-default-400 text-small" suppressHydrationWarning>
            Last updated: {mounted && now ? formatRelativeTime(lastUpdated, now) : "-"}
          </span>
          <Select
            items={selectOptions}
            label="Rows per page:"
            placeholder={rowsPerPage.toString()}
            className="max-w-xs"
            onChange={onRowsPerPageChange}
            disallowEmptySelection
            defaultSelectedKeys={["20"]}
          >
            {(selectOptions) => (
              <SelectItem key={selectOptions.value}>
                {selectOptions.label}
              </SelectItem>
            )}
          </Select>
        </div>
      </div>
    );
  }, [
    filterValue,
    statusFilter,
    visibleColumns,
    onRowsPerPageChange,
    onSearchChange,
    deleteButtonActive,
    columns,
    rowsPerPage,
    assetsData.length,
    onClear,
    selectOptions,
    handleDelete,
  ]);

  const bottomContent = useMemo(() => {
    return (
      <div className="py-2 px-2 flex justify-between items-center">
        <span className="w-[30%] text-small text-default-400">
          {selectedKeys === "all"
            ? "All items selected"
            : `${selectedKeys.size} of ${assetsData.length} selected`}
        </span>
        <Pagination
          loop
          showControls
          showShadow
          color="primary"
          page={page}
          total={pages}
          onChange={setPage}
        />
        <div className="hidden sm:flex w-[30%] justify-end gap-2"></div>
      </div>
    );
  }, [selectedKeys, page, pages, assetsData.length]);

  return (
    <>
      <Table
        aria-label="Asset Table"
        isHeaderSticky
        isStriped
        bottomContent={bottomContent}
        bottomContentPlacement="outside"
        classNames={{
          wrapper: "max-h-full",
        }}
        selectedKeys={selectedKeys}
        selectionMode="multiple"
        sortDescriptor={sortDescriptor}
        topContent={topContent}
        topContentPlacement="outside"
        onSelectionChange={setSelectedKeys}
        onSortChange={setSortDescriptor}
      >
        <TableHeader columns={headerColumns}>
          {(column) => (
            <TableColumn
              key={column.uid}
              align={column.uid === "actions" ? "center" : "start"}
              allowsSorting={column.sortable}
            >
              {column.name}
            </TableColumn>
          )}
        </TableHeader>
        <TableBody emptyContent={"No assets found"} items={sortedItems}>
          {(item) => (
            <TableRow key={item.assetid} className="bg-blue">
              {(columnKey) => (
                <TableCell>{renderCell(item, columnKey)}</TableCell>
              )}
            </TableRow>
          )}
        </TableBody>
      </Table>
      <Modal
        isOpen={isAssignModalOpen}
        onOpenChange={onAssignModalOpenChange}
        onClose={handleUserSelection}
        backdrop="blur"
        isKeyboardDismissDisabled
        hideCloseButton
        size="lg"
      >
        <ModalContent>
          {(onClose) => {
            {
              console.log(selectedAsset);
            }
            const assignedUser = userAssetsData.find(
              (ua) => ua.assetid === selectedAsset?.assetid
            );
            const assignedUserId = assignedUser ? assignedUser.userid : null;

            return (
              <>
                <ModalHeader className="flex flex-col gap-1">
                  {assignedUser && selectedAsset
                    ? `Update User for ${selectedAsset?.assetname} from ${
                        user.find((user) => user.userid === assignedUser.userid)
                          .firstname
                      }`
                    : `Assign User to ${selectedAsset?.assetname}`}
                </ModalHeader>
                <ModalBody>
                  <Select
                    items={user}
                    placeholder="Select an user"
                    className="w-full"
                    aria-label="Select an user"
                    onSelectionChange={handleUserSelection}
                    defaultSelectedKeys={assignedUserId ? [assignedUserId] : []}
                  >
                    {(user) => (
                      <SelectItem key={user.userid}>
                        {user.firstname + " " + user.lastname}
                      </SelectItem>
                    )}
                  </Select>
                </ModalBody>
                <ModalFooter>
                  <Button color="danger" variant="solid" onPress={onClose}>
                    Close
                  </Button>
                  {assignedUser ? (
                    <>
                      <Button
                        color="warning"
                        onPress={() => {
                          handleUnassign(
                            selectedAsset?.assetid,
                            assignedUser.userid
                          );
                          setTimeout(() => {
                            setSelectedUser(null);
                          }, 500);
                          onClose();
                        }}
                      >
                        {console.log(assignedUser.userid)}
                        Remove
                      </Button>
                      <Button
                        color="primary"
                        isDisabled={!selectedUser}
                        onPress={() => {
                          handleAssign(selectedAsset?.assetid, selectedUser);
                          setTimeout(() => {
                            setSelectedUser(null);
                          }, 500);
                          onClose();
                        }}
                      >
                        Update
                      </Button>
                    </>
                  ) : (
                    <Button
                      color="primary"
                      isDisabled={!selectedUser}
                      onPress={() => {
                        handleAssign(selectedAsset?.assetid, selectedUser);
                        setTimeout(() => {
                          setSelectedUser(null);
                        }, 500);
                        onClose();
                      }}
                    >
                      Assign
                    </Button>
                  )}
                </ModalFooter>
              </>
            );
          }}
        </ModalContent>
      </Modal>
      <Modal
        isOpen={isDeleteModalOpen}
        onOpenChange={onDeleteModalOpenChange}
        backdrop="blur"
        isKeyboardDismissDisabled
        hideCloseButton
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                {deleteMode === "bulk"
                  ? `Delete ${selectedKeys === "all" ? assetsData.length : selectedKeys.size} selected item(s)?`
                  : `Delete ${selectedAsset?.assetname || "this item"}?`}
              </ModalHeader>
              <ModalBody>
                <p className="text-sm text-default-500">
                  This action permanently removes the asset and its user assignment. This cannot be undone.
                </p>
                {deleteMode === "single" && selectedAsset ? (() => {
                  const assigned = userAssetsData.find((ua) => ua.assetid === selectedAsset.assetid);
                  if (!assigned) return null;
                  const u = user.find((x) => x.userid === assigned.userid);
                  return (
                    <p className="text-sm text-danger-500">This asset is currently assigned to {u ? `${u.firstname} ${u.lastname}` : "a user"}.</p>
                  );
                })() : null}
                {deleteMode === "bulk" ? (() => {
                  const ids = selectedKeys === "all" ? assetsData.map((a) => a.assetid) : Array.from(selectedKeys);
                  const assignedCount = userAssetsData.filter((ua) => ids.includes(ua.assetid)).length;
                  if (!assignedCount) return null;
                  return (
                    <div className="flex flex-col gap-2">
                      <p className="text-sm text-danger-500">{assignedCount} selected item(s) are currently assigned to users.</p>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={confirmAssigned} onChange={(e) => setConfirmAssigned(e.target.checked)} />
                        I understand and want to delete them anyway
                      </label>
                    </div>
                  );
                })() : null}
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  color="danger"
                  isDisabled={deleteMode === "bulk" && (() => {
                    const ids = selectedKeys === "all" ? assetsData.map((a) => a.assetid) : Array.from(selectedKeys);
                    const assignedCount = userAssetsData.filter((ua) => ids.includes(ua.assetid)).length;
                    return assignedCount > 0 && !confirmAssigned;
                  })()}
                  onPress={async () => {
                    if (deleteMode === "bulk") {
                      const ids = selectedKeys === "all" ? assetsData.map((a) => a.assetid) : Array.from(selectedKeys);
                      for (const id of ids) {
                        await handleDelete(id);
                      }
                      setSelectedKeys(new Set());
                      setConfirmAssigned(false);
                    } else if (selectedAsset) {
                      await handleDelete(selectedAsset.assetid);
                    }
                    onClose();
                  }}
                >
                  Delete
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
      <Modal
        isOpen={isQRCodeModalOpen}
        size="sm"
        onOpenChange={onQRCodeModalOpenChange}
        backdrop="blur"
        isKeyboardDismissDisabled
        hideCloseButton
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1 bg-white text-black">
                QR-Code for {selectedAsset?.assettag}
              </ModalHeader>
              <ModalBody className="flex justify-center items-center bg-white">
                <QRCodeCanvas
                  value={`http://192.168.0.81:3000/assets/${selectedAsset?.assetid}`}
                  size={256}
                  bgColor={"#ffffff"}
                  fgColor={"#000000"}
                  level={"H"}
                  includeMargin={false}
                />
              </ModalBody>
              <ModalFooter className="bg-white">
                <Button color="danger" onPress={onClose}>
                  Close
                </Button>
                <Button color="primary" onClick={handleDownload}>
                  Download
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <Modal
        isOpen={isStatusModalOpen}
        size="lg"
        onOpenChange={onStatusModalOpenChange}
        hideCloseButton
        backdrop="blur"
        isKeyboardDismissDisabled
      >
        <ModalContent>
          {(onClose) => {
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
                <ModalHeader className="flex flex-col gap-1">
                  {selectedAsset &&
                    `Update Status for ${selectedAsset?.assetname}`}
                </ModalHeader>
                <ModalBody>
                  <Select
                    items={status}
                    placeholder="Select a status"
                    className="w-full"
                    aria-label="Select a status"
                    onSelectionChange={handleUserSelection}
                    defaultSelectedKeys={
                      assignedStatus ? [assignedStatus.statustypeid] : []
                    }
                    disabledKeys={disabledKeys}
                  >
                    {(status) => (
                      <SelectItem
                        key={status.statustypeid}
                        className={`text-${statusColorMap[status?.statustypename] || "default"}`}
                        color={statusColorMap[status?.statustypename] || "default"}
                      >
                        {status?.statustypename || "Unknown"}
                      </SelectItem>
                    )}
                  </Select>
                  <p className="text-sm text-default-400 mt-2">
                    <Info></Info>
                    {`Note: The current status and "Available" status cannot be
                    selected again. If the asset is not assigned to any user, it
                    cannot be set to "Active."`}
                  </p>
                </ModalBody>
                <ModalFooter>
                  <Button color="danger" variant="solid" onPress={onClose}>
                    Close
                  </Button>

                  <Button
                    color="primary"
                    isDisabled={!selectedUser}
                    onPress={async () => {
                      await handleStatusUpdate(selectedAsset?.assetid, selectedUser);
                      setTimeout(() => setSelectedUser(null), 300);
                      onClose();
                    }}
                  >
                    Update
                  </Button>
                </ModalFooter>
              </>
            );
          }}
        </ModalContent>
      </Modal>

      <Toaster position="bottom-right" expand={false} richColors closeButton />
    </>
  );
}
