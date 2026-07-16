// Author: Preston Lee

/**
 * Compare prevent-aha-goldens.csv AHA outputs vs OpenCVDRisk $evaluate (and local prevent-math).
 *
 * Usage: npx tsx scripts/compare-prevent-aha.ts
 * Env: FHIR_BASE_URL (default http://localhost:8080/fhir)
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isValidHba1c,
  isValidSdi,
  isValidUacr,
  prepTerms,
  riskFromBetas,
  selectPreventModel,
  type PreventInputs,
  type PreventModel,
  type PreventOutcome,
  type PreventSex,
} from '../src/app/features/open-cvd-risk-calculator/prevent/prevent-math';
import { PREVENT_S12_GOLDENS } from '../src/app/features/open-cvd-risk-calculator/prevent/s12-goldens';
import {
  evaluateLibrary,
  type CqlLibraryParameterValue,
} from './prevent-parity/fhir-cql';
import {
  FHIR_BASE_DEFAULT,
  parseBool,
  parseCsv,
  parseNum,
  csvEscape,
} from './prevent-parity/schema';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GOLDENS_CSV = resolve(ROOT, 'doc/prevent-parity/prevent-aha-goldens.csv');
const OUT_CSV = resolve(ROOT, 'doc/prevent-parity/prevent-aha-comparison.csv');

const TOLERANCE_PP = 0.1;

const RISK_EXPRESSIONS = [
  'SelectedPreventModel',
  'TenYearTotalCvdPercent',
  'TenYearAscvdPercent',
  'TenYearHeartFailurePercent',
  'TenYearChdPercent',
  'TenYearStrokePercent',
  'ThirtyYearTotalCvdPercent',
  'ThirtyYearAscvdPercent',
  'ThirtyYearHeartFailurePercent',
  'ThirtyYearChdPercent',
  'ThirtyYearStrokePercent',
] as const;

const OUTCOMES: readonly PreventOutcome[] = ['totalCvd', 'ascvd', 'hf', 'chd', 'stroke'];

const COMPARE_HEADERS = [
  'patient_id',
  'catalog_id',
  'display_name',
  'aha_status',
  'age_years',
  'selected_model_expected',
  'app_selected_model',
  'ts_selected_model',
  'aha_10y_total_cvd',
  'app_10y_total_cvd',
  'ts_10y_total_cvd',
  'delta_10y_total_cvd',
  'pass_10y_total_cvd',
  'aha_10y_ascvd',
  'app_10y_ascvd',
  'ts_10y_ascvd',
  'delta_10y_ascvd',
  'pass_10y_ascvd',
  'aha_10y_hf',
  'app_10y_hf',
  'ts_10y_hf',
  'delta_10y_hf',
  'pass_10y_hf',
  'aha_30y_total_cvd',
  'app_30y_total_cvd',
  'ts_30y_total_cvd',
  'delta_30y_total_cvd',
  'pass_30y_total_cvd',
  'aha_30y_ascvd',
  'app_30y_ascvd',
  'ts_30y_ascvd',
  'delta_30y_ascvd',
  'pass_30y_ascvd',
  'aha_30y_hf',
  'app_30y_hf',
  'ts_30y_hf',
  'delta_30y_hf',
  'pass_30y_hf',
  'app_10y_chd',
  'app_10y_stroke',
  'app_30y_chd',
  'app_30y_stroke',
  'ts_10y_chd',
  'ts_10y_stroke',
  'ts_30y_chd',
  'ts_30y_stroke',
  'overall_pass',
  'notes',
] as const;

function round1(n: number | null): number | null {
  if (n == null || !Number.isFinite(n)) {
    return null;
  }
  return Math.round(n * 10) / 10;
}

function numCell(n: number | null): string {
  return n == null ? '' : String(n);
}

function sheetKey(model: PreventModel, horizon: 10 | 30): string {
  return `${model}_${horizon}`;
}

function localRiskPercent(
  input: PreventInputs,
  sex: PreventSex,
  model: PreventModel,
  horizon: 10 | 30,
  outcome: PreventOutcome,
): number | null {
  const key = sheetKey(model, horizon);
  const sheet = PREVENT_S12_GOLDENS.sheets[key as keyof typeof PREVENT_S12_GOLDENS.sheets];
  if (!sheet) {
    return null;
  }
  const betas = sheet.betas[`${outcome}_${sex}` as keyof typeof sheet.betas] as unknown as
    | number[]
    | undefined;
  if (!betas) {
    return null;
  }
  const terms = prepTerms(horizon, model, input);
  return 100 * riskFromBetas(betas, terms);
}

function buildOverrides(row: Record<string, string>): Record<string, CqlLibraryParameterValue> {
  const params: Record<string, CqlLibraryParameterValue> = {
    OverrideDiabetes: parseBool(row['diabetes'] ?? '') === true,
    OverrideCurrentSmoker: parseBool(row['current_smoker'] ?? '') === true,
    OverrideAntihypertensive: parseBool(row['on_antihypertensive'] ?? '') === true,
    OverrideStatin: parseBool(row['on_statin'] ?? '') === true,
  };
  const age = parseNum(row['age_years'] ?? '');
  if (age != null) {
    params['OverrideAgeYears'] = { integer: Math.trunc(age) };
  }
  if (row['sex'] === 'female' || row['sex'] === 'male') {
    params['OverrideIsFemale'] = row['sex'] === 'female';
  }
  const tc = parseNum(row['total_chol_mg_dl'] ?? '');
  if (tc != null) {
    params['OverrideTotalCholMgDl'] = { decimal: tc };
  }
  const hdl = parseNum(row['hdl_mg_dl'] ?? '');
  if (hdl != null) {
    params['OverrideHdlMgDl'] = { decimal: hdl };
  }
  const sbp = parseNum(row['sbp_mm_hg'] ?? '');
  if (sbp != null) {
    params['OverrideSbpMmHg'] = { decimal: sbp };
  }
  const egfr = parseNum(row['egfr_ml_min_1_73m2'] ?? '');
  if (egfr != null) {
    params['OverrideEgfr'] = { decimal: egfr };
  }
  const bmi = parseNum(row['bmi_kg_m2'] ?? '');
  if (bmi != null) {
    params['OverrideBmiKgM2'] = { decimal: bmi };
  }
  const uacr = parseNum(row['uacr_mg_g'] ?? '');
  if (isValidUacr(uacr)) {
    params['OverrideUacrMgG'] = { decimal: uacr as number };
  }
  const hba1c = parseNum(row['hba1c_percent'] ?? '');
  if (isValidHba1c(hba1c)) {
    params['OverrideHba1cPercent'] = { decimal: hba1c as number };
  }
  const sdi = parseNum(row['sdi_decile'] ?? '');
  if (isValidSdi(sdi)) {
    params['OverrideSdiDecile'] = { integer: sdi as number };
  }
  return params;
}

function preventInputsFromRow(row: Record<string, string>): PreventInputs | null {
  const age = parseNum(row['age_years'] ?? '');
  const totalChol = parseNum(row['total_chol_mg_dl'] ?? '');
  const hdl = parseNum(row['hdl_mg_dl'] ?? '');
  const sbp = parseNum(row['sbp_mm_hg'] ?? '');
  const bmi = parseNum(row['bmi_kg_m2'] ?? '');
  const egfr = parseNum(row['egfr_ml_min_1_73m2'] ?? '');
  if (
    age == null ||
    totalChol == null ||
    hdl == null ||
    sbp == null ||
    bmi == null ||
    egfr == null ||
    (row['sex'] !== 'female' && row['sex'] !== 'male')
  ) {
    return null;
  }
  return {
    age,
    totalChol,
    hdl,
    sbp,
    diabetes: parseBool(row['diabetes'] ?? '') === true ? 1 : 0,
    smoke: parseBool(row['current_smoker'] ?? '') === true ? 1 : 0,
    bmi,
    egfr,
    antihtn: parseBool(row['on_antihypertensive'] ?? '') === true ? 1 : 0,
    statin: parseBool(row['on_statin'] ?? '') === true ? 1 : 0,
    uacr: parseNum(row['uacr_mg_g'] ?? ''),
    hba1c: parseNum(row['hba1c_percent'] ?? ''),
    sdi: parseNum(row['sdi_decile'] ?? ''),
  };
}

function asAppPercent(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return round1(value);
}

function compareField(
  aha: number | null,
  app: number | null,
): { delta: number | null; pass: boolean | null } {
  if (aha == null) {
    return { delta: null, pass: null };
  }
  if (app == null) {
    return { delta: null, pass: false };
  }
  const delta = round1(Math.abs(aha - app));
  return { delta, pass: Math.abs(aha - app) <= TOLERANCE_PP + 1e-9 };
}

async function main(): Promise<void> {
  const fhirBase = process.env['FHIR_BASE_URL']?.trim() || FHIR_BASE_DEFAULT;
  const { rows } = parseCsv(readFileSync(GOLDENS_CSV, 'utf8'));
  if (rows.length === 0) {
    throw new Error(`No rows in ${GOLDENS_CSV}`);
  }

  const outRows: Record<string, string>[] = [];
  let failures = 0;

  for (const row of rows) {
    const status = row['aha_status'] ?? '';
    const scorable = status === 'ok' || status === 'ok_no_30y';
    const input = preventInputsFromRow(row);
    const sex = row['sex'] as PreventSex;
    const model = input ? selectPreventModel(input) : null;

    let app: Record<string, unknown> = {};
    let evalError = '';
    if (input && (row['patient_id'] ?? '')) {
      try {
        app = await evaluateLibrary(
          fhirBase,
          'OpenCVDRisk',
          row['patient_id']!,
          RISK_EXPRESSIONS,
          buildOverrides(row),
        );
      } catch (err) {
        evalError = err instanceof Error ? err.message : String(err);
      }
    }

    const app10 = {
      totalCvd: asAppPercent(app['TenYearTotalCvdPercent']),
      ascvd: asAppPercent(app['TenYearAscvdPercent']),
      hf: asAppPercent(app['TenYearHeartFailurePercent']),
      chd: asAppPercent(app['TenYearChdPercent']),
      stroke: asAppPercent(app['TenYearStrokePercent']),
    };
    const app30 = {
      totalCvd: asAppPercent(app['ThirtyYearTotalCvdPercent']),
      ascvd: asAppPercent(app['ThirtyYearAscvdPercent']),
      hf: asAppPercent(app['ThirtyYearHeartFailurePercent']),
      chd: asAppPercent(app['ThirtyYearChdPercent']),
      stroke: asAppPercent(app['ThirtyYearStrokePercent']),
    };

    const ts10: Record<PreventOutcome, number | null> = {
      totalCvd: null,
      ascvd: null,
      hf: null,
      chd: null,
      stroke: null,
    };
    const ts30: Record<PreventOutcome, number | null> = {
      totalCvd: null,
      ascvd: null,
      hf: null,
      chd: null,
      stroke: null,
    };
    if (input && model && (sex === 'female' || sex === 'male')) {
      for (const outcome of OUTCOMES) {
        ts10[outcome] = round1(localRiskPercent(input, sex, model, 10, outcome));
        if ((parseNum(row['age_years'] ?? '') ?? 99) <= 59) {
          ts30[outcome] = round1(localRiskPercent(input, sex, model, 30, outcome));
        }
      }
    }

    const aha10 = {
      totalCvd: parseNum(row['aha_10y_total_cvd'] ?? ''),
      ascvd: parseNum(row['aha_10y_ascvd'] ?? ''),
      hf: parseNum(row['aha_10y_hf'] ?? ''),
    };
    const aha30 = {
      totalCvd: parseNum(row['aha_30y_total_cvd'] ?? ''),
      ascvd: parseNum(row['aha_30y_ascvd'] ?? ''),
      hf: parseNum(row['aha_30y_hf'] ?? ''),
    };

    const c10t = compareField(aha10.totalCvd, app10.totalCvd);
    const c10a = compareField(aha10.ascvd, app10.ascvd);
    const c10h = compareField(aha10.hf, app10.hf);
    const c30t = compareField(aha30.totalCvd, app30.totalCvd);
    const c30a = compareField(aha30.ascvd, app30.ascvd);
    const c30h = compareField(aha30.hf, app30.hf);

    const passBits = [c10t.pass, c10a.pass, c10h.pass, c30t.pass, c30a.pass, c30h.pass].filter(
      (p): p is boolean => p != null,
    );
    const overallPass = scorable && passBits.length > 0 && passBits.every(Boolean);
    if (scorable && !overallPass) {
      failures += 1;
    }

    const notes: string[] = [];
    if (!scorable) {
      notes.push(`skipped_aha_status=${status || 'blank'}`);
    }
    if (evalError) {
      notes.push(`eval_error=${evalError}`);
    }
    if (model && app['SelectedPreventModel'] && model !== app['SelectedPreventModel']) {
      notes.push(`model_mismatch_ts=${model}_app=${String(app['SelectedPreventModel'])}`);
    }

    const out: Record<string, string> = {
      patient_id: row['patient_id'] ?? '',
      catalog_id: row['catalog_id'] ?? '',
      display_name: row['display_name'] ?? '',
      aha_status: status,
      age_years: row['age_years'] ?? '',
      selected_model_expected: row['selected_model_expected'] ?? '',
      app_selected_model: typeof app['SelectedPreventModel'] === 'string' ? app['SelectedPreventModel'] : '',
      ts_selected_model: model ?? '',
      aha_10y_total_cvd: numCell(aha10.totalCvd),
      app_10y_total_cvd: numCell(app10.totalCvd),
      ts_10y_total_cvd: numCell(ts10.totalCvd),
      delta_10y_total_cvd: numCell(c10t.delta),
      pass_10y_total_cvd: c10t.pass == null ? '' : String(c10t.pass),
      aha_10y_ascvd: numCell(aha10.ascvd),
      app_10y_ascvd: numCell(app10.ascvd),
      ts_10y_ascvd: numCell(ts10.ascvd),
      delta_10y_ascvd: numCell(c10a.delta),
      pass_10y_ascvd: c10a.pass == null ? '' : String(c10a.pass),
      aha_10y_hf: numCell(aha10.hf),
      app_10y_hf: numCell(app10.hf),
      ts_10y_hf: numCell(ts10.hf),
      delta_10y_hf: numCell(c10h.delta),
      pass_10y_hf: c10h.pass == null ? '' : String(c10h.pass),
      aha_30y_total_cvd: numCell(aha30.totalCvd),
      app_30y_total_cvd: numCell(app30.totalCvd),
      ts_30y_total_cvd: numCell(ts30.totalCvd),
      delta_30y_total_cvd: numCell(c30t.delta),
      pass_30y_total_cvd: c30t.pass == null ? '' : String(c30t.pass),
      aha_30y_ascvd: numCell(aha30.ascvd),
      app_30y_ascvd: numCell(app30.ascvd),
      ts_30y_ascvd: numCell(ts30.ascvd),
      delta_30y_ascvd: numCell(c30a.delta),
      pass_30y_ascvd: c30a.pass == null ? '' : String(c30a.pass),
      aha_30y_hf: numCell(aha30.hf),
      app_30y_hf: numCell(app30.hf),
      ts_30y_hf: numCell(ts30.hf),
      delta_30y_hf: numCell(c30h.delta),
      pass_30y_hf: c30h.pass == null ? '' : String(c30h.pass),
      app_10y_chd: numCell(app10.chd),
      app_10y_stroke: numCell(app10.stroke),
      app_30y_chd: numCell(app30.chd),
      app_30y_stroke: numCell(app30.stroke),
      ts_10y_chd: numCell(ts10.chd),
      ts_10y_stroke: numCell(ts10.stroke),
      ts_30y_chd: numCell(ts30.chd),
      ts_30y_stroke: numCell(ts30.stroke),
      overall_pass: scorable ? String(overallPass) : '',
      notes: notes.join('; '),
    };
    outRows.push(out);

    console.log(
      `${row['catalog_id']}: status=${status || 'blank'} app10yCVD=${numCell(app10.totalCvd)} aha=${numCell(aha10.totalCvd)} pass=${scorable ? overallPass : 'n/a'}`,
    );
  }

  const lines = [
    COMPARE_HEADERS.join(','),
    ...outRows.map((r) => COMPARE_HEADERS.map((h) => csvEscape(r[h] ?? '')).join(',')),
  ];
  mkdirSync(dirname(OUT_CSV), { recursive: true });
  writeFileSync(OUT_CSV, lines.join('\n') + '\n', 'utf8');
  console.log(`\nWrote ${OUT_CSV}`);
  if (failures > 0) {
    console.error(`${failures} scorable patient(s) failed AHA vs app tolerance (${TOLERANCE_PP} pp)`);
    process.exit(1);
  }
  const scorableCount = outRows.filter((r) => r['aha_status'] === 'ok' || r['aha_status'] === 'ok_no_30y').length;
  if (scorableCount === 0) {
    console.warn('No scorable AHA rows yet (aha_status blank). Comparison CSV includes app/ts columns for drafting.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
