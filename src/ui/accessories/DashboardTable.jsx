"use client";
import React, { useEffect } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Input,
  Button,
  DropdownTrigger,
  Dropdown,
  DropdownMenu,
  DropdownItem,
  Chip,
  User,
  Pagination,
  Breadcrumbs,
  BreadcrumbItem,
  Select,
  SelectSection,
  Tooltip,
  SelectItem,
} from "@heroui/react";
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
  Active: "primary",
  Available: "success",
  Pending: "warning",
  "Lost/Stolen": "danger",
  "Out for Repair": "default",
  Archived: "default",
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
  const [filterValue, setFilterValue] = React.useState("");
  const [selectedKeys, setSelectedKeys] = React.useState(new Set([]));
  const [deleteButtonActive, setDeleteButtonActive] = React.useState(false);
  const [visibleColumns, setVisibleColumns] = React.useState(
    new Set(INITIAL_VISIBLE_COLUMNS)
  );
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [rowsPerPage, setRowsPerPage] = React.useState(20);
  const [sortDescriptor, setSortDescriptor] = React.useState({
    column: "assettag",
    direction: "ascending",
  });
  const [page, setPage] = React.useState(1);

  const hasSearchFilter = Boolean(filterValue);

  console.log("VERBINDUNG :", userAssets);

  useEffect(() => {
    if (selectedKeys.size > 0) {
      setDeleteButtonActive(true);
    } else {
      setDeleteButtonActive(false);
    }
  }, [selectedKeys]);

  const headerColumns = React.useMemo(() => {
    if (visibleColumns === "all") return columns;

    return columns?.filter((column) =>
      Array.from(visibleColumns).includes(column.uid)
    );
  }, [visibleColumns, columns]);

  const filteredItems = React.useMemo(() => {
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

  const items = React.useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredItems.slice(start, end);
  }, [page, filteredItems, rowsPerPage]);

  console.log("ITEMS:", items);

  const sortedItems = React.useMemo(() => {
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

  const renderCell = React.useCallback(
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
            <Chip
              className="capitalize"
              color={statusColorMap[stat.statustypename]}
              size="sm"
              variant="flat"
            >
              {stat ? stat.statustypename : "Unknown"}
            </Chip>
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

  const onNextPage = React.useCallback(() => {
    if (page < pages) {
      setPage(page + 1);
    }
  }, [page, pages]);

  const onPreviousPage = React.useCallback(() => {
    if (page > 1) {
      setPage(page - 1);
    }
  }, [page]);

  const onRowsPerPageChange = React.useCallback((e) => {
    setRowsPerPage(Number(e.target.value));
    setPage(1);
  }, []);

  const onSearchChange = React.useCallback((value) => {
    if (value) {
      setFilterValue(value);
      setPage(1);
    } else {
      setFilterValue("");
    }
  }, []);

  const onClear = React.useCallback(() => {
    setFilterValue("");
    setPage(1);
  }, []);

  const topContent = React.useMemo(() => {
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
                >
                  Delete Entries
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
            <Button color="primary" endContent={<PlusIcon />}>
              Add New
            </Button>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-default-400 text-small">
            Total: {data.length} Entries
          </span>
          <Select
            items={selectOptions}
            label="Rows per page:"
            placeholder={rowsPerPage.toString()}
            className="max-w-xs"
            onChange={onRowsPerPageChange}
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
    data.length,
    onSearchChange,
    deleteButtonActive,
    columns,
    rowsPerPage,
    onClear,
    selectOptions,
  ]);

  const bottomContent = React.useMemo(() => {
    return (
      <div className="py-2 px-2 flex justify-between items-center">
        <span className="w-[30%] text-small text-default-400">
          {selectedKeys === "all"
            ? "All items selected"
            : `${selectedKeys.size} of ${filteredItems.length} selected`}
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
  }, [selectedKeys, page, pages, filteredItems]);

  return (
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
      <TableBody emptyContent={"No users found"} items={sortedItems}>
        {(item) => (
          <TableRow key={item.assetid} className="bg-blue">
            {(columnKey) => (
              <TableCell>{renderCell(item, columnKey)}</TableCell>
            )}
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
