"use client";
import React, { useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EditIcon, DeleteIcon, EyeIcon } from "../ui/Icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const statusColorMap = {
  active: "default",
  paused: "destructive",
  vacation: "secondary",
};

function DashboardTable({ data, columns }) {
  const renderCell = useCallback((user, columnKey) => {
    const cellValue = user[columnKey];

    switch (columnKey) {
      case "name":
        return (
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={user.avatar} />
              <AvatarFallback>{cellValue?.charAt(0) || "U"}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{cellValue}</span>
              <span className="text-sm text-muted-foreground">{user.email}</span>
            </div>
          </div>
        );
      case "role":
        return (
          <div className="flex flex-col">
            <p className="text-sm font-medium capitalize">{cellValue}</p>
            <p className="text-sm text-muted-foreground capitalize">
              {user.team}
            </p>
          </div>
        );
      case "status":
        return (
          <Badge variant={statusColorMap[user.status]} className="capitalize">
            {cellValue}
          </Badge>
        );
      case "actions":
        return (
          <div className="relative flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-lg text-muted-foreground cursor-pointer hover:text-foreground">
                  <EyeIcon />
                </span>
              </TooltipTrigger>
              <TooltipContent>Details</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-lg text-muted-foreground cursor-pointer hover:text-foreground">
                  <EditIcon />
                </span>
              </TooltipTrigger>
              <TooltipContent>Edit user</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-lg text-destructive cursor-pointer hover:text-destructive/80">
                  <DeleteIcon />
                </span>
              </TooltipTrigger>
              <TooltipContent>Delete user</TooltipContent>
            </Tooltip>
          </div>
        );
      default:
        return cellValue;
    }
  }, []);

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
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
          {data.map((item) => (
            <TableRow key={item.id}>
              {columns.map((column) => (
                <TableCell key={column.uid}>
                  {renderCell(item, column.uid)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default DashboardTable;
