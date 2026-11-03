/** Add months to a UTC date, clamping the day to the target month's length. */
function addMonthsClamped(date: Date, months: number): Date {
  const next = new Date(date);
  const day = next.getUTCDate();
  // Park on day 1 so setUTCMonth cannot overflow into the following month.
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + months);
  const daysInTarget = new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0),
  ).getUTCDate();
  next.setUTCDate(Math.min(day, daysInTarget));
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/**
 * The due date that follows completing a maintenance schedule.
 *
 * The step starts from whichever is later, the current due date or `now`: a
 * schedule completed late must not land on a date that is already in the past
 * (it would be overdue again immediately). Month-based steps clamp to the end
 * of shorter months (Jan 31 + 1 month = Feb 28/29) instead of overflowing.
 *
 * daily +1 day, weekly +7 days, monthly +1 month, quarterly +3 months,
 * annually +12 months; any other value falls back to +30 days.
 */
export function advanceDueDate(
  currentDue: Date,
  frequency: string,
  now: Date = new Date(),
): Date {
  const base = currentDue.getTime() > now.getTime() ? currentDue : now;
  switch (frequency) {
    case "daily":
      return addDays(base, 1);
    case "weekly":
      return addDays(base, 7);
    case "monthly":
      return addMonthsClamped(base, 1);
    case "quarterly":
      return addMonthsClamped(base, 3);
    case "annually":
      return addMonthsClamped(base, 12);
    default:
      return addDays(base, 30);
  }
}
