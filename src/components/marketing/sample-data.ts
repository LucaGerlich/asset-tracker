// Fictional dataset shared by every marketing mock, so tags, people and
// locations stay consistent across the page. Status names match prisma/seed.js.

export type SampleStatus =
  "Active" | "Available" | "Pending" | "Out for Repair" | "Retired";
export type SampleLocationId = "FRA-HQ" | "BER-02" | "MUC-01";
export type Tone = "default" | "accent" | "warn" | "muted";

export interface SampleLocation {
  id: SampleLocationId;
  name: string;
}
export interface SamplePerson {
  handle: string;
  name: string;
  location: SampleLocationId;
}
export interface SampleAsset {
  tag: string;
  name: string;
  status: SampleStatus;
  assignee: string | null;
  location: SampleLocationId;
}
export interface SampleLicense {
  name: string;
  seatsUsed: number;
  seatsTotal: number;
  renewsOn: string;
  daysToRenewal: number;
}
export interface SampleConsumable {
  name: string;
  stockPercent: number;
  minimumPercent: number;
  belowMinimum: boolean;
}
export interface SampleAuditEvent {
  time: string;
  action: string;
  text: string;
  assetTag: string | null;
  person: string | null;
  tone: Tone;
}
export interface SampleTcoRow {
  label: string;
  purchase: number;
  maintenance: number;
}

export const SAMPLE_COMPANY = "Nordwerk GmbH";

export const SAMPLE_LOCATIONS: readonly SampleLocation[] = [
  { id: "FRA-HQ", name: "Frankfurt HQ" },
  { id: "BER-02", name: "Berlin Office" },
  { id: "MUC-01", name: "Munich Office" },
];

export const SAMPLE_PEOPLE: readonly SamplePerson[] = [
  { handle: "m.keller", name: "Mara Keller", location: "FRA-HQ" },
  { handle: "s.weber", name: "Sven Weber", location: "BER-02" },
  { handle: "j.braun", name: "Jonas Braun", location: "MUC-01" },
  { handle: "a.yilmaz", name: "Aylin Yilmaz", location: "FRA-HQ" },
  { handle: "l.fischer", name: "Lea Fischer", location: "BER-02" },
  { handle: "t.nguyen", name: "Tuan Nguyen", location: "FRA-HQ" },
  { handle: "k.schmidt", name: "Katrin Schmidt", location: "MUC-01" },
  { handle: "r.okafor", name: "Rita Okafor", location: "FRA-HQ" },
];

export const SAMPLE_ASSETS: readonly SampleAsset[] = [
  {
    tag: "AT-00412",
    name: "MacBook Pro 14",
    status: "Active",
    assignee: "m.keller",
    location: "FRA-HQ",
  },
  {
    tag: "AT-00413",
    name: "Dell U2723QE",
    status: "Available",
    assignee: null,
    location: "FRA-HQ",
  },
  {
    tag: "AT-00417",
    name: "ThinkPad T14",
    status: "Active",
    assignee: "s.weber",
    location: "BER-02",
  },
  {
    tag: "AT-00421",
    name: "iPhone 15",
    status: "Out for Repair",
    assignee: "j.braun",
    location: "MUC-01",
  },
  {
    tag: "AT-00398",
    name: "MacBook Air 13",
    status: "Available",
    assignee: null,
    location: "MUC-01",
  },
  {
    tag: "AT-00430",
    name: "iPad Air",
    status: "Active",
    assignee: "a.yilmaz",
    location: "FRA-HQ",
  },
  {
    tag: "AT-00433",
    name: "Logitech Rally Bar",
    status: "Active",
    assignee: "l.fischer",
    location: "BER-02",
  },
  {
    tag: "AT-00441",
    name: "ThinkPad X1 Carbon",
    status: "Pending",
    assignee: null,
    location: "BER-02",
  },
  {
    tag: "AT-00302",
    name: "Dell Latitude 7420",
    status: "Retired",
    assignee: null,
    location: "FRA-HQ",
  },
  {
    tag: "AT-00445",
    name: "Pixel 8",
    status: "Active",
    assignee: "t.nguyen",
    location: "FRA-HQ",
  },
  {
    tag: "AT-00447",
    name: "Studio Display",
    status: "Active",
    assignee: "k.schmidt",
    location: "MUC-01",
  },
  {
    tag: "AT-00450",
    name: "MacBook Pro 16",
    status: "Active",
    assignee: "r.okafor",
    location: "FRA-HQ",
  },
];

export const SAMPLE_LICENSES: readonly SampleLicense[] = [
  {
    name: "Figma",
    seatsUsed: 18,
    seatsTotal: 20,
    renewsOn: "2026-11-02",
    daysToRenewal: 32,
  },
  {
    name: "Microsoft 365 E3",
    seatsUsed: 41,
    seatsTotal: 45,
    renewsOn: "2027-01-15",
    daysToRenewal: 107,
  },
  {
    name: "JetBrains All Products",
    seatsUsed: 9,
    seatsTotal: 10,
    renewsOn: "2026-12-01",
    daysToRenewal: 62,
  },
];

export const SAMPLE_CONSUMABLES: readonly SampleConsumable[] = [
  {
    name: "Toner HP 59A",
    stockPercent: 86,
    minimumPercent: 25,
    belowMinimum: false,
  },
  {
    name: "USB-C cables",
    stockPercent: 32,
    minimumPercent: 40,
    belowMinimum: true,
  },
  {
    name: "Keyboards",
    stockPercent: 100,
    minimumPercent: 20,
    belowMinimum: false,
  },
];

export const SAMPLE_AUDIT_EVENTS: readonly SampleAuditEvent[] = [
  {
    time: "14:02:11",
    action: "checkout",
    text: "AT-00412 → m.keller",
    assetTag: "AT-00412",
    person: "m.keller",
    tone: "default",
  },
  {
    time: "14:05:47",
    action: "licence.update",
    text: "Figma seats 18/20",
    assetTag: null,
    person: null,
    tone: "default",
  },
  {
    time: "14:09:03",
    action: "status",
    text: "AT-00421 Out for Repair",
    assetTag: "AT-00421",
    person: "j.braun",
    tone: "warn",
  },
  {
    time: "14:12:30",
    action: "scim.deactivate",
    text: "l.fischer",
    assetTag: null,
    person: "l.fischer",
    tone: "default",
  },
  {
    time: "14:12:58",
    action: "checkin",
    text: "AT-00398 ← k.schmidt",
    assetTag: "AT-00398",
    person: "k.schmidt",
    tone: "accent",
  },
];

// Illustrative round numbers (EUR, 3-year view) for the TCO preview.
export const SAMPLE_TCO: readonly SampleTcoRow[] = [
  { label: "Laptops", purchase: 48000, maintenance: 6200 },
  { label: "Monitors", purchase: 12000, maintenance: 900 },
  { label: "Phones", purchase: 9500, maintenance: 2100 },
  { label: "Meeting rooms", purchase: 7000, maintenance: 1400 },
];

export const LIFECYCLE: readonly SampleStatus[] = [
  "Pending",
  "Available",
  "Active",
  "Out for Repair",
  "Retired",
];
