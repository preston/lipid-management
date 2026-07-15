// Author: Preston Lee

import { TestBed } from '@angular/core/testing';
import { provideHttpClient, HttpRequest } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { FhirBundleLoaderService } from './fhir-bundle-loader.service';
import { SettingsService } from './settings.service';
import { Settings } from '../models/settings.model';
import { EXAMPLE_DATA_CATALOG } from '../features/loader/loader.catalog';

const bmiAsset = {
  resourceType: 'Bundle',
  type: 'transaction',
  entry: [
    {
      resource: {
        resourceType: 'ValueSet',
        id: 'body-mass-index',
        version: '2026-07-15',
        status: 'active',
      },
    },
  ],
};

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

describe('FhirBundleLoaderService', () => {
  let service: FhirBundleLoaderService;
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
    service = TestBed.inject(FhirBundleLoaderService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('orders example data hospital → practitioner → patients', () => {
    const hospital = EXAMPLE_DATA_CATALOG.find((e) => e.id === 'hospital')!;
    const practitioner = EXAMPLE_DATA_CATALOG.find((e) => e.id === 'practitioner')!;
    const marco = EXAMPLE_DATA_CATALOG.find((e) => e.id === 'marco')!;
    const aja = EXAMPLE_DATA_CATALOG.find((e) => e.id === 'aja')!;
    const shuffled = [aja, hospital, marco, practitioner];
    const ordered = service.orderExampleEntries(shuffled);
    expect(ordered.map((e) => e.id)).toEqual(['hospital', 'practitioner', 'marco', 'aja']);
  });

  it('checks patient example as present on 200', async () => {
    const marco = EXAMPLE_DATA_CATALOG.find((e) => e.id === 'marco')!;
    const promise = service.checkExampleData([marco]);
    http
      .expectOne(`http://fhir.test/fhir/Patient/${marco.resourceId}`)
      .flush({ resourceType: 'Patient', id: marco.resourceId });
    const results = await promise;
    expect(results[0].status).toBe('present');
  });

  it('checks patient example as missing on 404', async () => {
    const marco = EXAMPLE_DATA_CATALOG.find((e) => e.id === 'marco')!;
    const promise = service.checkExampleData([marco]);
    http
      .expectOne(`http://fhir.test/fhir/Patient/${marco.resourceId}`)
      .flush(null, { status: 404, statusText: 'Not Found' });
    const results = await promise;
    expect(results[0].status).toBe('missing');
  });

  it('loads a ValueSet bundle via POST to fhir base as match', async () => {
    const promise = service.loadValueSets([
      {
        id: 'body-mass-index',
        assetPath: '/value-sets/body-mass-index.json',
        label: 'BMI',
        origin: 'asu',
      },
    ]);
    (await nextRequest(http, (r) => r.url === '/value-sets/body-mass-index.json')).flush(bmiAsset);
    (await nextRequest(http, (r) => r.url === 'http://fhir.test/fhir')).flush({
      resourceType: 'Bundle',
      type: 'transaction-response',
      entry: [],
    });
    (
      await nextRequest(http, (r) => r.url === 'http://fhir.test/fhir/ValueSet/body-mass-index')
    ).flush({
      resourceType: 'ValueSet',
      id: 'body-mass-index',
      version: '2026-07-15',
      status: 'active',
    });
    const results = await promise;
    expect(results[0].status).toBe('match');
    expect(results[0].appVersion).toBe('2026-07-15');
    expect(results[0].serverVersion).toBe('2026-07-15');
  });

  it('rewrites example Patient POST to PUT by id on load', async () => {
    const marco = EXAMPLE_DATA_CATALOG.find((e) => e.id === 'marco')!;
    const promise = service.loadExampleData([marco]);
    (await nextRequest(http, (r) => r.url === marco.assetPath)).flush({
      resourceType: 'Bundle',
      type: 'transaction',
      entry: [
        {
          fullUrl: `urn:uuid:${marco.resourceId}`,
          resource: {
            resourceType: 'Patient',
            id: marco.resourceId,
          },
          request: { method: 'POST', url: 'Patient' },
        },
      ],
    });
    const post = await nextRequest(http, (r) => r.url === 'http://fhir.test/fhir');
    const body = post.request.body as {
      entry?: { request?: { method?: string; url?: string } }[];
    };
    expect(body.entry?.[0]?.request?.method).toBe('PUT');
    expect(body.entry?.[0]?.request?.url).toBe(`Patient/${marco.resourceId}`);
    post.flush({
      resourceType: 'Bundle',
      type: 'transaction-response',
      entry: [],
    });
    const results = await promise;
    expect(results[0].status).toBe('ok');
  });

  it('checks ValueSet as match when server version equals app', async () => {
    const promise = service.checkValueSets([
      {
        id: 'body-mass-index',
        assetPath: '/value-sets/body-mass-index.json',
        label: 'BMI',
        origin: 'asu',
      },
    ]);
    (await nextRequest(http, (r) => r.url === '/value-sets/body-mass-index.json')).flush(bmiAsset);
    (
      await nextRequest(http, (r) => r.url === 'http://fhir.test/fhir/ValueSet/body-mass-index')
    ).flush({
      resourceType: 'ValueSet',
      id: 'body-mass-index',
      version: '2026-07-15',
      status: 'active',
    });
    const results = await promise;
    expect(results[0].status).toBe('match');
    expect(results[0].appVersion).toBe('2026-07-15');
    expect(results[0].serverVersion).toBe('2026-07-15');
  });

  it('checks ValueSet as version_mismatch when server version differs', async () => {
    const promise = service.checkValueSets([
      {
        id: 'body-mass-index',
        assetPath: '/value-sets/body-mass-index.json',
        label: 'BMI',
        origin: 'asu',
      },
    ]);
    (await nextRequest(http, (r) => r.url === '/value-sets/body-mass-index.json')).flush(bmiAsset);
    (
      await nextRequest(http, (r) => r.url === 'http://fhir.test/fhir/ValueSet/body-mass-index')
    ).flush({
      resourceType: 'ValueSet',
      id: 'body-mass-index',
      version: '2020-01-01',
      status: 'active',
    });
    const results = await promise;
    expect(results[0].status).toBe('version_mismatch');
    expect(results[0].message).toBe('Server version must be 2026-07-15');
  });

  it('checks ValueSet as missing on 404', async () => {
    const promise = service.checkValueSets([
      {
        id: 'body-mass-index',
        assetPath: '/value-sets/body-mass-index.json',
        label: 'BMI',
        origin: 'asu',
      },
    ]);
    (await nextRequest(http, (r) => r.url === '/value-sets/body-mass-index.json')).flush(bmiAsset);
    (
      await nextRequest(http, (r) => r.url === 'http://fhir.test/fhir/ValueSet/body-mass-index')
    ).flush(null, {
      status: 404,
      statusText: 'Not Found',
    });
    const results = await promise;
    expect(results[0].status).toBe('missing');
    expect(results[0].appVersion).toBe('2026-07-15');
  });
});
