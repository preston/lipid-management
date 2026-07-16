// Author: Preston Lee

/**
 * Validate prevent-aha-goldens.csv schema / consistency rules.
 *
 * Usage: npx tsx scripts/validate-prevent-aha-goldens.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GOLDENS_HEADERS, parseCsv, validateGoldensRows } from './prevent-parity/schema';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GOLDENS_CSV = resolve(ROOT, 'doc/prevent-parity/prevent-aha-goldens.csv');

function main(): void {
  const { headers, rows } = parseCsv(readFileSync(GOLDENS_CSV, 'utf8'));
  const missing = GOLDENS_HEADERS.filter((h) => !headers.includes(h));
  const extra = headers.filter((h) => !(GOLDENS_HEADERS as readonly string[]).includes(h));
  const errors = [...validateGoldensRows(rows)];
  if (missing.length) {
    errors.push(`Missing headers: ${missing.join(', ')}`);
  }
  if (extra.length) {
    errors.push(`Unexpected headers: ${extra.join(', ')}`);
  }
  if (errors.length) {
    console.error('Validation failed:');
    for (const e of errors) {
      console.error(`  - ${e}`);
    }
    process.exit(1);
  }
  console.log(`OK: ${rows.length} rows, ${headers.length} columns in ${GOLDENS_CSV}`);
}

main();
