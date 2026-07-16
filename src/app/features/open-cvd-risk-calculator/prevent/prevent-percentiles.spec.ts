// Author: Preston Lee

import { describe, expect, it } from 'vitest';
import {
  formatPrevent30yCvdPercentileDisplay,
  prevent30yCvdPercentile,
} from './prevent-percentiles';
import { PREVENT_30Y_CVD_PERCENTILES } from './prevent-30y-cvd-percentiles';

describe('prevent30yCvdPercentile', () => {
  it('returns null outside ages 30–59', () => {
    expect(prevent30yCvdPercentile(29, 'female', 5)).toBeNull();
    expect(prevent30yCvdPercentile(60, 'male', 5)).toBeNull();
  });

  it('uses Khan-lab min(which(tableRisk >= patientRisk)) on mmc2 CVD F', () => {
    const age45Col = PREVENT_30Y_CVD_PERCENTILES.bySexAge.female['45'];
    expect(age45Col[29]).toBeCloseTo(7.4113240242004395, 6);
    expect(prevent30yCvdPercentile(45, 'female', 7.4113240242004395)).toBe(30);
    expect(prevent30yCvdPercentile(45, 'female', 7.4)).toBe(30);
  });

  it('maps risks above 98th to 99 (table 99th is 100%)', () => {
    expect(PREVENT_30Y_CVD_PERCENTILES.bySexAge.female['45'][98]).toBe(100);
    expect(prevent30yCvdPercentile(45, 'female', 99)).toBe(99);
    expect(prevent30yCvdPercentile(45, 'female', 100)).toBe(99);
  });

  it('returns 1st when risk is at or below the 1st percentile threshold', () => {
    const first = PREVENT_30Y_CVD_PERCENTILES.bySexAge.male['40'][0];
    expect(prevent30yCvdPercentile(40, 'male', first)).toBe(1);
    expect(prevent30yCvdPercentile(40, 'male', 0)).toBe(1);
  });

  it('rejects non-finite inputs', () => {
    expect(prevent30yCvdPercentile(45, 'female', Number.NaN)).toBeNull();
    expect(prevent30yCvdPercentile(Number.NaN, 'female', 5)).toBeNull();
  });
});

describe('formatPrevent30yCvdPercentileDisplay', () => {
  it('uses ordinal form for in-range percentiles', () => {
    expect(formatPrevent30yCvdPercentileDisplay(45, 'female', 7.4)).toBe('30th');
    expect(formatPrevent30yCvdPercentileDisplay(45, 'female', 14.7)).toMatch(/^\d+(st|nd|rd|th)$/);
  });

  it('shows ≤1st below the first table threshold and ≥99th above the 98th', () => {
    const first = PREVENT_30Y_CVD_PERCENTILES.bySexAge.female['45'][0];
    const p98 = PREVENT_30Y_CVD_PERCENTILES.bySexAge.female['45'][97];
    expect(formatPrevent30yCvdPercentileDisplay(45, 'female', first - 0.01)).toBe('≤1st');
    expect(formatPrevent30yCvdPercentileDisplay(45, 'female', first)).toBe('1st');
    expect(formatPrevent30yCvdPercentileDisplay(45, 'female', p98)).toBe('98th');
    expect(formatPrevent30yCvdPercentileDisplay(45, 'female', p98 + 0.01)).toBe('≥99th');
    expect(formatPrevent30yCvdPercentileDisplay(45, 'female', 100)).toBe('≥99th');
  });

  it('returns null outside ages 30–59', () => {
    expect(formatPrevent30yCvdPercentileDisplay(60, 'female', 20)).toBeNull();
  });
});
