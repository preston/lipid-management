// Author: Preston Lee

import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import type { Bundle, Parameters, Patient } from 'fhir/r4';
import { CqlEvaluateService } from './cql-evaluate.service';
import { PatientContextService } from './patient-context.service';
import { SettingsService } from './settings.service';

describe('CqlEvaluateService', () => {
  let service: CqlEvaluateService;
  let httpMock: HttpTestingController;
  let patientContext: PatientContextService;

  const patient: Patient = {
    resourceType: 'Patient',
    id: 'p-1',
    name: [{ family: 'Doe', given: ['Jane'] }],
  };

  const clientBundle: Bundle = {
    resourceType: 'Bundle',
    type: 'collection',
    entry: [{ resource: patient }],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        CqlEvaluateService,
        PatientContextService,
        {
          provide: SettingsService,
          useValue: {
            getEffectiveFhirBaseUrl: () => 'http://example.test/fhir',
          },
        },
      ],
    });
    service = TestBed.inject(CqlEvaluateService);
    httpMock = TestBed.inject(HttpTestingController);
    patientContext = TestBed.inject(PatientContextService);
  });

  afterEach(() => {
    httpMock.verify();
    patientContext.resetForTests();
  });

  it('posts subject and expressions without data when no client bundle', () => {
    patientContext.setStandalonePatient(patient);

    service.evaluateLibrary('OpenCVDRisk', ['TenYearTotalCvdPercent']).subscribe();

    const req = httpMock.expectOne('http://example.test/fhir/Library/OpenCVDRisk/$evaluate');
    expect(req.request.method).toBe('POST');
    const body = req.request.body as Parameters;
    const names = (body.parameter ?? []).map((p) => p.name);
    expect(names).toContain('subject');
    expect(names).toContain('expression');
    expect(names).not.toContain('data');
    expect(names).not.toContain('useServerData');
    expect(body.parameter?.find((p) => p.name === 'subject')?.valueString).toBe('Patient/p-1');

    req.flush({ resourceType: 'Parameters', parameter: [] });
  });

  it('posts data Bundle and useServerData false when client bundle is set', () => {
    patientContext.setClientDataPatient(clientBundle, patient);

    service.evaluateLibrary('OpenCVDRisk', ['TenYearTotalCvdPercent']).subscribe();

    const req = httpMock.expectOne('http://example.test/fhir/Library/OpenCVDRisk/$evaluate');
    const body = req.request.body as Parameters;
    const useServerData = body.parameter?.find((p) => p.name === 'useServerData');
    const data = body.parameter?.find((p) => p.name === 'data');
    expect(useServerData?.valueBoolean).toBe(false);
    expect(data?.resource).toEqual(clientBundle);
    expect(body.parameter?.find((p) => p.name === 'subject')?.valueString).toBe('Patient/p-1');

    req.flush({ resourceType: 'Parameters', parameter: [] });
  });

  it('nests library parameters under a parameters resource', () => {
    patientContext.setStandalonePatient(patient);

    service
      .evaluateLibrary('OpenCVDRisk', ['TenYearTotalCvdPercent'], {
        OverrideAgeYears: { integer: 55 },
        OverrideTotalCholMgDl: { decimal: 200 },
        OverrideDiabetes: true,
        LifeExpectancyLimited: false,
      })
      .subscribe();

    const req = httpMock.expectOne('http://example.test/fhir/Library/OpenCVDRisk/$evaluate');
    const body = req.request.body as Parameters;
    const nested = body.parameter?.find((p) => p.name === 'parameters')?.resource as Parameters;
    expect(nested?.resourceType).toBe('Parameters');
    const byName = Object.fromEntries((nested.parameter ?? []).map((p) => [p.name, p]));
    expect(byName['OverrideAgeYears']?.valueInteger).toBe(55);
    expect(byName['OverrideTotalCholMgDl']?.valueDecimal).toBe(200);
    expect(byName['OverrideDiabetes']?.valueBoolean).toBe(true);
    expect(byName['LifeExpectancyLimited']?.valueBoolean).toBe(false);

    req.flush({ resourceType: 'Parameters', parameter: [] });
  });
});
