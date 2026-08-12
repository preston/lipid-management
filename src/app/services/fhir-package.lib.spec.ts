// Author: Preston Lee

import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { Bundle, Library } from 'fhir/r4';
import {
  PACKAGE_AUTHOR,
  PACKAGE_FHIR_VERSION,
  PACKAGE_LICENSE,
  PACKAGE_NAME,
  buildIndexJson,
  buildPackageJson,
  buildTarGz,
  encodeUtf8Json,
  parseCqlRelatedArtifacts,
  resourceFileName,
  stripCqlComments,
} from './fhir-package.lib';

describe('fhir-package.lib', () => {
  it('buildPackageJson includes required FHIR npm fields', () => {
    const manifest = buildPackageJson('0.1.1', new Date('2026-08-12T00:01:02Z'));
    expect(manifest.name).toBe(PACKAGE_NAME);
    expect(manifest.version).toBe('0.1.1');
    expect(manifest.author).toBe(PACKAGE_AUTHOR);
    expect(manifest.license).toBe(PACKAGE_LICENSE);
    expect(manifest.fhirVersions).toEqual([PACKAGE_FHIR_VERSION]);
    expect(manifest.type).toBe('Conformance');
    expect(manifest.dependencies['hl7.fhir.r4.core']).toBe('4.0.1');
    expect(manifest.dependencies['hl7.fhir.uv.cql']).toBe('2.0.0');
    expect(manifest.date).toBe('20260812000102');
  });

  it('buildIndexJson uses index-version 2 and string primitives only', () => {
    const index = buildIndexJson([
      {
        filename: 'Library-BMI.json',
        resource: {
          resourceType: 'Library',
          id: 'BMI',
          url: 'https://asu.edu/fhir/Library/BMI',
          version: '1.0.0',
          status: 'active',
          type: { coding: [{ code: 'logic-library' }] },
        } as Library,
      },
      {
        filename: 'Bundle-patient.json',
        resource: {
          resourceType: 'Bundle',
          type: 'transaction',
        } as Bundle,
      },
    ]);

    expect(index['index-version']).toBe(2);
    expect(index.files).toHaveLength(2);
    expect(index.files[0]).toEqual({
      filename: 'Bundle-patient.json',
      resourceType: 'Bundle',
      type: 'transaction',
    });
    expect(index.files[1]).toEqual({
      filename: 'Library-BMI.json',
      resourceType: 'Library',
      id: 'BMI',
      url: 'https://asu.edu/fhir/Library/BMI',
      version: '1.0.0',
    });
  });

  it('stripCqlComments preserves URLs containing //', () => {
    const cql = "valueset \"X\": 'https://asu.edu/fhir/ValueSet/foo'";
    expect(stripCqlComments(cql)).toBe(cql);
  });

  it('parseCqlRelatedArtifacts extracts model, includes, valuesets, and codesystems', () => {
    const cql = `
      using FHIR version '4.0.1'
      include FHIRHelpers version '4.0.1'
      include BMI version '1.0.0'
      valueset "BodyWeight": 'https://asu.edu/fhir/ValueSet/body-weight'
      codesystem "LOINC": 'http://loinc.org'
    `;
    const artifacts = parseCqlRelatedArtifacts(cql);
    const resources = artifacts.map((a) => a.resource);
    expect(resources).toContain('http://hl7.org/fhir/uv/cql/Library/FHIR-ModelInfo|4.0.1');
    expect(resources).toContain('http://hl7.org/fhir/uv/cql/Library/FHIRHelpers|4.0.1');
    expect(resources).toContain('https://asu.edu/fhir/Library/BMI|1.0.0');
    expect(resources).toContain('https://asu.edu/fhir/ValueSet/body-weight');
    expect(resources).toContain('http://loinc.org');
    expect(artifacts.every((a) => a.type === 'depends-on')).toBe(true);
  });

  it('buildTarGz produces gzip archive with expected member paths', () => {
    const entries = [
      {
        path: 'package/package.json',
        bytes: encodeUtf8Json({ name: PACKAGE_NAME, version: '0.1.1' }),
      },
      {
        path: 'package/Library-BMI.json',
        bytes: encodeUtf8Json({ resourceType: 'Library', id: 'BMI' }),
      },
      {
        path: 'package/.index.json',
        bytes: encodeUtf8Json({ 'index-version': 2, files: [] }),
      },
    ];
    const archive = buildTarGz(entries);
    expect(archive[0]).toBe(0x1f);
    expect(archive[1]).toBe(0x8b);

    const tar = gunzipSync(archive);
    const tarText = Buffer.from(tar).toString('utf8');
    expect(tarText).toContain('package/package.json');
    expect(tarText).toContain('package/Library-BMI.json');
    expect(tarText).toContain('package/.index.json');
  });

  it('resourceFileName follows Type-id convention', () => {
    expect(resourceFileName('ValueSet', 'body-weight')).toBe('ValueSet-body-weight.json');
  });
});
