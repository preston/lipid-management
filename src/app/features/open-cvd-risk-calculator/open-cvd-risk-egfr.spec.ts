// Author: Preston Lee

import { describe, expect, it } from 'vitest';
import { computeBmiKgM2, computeEgfr2021Creatinine } from './open-cvd-risk-egfr';

describe('open-cvd-risk-egfr', () => {
  it('computes BMI from height and weight', () => {
    expect(computeBmiKgM2(170, 70)).toBeCloseTo(24.22, 2);
  });

  it('computes eGFR using CKD-EPI 2021', () => {
    const egfr = computeEgfr2021Creatinine(1.0, 55, 'female');
    expect(egfr).toBeGreaterThan(50);
    expect(egfr).toBeLessThan(120);
  });
});
