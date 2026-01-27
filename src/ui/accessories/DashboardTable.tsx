"use client";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  ChevronDownIcon,
} from "../Icons";
import { capitalize } from "../../../utils/utils";

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
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [sortDescriptor, setSortDescriptor] = useState({
    column: "assettag",
    direction: "ascending",
  });
  const [page, setPage] = useState(1);

  const hasSearchFilter = Boolean(filterValue);

  useEffect(() => {
    if (selectedKeys.size > 0) {
      setDeleteButtonActive(true);
    } else {
      setDeleteButtonActive(false);
    }
  }, [selectedKeys]);

  const headerColumns = useMemo(() => {
    if (visibleColumns === "all") return columns;

    return columns?.filter((column) =>
      Array.from(visibleColumns).includes(column.uid)
    );
  }, [visibleColumns, columns]);

  const filteredItems = useMemo(() => {
    let filteredAssets = [...data];

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
        // Assuming 'statustypename' is the field that contains the status name in the 'status' array
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
  }, [data, status, filterValue, statusFilter, hasSearchFilter]);

  const pages = Math.ceil(filteredItems.length / rowsPerPage);

  const items = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredItems.slice(start, end);
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
          const userAssetEntry = userAssets.find(
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
            (stat) => stat.statustypeid === asset.statustypeid
          );
          return (
            <Badge className="capitalize" variant={statusColorMap[stat.statustypename]}>
              {stat ? stat.statustypename : "Unknown"}
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
        case "mobile":
          return (
            <div className="flex flex-col">
              <p className="text-bold text-small capitalize">
                {asset.mobile.toString()}
              </p>
            </div>
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
            // <div className="relative flex justify-end items-center gap-2">
            //   <Dropdown>
            //     <DropdownTrigger>
            //       <Button isIconOnly size="sm" variant="light">
            //         <VerticalDotsIcon className="text-default-300" />
            //       </Button>
            //     </DropdownTrigger>
            //     <DropdownMenu>
            //       <DropdownItem>
            //         <Link href={`assets/${asset.assetid}/`}>View</Link>
            //       </DropdownItem>
            //       <DropdownItem>
            //         <Link href={`assets/${asset.assetid}/edit/`}>Edit</Link>
            //       </DropdownItem>
            //       <DropdownItem>Delete</DropdownItem>
            //     </DropdownMenu>
            //   </Dropdown>
            // </div>
            <div className="relative flex items-center gap-2">
              <Link href={`assets/${asset.assetid}/`}>
                <span className="text-lg text-default-400 cursor-pointer active:opacity-50">
                  <EyeIcon />
                </span>
              </Link>
              <Link href={`assets/${asset.assetid}/edit`}>
                <span className="text-lg text-default-400 cursor-pointer active:opacity-50">
                  <EditIcon />
                </span>
              </Link>
              <span className="text-lg text-danger cursor-pointer active:opacity-50">
                <DeleteIcon />
              </span>
              <Link href={`assets/${asset.assetid}/edit`}>
                <span className="text-lg text-default-400 cursor-pointer active:opacity-50">
                  <AssignIcon />
                </span>
              </Link>
            </div>
          );
        default:
          return cellValue;
      }
    },
    [locations, status, manufacturers, models, categories, user, userAssets]
  );

  const onNextPage = useCallback(() => {
    if (page < pages) {
      setPage(page + 1);
    }
  }, [page, pages]);

  const onPreviousPage = useCallback(() => {
    if (page > 1) {
      setPage(page - 1);
    }
  }, [page]);

  const onRowsPerPageChange = useCallback((value) => {
    setRowsPerPage(Number(value));
    setPage(1);
  }, []);

  const onSearchChange = useCallback((e) => {
    const value = e.target.value;
    if (value) {
      setFilterValue(value);
      setPage(1);
    } else {
      setFilterValue("");
    }
  }, []);

  const topContent = useMemo(() => {
    const handleStatusToggle = (statusUid) => {
      const currentFilter = statusFilter === "all" ? new Set(statusOptions.map(s => s.uid)) : new Set(statusFilter);
      if (currentFilter.has(statusUid)) {
        currentFilter.delete(statusUid);
      } else {
        currentFilter.add(statusUid);
      }
      setStatusFilter(currentFilter.size === statusOptions.length ? "all" : currentFilter);
    };

    const handleColumnToggle = (columnUid) => {
      const currentColumns = visibleColumns === "all" ? new Set(columns.map(c => c.uid)) : new Set(visibleColumns);
      if (currentColumns.has(columnUid)) {
        currentColumns.delete(columnUid);
      } else {
        currentColumns.add(columnUid);
      }
      setVisibleColumns(currentColumns.size === columns.length ? "all" : currentColumns);
    };

    const currentStatusSet = statusFilter === "all" ? new Set(statusOptions.map(s => s.uid)) : new Set(statusFilter);
    const currentColumnsSet = visibleColumns === "all" ? new Set(columns.map(c => c.uid)) : new Set(visibleColumns);

    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-between gap-3 items-end">
          <div className="relative w-full sm:max-w-[44%]">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search for an Item..."
              value={filterValue}
              onChange={onSearchChange}
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={!deleteButtonActive}>
                  Bulk Edit
                  <ChevronDownIcon className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Edit Entries</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">
                  Delete Entries
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button>
              <PlusIcon className="mr-2 h-4 w-4" />
              Add New
            </Button>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">
            Total: {data.length} Entries
          </span>
          <Select value={String(rowsPerPage)} onValueChange={onRowsPerPageChange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Rows per page" />
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
    );
  }, [
    filterValue,
    statusFilter,
    visibleColumns,
    onRowsPerPageChange,
    data.length,
    onSearchChange,
    deleteButtonActive,
    columns,
    rowsPerPage,
    selectOptions,
  ]);

  const bottomContent = useMemo(() => {
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {selectedKeys === "all"
            ? "All items selected"
            : `${selectedKeys.size} of ${filteredItems.length} selected`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onPreviousPage}
            disabled={page === 1 || filteredItems.length === 0}
          >
            Previous
          </Button>
          <span className="text-sm">
            Page {page} of {pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={onNextPage}
            disabled={page === pages || filteredItems.length === 0}
          >
            Next
          </Button>
        </div>
        <div className="w-[30%]"></div>
      </div>
    );
  }, [selectedKeys, page, pages, filteredItems, onPreviousPage, onNextPage]);

  return (
    <div className="w-full space-y-4">
      {topContent}
      <div className="w-full overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
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
                <TableCell colSpan={headerColumns.length} className="text-center">
                  No accessories found
                </TableCell>
              </TableRow>
            ) : (
              sortedItems.map((item) => (
                <TableRow key={item.assetid}>
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
      {bottomContent}
    </div>
  );
}
