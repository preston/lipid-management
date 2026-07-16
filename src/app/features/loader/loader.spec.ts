// Author: Preston Lee

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Loader } from './loader';
import { CQL_LIBRARY_CATALOG, EXAMPLE_DATA_CATALOG, VALUE_SET_CATALOG } from './loader.catalog';
import { SettingsService } from '../../services/settings.service';
import { Settings } from '../../models/settings.model';

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
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('renders catalog sections without readiness badges', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('#loader-cql-card')).toBeTruthy();
    expect(el.querySelector('#loader-valueset-card')).toBeTruthy();
    expect(el.querySelector('#loader-example-card')).toBeTruthy();
    expect(el.querySelector('#loader-readiness')).toBeNull();
    expect(el.querySelector('#loader-fhirhelpers-badge')).toBeNull();
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

  it('renders CQL descriptions and download links', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('#loader-cql-intro')?.textContent).toContain(
      'decision support signals',
    );

    for (const entry of CQL_LIBRARY_CATALOG) {
      const description = el.querySelector(`#loader-cql-description-${entry.id}`);
      expect(description?.textContent?.trim()).toBe(entry.description);

      const download = el.querySelector(
        `#loader-cql-download-${entry.id}`,
      ) as HTMLAnchorElement | null;
      expect(download?.getAttribute('href')).toBe(entry.assetPath);
      expect(download?.getAttribute('download')).toBe(entry.assetPath.split('/').pop());
    }
  });
});
