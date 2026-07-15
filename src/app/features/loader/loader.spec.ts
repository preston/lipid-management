// Author: Preston Lee

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, HttpRequest } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Loader } from './loader';
import { CQL_LIBRARY_CATALOG, EXAMPLE_DATA_CATALOG, VALUE_SET_CATALOG } from './loader.catalog';
import { SettingsService } from '../../services/settings.service';
import { Settings } from '../../models/settings.model';

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

describe('Loader', () => {
  let fixture: ComponentFixture<Loader>;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [Loader],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    const settings = TestBed.inject(SettingsService);
    settings.settings.set(
      Object.assign(new Settings(), { fhirBaseUrl: 'http://fhir.test/fhir', developer: true }),
    );
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Loader);
    fixture.detectChanges();
    (await nextRequest(http, (r) => r.url === 'http://fhir.test/fhir/Library/FHIRHelpers')).flush(
      null,
      { status: 404, statusText: 'Not Found' },
    );
    (
      await nextRequest(
        http,
        (r) => r.urlWithParams.includes('/Library') && r.urlWithParams.includes('FHIRHelpers'),
      )
    ).flush({ resourceType: 'Bundle', type: 'searchset', entry: [] });
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('renders catalog sections', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('#loader-cql-card')).toBeTruthy();
    expect(el.querySelector('#loader-valueset-card')).toBeTruthy();
    expect(el.querySelector('#loader-example-card')).toBeTruthy();
    expect(el.querySelectorAll('#loader-cql-table tbody tr').length).toBe(
      CQL_LIBRARY_CATALOG.length,
    );
    expect(el.querySelectorAll('#loader-valueset-table tbody tr').length).toBe(
      VALUE_SET_CATALOG.length,
    );
    expect(el.querySelectorAll('#loader-example-list .list-group-item').length).toBe(
      EXAMPLE_DATA_CATALOG.length,
    );
  });
});
