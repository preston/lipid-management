// Author: Preston Lee

import type { Bundle, BundleEntry, Patient, Resource } from 'fhir/r4';

export type ClientFhirBundleSuccess = {
  bundle: Bundle;
  patient: Patient;
};

export type ClientFhirBundleFailure = {
  error: string;
};

export type ClientFhirBundleResult = ClientFhirBundleSuccess | ClientFhirBundleFailure;

export function parseClientFhirJson(text: string): { ok: true; value: unknown } | ClientFhirBundleFailure {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { error: 'File is not valid JSON.' };
  }
}

/**
 * Validates a client-provided FHIR Bundle for calculator evaluate: exactly one Patient
 * with an id among entries. Returns a normalized collection Bundle suitable for the
 * CQL-with-FHIR $evaluate `data` parameter (strips transaction `request` fields).
 */
export function validateClientFhirPatientBundle(json: unknown): ClientFhirBundleResult {
  if (json == null || typeof json !== 'object' || Array.isArray(json)) {
    return { error: 'Expected a FHIR Bundle JSON object.' };
  }

  const candidate = json as Record<string, unknown>;
  if (candidate['resourceType'] !== 'Bundle') {
    return { error: 'JSON resourceType must be Bundle.' };
  }

  const rawEntries = candidate['entry'];
  if (rawEntries != null && !Array.isArray(rawEntries)) {
    return { error: 'Bundle.entry must be an array when present.' };
  }

  const entries = (rawEntries as BundleEntry[] | undefined) ?? [];
  const patients = entries
    .map((e) => e?.resource)
    .filter((r): r is Patient => r?.resourceType === 'Patient');

  if (patients.length === 0) {
    return { error: 'Bundle must contain exactly one Patient resource entry.' };
  }
  if (patients.length > 1) {
    return {
      error: `Bundle must contain exactly one Patient resource entry (found ${patients.length}).`,
    };
  }

  const patient = patients[0];
  if (!patient.id || patient.id.trim() === '') {
    return { error: 'The Patient resource must have a non-empty id.' };
  }

  const bundle = normalizeBundleForEvaluateData(candidate as unknown as Bundle);
  return { bundle, patient };
}

function normalizeBundleForEvaluateData(source: Bundle): Bundle {
  const entry = (source.entry ?? []).map((e): BundleEntry => {
    const next: BundleEntry = {};
    if (e.fullUrl) {
      next.fullUrl = e.fullUrl;
    }
    if (e.resource) {
      next.resource = e.resource as Resource;
    }
    return next;
  });

  return {
    resourceType: 'Bundle',
    type: 'collection',
    entry,
  };
}
