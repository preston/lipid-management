// Author: Preston Lee

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { OpenCVDRiskCalculator } from './open-cvd-risk-calculator';
import { PatientContextService } from '../../services/patient-context.service';
import { CalculatorPrefillService } from '../../services/calculator-prefill.service';
import { CqlEvaluateService } from '../../services/cql-evaluate.service';
import type { Patient } from 'fhir/r4';

const SAMPLE_PATIENT: Patient = {
  resourceType: 'Patient',
  id: 'example-1',
  name: [{ family: 'Doe', given: ['Jane'] }],
  gender: 'female',
  birthDate: '1970-01-15',
};

const SAMPLE_PATIENT_WITH_ZIP: Patient = {
  ...SAMPLE_PATIENT,
  id: 'example-zip',
  address: [
    { use: 'work', postalCode: '10001' },
    { use: 'home', postalCode: '90210-1234' },
  ],
};

/** Minimal CSV matching Graham Center columns used by parseSdiZctaCsv. */
const SDI_CSV_FIXTURE = [
  'ZCTA5_FIPS,SDI_score',
  '90210,15',
  '01001,36',
  '37220,5',
].join('\n');

describe('OpenCVDRiskCalculator', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [OpenCVDRiskCalculator],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: CalculatorPrefillService,
          useValue: {
            prefillFromChart: () => of({ form: {}, provenances: [], exclusions: [] }),
          },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  function selectSamplePatient(patient: Patient = SAMPLE_PATIENT): void {
    TestBed.inject(PatientContextService).setStandalonePatient(patient);
  }

  function flushSdiMap(csvText: string = SDI_CSV_FIXTURE): void {
    const req = http.expectOne('/data/sdi/asset_rgc_sdi_2015_through_2019_zcta.csv');
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('text');
    req.flush(csvText);
  }

  function createFixture(patient: Patient = SAMPLE_PATIENT) {
    selectSamplePatient(patient);
    const fixture = TestBed.createComponent(OpenCVDRiskCalculator);
    fixture.detectChanges();
    flushSdiMap();
    fixture.detectChanges();
    return fixture;
  }

  function fillCompleteForm(component: OpenCVDRiskCalculator): void {
    component['model'].set({
      age: 55,
      sex: 'female',
      heightCm: 170,
      weightKg: 70,
      totalCholesterolMgDl: 200,
      hdlMgDl: 50,
      systolicBpMmHg: 120,
      egfrMlMin173m2: 90,
      diabetes: 'no',
      currentSmoker: 'no',
      onAntihypertensive: 'no',
      onStatin: 'no',
      uacrMgG: null,
      hba1cPercent: null,
      zipCode: '',
      sdiDecile: null,
    });
  }

  it('should create', () => {
    const fixture = createFixture();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render optional risk-scoring predictors including ZIP', () => {
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent ?? '';

    expect(root.querySelector('#open-cvd-risk-optional-predictors-card')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-uacr')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-hba1c')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-zip')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-sdi')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-sdi-resolved')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-active-model')?.textContent).toContain('Base');
    expect(text).toMatch(/UACR/i);
    expect(text).toMatch(/HbA1c/i);
    expect(text).toMatch(/SDI decile/i);
    expect(text).toMatch(/ZIP code/i);
  });

  it('should prefill ZIP from home address and resolve SDI', () => {
    const fixture = createFixture(SAMPLE_PATIENT_WITH_ZIP);
    const component = fixture.componentInstance;

    expect(component['model']().zipCode).toBe('90210');
    expect(component['model']().sdiDecile).toBe(2);
    expect(component['sdiLookupStatus']()).toBe('found');
    expect(component['activeRiskModel']()).toBe('sdi');
  });

  it('should update SDI when ZIP override changes', () => {
    const fixture = createFixture();
    const component = fixture.componentInstance;

    component['model'].update((m) => ({ ...m, zipCode: '01001' }));
    component['onZipCodeInput']();
    fixture.detectChanges();

    expect(component['model']().sdiDecile).toBe(4);
    expect(component['sdiLookupStatus']()).toBe('found');
  });

  it('should clear SDI when ZIP is unknown', () => {
    const fixture = createFixture(SAMPLE_PATIENT_WITH_ZIP);
    const component = fixture.componentInstance;

    component['model'].update((m) => ({ ...m, zipCode: '99999' }));
    component['onZipCodeInput']();
    fixture.detectChanges();

    expect(component['model']().sdiDecile).toBeNull();
    expect(component['sdiLookupStatus']()).toBe('missing');
  });

  it('should keep manual SDI when ZIP is cleared', () => {
    const fixture = createFixture();
    const component = fixture.componentInstance;

    component['model'].update((m) => ({ ...m, sdiDecile: 8 }));
    component['onSdiDecileInput']();
    fixture.detectChanges();
    expect(component['sdiLookupStatus']()).toBe('manual');

    component['model'].update((m) => ({ ...m, zipCode: '' }));
    component['onZipCodeInput']();
    fixture.detectChanges();

    expect(component['model']().sdiDecile).toBe(8);
    expect(component['sdiLookupStatus']()).toBe('manual');
  });

  it('should include guideline instruction help text for mapped fields', () => {
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('#open-cvd-risk-egfr-help')?.textContent?.trim()).toBe(
      'Valid range: 15–150',
    );
    expect(root.querySelector('#open-cvd-risk-zip-help')?.textContent).toContain('chart address');
  });

  it('should compute BMI from height and weight', () => {
    const fixture = createFixture();
    const component = fixture.componentInstance;

    component['model'].update((current) => ({
      ...current,
      heightCm: 170,
      weightKg: 70,
    }));
    fixture.detectChanges();

    expect(component['bmiKgM2']()).toBeCloseTo(24.2, 1);
  });

  it('should mark inputs complete when required fields are present', () => {
    const fixture = createFixture();
    const component = fixture.componentInstance;

    expect(component['inputsComplete']()).toBe(false);
    fillCompleteForm(component);
    fixture.detectChanges();

    expect(component['inputsComplete']()).toBe(true);
    expect(component['canCalculate']()).toBe(true);
  });

  it('should treat out-of-range age as complete inputs but guideline-gated', () => {
    const fixture = createFixture();
    const component = fixture.componentInstance;

    component['model'].set({
      age: 16,
      sex: 'female',
      heightCm: 170,
      weightKg: 70,
      totalCholesterolMgDl: 200,
      hdlMgDl: 50,
      systolicBpMmHg: 120,
      egfrMlMin173m2: 90,
      diabetes: 'no',
      currentSmoker: 'no',
      onAntihypertensive: 'no',
      onStatin: 'no',
      uacrMgG: null,
      hba1cPercent: null,
      zipCode: '',
      sdiDecile: null,
    });
    fixture.detectChanges();

    expect(component['inputsComplete']()).toBe(true);
    expect(component['ageInGuidelineRange']()).toBe(false);
    expect(component['canCalculate']()).toBe(false);

    component['setProceedDespiteExclusions'](true);
    fixture.detectChanges();
    expect(component['canCalculate']()).toBe(true);
  });

  it('should include optional overrides when set and update active model', () => {
    const fixture = createFixture();
    const component = fixture.componentInstance;
    fillCompleteForm(component);
    component['model'].update((m) => ({ ...m, uacrMgG: 40 }));
    fixture.detectChanges();

    expect(component['activeRiskModel']()).toBe('uacr');
    const params = component['buildLibraryParameters']();
    expect(params['OverrideUacrMgG']).toEqual({ decimal: 40 });
  });

  it('should omit out-of-range and non-integer optional overrides', () => {
    const fixture = createFixture();
    const component = fixture.componentInstance;
    fillCompleteForm(component);
    component['model'].update((m) => ({
      ...m,
      uacrMgG: 0.01,
      hba1cPercent: 16,
      sdiDecile: 8.5,
    }));
    fixture.detectChanges();

    expect(component['activeRiskModel']()).toBe('base');
    const params = component['buildLibraryParameters']();
    expect(params).not.toHaveProperty('OverrideUacrMgG');
    expect(params).not.toHaveProperty('OverrideHba1cPercent');
    expect(params).not.toHaveProperty('OverrideSdiDecile');
  });

  it('should pass library parameters when calculating risk', () => {
    const evaluateLibrary = vi.fn(() =>
      of({
        SelectedPreventModel: 'base',
        TenYearTotalCvdPercent: 8.1,
        TenYearAscvdPercent: 5.0,
        TenYearHeartFailurePercent: 4.0,
        TenYearChdPercent: 3.0,
        TenYearStrokePercent: 2.0,
        ThirtyYearTotalCvdPercent: 22.3,
        ThirtyYearAscvdPercent: 15.0,
        ThirtyYearHeartFailurePercent: 12.0,
        ThirtyYearChdPercent: 10.0,
        ThirtyYearStrokePercent: 8.0,
      }),
    );
    vi.spyOn(TestBed.inject(CqlEvaluateService), 'evaluateLibrary').mockImplementation(
      evaluateLibrary,
    );

    const fixture = createFixture();
    const component = fixture.componentInstance;
    fillCompleteForm(component);
    fixture.detectChanges();

    component['calculateRisk']();

    expect(evaluateLibrary).toHaveBeenCalledWith(
      'OpenCVDRisk',
      expect.arrayContaining(['SelectedPreventModel', 'TenYearTotalCvdPercent']),
      expect.objectContaining({
        OverrideAgeYears: { integer: 55 },
        OverrideIsFemale: true,
      }),
    );
  });

  it('should render five outcomes for both horizons', () => {
    const fixture = createFixture();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('#open-cvd-risk-result-10y-total-cvd')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-result-30y-stroke')).toBeTruthy();
  });

  it('should map the current form to OpenCVDRisk library parameters', () => {
    const fixture = createFixture();
    const component = fixture.componentInstance;
    fillCompleteForm(component);
    component['setLifeExpectancyLimited'](true);
    fixture.detectChanges();

    const params = component['buildLibraryParameters']();
    expect(params['OverrideAgeYears']).toEqual({ integer: 55 });
    expect(params['LifeExpectancyLimited']).toBe(true);
    expect(params['OverrideBmiKgM2']).toEqual({ decimal: expect.any(Number) });
  });
});
