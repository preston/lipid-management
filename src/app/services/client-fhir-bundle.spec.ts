// Author: Preston Lee

import type { Bundle, Patient } from 'fhir/r4';
import {
  parseClientFhirJson,
  validateClientFhirPatientBundle,
} from './client-fhir-bundle';

describe('client-fhir-bundle', () => {
  const patient = (id?: string): Patient => ({
    resourceType: 'Patient',
    ...(id != null ? { id } : {}),
    name: [{ family: 'Test', given: ['Pat'] }],
  });

  it('parseClientFhirJson returns error for invalid JSON', () => {
    expect(parseClientFhirJson('{not json')).toEqual({ error: 'File is not valid JSON.' });
  });

  it('parseClientFhirJson returns parsed value for valid JSON', () => {
    expect(parseClientFhirJson('{"resourceType":"Bundle"}')).toEqual({
      ok: true,
      value: { resourceType: 'Bundle' },
    });
  });

  it('rejects non-object and non-Bundle inputs', () => {
    expect(validateClientFhirPatientBundle(null)).toEqual({
      error: 'Expected a FHIR Bundle JSON object.',
    });
    expect(validateClientFhirPatientBundle([])).toEqual({
      error: 'Expected a FHIR Bundle JSON object.',
    });
    expect(validateClientFhirPatientBundle({ resourceType: 'Patient' })).toEqual({
      error: 'JSON resourceType must be Bundle.',
    });
  });

  it('rejects Bundle with zero Patient entries', () => {
    const hospitalShaped: Bundle = {
      resourceType: 'Bundle',
      type: 'batch',
      entry: [
        {
          resource: { resourceType: 'Organization', id: 'org-1' },
        },
      ],
    };
    expect(validateClientFhirPatientBundle(hospitalShaped)).toEqual({
      error: 'Bundle must contain exactly one Patient resource entry.',
    });
  });

  it('rejects Bundle with two Patient entries', () => {
    const result = validateClientFhirPatientBundle({
      resourceType: 'Bundle',
      type: 'collection',
      entry: [{ resource: patient('a') }, { resource: patient('b') }],
    });
    expect(result).toEqual({
      error: 'Bundle must contain exactly one Patient resource entry (found 2).',
    });
  });

  it('rejects Patient without id', () => {
    expect(
      validateClientFhirPatientBundle({
        resourceType: 'Bundle',
        type: 'collection',
        entry: [{ resource: patient() }],
      }),
    ).toEqual({ error: 'The Patient resource must have a non-empty id.' });
  });

  it('accepts multi-resource Synthea-shaped transaction and normalizes for data', () => {
    const result = validateClientFhirPatientBundle({
      resourceType: 'Bundle',
      type: 'transaction',
      entry: [
        {
          fullUrl: 'urn:uuid:patient-1',
          resource: patient('patient-1'),
          request: { method: 'POST', url: 'Patient' },
        },
        {
          fullUrl: 'urn:uuid:obs-1',
          resource: {
            resourceType: 'Observation',
            id: 'obs-1',
            status: 'final',
            code: { text: 'LDL' },
          },
          request: { method: 'POST', url: 'Observation' },
        },
      ],
    });

    expect('error' in result).toBe(false);
    if ('error' in result) {
      return;
    }

    expect(result.patient.id).toBe('patient-1');
    expect(result.bundle.type).toBe('collection');
    expect(result.bundle.entry?.length).toBe(2);
    expect(result.bundle.entry?.[0].fullUrl).toBe('urn:uuid:patient-1');
    expect(result.bundle.entry?.[0].resource?.resourceType).toBe('Patient');
    expect(result.bundle.entry?.[0].request).toBeUndefined();
    expect(result.bundle.entry?.[1].request).toBeUndefined();
    expect(result.bundle.entry?.[1].resource?.resourceType).toBe('Observation');
  });
});
