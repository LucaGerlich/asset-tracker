/**
 * Asset Health Score Calculator
 *
 * Computes a composite 0–100 score from four equally-weighted factors:
 *   age (25), warranty (25), maintenance (25), depreciation (25).
 *
 * Missing data yields a neutral midpoint (12.5) so incomplete records
 * are not unfairly penalised.
 */

export interface HealthScoreInput {
  purchaseDate: Date | null;
  expectedEndOfLife: Date | null;
  warrantyExpires: Date | null;
  lastMaintenanceDate: Date | null;
  maintenanceFrequencyDays: number | null;
  percentDepreciated: number | null; // 0-100
}

export type HealthLabel = "excellent" | "good" | "fair" | "poor" | "critical";

export interface HealthScoreResult {
  overall: number;
  ageFactor: number;
  warrantyFactor: number;
  maintenanceFactor: number;
  depreciationFactor: number;
  label: HealthLabel;
}

const MAX_FACTOR = 25;
const NEUTRAL = MAX_FACTOR / 2; // 12.5
const DEFAULT_LIFESPAN_YEARS = 7;

export function calculateHealthScore(
  input: HealthScoreInput,
): HealthScoreResult {
  const ageFactor = computeAgeFactor(input);
  const warrantyFactor = computeWarrantyFactor(input);
  const maintenanceFactor = computeMaintenanceFactor(input);
  const depreciationFactor = computeDepreciationFactor(input);

  const overall = Math.round(
    ageFactor + warrantyFactor + maintenanceFactor + depreciationFactor,
  );

  return {
    overall: clamp(overall, 0, 100),
    ageFactor: round2(ageFactor),
    warrantyFactor: round2(warrantyFactor),
    maintenanceFactor: round2(maintenanceFactor),
    depreciationFactor: round2(depreciationFactor),
    label: scoreToLabel(overall),
  };
}

/**
 * Convert a maintenance schedule frequency string to approximate days.
 */
export function frequencyToDays(frequency: string): number {
  switch (frequency.toLowerCase()) {
    case "daily":
      return 1;
    case "weekly":
      return 7;
    case "biweekly":
      return 14;
    case "monthly":
      return 30;
    case "quarterly":
      return 90;
    case "semiannually":
    case "semi-annually":
      return 182;
    case "yearly":
    case "annually":
      return 365;
    default:
      return 365; // safe fallback
  }
}

export function labelColor(label: HealthLabel): string {
  switch (label) {
    case "excellent":
      return "text-green-600";
    case "good":
      return "text-blue-600";
    case "fair":
      return "text-yellow-600";
    case "poor":
      return "text-orange-600";
    case "critical":
      return "text-red-600";
  }
}

export function labelBgColor(label: HealthLabel): string {
  switch (label) {
    case "excellent":
      return "bg-green-100 text-green-800";
    case "good":
      return "bg-blue-100 text-blue-800";
    case "fair":
      return "bg-yellow-100 text-yellow-800";
    case "poor":
      return "bg-orange-100 text-orange-800";
    case "critical":
      return "bg-red-100 text-red-800";
  }
}

function computeAgeFactor(input: HealthScoreInput): number {
  const { purchaseDate, expectedEndOfLife } = input;

  if (!purchaseDate) return NEUTRAL;

  const now = new Date();
  const purchaseMs = purchaseDate.getTime();
  const elapsedMs = now.getTime() - purchaseMs;

  if (elapsedMs < 0) return MAX_FACTOR; // purchased in the future → brand new

  const lifespanMs = expectedEndOfLife
    ? expectedEndOfLife.getTime() - purchaseMs
    : DEFAULT_LIFESPAN_YEARS * 365.25 * 24 * 60 * 60 * 1000;

  if (lifespanMs <= 0) return 0;

  const ratio = 1 - elapsedMs / lifespanMs;
  return clamp(MAX_FACTOR * ratio, 0, MAX_FACTOR);
}

function computeWarrantyFactor(input: HealthScoreInput): number {
  const { warrantyExpires } = input;

  if (!warrantyExpires) return NEUTRAL;

  const now = new Date();
  const daysRemaining =
    (warrantyExpires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  if (daysRemaining > 90) return MAX_FACTOR;
  if (daysRemaining > 30) return 18;
  if (daysRemaining > 0) return 10;
  return 5; // expired
}

function computeMaintenanceFactor(input: HealthScoreInput): number {
  const { lastMaintenanceDate, maintenanceFrequencyDays } = input;

  if (!maintenanceFrequencyDays) return NEUTRAL; // no schedule → neutral
  if (!lastMaintenanceDate) return 5; // schedule exists but never maintained → bad

  const now = new Date();
  const daysSinceMaintenance =
    (now.getTime() - lastMaintenanceDate.getTime()) / (1000 * 60 * 60 * 24);

  const overdueRatio = daysSinceMaintenance / maintenanceFrequencyDays;

  if (overdueRatio <= 1.0) return MAX_FACTOR; // on-time or early
  if (overdueRatio <= 1.5) return 15; // slightly overdue
  return 5; // significantly overdue
}

function computeDepreciationFactor(input: HealthScoreInput): number {
  const { percentDepreciated } = input;

  if (percentDepreciated === null || percentDepreciated === undefined)
    return NEUTRAL;

  return clamp(MAX_FACTOR * (1 - percentDepreciated / 100), 0, MAX_FACTOR);
}

function scoreToLabel(score: number): HealthLabel {
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 40) return "fair";
  if (score >= 20) return "poor";
  return "critical";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
