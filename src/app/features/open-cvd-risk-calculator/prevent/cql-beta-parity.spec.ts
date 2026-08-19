// Author: Preston Lee

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PREVENT_S12_GOLDENS } from './s12-goldens';

const OUTCOME_PASCAL: Record<string, string> = {
  totalCvd: 'TotalCvd',
  ascvd: 'Ascvd',
  hf: 'Hf',
  chd: 'Chd',
  stroke: 'Stroke',
};

const MODEL_PASCAL: Record<string, string> = {
  base: 'Base',
  uacr: 'Uacr',
  hba1c: 'Hba1c',
  sdi: 'Sdi',
  full: 'Full',
};

function parseCqlDecimalList(body: string): number[] {
  return body
    .split(',')
    .map((part) => {
      const cleaned = part.trim();
      if (!cleaned) {
        return null;
      }
      const neg = cleaned.startsWith('-');
      const raw = (neg ? cleaned.slice(1) : cleaned).trim();
      const num = Number(raw);
      return Number.isFinite(num) ? (neg ? -num : num) : null;
    })
    .filter((n): n is number => n != null);
}

describe('OpenCVDRisk.cql beta literals vs S12 goldens', () => {
  it('matches every generated Beta define to golden vectors', () => {
    const cql = readFileSync(resolve(process.cwd(), 'public/package/cql/OpenCVDRisk.cql'), 'utf8');
    expect(cql).toContain("library OpenCVDRisk version '0.6.0'");
    expect(cql).toContain('* 0.02586');

    for (const [sheetKey, sheet] of Object.entries(PREVENT_S12_GOLDENS.sheets)) {
      const model = sheet.model;
      const horizon = sheet.horizon;
      for (const outcome of ['totalCvd', 'ascvd', 'hf', 'chd', 'stroke'] as const) {
        for (const sex of ['female', 'male'] as const) {
          const defineName = `Beta${horizon}${sex[0]!.toUpperCase()}${sex.slice(1)}${OUTCOME_PASCAL[outcome]}${MODEL_PASCAL[model]}`;
          const re = new RegExp(
            `define ${defineName}:\\s*List\\s*<\\s*System\\.Decimal\\s*>\\s*\\{([^}]+)\\}`,
            'm',
          );
          const m = cql.match(re);
          expect(m, `missing ${defineName} for ${sheetKey}`).toBeTruthy();
          const parsed = parseCqlDecimalList(m![1]!);
          const expected = sheet.betas[`${outcome}_${sex}` as keyof typeof sheet.betas] as unknown as number[];
          expect(parsed.length).toBe(expected.length);
          for (let i = 0; i < expected.length; i++) {
            expect(Math.abs(parsed[i]! - expected[i]!)).toBeLessThan(1e-12);
          }
        }
      }
    }
  });
});
