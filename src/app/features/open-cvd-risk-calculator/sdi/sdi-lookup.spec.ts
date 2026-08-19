// Author: Preston Lee

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  centileToDecile,
  lookupSdiDecile,
  normalizeZip,
  parseSdiZctaCsv,
  postalCodeFromPatientAddress,
} from './sdi-lookup';

const SDI_CSV_PATH = resolve(
  process.cwd(),
  'doc/sdi/asset_rgc_sdi_2015_through_2019_zcta.csv',
);

describe('sdi-lookup', () => {
  it('normalizes ZIP+4, padding, and non-digits', () => {
    expect(normalizeZip('90210-1234')).toBe('90210');
    expect(normalizeZip('90210')).toBe('90210');
    expect(normalizeZip('738')).toBe('00738');
    expect(normalizeZip('  01001  ')).toBe('01001');
    expect(normalizeZip('')).toBeNull();
    expect(normalizeZip(null)).toBeNull();
  });

  it('maps SDI_score centiles like preventr', () => {
    expect(centileToDecile(1)).toBe(1);
    expect(centileToDecile(10)).toBe(1);
    expect(centileToDecile(11)).toBe(2);
    expect(centileToDecile(20)).toBe(2);
    expect(centileToDecile(36)).toBe(4);
    expect(centileToDecile(100)).toBe(10);
    expect(centileToDecile(101)).toBeNull();
  });

  it('parses the raw Graham Center CSV into a ZIP→decile map', () => {
    const map = parseSdiZctaCsv(readFileSync(SDI_CSV_PATH, 'utf8'));
    expect(Object.keys(map).length).toBeGreaterThan(30000);
    expect(lookupSdiDecile(map, '01001')).toBe(4);
    expect(lookupSdiDecile(map, '90210')).toBe(2);
    expect(lookupSdiDecile(map, '37220')).toBe(1);
    expect(lookupSdiDecile(map, '99999')).toBeNull();
  });

  it('keeps ZctaMapSize in CQL aligned with parsed CSV key count', () => {
    const map = parseSdiZctaCsv(readFileSync(SDI_CSV_PATH, 'utf8'));
    const cql = readFileSync(resolve(process.cwd(), 'public/package/cql/SDI-2019.cql'), 'utf8');
    expect(cql).toContain("library SDI2019 version '1.0.1'");
    const m = cql.match(/define ZctaMapSize:\s*\n\s*(\d+)/);
    expect(m).toBeTruthy();
    expect(Number(m![1])).toBe(Object.keys(map).length);
    expect(cql).toContain("when '90210' then 2");
    expect(cql).toContain("when '01001' then 4");
  });

  it('prefers home address postalCode', () => {
    expect(
      postalCodeFromPatientAddress([
        { use: 'work', postalCode: '10001' },
        { use: 'home', postalCode: '90210-0001' },
      ]),
    ).toBe('90210');
  });
});
