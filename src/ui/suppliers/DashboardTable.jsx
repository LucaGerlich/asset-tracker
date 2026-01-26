"use client";
import React, { useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EditIcon, DeleteIcon, EyeIcon } from "../Icons.jsx";

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
            <Avatar className="h-10 w-10">
              <AvatarImage src={user.avatar} alt={cellValue} />
              <AvatarFallback>{cellValue?.charAt(0) || "?"}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-medium">{cellValue}</span>
              <span className="text-sm text-muted-foreground">{user.email}</span>
            </div>
          </div>
        );
      case "role":
        return (
          <div className="flex flex-col">
            <p className="text-bold text-sm capitalize">{cellValue}</p>
            <p className="text-bold text-sm capitalize text-default-400">
              {user.team}
            </p>
          </div>
        );
      case "status":
        return (
          <Badge className="capitalize" variant={statusColorMap[user.status]}>
            {cellValue}
          </Badge>
        );
      case "actions":
        return (
          <TooltipProvider>
            <div className="relative flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-lg text-muted-foreground cursor-pointer hover:opacity-80">
                    <EyeIcon />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Details</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-lg text-muted-foreground cursor-pointer hover:opacity-80">
                    <EditIcon />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Edit user</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-lg text-destructive cursor-pointer hover:opacity-80">
                    <DeleteIcon />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Delete user</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        );
      default:
        return cellValue;
    }
  }, []);

  return (
    <div className="w-full overflow-x-auto rounded-md border">
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
                <TableCell key={column.uid}>{renderCell(item, column.uid)}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default DashboardTable;
