// Author: Preston Lee

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FhirBundleLoaderService } from './fhir-bundle-loader.service';
import { SettingsService } from './settings.service';
import { Settings } from '../models/settings.model';
import { EXAMPLE_DATA_CATALOG } from '../features/loader/loader.catalog';

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
    const shuffled = [
      EXAMPLE_DATA_CATALOG[3],
      EXAMPLE_DATA_CATALOG[0],
      EXAMPLE_DATA_CATALOG[2],
      EXAMPLE_DATA_CATALOG[1],
    ];
    const ordered = service.orderExampleEntries(shuffled);
    expect(ordered.map((e) => e.id)).toEqual(['hospital', 'practitioner', 'dakota', 'dori']);
  });

  it('checks patient example as present on 200', async () => {
    const dori = EXAMPLE_DATA_CATALOG.find((e) => e.id === 'dori')!;
    const promise = service.checkExampleData([dori]);
    http
      .expectOne(`http://fhir.test/fhir/Patient/${dori.resourceId}`)
      .flush({ resourceType: 'Patient', id: dori.resourceId });
    const results = await promise;
    expect(results[0].status).toBe('present');
  });

  it('checks patient example as missing on 404', async () => {
    const dori = EXAMPLE_DATA_CATALOG.find((e) => e.id === 'dori')!;
    const promise = service.checkExampleData([dori]);
    http
      .expectOne(`http://fhir.test/fhir/Patient/${dori.resourceId}`)
      .flush(null, { status: 404, statusText: 'Not Found' });
    const results = await promise;
    expect(results[0].status).toBe('missing');
  });

  it('loads a ValueSet bundle via POST to fhir base', async () => {
    const promise = service.loadValueSets([
      {
        id: 'body-mass-index',
        assetPath: '/value-sets/body-mass-index.json',
        label: 'BMI',
        origin: 'asu',
      },
    ]);
    http.expectOne('/value-sets/body-mass-index.json').flush({
      resourceType: 'Bundle',
      type: 'transaction',
      entry: [],
    });
    await Promise.resolve();
    http.expectOne('http://fhir.test/fhir').flush({
      resourceType: 'Bundle',
      type: 'transaction-response',
      entry: [],
    });
    const results = await promise;
    expect(results[0].status).toBe('ok');
  });
});
