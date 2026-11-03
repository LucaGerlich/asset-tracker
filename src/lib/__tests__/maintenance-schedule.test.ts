import { describe, it, expect } from "vitest";
import { advanceDueDate } from "../maintenance-schedule";

const d = (iso: string) => new Date(iso);

describe("advanceDueDate", () => {
  const now = d("2026-11-03T10:00:00Z");

  it("advances from the current due date while it is still in the future", () => {
    expect(advanceDueDate(d("2026-11-20T08:00:00Z"), "weekly", now)).toEqual(
      d("2026-11-27T08:00:00Z"),
    );
    expect(advanceDueDate(d("2026-11-20T08:00:00Z"), "daily", now)).toEqual(
      d("2026-11-21T08:00:00Z"),
    );
  });

  it("advances from now when the schedule is overdue, so it is not overdue again", () => {
    const next = advanceDueDate(d("2026-05-01T08:00:00Z"), "monthly", now);
    expect(next).toEqual(d("2026-12-03T10:00:00Z"));
    expect(next.getTime()).toBeGreaterThan(now.getTime());
  });

  it("clamps the day of month instead of overflowing into the next month", () => {
    expect(advanceDueDate(d("2027-01-31T08:00:00Z"), "monthly", now)).toEqual(
      d("2027-02-28T08:00:00Z"),
    );
    expect(advanceDueDate(d("2026-11-30T08:00:00Z"), "quarterly", now)).toEqual(
      d("2027-02-28T08:00:00Z"),
    );
  });

  it("keeps a leap-day due date valid when advancing a year", () => {
    const leapNow = d("2028-01-10T00:00:00Z");
    expect(
      advanceDueDate(d("2028-02-29T08:00:00Z"), "annually", leapNow),
    ).toEqual(d("2029-02-28T08:00:00Z"));
  });

  it("uses a 30 day fallback for an unknown frequency", () => {
    expect(advanceDueDate(d("2026-11-10T00:00:00Z"), "custom", now)).toEqual(
      d("2026-12-10T00:00:00Z"),
    );
  });
});
