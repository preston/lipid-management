// Author: Preston Lee

import type { OpenCVDRiskSex } from './open-cvd-risk-calculator.model';

/** CKD-EPI 2021 creatinine equation (Scr mg/dL), race-free — mirrors OpenCVDRisk.cql */
function egfr2021Base(scrMgDl: number, ageYears: number, k: number, alpha: number): number {
  const ratio = scrMgDl / k;
  const minPart = Math.min(ratio, 1.0);
  const maxPart = Math.max(ratio, 1.0);
  return 142 * Math.pow(minPart, alpha) * Math.pow(maxPart, -1.2) * Math.pow(0.9938, ageYears);
}

export function computeEgfr2021Creatinine(
  scrMgDl: number,
  ageYears: number,
  sex: OpenCVDRiskSex,
): number {
  if (sex === 'female') {
    return egfr2021Base(scrMgDl, ageYears, 0.7, -0.241) * 1.012;
  }
  return egfr2021Base(scrMgDl, ageYears, 0.9, -0.303);
}

export function computeBmiKgM2(heightCm: number, weightKg: number): number {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}
