// Author: Preston Lee

/**
 * Age/sex 30-year PREVENT-CVD risk percentile lookup (Khan-lab inversion on mmc2 tables).
 * Tables from Krishnan JACC 2025 mmc2.xlsx via scripts/extract-prevent-percentiles.ts.
 */

import type { PreventSex } from './prevent-math';
import { PREVENT_30Y_CVD_PERCENTILES } from './prevent-30y-cvd-percentiles';

/**
 * Smallest percentile whose table absolute 30y CVD risk (%) ≥ patient risk.
 * Ages outside 30–59 return null. Table 99th is 100% so high risks map to 99.
 */
export function prevent30yCvdPercentile(
  ageYears: number,
  sex: PreventSex,
  thirtyYearTotalCvdPercent: number,
): number | null {
  if (
    !Number.isFinite(ageYears) ||
    !Number.isFinite(thirtyYearTotalCvdPercent) ||
    thirtyYearTotalCvdPercent < 0
  ) {
    return null;
  }
  const age = Math.trunc(ageYears);
  if (age < 30 || age > 59) {
    return null;
  }
  const byAge = PREVENT_30Y_CVD_PERCENTILES.bySexAge[sex] as Record<string, readonly number[]>;
  const column = byAge[String(age)];
  if (!column || column.length !== 99) {
    return null;
  }
  for (let i = 0; i < column.length; i++) {
    if (column[i]! >= thirtyYearTotalCvdPercent) {
      return i + 1;
    }
  }
  return 99;
}

function ordinalPercentile(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${n}th`;
  }
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/**
 * UI label for 30y CVD percentile. Uses ordinal form (e.g. "93rd").
 * Risks below the 1st table threshold show "≤1st"; at/above the 99th (100%) show "≥99th".
 */
export function formatPrevent30yCvdPercentileDisplay(
  ageYears: number,
  sex: PreventSex,
  thirtyYearTotalCvdPercent: number,
): string | null {
  const pct = prevent30yCvdPercentile(ageYears, sex, thirtyYearTotalCvdPercent);
  if (pct == null) {
    return null;
  }
  const age = Math.trunc(ageYears);
  const byAge = PREVENT_30Y_CVD_PERCENTILES.bySexAge[sex] as Record<string, readonly number[]>;
  const column = byAge[String(age)];
  if (!column || column.length !== 99) {
    return null;
  }
  const first = column[0]!;
  const p98 = column[97]!;
  if (thirtyYearTotalCvdPercent < first) {
    return '≤1st';
  }
  if (thirtyYearTotalCvdPercent > p98) {
    return '≥99th';
  }
  return ordinalPercentile(pct);
}
