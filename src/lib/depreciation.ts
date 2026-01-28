/**
 * Depreciation Calculator
 * Supports multiple depreciation methods for asset valuation
 */

export type DepreciationMethod = 'straight_line' | 'declining_balance' | 'sum_of_years';

export interface DepreciationParams {
  purchasePrice: number;
  purchaseDate: Date;
  usefulLifeYears: number;
  salvagePercent: number; // Percentage of original value (e.g., 10 = 10%)
  method: DepreciationMethod;
}

export interface DepreciationResult {
  originalValue: number;
  salvageValue: number;
  totalDepreciation: number;
  currentValue: number;
  yearsOwned: number;
  depreciationPerYear: number[];
  accumulatedDepreciation: number;
  percentDepreciated: number;
  isFullyDepreciated: boolean;
}

export interface DepreciationScheduleItem {
  year: number;
  startValue: number;
  depreciation: number;
  endValue: number;
  accumulatedDepreciation: number;
}

/**
 * Calculate depreciation for an asset
 */
export function calculateDepreciation(params: DepreciationParams): DepreciationResult {
  const { purchasePrice, purchaseDate, usefulLifeYears, salvagePercent, method } = params;

  const salvageValue = purchasePrice * (salvagePercent / 100);
  const depreciableAmount = purchasePrice - salvageValue;

  // Calculate years owned (fractional)
  const now = new Date();
  const yearsOwned = Math.max(0, (now.getTime() - purchaseDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

  let depreciationPerYear: number[] = [];

  switch (method) {
    case 'straight_line':
      depreciationPerYear = calculateStraightLine(depreciableAmount, usefulLifeYears);
      break;
    case 'declining_balance':
      depreciationPerYear = calculateDecliningBalance(purchasePrice, salvageValue, usefulLifeYears);
      break;
    case 'sum_of_years':
      depreciationPerYear = calculateSumOfYears(depreciableAmount, usefulLifeYears);
      break;
  }

  // Calculate accumulated depreciation
  const fullYearsOwned = Math.floor(yearsOwned);
  const partialYear = yearsOwned - fullYearsOwned;

  let accumulatedDepreciation = 0;
  for (let i = 0; i < Math.min(fullYearsOwned, depreciationPerYear.length); i++) {
    accumulatedDepreciation += depreciationPerYear[i];
  }

  // Add partial year depreciation
  if (fullYearsOwned < depreciationPerYear.length) {
    accumulatedDepreciation += depreciationPerYear[fullYearsOwned] * partialYear;
  }

  // Ensure we don't exceed depreciable amount
  accumulatedDepreciation = Math.min(accumulatedDepreciation, depreciableAmount);

  const currentValue = Math.max(salvageValue, purchasePrice - accumulatedDepreciation);
  const totalDepreciation = purchasePrice - salvageValue;
  const percentDepreciated = (accumulatedDepreciation / totalDepreciation) * 100;
  const isFullyDepreciated = yearsOwned >= usefulLifeYears;

  return {
    originalValue: purchasePrice,
    salvageValue,
    totalDepreciation,
    currentValue,
    yearsOwned,
    depreciationPerYear,
    accumulatedDepreciation,
    percentDepreciated: Math.min(100, percentDepreciated),
    isFullyDepreciated,
  };
}

/**
 * Get full depreciation schedule
 */
export function getDepreciationSchedule(params: DepreciationParams): DepreciationScheduleItem[] {
  const result = calculateDepreciation(params);
  const schedule: DepreciationScheduleItem[] = [];

  let currentValue = params.purchasePrice;
  let accumulatedDepreciation = 0;

  for (let year = 1; year <= params.usefulLifeYears; year++) {
    const yearIndex = year - 1;
    const depreciation = result.depreciationPerYear[yearIndex] || 0;
    accumulatedDepreciation += depreciation;
    const endValue = Math.max(result.salvageValue, currentValue - depreciation);

    schedule.push({
      year,
      startValue: currentValue,
      depreciation,
      endValue,
      accumulatedDepreciation,
    });

    currentValue = endValue;
  }

  return schedule;
}

/**
 * Straight-line depreciation
 * Equal depreciation amount each year
 */
function calculateStraightLine(depreciableAmount: number, usefulLifeYears: number): number[] {
  const annualDepreciation = depreciableAmount / usefulLifeYears;
  return Array(usefulLifeYears).fill(annualDepreciation);
}

/**
 * Double declining balance depreciation
 * Accelerated depreciation, more in early years
 */
function calculateDecliningBalance(
  purchasePrice: number,
  salvageValue: number,
  usefulLifeYears: number
): number[] {
  const rate = 2 / usefulLifeYears; // Double declining rate
  const depreciation: number[] = [];
  let bookValue = purchasePrice;

  for (let year = 0; year < usefulLifeYears; year++) {
    let yearDepreciation = bookValue * rate;

    // Don't depreciate below salvage value
    if (bookValue - yearDepreciation < salvageValue) {
      yearDepreciation = Math.max(0, bookValue - salvageValue);
    }

    depreciation.push(yearDepreciation);
    bookValue -= yearDepreciation;

    if (bookValue <= salvageValue) break;
  }

  return depreciation;
}

/**
 * Sum-of-years digits depreciation
 * Accelerated depreciation based on remaining useful life
 */
function calculateSumOfYears(depreciableAmount: number, usefulLifeYears: number): number[] {
  // Sum of years digits: n + (n-1) + (n-2) + ... + 1 = n(n+1)/2
  const sumOfYears = (usefulLifeYears * (usefulLifeYears + 1)) / 2;
  const depreciation: number[] = [];

  for (let year = 1; year <= usefulLifeYears; year++) {
    const remainingLife = usefulLifeYears - year + 1;
    const yearDepreciation = (remainingLife / sumOfYears) * depreciableAmount;
    depreciation.push(yearDepreciation);
  }

  return depreciation;
}

/**
 * Format currency value
 */
export function formatCurrency(value: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Get depreciation method display name
 */
export function getMethodDisplayName(method: DepreciationMethod): string {
  switch (method) {
    case 'straight_line':
      return 'Straight Line';
    case 'declining_balance':
      return 'Double Declining Balance';
    case 'sum_of_years':
      return 'Sum of Years Digits';
    default:
      return method;
  }
}
