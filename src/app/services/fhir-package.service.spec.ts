// Author: Preston Lee

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { gunzipSync } from 'node:zlib';
import { HttpRequest } from '@angular/common/http';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { FhirPackageService } from './fhir-package.service';
import {
  CQL_LIBRARY_CATALOG,
  EXAMPLE_DATA_CATALOG,
  VALUE_SET_CATALOG,
} from '../features/loader/loader.catalog';

async function nextRequest(
  http: HttpTestingController,
  predicate: (req: HttpRequest<unknown>) => boolean,
) {
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

describe('FhirPackageService', () => {
  let service: FhirPackageService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FhirPackageService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('assembles a spec-shaped tarball archive', async () => {
    const promise = service.buildPackageArchive();

    const lipMgmtVersion = '0.1.1';
    (await nextRequest(http, (r) => r.url === '/cql/LipidManagement.cql')).flush(
      `library LipidManagement version '${lipMgmtVersion}'\nusing FHIR version '4.0.1'\ninclude FHIRHelpers version '4.0.1'\ninclude OpenCVDRisk version '0.5.3'`,
    );

    for (const entry of CQL_LIBRARY_CATALOG) {
      if (entry.id === 'LipidManagement') {
        continue;
      }
      const version = entry.id === 'OpenCVDRisk' ? '0.5.3' : '1.0.0';
      const includes =
        entry.id === 'OpenCVDRisk' ? "include BMI version '1.0.0'" : '';
      (await nextRequest(http, (r) => r.url === entry.assetPath)).flush(
        `library ${entry.id === 'SDI2019' ? 'SDI2019' : entry.id} version '${version}'\nusing FHIR version '4.0.1'\ninclude FHIRHelpers version '4.0.1'\n${includes}`,
      );
    }

    for (const entry of VALUE_SET_CATALOG) {
      (await nextRequest(http, (r) => r.url === entry.assetPath)).flush({
        resourceType: 'Bundle',
        type: 'transaction',
        entry: [
          {
            resource: {
              resourceType: 'ValueSet',
              id: entry.id,
              url: `https://asu.edu/fhir/ValueSet/${entry.id}`,
              version: '1.0.0',
              status: 'active',
            },
          },
        ],
      });
    }

    for (const entry of EXAMPLE_DATA_CATALOG.filter((e) => e.kind === 'patient')) {
      (await nextRequest(http, (r) => r.url === entry.assetPath)).flush({
        resourceType: 'Bundle',
        type: 'transaction',
        entry: [],
      });
    }

    const { archive, filename } = await promise;

    expect(filename).toBe('com.prestonlee.fhir.lipid-management-0.1.1.tgz');
    expect(archive[0]).toBe(0x1f);
    expect(archive[1]).toBe(0x8b);

    const tar = gunzipSync(archive);
    const tarText = Buffer.from(tar).toString('utf8');
    expect(tarText).toContain('package/package.json');
    expect(tarText).toContain('package/.index.json');
    expect(tarText).toContain('package/Library-LipidManagement.json');
    expect(tarText).toContain('package/ValueSet-body-height.json');
    expect(tarText).toContain('package/examples/.index.json');
    expect(tarText).toContain(
      `package/examples/Bundle-${EXAMPLE_DATA_CATALOG.find((e) => e.id === 'marco')!.resourceId}.json`,
    );
  });
});
