// Author: Preston Lee

import { TestBed } from '@angular/core/testing';
import { provideHttpClient, HttpRequest } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { FhirLibraryService } from './fhir-library.service';
import { SettingsService } from './settings.service';
import { Settings } from '../models/settings.model';
import { Library } from 'fhir/r4';
import { encodeUtf8Base64 } from './utf8-encoding.lib';

async function nextRequest(
  http: HttpTestingController,
  predicate: (req: HttpRequest<unknown>) => boolean,
): Promise<TestRequest> {
  for (let i = 0; i < 20; i++) {
    const matches = http.match(predicate);
    if (matches.length === 1) {
      return matches[0];
    }
    if (matches.length > 1) {
      throw new Error(`Expected one request, found ${matches.length}`);
    }
    await Promise.resolve();
  }
  return http.expectOne(predicate);
}

describe('FhirLibraryService', () => {
  let service: FhirLibraryService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const settings = TestBed.inject(SettingsService);
    settings.settings.set(
      Object.assign(new Settings(), { fhirBaseUrl: 'http://fhir.test/fhir' }),
    );
    service = TestBed.inject(FhirLibraryService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('reports missing when Library GET returns 404', async () => {
    const promise = service.auditCatalogLibraries([
      { id: 'BMI', assetPath: '/cql/BMI.cql', label: 'BMI', description: 'BMI library' },
    ]);
    (await nextRequest(http, (r) => r.url === '/cql/BMI.cql')).flush(
      "library BMI version '1.0.0'",
    );
    (await nextRequest(http, (r) => r.url === 'http://fhir.test/fhir/Library/BMI')).flush(null, {
      status: 404,
      statusText: 'Not Found',
    });
    const results = await promise;
    expect(results[0].status).toBe('missing');
    expect(results[0].appVersion).toBe('1.0.0');
  });

  it('reports match when server text/cql equals app asset', async () => {
    const cql = "library BMI version '1.0.0'\ndefine X: 1";
    const library: Library = {
      resourceType: 'Library',
      id: 'BMI',
      version: '1.0.0',
      status: 'active',
      type: {},
      content: [{ contentType: 'text/cql', data: encodeUtf8Base64(cql) }],
    };
    const promise = service.auditCatalogLibraries([
      { id: 'BMI', assetPath: '/cql/BMI.cql', label: 'BMI', description: 'BMI library' },
    ]);
    (await nextRequest(http, (r) => r.url === '/cql/BMI.cql')).flush(cql);
    (await nextRequest(http, (r) => r.url === 'http://fhir.test/fhir/Library/BMI')).flush(library);
    const results = await promise;
    expect(results[0].status).toBe('match');
  });

  it('reports version_mismatch when content matches but Library.version differs', async () => {
    const cql = "library BMI version '1.0.0'\ndefine X: 1";
    const library: Library = {
      resourceType: 'Library',
      id: 'BMI',
      version: '0.9.0',
      status: 'active',
      type: {},
      content: [{ contentType: 'text/cql', data: encodeUtf8Base64(cql) }],
    };
    const promise = service.auditCatalogLibraries([
      { id: 'BMI', assetPath: '/cql/BMI.cql', label: 'BMI', description: 'BMI library' },
    ]);
    (await nextRequest(http, (r) => r.url === '/cql/BMI.cql')).flush(cql);
    (await nextRequest(http, (r) => r.url === 'http://fhir.test/fhir/Library/BMI')).flush(library);
    const results = await promise;
    expect(results[0].status).toBe('version_mismatch');
    expect(results[0].message).toBe('Server version must be 1.0.0');
  });

  it('reports version_mismatch when content matches but server version is null', async () => {
    const cql = "library BMI version '1.0.0'\ndefine X: 1";
    const library: Library = {
      resourceType: 'Library',
      id: 'BMI',
      status: 'active',
      type: {},
      content: [{ contentType: 'text/cql', data: encodeUtf8Base64(cql) }],
    };
    const promise = service.auditCatalogLibraries([
      { id: 'BMI', assetPath: '/cql/BMI.cql', label: 'BMI', description: 'BMI library' },
    ]);
    (await nextRequest(http, (r) => r.url === '/cql/BMI.cql')).flush(cql);
    (await nextRequest(http, (r) => r.url === 'http://fhir.test/fhir/Library/BMI')).flush(library);
    const results = await promise;
    expect(results[0].status).toBe('version_mismatch');
    expect(results[0].serverVersion).toBeNull();
    expect(results[0].message).toBe('Server version must be 1.0.0');
  });

  it('builds Library with text/cql content from CQL source', () => {
    const library = service.buildLibraryFromCql(
      "library OpenCVDRisk version '0.4.0'",
      'OpenCVDRisk.cql',
    );
    expect(library.id).toBe('OpenCVDRisk');
    expect(library.version).toBe('0.4.0');
    expect(library.content?.[0]?.contentType).toBe('text/cql');
    expect(library.content?.[0]?.data).toBeTruthy();
  });
});
