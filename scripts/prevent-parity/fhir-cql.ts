// Author: Preston Lee

import type { Observation, Parameters, ParametersParameter, Patient, Quantity } from 'fhir/r4';

export type CqlLibraryParameterValue =
  | boolean
  | string
  | number
  | { integer: number }
  | { decimal: number };

export async function fhirGetJson<T>(baseUrl: string, path: string): Promise<T> {
  const url = `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  const res = await fetch(url, { headers: { Accept: 'application/fhir+json' } });
  if (!res.ok) {
    throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function evaluateLibrary(
  baseUrl: string,
  libraryId: string,
  patientId: string,
  expressionNames: readonly string[],
  libraryParameters?: Record<string, CqlLibraryParameterValue>,
): Promise<Record<string, unknown>> {
  const parameter: ParametersParameter[] = [
    { name: 'subject', valueString: `Patient/${patientId}` },
    ...libraryParameterParts(libraryParameters),
    ...expressionNames.map(
      (name): ParametersParameter => ({ name: 'expression', valueString: name }),
    ),
  ];
  const body: Parameters = { resourceType: 'Parameters', parameter };
  const url = `${baseUrl.replace(/\/$/, '')}/Library/${encodeURIComponent(libraryId)}/$evaluate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/fhir+json',
      'Content-Type': 'application/fhir+json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`$evaluate ${libraryId} for ${patientId} failed: ${res.status} ${text.slice(0, 400)}`);
  }
  const params = (await res.json()) as Parameters;
  return parametersToMap(params);
}

function libraryParameterParts(
  libraryParameters?: Record<string, CqlLibraryParameterValue>,
): ParametersParameter[] {
  if (!libraryParameters || Object.keys(libraryParameters).length === 0) {
    return [];
  }
  const nested: ParametersParameter[] = [];
  for (const [name, value] of Object.entries(libraryParameters)) {
    nested.push(toLibraryParameterPart(name, value));
  }
  return [
    {
      name: 'parameters',
      resource: {
        resourceType: 'Parameters',
        parameter: nested,
      } as Parameters,
    },
  ];
}

function toLibraryParameterPart(
  name: string,
  value: CqlLibraryParameterValue,
): ParametersParameter {
  const part: ParametersParameter = { name };
  if (typeof value === 'boolean') {
    part.valueBoolean = value;
    return part;
  }
  if (typeof value === 'string') {
    part.valueString = value;
    return part;
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      part.valueInteger = value;
    } else {
      part.valueDecimal = value;
    }
    return part;
  }
  if ('integer' in value) {
    part.valueInteger = value.integer;
    return part;
  }
  part.valueDecimal = value.decimal;
  return part;
}

function parametersToMap(parameters: Parameters): Record<string, unknown> {
  const evaluationError = (parameters.parameter ?? []).find(
    (p) => p.name === 'evaluation error' || p.name === 'evaluationError',
  );
  if (evaluationError) {
    throw new Error('CQL evaluation error in Parameters response');
  }
  const out: Record<string, unknown> = {};
  for (const p of parameters.parameter ?? []) {
    if (!p.name) {
      continue;
    }
    out[p.name] = readParameterValue(p);
  }
  return out;
}

function readParameterValue(p: ParametersParameter): unknown {
  if (p.resource) {
    return p.resource;
  }
  if (p.valueBoolean != null) {
    return p.valueBoolean;
  }
  if (p.valueInteger != null) {
    return p.valueInteger;
  }
  if (p.valueDecimal != null) {
    return p.valueDecimal;
  }
  if (p.valueString != null) {
    return p.valueString;
  }
  if (p.valueDate != null) {
    return p.valueDate;
  }
  if (p.valueDateTime != null) {
    return p.valueDateTime;
  }
  if (p.valueQuantity) {
    return p.valueQuantity;
  }
  return null;
}

export function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (value && typeof value === 'object' && 'value' in value) {
    const q = value as Quantity;
    if (typeof q.value === 'number' && Number.isFinite(q.value)) {
      return q.value;
    }
  }
  return null;
}

export function observationMeta(raw: unknown): { id: string; effective: string } {
  const obs = raw as Observation | null;
  if (!obs || obs.resourceType !== 'Observation') {
    return { id: '', effective: '' };
  }
  const effectiveRaw =
    typeof obs.effectiveDateTime === 'string'
      ? obs.effectiveDateTime
      : obs.effectivePeriod?.start;
  return { id: obs.id ?? '', effective: effectiveRaw ?? '' };
}

export function creatinineMgDlFromObservation(raw: unknown): number | null {
  const obs = raw as Observation | null;
  if (!obs || obs.resourceType !== 'Observation') {
    return null;
  }
  const q = obs.valueQuantity;
  if (!q || typeof q.value !== 'number' || !Number.isFinite(q.value)) {
    return null;
  }
  const unit = (q.unit ?? q.code ?? '').toLowerCase();
  // µmol/L → mg/dL
  if (unit.includes('umol') || unit.includes('µmol') || unit.includes('mmol')) {
    if (unit.includes('mmol')) {
      return q.value * 11.312; // mmol/L → mg/dL roughly for creatinine
    }
    return q.value / 88.4;
  }
  return q.value;
}

export function patientDisplayName(patient: Patient): string {
  const name = patient.name?.[0];
  if (!name) {
    return patient.id ?? '';
  }
  const given = (name.given ?? []).join(' ');
  const family = name.family ?? '';
  return [given, family].filter(Boolean).join(' ').trim() || (patient.id ?? '');
}
