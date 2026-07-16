// Author: Preston Lee

/**
 * Extract PREVENT S12A–J betas and worked-example risks; emit goldens JSON/TS.
 *
 * Usage: npx tsx scripts/extract-prevent-s12.ts
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const XLSX_PATH = resolve(
  ROOT,
  'doc/private/NIHMS1953934-supplement-Supplemental_Tables.xlsx',
);
const OUT_JSON = resolve(
  ROOT,
  'src/app/features/open-cvd-risk-calculator/prevent/s12-goldens.json',
);
const OUT_TS = resolve(
  ROOT,
  'src/app/features/open-cvd-risk-calculator/prevent/s12-goldens.ts',
);

const SHEETS: Record<string, string> = {
  base_10: 'Table S12A Base 10yr',
  uacr_10: 'Table S12B ACR 10yr',
  hba1c_10: 'Table S12C A1c 10yr',
  sdi_10: 'Table S12D SDI 10yr',
  full_10: 'Table S12E Full 10yr',
  base_30: 'Table S12F Base 30yr',
  uacr_30: 'Table S12G ACR 30yr',
  hba1c_30: 'Table S12H A1c 30yr',
  sdi_30: 'Table S12I SDI 30yr',
  full_30: 'Table S12J Full 30yr',
};

const OUTCOMES: ReadonlyArray<[string, [string, string]]> = [
  ['totalCvd', ['C', 'D']],
  ['ascvd', ['E', 'F']],
  ['hf', ['G', 'H']],
  ['chd', ['I', 'J']],
  ['stroke', ['K', 'L']],
];

const BASE10_KEYS = [
  'age',
  'nonhdl',
  'hdl',
  'sbp_lt',
  'sbp_gte',
  'dm',
  'smoke',
  'bmi_lt',
  'bmi_gte',
  'egfr_lt',
  'egfr_gte',
  'antihtn',
  'statin',
  'treated_sbp',
  'treated_nonhdl',
  'age_nonhdl',
  'age_hdl',
  'age_sbp',
  'age_dm',
  'age_smoke',
  'age_bmi_gte',
  'age_egfr_lt',
  'constant',
] as const;

const BASE30_KEYS = [
  'age',
  'age2',
  'nonhdl',
  'hdl',
  'sbp_lt',
  'sbp_gte',
  'dm',
  'smoke',
  'bmi_lt',
  'bmi_gte',
  'egfr_lt',
  'egfr_gte',
  'antihtn',
  'statin',
  'treated_sbp',
  'treated_nonhdl',
  'age_nonhdl',
  'age_hdl',
  'age_sbp',
  'age_dm',
  'age_smoke',
  'age_bmi_gte',
  'age_egfr_lt',
  'constant',
] as const;

const LABEL_TO_KEY: Record<string, string> = {
  'Age per 10 years': 'age',
  'Age per 10 years squared': 'age2',
  'non-HDL-C per 1 mmol/L': 'nonhdl',
  'HDL-C per 0.3 mmol/L': 'hdl',
  'SBP <110 per 20 mmHg': 'sbp_lt',
  'SBP ≥110 per 20 mmHg': 'sbp_gte',
  Diabetes: 'dm',
  'Current smoking': 'smoke',
  'BMI <30, per 5 kg/m2': 'bmi_lt',
  'BMI 30+, per 5 kg/m2': 'bmi_gte',
  'eGFR <60, per -15 ml': 'egfr_lt',
  'eGFR 60+, per -15 ml': 'egfr_gte',
  'Anti-hypertensive use': 'antihtn',
  'Statin use': 'statin',
  'Treated SBP ≥110 mm Hg per 20 mm Hg': 'treated_sbp',
  'Treated non-HDL-C': 'treated_nonhdl',
  'Age per 10yr * non-HDL-C per 1 mmol/L': 'age_nonhdl',
  'Age per 10yr * HDL-C per 0.3 mml/L': 'age_hdl',
  'Age per 10yr * SBP ≥110 mm Hg per 20 mmHg': 'age_sbp',
  'Age per 10yr * diabetes': 'age_dm',
  'Age per 10yr * current smoking': 'age_smoke',
  'Age per 10yr * BMI 30+ per 5 kg/m2': 'age_bmi_gte',
  'Age per 10yr * eGFR <60, per -15 ml': 'age_egfr_lt',
  'ln-UACR, mg/g, per 1 ln unit': 'ln_uacr',
  'ln-ACR, mg/g, per 1 ln unit': 'ln_uacr',
  'Missing UACR/PCR/Dipstick': 'missing_uacr',
  'Missing ACR/PCR/Dipstick': 'missing_uacr',
  'HbA1c in DM, per 1%': 'hba1c_dm',
  'HbA1c no DM, per 1%': 'hba1c_nodm',
  'Missing HbA1c': 'missing_hba1c',
  'SDI decile categories 4-6 vs. 1-3': 'sdi_4_6',
  'SDI decile categories 7-10 vs. 1-3': 'sdi_7_10',
  'Missing SDI': 'missing_sdi',
  Constant: 'constant',
};

type CellValue = string | number | boolean | Date | undefined;
type Grid = Map<string, CellValue>;

function cellKey(col: string, row: number): string {
  return `${col}${row}`;
}

function loadSheetGrid(sheet: XLSX.WorkSheet): Grid {
  const grid: Grid = new Map();
  for (const addr of Object.keys(sheet)) {
    if (addr.startsWith('!')) {
      continue;
    }
    const cell = sheet[addr];
    if (cell == null || cell.v === undefined) {
      continue;
    }
    grid.set(addr, cell.v as CellValue);
  }
  return grid;
}

function keysForModel(model: string, horizon: number): string[] {
  const base = [...(horizon === 30 ? BASE30_KEYS : BASE10_KEYS)];
  const insertAt = base.indexOf('constant');
  let extras: string[] = [];
  if (model === 'uacr') {
    extras = ['ln_uacr', 'missing_uacr'];
  } else if (model === 'hba1c') {
    extras = ['hba1c_dm', 'hba1c_nodm', 'missing_hba1c'];
  } else if (model === 'sdi') {
    extras = ['sdi_4_6', 'sdi_7_10', 'missing_sdi'];
  } else if (model === 'full') {
    extras = [
      'sdi_4_6',
      'sdi_7_10',
      'missing_sdi',
      'ln_uacr',
      'missing_uacr',
      'hba1c_dm',
      'hba1c_nodm',
      'missing_hba1c',
    ];
  }
  return [...base.slice(0, insertAt), ...extras, ...base.slice(insertAt)];
}

function num(v: CellValue): number {
  if (v == null || v === '') {
    return 0.0;
  }
  if (typeof v === 'number') {
    return v;
  }
  if (typeof v === 'boolean') {
    return v ? 1 : 0;
  }
  if (v instanceof Date) {
    return Number.NaN;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : 0.0;
}

function getCell(grid: Grid, col: string, row: number): CellValue {
  return grid.get(cellKey(col, row));
}

interface SheetExtract {
  model: string;
  horizon: number;
  termKeys: string[];
  inputs: Record<string, number>;
  betas: Record<string, number[]>;
  risks: Record<string, number>;
}

function extractSheet(grid: Grid, model: string, horizon: number): SheetExtract {
  const byLabel: Record<string, Record<string, number>> = {};
  for (let r = 45; r < 100; r++) {
    const label = getCell(grid, 'A', r);
    if (typeof label !== 'string') {
      continue;
    }
    const key = LABEL_TO_KEY[label.trim()];
    if (!key) {
      continue;
    }
    byLabel[key] = {};
    for (const [outcome, [fc, mc]] of OUTCOMES) {
      byLabel[key]![`${outcome}_female`] = num(getCell(grid, fc, r));
      byLabel[key]![`${outcome}_male`] = num(getCell(grid, mc, r));
    }
  }

  const termKeys = keysForModel(model, horizon);
  const betas: Record<string, number[]> = {};
  for (const [outcome] of OUTCOMES) {
    for (const sex of ['female', 'male'] as const) {
      const vec: number[] = [];
      for (const k of termKeys) {
        const row = byLabel[k] ?? {};
        vec.push(row[`${outcome}_${sex}`] ?? 0.0);
      }
      betas[`${outcome}_${sex}`] = vec;
    }
  }

  let riskRow: number | null = null;
  for (let r = 40; r < 55; r++) {
    if (getCell(grid, 'A', r) === 'Risk') {
      riskRow = r;
      break;
    }
  }
  const risks: Record<string, number> = {};
  if (riskRow != null) {
    for (const [outcome, [fc, mc]] of OUTCOMES) {
      risks[`${outcome}_female`] = num(getCell(grid, fc, riskRow));
      risks[`${outcome}_male`] = num(getCell(grid, mc, riskRow));
    }
  }

  const inputs: Record<string, number> = {
    age: num(getCell(grid, 'C', 4)),
    totalChol: num(getCell(grid, 'C', 5)),
    hdl: num(getCell(grid, 'C', 6)),
    sbp: num(getCell(grid, 'C', 7)),
    diabetes: num(getCell(grid, 'C', 8)),
    smoke: num(getCell(grid, 'C', 9)),
    bmi: num(getCell(grid, 'C', 10)),
    egfr: num(getCell(grid, 'C', 11)),
    antihtn: num(getCell(grid, 'C', 12)),
    statin: num(getCell(grid, 'C', 13)),
  };
  for (let r = 14; r < 18; r++) {
    const a = getCell(grid, 'A', r);
    const c = getCell(grid, 'C', r);
    if (typeof a !== 'string') {
      continue;
    }
    if (a.includes('UACR')) {
      inputs['uacr'] = num(c);
    } else if (a.includes('HbA1c')) {
      inputs['hba1c'] = num(c);
    } else if (a.includes('SDI')) {
      inputs['sdi'] = num(c);
    }
  }

  return { model, horizon, termKeys, inputs, betas, risks };
}

function formatJsonNumber(n: number, asFloat: boolean): string {
  if (!Number.isFinite(n)) {
    return JSON.stringify(n);
  }
  if (Object.is(n, -0)) {
    return asFloat ? '-0.0' : '0';
  }
  if (Number.isInteger(n)) {
    return asFloat ? `${n}.0` : String(n);
  }
  return String(n);
}

/** JSON with Python-like typing: ints for horizon, floats (`50.0`) for Excel values. */
function stringifyGoldens(payload: {
  source: string;
  sheets: Record<string, SheetExtract>;
}): string {
  const indent = 2;
  const pad = (level: number) => ' '.repeat(indent * level);

  const num = (n: number, asFloat: boolean) => formatJsonNumber(n, asFloat);

  const arr = (vals: number[], level: number, asFloat: boolean): string => {
    if (vals.length === 0) {
      return '[]';
    }
    const items = vals.map((v) => `${pad(level + 1)}${num(v, asFloat)}`);
    return `[\n${items.join(',\n')}\n${pad(level)}]`;
  };

  const strArr = (vals: string[], level: number): string => {
    if (vals.length === 0) {
      return '[]';
    }
    const items = vals.map((v) => `${pad(level + 1)}${JSON.stringify(v)}`);
    return `[\n${items.join(',\n')}\n${pad(level)}]`;
  };

  const objNums = (o: Record<string, number>, level: number): string => {
    const entries = Object.entries(o);
    if (entries.length === 0) {
      return '{}';
    }
    const items = entries.map(
      ([k, v]) => `${pad(level + 1)}${JSON.stringify(k)}: ${num(v, true)}`,
    );
    return `{\n${items.join(',\n')}\n${pad(level)}}`;
  };

  const betasObj = (betas: Record<string, number[]>, level: number): string => {
    const entries = Object.entries(betas);
    const items = entries.map(
      ([k, v]) => `${pad(level + 1)}${JSON.stringify(k)}: ${arr(v, level + 1, true)}`,
    );
    return `{\n${items.join(',\n')}\n${pad(level)}}`;
  };

  const sheetObj = (s: SheetExtract, level: number): string => {
    const lines = [
      `${pad(level + 1)}"model": ${JSON.stringify(s.model)}`,
      `${pad(level + 1)}"horizon": ${num(s.horizon, false)}`,
      `${pad(level + 1)}"termKeys": ${strArr(s.termKeys, level + 1)}`,
      `${pad(level + 1)}"inputs": ${objNums(s.inputs, level + 1)}`,
      `${pad(level + 1)}"betas": ${betasObj(s.betas, level + 1)}`,
      `${pad(level + 1)}"risks": ${objNums(s.risks, level + 1)}`,
    ];
    return `{\n${lines.join(',\n')}\n${pad(level)}}`;
  };

  const sheetEntries = Object.entries(payload.sheets).map(
    ([k, s]) => `${pad(2)}${JSON.stringify(k)}: ${sheetObj(s, 2)}`,
  );

  return (
    `{\n` +
    `${pad(1)}"source": ${JSON.stringify(payload.source)},\n` +
    `${pad(1)}"sheets": {\n${sheetEntries.join(',\n')}\n${pad(1)}}\n` +
    `}\n`
  );
}

function main(): void {
  const workbook = XLSX.readFile(XLSX_PATH, { cellDates: false });
  const payload: {
    source: string;
    sheets: Record<string, SheetExtract>;
  } = {
    source: 'NIHMS1953934-supplement-Supplemental_Tables.xlsx',
    sheets: {},
  };

  for (const [key, sheetName] of Object.entries(SHEETS)) {
    const sheet = workbook.Sheets[sheetName];
    if (sheet == null) {
      throw new Error(`Missing sheet: ${sheetName}`);
    }
    const [model, horizonS] = key.split(/_(?=\d+$)/) as [string, string];
    const horizon = Number(horizonS);
    payload.sheets[key] = extractSheet(loadSheetGrid(sheet), model, horizon);
  }

  mkdirSync(dirname(OUT_JSON), { recursive: true });
  writeFileSync(OUT_JSON, stringifyGoldens(payload), 'utf8');

  const ts = [
    '// Author: Preston Lee',
    '',
    '/** Golden S12A–J extract from Khan PREVENT supplemental Excel. Regenerated by scripts/extract-prevent-s12.ts */',
    `export const PREVENT_S12_GOLDENS = ${stringifyGoldens(payload).trimEnd()} as const;`,
    '',
  ];
  writeFileSync(OUT_TS, ts.join('\n'), 'utf8');

  const s = payload.sheets['base_10']!;
  const betas = s.betas['totalCvd_female']!;
  const inp = s.inputs;
  const age10 = (inp['age']! - 55) / 10;
  const nonhdl = (inp['totalChol']! - inp['hdl']!) * 0.02586 - 3.5;
  const hdlsc = (inp['hdl']! * 0.02586 - 1.3) / 0.3;
  const sbpLt = (Math.min(inp['sbp']!, 110) - 110) / 20;
  const sbpGte = (Math.max(inp['sbp']!, 110) - 130) / 20;
  const bmiLt = (Math.min(inp['bmi']!, 30) - 25) / 5;
  const bmiGte = (Math.max(inp['bmi']!, 30) - 30) / 5;
  const egfrLt = (Math.min(inp['egfr']!, 60) - 60) / -15;
  const egfrGte = (Math.max(inp['egfr']!, 60) - 90) / -15;
  const dm = inp['diabetes']!;
  const smoke = inp['smoke']!;
  const bp = inp['antihtn']!;
  const statin = inp['statin']!;
  const terms = [
    age10,
    nonhdl,
    hdlsc,
    sbpLt,
    sbpGte,
    dm,
    smoke,
    bmiLt,
    bmiGte,
    egfrLt,
    egfrGte,
    bp,
    statin,
    bp * sbpGte,
    statin * nonhdl,
    age10 * nonhdl,
    age10 * hdlsc,
    age10 * sbpGte,
    age10 * dm,
    age10 * smoke,
    age10 * bmiGte,
    age10 * egfrLt,
    1.0,
  ];
  const lp = betas.reduce((sum, b, i) => sum + b * terms[i]!, 0);
  const risk = Math.exp(lp) / (1 + Math.exp(lp));
  const expected = s.risks['totalCvd_female']!;
  console.log(`Wrote ${OUT_JSON}`);
  console.log(`Wrote ${OUT_TS}`);
  console.log(`S12A female totalCVD computed=${risk} excel=${expected} delta=${risk - expected}`);
  if (Math.abs(risk - expected) >= 1e-12) {
    throw new Error(`Sanity check failed: ${risk} vs ${expected}`);
  }
}

main();
