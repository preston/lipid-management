// Author: Preston Lee

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, Subject } from 'rxjs';
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

/** Fixture ZIP→decile values matching former CSV-based tests. */
const SDI_FIXTURE: Record<string, number> = {
  '90210': 2,
  '01001': 4,
  '37220': 1,
};

const EMPTY_RISK_RESULTS = {
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
  OpenCvdRiskAge: 68,
  BaseTenYearTotalCvdPercent: 8.1,
  BaseThirtyYearTotalCvdPercent: 22.3,
};

describe('OpenCVDRiskCalculator', () => {
  let evaluateLibrary: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    evaluateLibrary = vi.fn(
      (libraryId: string, _exprs?: string[], params?: Record<string, unknown>) => {
        if (libraryId === 'SDI2019') {
          const zip =
            typeof params?.['OverrideZipCode'] === 'string'
              ? params['OverrideZipCode']
              : null;
          const decile = zip != null ? (SDI_FIXTURE[zip] ?? null) : null;
          return of({ SdiDecile: decile });
        }
        return of({ ...EMPTY_RISK_RESULTS });
      },
    );
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
        {
          provide: CqlEvaluateService,
          useValue: { evaluateLibrary },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function selectSamplePatient(patient: Patient = SAMPLE_PATIENT): void {
    TestBed.inject(PatientContextService).setStandalonePatient(patient);
  }

  function createFixture(patient: Patient = SAMPLE_PATIENT) {
    selectSamplePatient(patient);
    const fixture = TestBed.createComponent(OpenCVDRiskCalculator);
    fixture.detectChanges();
    return fixture;
  }

  function createBlankFixture() {
    TestBed.inject(PatientContextService).resetForTests();
    const fixture = TestBed.createComponent(OpenCVDRiskCalculator);
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

  it('should prefill ZIP from home address and resolve SDI via SDI2019', () => {
    const fixture = createFixture(SAMPLE_PATIENT_WITH_ZIP);
    const component = fixture.componentInstance;

    expect(component['model']().zipCode).toBe('90210');
    expect(component['model']().sdiDecile).toBe(2);
    expect(component['sdiLookupStatus']()).toBe('found');
    expect(component['activeRiskModel']()).toBe('sdi');
    expect(evaluateLibrary).toHaveBeenCalledWith(
      'SDI2019',
      ['SdiDecile'],
      { OverrideZipCode: '90210' },
    );
  });

  it('should update SDI when ZIP override changes', () => {
    const fixture = createFixture();
    const component = fixture.componentInstance;

    component['model'].update((m) => ({ ...m, zipCode: '01001' }));
    component['onZipCodeInput']();
    fixture.detectChanges();

    expect(component['model']().sdiDecile).toBe(4);
    expect(component['sdiLookupStatus']()).toBe('found');
    expect(evaluateLibrary).toHaveBeenCalledWith(
      'SDI2019',
      ['SdiDecile'],
      { OverrideZipCode: '01001' },
    );
  });

  it('should resolve SDI from ZIP input DOM value before model sync', () => {
    const fixture = createFixture();
    const component = fixture.componentInstance;
    const zipInput = (fixture.nativeElement as HTMLElement).querySelector(
      '#open-cvd-risk-zip',
    ) as HTMLInputElement;

    // Stale model, fresh DOM value — mirrors (input) racing ahead of [formField].
    expect(component['model']().zipCode).not.toBe('01001');
    zipInput.value = '01001';
    const event = { target: zipInput } as unknown as Event;
    component['onZipCodeInput'](event);
    fixture.detectChanges();

    expect(component['model']().zipCode).toBe('01001');
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

    expect(root.querySelector('#open-cvd-risk-egfr')?.getAttribute('placeholder')).toBe('15-150');
    expect(root.querySelector('#open-cvd-risk-egfr-help')).toBeNull();
    expect(root.querySelector('#open-cvd-risk-zip-help')?.textContent).toContain('chart address');
  });

  it('should highlight missing required fields before touch without required text', () => {
    const fixture = createFixture();
    const component = fixture.componentInstance;
    const root = fixture.nativeElement as HTMLElement;

    component['model'].update((m) => ({ ...m, age: null }));
    fixture.detectChanges();

    const ageInput = root.querySelector('#open-cvd-risk-age') as HTMLInputElement;
    const ageField = component['openCvdRiskForm'].age();

    expect(ageField.invalid()).toBe(true);
    expect(ageField.touched()).toBe(false);
    expect(ageInput.classList.contains('is-invalid')).toBe(true);
    expect(root.querySelector('#open-cvd-risk-age-errors')).toBeNull();

    component['model'].update((m) => ({ ...m, age: 55 }));
    fixture.detectChanges();

    expect(ageInput.classList.contains('is-invalid')).toBe(false);
    expect(root.querySelector('#open-cvd-risk-age-errors')).toBeNull();
  });

  it('should still show range validation messages when a value is out of range', () => {
    const fixture = createFixture();
    const component = fixture.componentInstance;
    const root = fixture.nativeElement as HTMLElement;

    component['model'].update((m) => ({ ...m, systolicBpMmHg: 80 }));
    fixture.detectChanges();

    expect(root.querySelector('#open-cvd-risk-systolic-bp')?.classList.contains('is-invalid')).toBe(
      true,
    );
    expect(root.querySelector('#open-cvd-risk-systolic-bp-errors')?.textContent).toContain(
      'at least 90',
    );
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

  it('should reset form values to the prefill baseline', () => {
    const fixture = createFixture();
    const component = fixture.componentInstance;
    const root = fixture.nativeElement as HTMLElement;
    const baseline = { ...component['model']() };

    expect(component['canResetToPrefill']()).toBe(true);
    expect(root.querySelector('#open-cvd-risk-reset')).toBeTruthy();

    component['model'].update((m) => ({
      ...m,
      age: 40,
      totalCholesterolMgDl: 300,
      uacrMgG: 40,
    }));
    component['lifeExpectancyLimited'].set(true);
    component['dismissExclusion']('age-out-of-range');
    fixture.detectChanges();

    component['resetToPrefill']();
    fixture.detectChanges();

    expect(component['model']()).toEqual(baseline);
    expect(component['lifeExpectancyLimited']()).toBe(false);
    expect(component['dismissedExclusionIds']().has('age-out-of-range')).toBe(false);
    expect(component['zipUserEdited']()).toBe(false);
    expect(component['sdiManual']()).toBe(false);
  });

  it('should recalculate after reset when the restored form is complete', async () => {
    TestBed.resetTestingModule();
    evaluateLibrary = vi.fn(
      (libraryId: string, _exprs?: string[], params?: Record<string, unknown>) => {
        if (libraryId === 'SDI2019') {
          const zip =
            typeof params?.['OverrideZipCode'] === 'string'
              ? params['OverrideZipCode']
              : null;
          return of({ SdiDecile: zip != null ? (SDI_FIXTURE[zip] ?? null) : null });
        }
        return of({ ...EMPTY_RISK_RESULTS });
      },
    );
    await TestBed.configureTestingModule({
      imports: [OpenCVDRiskCalculator],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: CalculatorPrefillService,
          useValue: {
            prefillFromChart: () =>
              of({
                form: {
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
                },
                provenances: [],
                exclusions: [],
              }),
          },
        },
        {
          provide: CqlEvaluateService,
          useValue: { evaluateLibrary },
        },
      ],
    }).compileComponents();

    const fixture = createFixture();
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(evaluateLibrary.mock.calls.filter((c) => c[0] === 'OpenCVDRisk')).toHaveLength(1);
    expect(component['risk10yTotal']()).toBe('8.1');

    component['model'].update((m) => ({ ...m, totalCholesterolMgDl: 280, uacrMgG: 40 }));
    component['clearCalculatedResults']();
    fixture.detectChanges();
    expect(component['risk10yTotal']()).toBe('—');

    component['resetToPrefill']();
    fixture.detectChanges();

    expect(component['model']().totalCholesterolMgDl).toBe(200);
    expect(component['model']().uacrMgG).toBeNull();
    expect(evaluateLibrary.mock.calls.filter((c) => c[0] === 'OpenCVDRisk')).toHaveLength(2);
    expect(component['risk10yTotal']()).toBe('8.1');
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

  it('should auto-calculate after prefill when the form is complete', async () => {
    TestBed.resetTestingModule();
    evaluateLibrary = vi.fn(
      (libraryId: string, _exprs?: string[], params?: Record<string, unknown>) => {
        if (libraryId === 'SDI2019') {
          const zip =
            typeof params?.['OverrideZipCode'] === 'string'
              ? params['OverrideZipCode']
              : null;
          return of({ SdiDecile: zip != null ? (SDI_FIXTURE[zip] ?? null) : null });
        }
        return of({ ...EMPTY_RISK_RESULTS });
      },
    );
    await TestBed.configureTestingModule({
      imports: [OpenCVDRiskCalculator],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: CalculatorPrefillService,
          useValue: {
            prefillFromChart: () =>
              of({
                form: {
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
                },
                provenances: [],
                exclusions: [],
              }),
          },
        },
        {
          provide: CqlEvaluateService,
          useValue: { evaluateLibrary },
        },
      ],
    }).compileComponents();

    const fixture = createFixture();
    fixture.detectChanges();

    expect(evaluateLibrary).toHaveBeenCalledWith(
      'OpenCVDRisk',
      expect.any(Array),
      expect.any(Object),
    );
    expect(fixture.componentInstance['risk10yTotal']()).toBe('8.1');
  });

  it('should wait for ZIP→SDI then auto-calculate with SDI and sync baseline', async () => {
    TestBed.resetTestingModule();
    const sdiSubject = new Subject<Record<string, unknown>>();
    evaluateLibrary = vi.fn(
      (libraryId: string, _exprs?: string[], _params?: Record<string, unknown>) => {
        if (libraryId === 'SDI2019') {
          return sdiSubject.asObservable();
        }
        return of({
          ...EMPTY_RISK_RESULTS,
          SelectedPreventModel: 'sdi',
          TenYearTotalCvdPercent: 9.0,
        });
      },
    );
    await TestBed.configureTestingModule({
      imports: [OpenCVDRiskCalculator],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: CalculatorPrefillService,
          useValue: {
            prefillFromChart: () =>
              of({
                form: {
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
                },
                provenances: [],
                exclusions: [],
              }),
          },
        },
        {
          provide: CqlEvaluateService,
          useValue: { evaluateLibrary },
        },
      ],
    }).compileComponents();

    selectSamplePatient(SAMPLE_PATIENT_WITH_ZIP);
    const fixture = TestBed.createComponent(OpenCVDRiskCalculator);
    fixture.detectChanges();
    // Prefill finished but SDI2019 still in flight — must not calculate yet.
    expect(evaluateLibrary).toHaveBeenCalledWith(
      'SDI2019',
      ['SdiDecile'],
      { OverrideZipCode: '90210' },
    );
    expect(evaluateLibrary.mock.calls.some((c) => c[0] === 'OpenCVDRisk')).toBe(false);
    expect(fixture.componentInstance['model']().sdiDecile).toBeNull();
    expect(fixture.componentInstance['sdiLookupStatus']()).toBe('loading');

    sdiSubject.next({ SdiDecile: 2 });
    sdiSubject.complete();
    fixture.detectChanges();

    expect(fixture.componentInstance['model']().sdiDecile).toBe(2);
    expect(fixture.componentInstance['prefillBaseline']()?.sdiDecile).toBe(2);
    expect(evaluateLibrary.mock.calls.filter((c) => c[0] === 'OpenCVDRisk')).toHaveLength(1);
    expect(evaluateLibrary).toHaveBeenCalledWith(
      'OpenCVDRisk',
      expect.any(Array),
      expect.objectContaining({
        OverrideSdiDecile: { integer: 2 },
      }),
    );
    expect(fixture.componentInstance['provenanceFor']('sdiDecile')).toBeNull();
  });

  it('should not auto-calculate when prefill leaves required fields incomplete', () => {
    const fixture = createFixture();
    fixture.detectChanges();

    expect(fixture.componentInstance['inputsComplete']()).toBe(false);
    expect(evaluateLibrary.mock.calls.some((c) => c[0] === 'OpenCVDRisk')).toBe(false);
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

  it('should enter blank session by default in standalone mode', () => {
    const prefill = TestBed.inject(CalculatorPrefillService);
    const prefillSpy = vi.spyOn(prefill, 'prefillFromChart');
    const fixture = createBlankFixture();
    const component = fixture.componentInstance;
    const root = fixture.nativeElement as HTMLElement;
    const ctx = TestBed.inject(PatientContextService);

    expect(ctx.isBlankSession()).toBe(true);
    expect(component['selectedPatient']()?.id).toBe('opencvd-blank');
    expect(root.querySelector('#open-cvd-risk-calculator-form')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-patient-selection')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-patient-banner-name')?.textContent?.trim()).toBe(
      'Manual entry',
    );
    expect(root.querySelector('#open-cvd-risk-patient-banner-meta')).toBeNull();
    expect(prefillSpy).not.toHaveBeenCalled();
  });

  it('should allow calculate in blank mode without chart prefill', () => {
    const fixture = createBlankFixture();
    const component = fixture.componentInstance;
    fillCompleteForm(component);
    fixture.detectChanges();

    expect(component['canCalculate']()).toBe(true);
    component['calculateRisk']();

    expect(evaluateLibrary).toHaveBeenCalledWith(
      'OpenCVDRisk',
      expect.arrayContaining(['SelectedPreventModel', 'TenYearTotalCvdPercent']),
      expect.objectContaining({
        OverrideAgeYears: { integer: 55 },
        OverrideIsFemale: true,
      }),
    );
    expect(component['risk10yTotal']()).toBe('8.1');
  });

  it('should navigate patient search results with arrow keys and select with Enter', () => {
    const fixture = createBlankFixture();
    const component = fixture.componentInstance;
    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector('#open-cvd-risk-patient-search') as HTMLInputElement;
    const secondPatient: Patient = {
      resourceType: 'Patient',
      id: 'example-2',
      name: [{ family: 'Smith', given: ['John'] }],
      gender: 'male',
      birthDate: '1965-04-20',
    };
    component['searchHits'].set([
      {
        id: SAMPLE_PATIENT.id!,
        displayName: 'Jane Doe',
        gender: 'female',
        birthDate: SAMPLE_PATIENT.birthDate,
        patient: SAMPLE_PATIENT,
      },
      {
        id: secondPatient.id!,
        displayName: 'John Smith',
        gender: 'male',
        birthDate: secondPatient.birthDate,
        patient: secondPatient,
      },
    ]);
    fixture.detectChanges();

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    expect(component['activeSearchHitIndex']()).toBe(0);
    expect(input.getAttribute('aria-activedescendant')).toBe(
      'open-cvd-risk-patient-search-result-0',
    );

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    expect(component['activeSearchHitIndex']()).toBe(1);
    expect(
      root.querySelector('#open-cvd-risk-patient-search-result-1')?.classList.contains('active'),
    ).toBe(true);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    expect(TestBed.inject(PatientContextService).selectedPatient()?.id).toBe('example-2');
    expect(component['searchHits']()).toEqual([]);
    expect(component['activeSearchHitIndex']()).toBe(-1);
  });

  it('should wrap upward to the last patient search result and clear results with Escape', () => {
    const fixture = createBlankFixture();
    const component = fixture.componentInstance;
    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector('#open-cvd-risk-patient-search') as HTMLInputElement;
    component['searchHits'].set([
      {
        id: SAMPLE_PATIENT.id!,
        displayName: 'Jane Doe',
        gender: 'female',
        birthDate: SAMPLE_PATIENT.birthDate,
        patient: SAMPLE_PATIENT,
      },
      {
        id: 'example-2',
        displayName: 'John Smith',
        patient: { resourceType: 'Patient', id: 'example-2' },
      },
    ]);
    fixture.detectChanges();

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    fixture.detectChanges();
    expect(component['activeSearchHitIndex']()).toBe(1);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(component['searchHits']()).toEqual([]);
    expect(component['activeSearchHitIndex']()).toBe(-1);
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('should exit blank mode and prefill when a searched patient is selected', () => {
    const prefill = TestBed.inject(CalculatorPrefillService);
    const prefillSpy = vi.spyOn(prefill, 'prefillFromChart');
    const fixture = createBlankFixture();
    const component = fixture.componentInstance;
    const ctx = TestBed.inject(PatientContextService);

    expect(ctx.isBlankSession()).toBe(true);

    component['selectPatient']({
      id: SAMPLE_PATIENT.id!,
      displayName: 'Jane Doe',
      gender: 'female',
      birthDate: '1970-01-15',
      patient: SAMPLE_PATIENT,
    });
    fixture.detectChanges();

    expect(ctx.isBlankSession()).toBe(false);
    expect(ctx.selectedPatient()?.id).toBe('example-1');
    expect(prefillSpy).toHaveBeenCalled();
    expect(component['model']().sex).toBe('female');
  });

  it('should exit blank mode and prefill when a client bundle is loaded', async () => {
    const prefill = TestBed.inject(CalculatorPrefillService);
    const prefillSpy = vi.spyOn(prefill, 'prefillFromChart');
    const fixture = createBlankFixture();
    const component = fixture.componentInstance;
    const ctx = TestBed.inject(PatientContextService);

    const bundle = {
      resourceType: 'Bundle',
      type: 'collection',
      entry: [{ fullUrl: 'Patient/example-1', resource: SAMPLE_PATIENT }],
    };
    const file = new File([JSON.stringify(bundle)], 'patient.json', {
      type: 'application/json',
    });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file] });

    await component['onClientBundleFileSelected']({ target: input } as unknown as Event);
    fixture.detectChanges();

    expect(ctx.isBlankSession()).toBe(false);
    expect(ctx.hasRealClientData()).toBe(true);
    expect(ctx.selectedPatient()?.id).toBe('example-1');
    expect(prefillSpy).toHaveBeenCalled();
  });

  it('should return to blank session when Clear is pressed', () => {
    const fixture = createFixture();
    const component = fixture.componentInstance;
    const ctx = TestBed.inject(PatientContextService);
    fillCompleteForm(component);
    fixture.detectChanges();

    expect(ctx.isBlankSession()).toBe(false);

    component['clearPatient']();
    fixture.detectChanges();

    expect(ctx.isBlankSession()).toBe(true);
    expect(component['model']().age).toBeNull();
    expect(component['risk10yTotal']()).toBe('—');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('#open-cvd-risk-calculator-form'),
    ).toBeTruthy();
  });

  it('should not enter blank session under SMART launch', async () => {
    const ctx = TestBed.inject(PatientContextService);
    ctx.resetForTests();
    ctx.setSmartSession(SAMPLE_PATIENT, 'https://smart.example/fhir');

    const prefill = TestBed.inject(CalculatorPrefillService);
    const prefillSpy = vi.spyOn(prefill, 'prefillFromChart');
    const fixture = TestBed.createComponent(OpenCVDRiskCalculator);
    await fixture.componentInstance.ngOnInit();
    fixture.detectChanges();

    expect(ctx.isBlankSession()).toBe(false);
    expect(ctx.isSmart()).toBe(true);
    expect(ctx.selectedPatient()?.id).toBe('example-1');
    expect(prefillSpy).toHaveBeenCalled();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('#open-cvd-risk-patient-selection'),
    ).toBeNull();
  });
});
