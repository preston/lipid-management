// Author: Preston Lee

/** Shared schema for prevent-aha-goldens.csv archival contract. */

export const AHA_CALCULATOR_URL =
  'https://professional.heart.org/en/guidelines-and-statements/prevent-calculator';

export const FHIR_BASE_DEFAULT = 'http://localhost:8080/fhir';

export const CATALOG_PATIENTS = [
  {
    catalogId: 'marco',
    patientId: 'c6263db8-ac6d-4f67-89cd-520c9bcd32bd',
    label: 'Marco Balistreri',
  },
  {
    catalogId: 'aja',
    patientId: 'c8a81d80-45e4-cc3c-534a-b5c384f7357d',
    label: 'Aja Cormier',
  },
  {
    catalogId: 'ahmad',
    patientId: 'ae2fc04e-7c66-5451-f7a8-dfc489ee265c',
    label: 'Ahmad Schulist',
  },
  {
    catalogId: 'jeromy',
    patientId: '0ac99efa-66a6-ab32-581f-651621eb2194',
    label: 'Jeromy Boyer',
  },
  {
    catalogId: 'german',
    patientId: '00c57650-013d-27a1-513f-b865c14a29ca',
    label: 'German Zemlak',
  },
  {
    catalogId: 'katharine',
    patientId: '52227b7c-b95b-3291-55c5-dd159f545fbb',
    label: 'Katharine Hudson',
  },
  {
    catalogId: 'rhett',
    patientId: '459ce83f-8a46-af89-447d-549e5e846740',
    label: 'Rhett Kulas',
  },
  {
    catalogId: 'tracie',
    patientId: '16ac2432-87ea-4992-8fe9-3143ee9f5ed8',
    label: 'Tracie Weber',
  },
] as const;

export type AhaStatus =
  | 'ok'
  | 'ok_no_30y'
  | 'refused_exclusion'
  | 'incomplete_inputs'
  | 'manual_review'
  | '';

export const GOLDENS_HEADERS = [
  // Identity / capture metadata
  'patient_id',
  'catalog_id',
  'display_name',
  'gender',
  'birth_date',
  'scenario',
  'age_as_of',
  'age_years',
  'fhir_base_url',
  'opencvd_library_version',
  'extracted_at',
  'aha_captured_at',
  'aha_calculator_url',
  'aha_status',
  'aha_message',
  'notes',
  // Required inputs
  'sex',
  'total_chol_mg_dl',
  'hdl_mg_dl',
  'sbp_mm_hg',
  'height_cm',
  'weight_kg',
  'bmi_kg_m2',
  'egfr_ml_min_1_73m2',
  'creatinine_mg_dl',
  'diabetes',
  'current_smoker',
  'on_antihypertensive',
  'on_statin',
  // Optional predictors
  'uacr_mg_g',
  'hba1c_percent',
  'zip_code',
  'sdi_decile',
  'optional_uacr_entered',
  'optional_hba1c_entered',
  'optional_zip_entered',
  'selected_model_expected',
  // Provenance
  'prov_total_chol_obs_id',
  'prov_total_chol_effective',
  'prov_hdl_obs_id',
  'prov_hdl_effective',
  'prov_sbp_obs_id',
  'prov_sbp_effective',
  'prov_creatinine_obs_id',
  'prov_creatinine_effective',
  'prov_height_obs_id',
  'prov_height_effective',
  'prov_weight_obs_id',
  'prov_weight_effective',
  'prov_smoking_obs_id',
  'prov_smoking_effective',
  // Chart applicability
  'excl_age_out_of_range',
  'excl_known_cvd',
  'excl_lvef_below_40',
  'excl_hfref',
  'excl_cac_ge_300',
  'excl_eskd',
  'excl_inherited_cvd',
  'lvef_percent',
  'cac_score',
  // AHA outputs
  'aha_10y_total_cvd',
  'aha_10y_ascvd',
  'aha_10y_hf',
  'aha_30y_total_cvd',
  'aha_30y_ascvd',
  'aha_30y_hf',
  'aha_prevent_age',
  'aha_30y_cvd_percentile',
  'aha_10y_chd',
  'aha_10y_stroke',
  'aha_30y_chd',
  'aha_30y_stroke',
] as const;

export type GoldensHeader = (typeof GOLDENS_HEADERS)[number];
export type GoldensRow = Record<GoldensHeader, string>;

export function emptyGoldensRow(): GoldensRow {
  const row = {} as GoldensRow;
  for (const h of GOLDENS_HEADERS) {
    row[h] = '';
  }
  return row;
}

export function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function rowsToCsv(rows: readonly GoldensRow[]): string {
  const lines = [GOLDENS_HEADERS.join(',')];
  for (const row of rows) {
    lines.push(GOLDENS_HEADERS.map((h) => csvEscape(row[h] ?? '')).join(','));
  }
  return lines.join('\n') + '\n';
}

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }
  const headers = splitCsvLine(lines[0]!);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!);
    const row: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      row[headers[c]!] = cells[c] ?? '';
    }
    rows.push(row);
  }
  return { headers, rows };
}

export function splitCsvLine(line: string): string[] {
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

export function boolStr(v: boolean): string {
  return v ? 'true' : 'false';
}

export function numStr(v: number | null | undefined, digits?: number): string {
  if (v == null || !Number.isFinite(v)) {
    return '';
  }
  if (digits != null) {
    return String(Number(v.toFixed(digits)));
  }
  return String(v);
}

export function parseBool(raw: string): boolean | null {
  if (raw === 'true') {
    return true;
  }
  if (raw === 'false') {
    return false;
  }
  return null;
}

export function parseNum(raw: string): number | null {
  if (raw === '' || raw == null) {
    return null;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function ageYearsOnDate(birthDate: string, asOfIsoDate: string): number | null {
  const born = new Date(birthDate + 'T00:00:00');
  const asOf = new Date(asOfIsoDate + 'T00:00:00');
  if (Number.isNaN(born.getTime()) || Number.isNaN(asOf.getTime())) {
    return null;
  }
  let age = asOf.getFullYear() - born.getFullYear();
  const m = asOf.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && asOf.getDate() < born.getDate())) {
    age -= 1;
  }
  return age;
}

export function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function nowIsoTimestamp(): string {
  return new Date().toISOString();
}

export function validateGoldensRows(rows: Record<string, string>[]): string[] {
  const errors: string[] = [];
  if (rows.length !== CATALOG_PATIENTS.length) {
    errors.push(`Expected ${CATALOG_PATIENTS.length} rows, got ${rows.length}`);
  }
  const expectedIds = new Set(CATALOG_PATIENTS.map((p) => p.patientId));
  const seen = new Set<string>();
  for (const row of rows) {
    const id = row['patient_id'] ?? '';
    if (!expectedIds.has(id)) {
      errors.push(`Unexpected patient_id: ${id}`);
    }
    if (seen.has(id)) {
      errors.push(`Duplicate patient_id: ${id}`);
    }
    seen.add(id);

    const status = (row['aha_status'] ?? '') as AhaStatus | '';
    const age = parseNum(row['age_years'] ?? '');
    const height = parseNum(row['height_cm'] ?? '');
    const weight = parseNum(row['weight_kg'] ?? '');
    const bmi = parseNum(row['bmi_kg_m2'] ?? '');

    if (height != null && weight != null && bmi != null) {
      const computed = weight / (height / 100) ** 2;
      if (Math.abs(computed - bmi) > 0.05) {
        errors.push(`${id}: BMI ${bmi} inconsistent with height/weight (computed ${computed.toFixed(3)})`);
      }
    }

    const optUacr = row['optional_uacr_entered'] === 'true';
    const optHba = row['optional_hba1c_entered'] === 'true';
    const optZip = row['optional_zip_entered'] === 'true';
    if (optUacr !== ((row['uacr_mg_g'] ?? '') !== '')) {
      errors.push(`${id}: optional_uacr_entered inconsistent with uacr_mg_g`);
    }
    if (optHba !== ((row['hba1c_percent'] ?? '') !== '')) {
      errors.push(`${id}: optional_hba1c_entered inconsistent with hba1c_percent`);
    }
    if (optZip !== ((row['zip_code'] ?? '') !== '')) {
      errors.push(`${id}: optional_zip_entered inconsistent with zip_code`);
    }

    if (status === 'ok' || status === 'ok_no_30y') {
      const required = [
        'sex',
        'total_chol_mg_dl',
        'hdl_mg_dl',
        'sbp_mm_hg',
        'bmi_kg_m2',
        'egfr_ml_min_1_73m2',
        'diabetes',
        'current_smoker',
        'on_antihypertensive',
        'on_statin',
        'age_years',
      ];
      for (const col of required) {
        if (!(row[col] ?? '').trim()) {
          errors.push(`${id}: missing required input ${col} for aha_status=${status}`);
        }
      }
      for (const col of ['aha_10y_total_cvd', 'aha_10y_ascvd', 'aha_10y_hf']) {
        if (!(row[col] ?? '').trim()) {
          errors.push(`${id}: missing ${col} for aha_status=${status}`);
        }
      }
      if (status === 'ok' && age != null && age <= 59) {
        for (const col of ['aha_30y_total_cvd', 'aha_30y_ascvd', 'aha_30y_hf']) {
          if (!(row[col] ?? '').trim()) {
            errors.push(`${id}: missing ${col} for aha_status=ok age<=59`);
          }
        }
      }
      if (age != null && age >= 60) {
        if (status !== 'ok_no_30y') {
          errors.push(`${id}: age>=60 should use aha_status=ok_no_30y (got ${status})`);
        }
        for (const col of ['aha_30y_total_cvd', 'aha_30y_ascvd', 'aha_30y_hf']) {
          if ((row[col] ?? '').trim()) {
            errors.push(`${id}: age>=60 should leave ${col} empty`);
          }
        }
      }
    }

    if (status === 'refused_exclusion') {
      if (!(row['aha_message'] ?? '').trim()) {
        errors.push(`${id}: refused_exclusion requires aha_message`);
      }
    }
  }
  return errors;
}
