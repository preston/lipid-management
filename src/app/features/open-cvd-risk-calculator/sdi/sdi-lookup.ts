// Author: Preston Lee

/** ZIP / ZCTA helpers; CSV parse is for codegen (scripts/generate-sdi-2019.ts), not the UI. */

export type SdiDecileMap = Readonly<Record<string, number>>;

export function normalizeZip(raw: string | null | undefined): string | null {
  if (raw == null) {
    return null;
  }
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 5) {
    return digits.slice(0, 5);
  }
  if (digits.length >= 1) {
    return digits.padStart(5, '0');
  }
  return null;
}

/** preventr-aligned mapping from SDI_score centile to PREVENT decile. */
export function centileToDecile(centile: number): number | null {
  if (!Number.isFinite(centile)) {
    return null;
  }
  if (centile <= 10) {
    return 1;
  }
  if (centile <= 20) {
    return 2;
  }
  if (centile <= 30) {
    return 3;
  }
  if (centile <= 40) {
    return 4;
  }
  if (centile <= 50) {
    return 5;
  }
  if (centile <= 60) {
    return 6;
  }
  if (centile <= 70) {
    return 7;
  }
  if (centile <= 80) {
    return 8;
  }
  if (centile <= 90) {
    return 9;
  }
  if (centile <= 100) {
    return 10;
  }
  return null;
}

/**
 * Parse Robert Graham Center ZCTA CSV (`ZCTA5_FIPS`, `SDI_score`) into a ZIP→decile map.
 * Headers are matched case-insensitively.
 */
export function parseSdiZctaCsv(csvText: string): SdiDecileMap {
  const lines = csvText.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines.length < 2) {
    return {};
  }
  const headerCells = splitCsvLine(lines[0]!);
  const zipIdx = headerCells.findIndex((h) => h.toLowerCase() === 'zcta5_fips');
  const scoreIdx = headerCells.findIndex((h) => h.toLowerCase() === 'sdi_score');
  if (zipIdx < 0 || scoreIdx < 0) {
    throw new Error('SDI CSV missing ZCTA5_FIPS or SDI_score column');
  }
  const out: Record<string, number> = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) {
      continue;
    }
    const cells = splitCsvLine(line);
    const zip = normalizeZip(cells[zipIdx] ?? '');
    if (zip == null) {
      continue;
    }
    const scoreRaw = (cells[scoreIdx] ?? '').trim();
    if (!scoreRaw) {
      continue;
    }
    const score = Number(scoreRaw);
    if (!Number.isFinite(score)) {
      continue;
    }
    const decile = centileToDecile(score);
    if (decile != null) {
      out[zip] = decile;
    }
  }
  return out;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      cells.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  cells.push(cur);
  return cells;
}

export function lookupSdiDecile(
  map: SdiDecileMap | null | undefined,
  zip: string | null | undefined,
): number | null {
  const key = normalizeZip(zip);
  if (key == null || map == null) {
    return null;
  }
  const d = map[key];
  return typeof d === 'number' && Number.isInteger(d) && d >= 1 && d <= 10 ? d : null;
}

export function postalCodeFromPatientAddress(
  addresses: ReadonlyArray<{ use?: string; postalCode?: string }> | undefined,
): string | null {
  if (!addresses?.length) {
    return null;
  }
  const home = addresses.find((a) => a.use === 'home' && a.postalCode);
  if (home?.postalCode) {
    return normalizeZip(home.postalCode);
  }
  const any = addresses.find((a) => a.postalCode);
  return any?.postalCode ? normalizeZip(any.postalCode) : null;
}
