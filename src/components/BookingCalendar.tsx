"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Reservation {
  id: string;
  startDate: string;
  endDate: string;
  status: string;
  user: { firstname: string; lastname: string };
  asset: { assetname: string; assettag: string };
}

export interface BookingCalendarProps {
  reservations: Reservation[];
  onDateClick?: (date: Date) => void;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  rejected: "bg-red-50 text-red-400 line-through",
};

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Build the 6-row grid of dates for a given month.
 * Each cell is a Date; cells outside the month belong to adjacent months.
 */
function buildCalendarGrid(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1);
  // JS getDay(): 0=Sun … 6=Sat  →  convert to Mon-based offset
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);

  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    cells.push(
      new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + i,
      ),
    );
  }
  return cells;
}

export default function BookingCalendar({
  reservations,
  onDateClick,
}: BookingCalendarProps) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [viewDate, setViewDate] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const cells = useMemo(() => buildCalendarGrid(year, month), [year, month]);

  const monthLabel = viewDate.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  /** Map each calendar day to the reservations that overlap it */
  const reservationsByDay = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    for (const cell of cells) {
      const key = cell.toISOString().slice(0, 10);
      const hits: Reservation[] = [];
      for (const r of reservations) {
        const rStart = startOfDay(new Date(r.startDate));
        const rEnd = startOfDay(new Date(r.endDate));
        if (cell >= rStart && cell <= rEnd) {
          hits.push(r);
        }
      }
      if (hits.length > 0) {
        map.set(key, hits);
      }
    }
    return map;
  }, [cells, reservations]);

  function prevMonth() {
    setViewDate(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setViewDate(new Date(year, month + 1, 1));
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <Button
          variant="outline"
          size="icon"
          onClick={prevMonth}
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold">{monthLabel}</h2>
        <Button
          variant="outline"
          size="icon"
          onClick={nextMonth}
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day-of-week labels */}
      <div className="text-muted-foreground grid grid-cols-7 text-center text-xs font-medium">
        {DAY_LABELS.map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 border-t border-l">
        {cells.map((cell, idx) => {
          const isCurrentMonth = cell.getMonth() === month;
          const isToday = isSameDay(cell, today);
          const key = cell.toISOString().slice(0, 10);
          const dayReservations = reservationsByDay.get(key) || [];

          return (
            <button
              key={idx}
              type="button"
              tabIndex={0}
              onClick={() => onDateClick?.(cell)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onDateClick?.(cell);
                }
              }}
              className={cn(
                "hover:bg-accent/50 relative min-h-[5rem] cursor-pointer border-r border-b p-1 text-left transition-colors",
                !isCurrentMonth && "bg-muted/30 text-muted-foreground",
              )}
            >
              {/* Day number */}
              <span
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                  isToday && "bg-primary text-primary-foreground",
                )}
              >
                {cell.getDate()}
              </span>

              {/* Reservation blocks */}
              <div className="mt-0.5 space-y-0.5">
                {dayReservations.slice(0, 3).map((r) => (
                  <Badge
                    key={r.id}
                    className={cn(
                      "block w-full truncate rounded px-1 py-0 text-[10px] leading-4 font-normal",
                      STATUS_STYLES[r.status] ||
                        "bg-muted text-muted-foreground",
                    )}
                  >
                    {r.user.firstname} {r.user.lastname}
                  </Badge>
                ))}
                {dayReservations.length > 3 && (
                  <span className="text-muted-foreground block text-[10px]">
                    +{dayReservations.length - 3} more
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-emerald-100 ring-1 ring-emerald-300" />
          Approved
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-amber-100 ring-1 ring-amber-300" />
          Pending
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-red-50 ring-1 ring-red-200" />
          Rejected
        </div>
      </div>
    </div>
  );
}
