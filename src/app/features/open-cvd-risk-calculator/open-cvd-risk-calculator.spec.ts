// Author: Preston Lee

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
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

describe('OpenCVDRiskCalculator', () => {
  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [OpenCVDRiskCalculator],
      providers: [
        provideHttpClient(),
        {
          provide: CalculatorPrefillService,
          useValue: {
            prefillFromChart: () => of({ form: {}, provenances: [], exclusions: [] }),
          },
        },
      ],
    }).compileComponents();
  });

  function selectSamplePatient(): void {
    TestBed.inject(PatientContextService).setStandalonePatient(SAMPLE_PATIENT);
  }

  afterEach(() => {
    TestBed.inject(PatientContextService).resetForTests();
    TestBed.resetTestingModule();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(OpenCVDRiskCalculator);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should require patient selection before showing the form', () => {
    const fixture = TestBed.createComponent(OpenCVDRiskCalculator);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('#open-cvd-risk-patient-mode-server')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-patient-mode-file')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-patient-search')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-patient-file-input')).toBeNull();
    expect(root.querySelector('#open-cvd-risk-calculator-form')).toBeNull();
  });

  it('should show file input in custom file mode', () => {
    const fixture = TestBed.createComponent(OpenCVDRiskCalculator);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component['setPatientSource']('file');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('#open-cvd-risk-patient-file-input')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-patient-search')).toBeNull();
  });

  it('should render required field controls when a patient is selected', () => {
    selectSamplePatient();
    const fixture = TestBed.createComponent(OpenCVDRiskCalculator);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('#open-cvd-risk-patient-banner')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-patient-clear')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-patient-search')).toBeNull();
    expect(root.querySelector('#open-cvd-risk-age')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-sex-female')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-sex-male')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-height-cm')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-weight-kg')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-total-cholesterol')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-hdl-cholesterol')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-systolic-bp')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-egfr')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-calculate')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-results')).toBeTruthy();
  });

  it('should hide the form and results while prefill is loading', () => {
    const prefill$ = new Subject<{
      form: Record<string, unknown>;
      provenances: unknown[];
      exclusions: unknown[];
    }>();
    TestBed.overrideProvider(CalculatorPrefillService, {
      useValue: { prefillFromChart: () => prefill$.asObservable() },
    });

    selectSamplePatient();
    const fixture = TestBed.createComponent(OpenCVDRiskCalculator);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('#open-cvd-risk-prefill-loading')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-patient-banner')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-calculator-form')).toBeNull();
    expect(root.querySelector('#open-cvd-risk-results')).toBeNull();

    prefill$.next({ form: {}, provenances: [], exclusions: [] });
    prefill$.complete();
    fixture.detectChanges();

    expect(root.querySelector('#open-cvd-risk-prefill-loading')).toBeNull();
    expect(root.querySelector('#open-cvd-risk-calculator-form')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-results')).toBeTruthy();
  });

  it('should show Custom bundle in the banner for client data patients', () => {
    const ctx = TestBed.inject(PatientContextService);
    ctx.setClientDataPatient(
      {
        resourceType: 'Bundle',
        type: 'collection',
        entry: [{ resource: SAMPLE_PATIENT }],
      },
      SAMPLE_PATIENT,
    );
    const fixture = TestBed.createComponent(OpenCVDRiskCalculator);
    fixture.detectChanges();
    const meta = fixture.nativeElement.querySelector(
      '#open-cvd-risk-patient-banner-meta',
    ) as HTMLElement;
    expect(meta.textContent).toContain('Custom bundle');
  });

  it('should not render optional add-on fields', () => {
    selectSamplePatient();
    const fixture = TestBed.createComponent(OpenCVDRiskCalculator);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).not.toMatch(/HbA1c/i);
    expect(text).not.toMatch(/UACR/i);
    expect(text).not.toMatch(/albumin/i);
    expect(text).not.toMatch(/social deprivation/i);
    expect(text).not.toMatch(/zip code/i);
  });

  it('should include AHA PREVENT instruction help text for mapped fields', () => {
    selectSamplePatient();
    const fixture = TestBed.createComponent(OpenCVDRiskCalculator);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('#open-cvd-risk-age-help')?.textContent).toContain('30');
    expect(root.querySelector('#open-cvd-risk-age-help')?.textContent).toContain('79');
    expect(root.querySelector('#open-cvd-risk-total-cholesterol-help')?.textContent).toContain(
      '130',
    );
    expect(root.querySelector('#open-cvd-risk-hdl-cholesterol-help')?.textContent).toContain('20');
    expect(root.querySelector('#open-cvd-risk-systolic-bp-help')?.textContent).toContain('90');
    expect(root.querySelector('#open-cvd-risk-bmi-help')?.textContent).toContain('18.5');
    expect(root.querySelector('#open-cvd-risk-egfr-help')?.textContent?.trim()).toBe(
      'Valid range: 15–140',
    );
    expect(root.querySelector('label[for="open-cvd-risk-egfr"]')?.textContent).toContain('eGFR');
    expect(root.querySelector('#open-cvd-risk-diabetes-help')?.textContent?.trim()).toBe(
      'Any history of diabetes.',
    );
    expect(root.querySelector('#open-cvd-risk-smoking-help')?.textContent?.trim()).toBe(
      'Any cigarette use within the last 30 days',
    );
    expect(root.querySelector('#open-cvd-risk-antihypertensive-help')?.textContent?.trim()).toBe(
      'Current use of any medication for hypertension',
    );
    expect(root.querySelector('#open-cvd-risk-statin-help')?.textContent?.trim()).toBe(
      'Current use of statin medication to lower cholesterol',
    );
  });

  it('should compute BMI from height and weight', () => {
    selectSamplePatient();
    const fixture = TestBed.createComponent(OpenCVDRiskCalculator);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component['model'].update((current) => ({
      ...current,
      heightCm: 170,
      weightKg: 70,
    }));
    fixture.detectChanges();

    expect(component['bmiKgM2']()).toBeCloseTo(24.2, 1);
  });

  it('should sync Signal Forms field bindings from the DOM', async () => {
    selectSamplePatient();
    const fixture = TestBed.createComponent(OpenCVDRiskCalculator);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const component = fixture.componentInstance;

    setNumberInput(root, '#open-cvd-risk-age', 55);
    setNumberInput(root, '#open-cvd-risk-height-cm', 170);
    setNumberInput(root, '#open-cvd-risk-weight-kg', 70);
    setNumberInput(root, '#open-cvd-risk-egfr', 90);
    (root.querySelector('#open-cvd-risk-sex-female') as HTMLInputElement).click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component['model']().age).toBe(55);
    expect(component['model']().heightCm).toBe(170);
    expect(component['model']().weightKg).toBe(70);
    expect(component['model']().egfrMlMin173m2).toBe(90);
    expect(component['model']().sex).toBe('female');
    expect(component['bmiKgM2']()).toBeCloseTo(24.2, 1);
  });

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
    });
  }

  it('should mark inputs complete when required fields are present', () => {
    selectSamplePatient();
    const fixture = TestBed.createComponent(OpenCVDRiskCalculator);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component['inputsComplete']()).toBe(false);
    expect(component['canCalculate']()).toBe(false);

    fillCompleteForm(component);
    fixture.detectChanges();

    expect(component['inputsComplete']()).toBe(true);
    expect(component['canCalculate']()).toBe(true);
    expect(
      fixture.nativeElement.querySelector('#open-cvd-risk-results-message')?.textContent,
    ).toContain('Form looks complete');
  });

  it('should treat out-of-range age as complete inputs but PREVENT-gated', () => {
    selectSamplePatient();
    const fixture = TestBed.createComponent(OpenCVDRiskCalculator);
    const component = fixture.componentInstance;
    fixture.detectChanges();

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
    });
    fixture.detectChanges();

    expect(component['model']().age).toBe(16);
    expect(component['inputsComplete']()).toBe(true);
    expect(component['ageInPreventRange']()).toBe(false);
    expect(component['hasActiveExclusions']()).toBe(true);
    expect(component['canCalculate']()).toBe(false);
    expect(
      fixture.nativeElement.querySelector('#open-cvd-risk-results-message')?.textContent,
    ).toContain('Form looks complete');

    component['setProceedDespiteExclusions'](true);
    fixture.detectChanges();
    expect(component['canCalculate']()).toBe(true);
  });

  it('should show PREVENT applicability banner and gate Calculate until proceed', () => {
    selectSamplePatient();
    const fixture = TestBed.createComponent(OpenCVDRiskCalculator);
    const component = fixture.componentInstance;
    fillCompleteForm(component);
    fixture.detectChanges();

    component['chartExclusions'].set([
      {
        id: 'known-cvd',
        message: 'Chart suggests known cardiovascular disease',
        source: 'chart',
        provenance: 'Chart condition: Coronary artery disease',
      },
    ]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('#open-cvd-risk-prevent-applicability')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-prevent-reason-known-cvd')?.textContent).toContain(
      'known cardiovascular disease',
    );
    expect(
      (root.querySelector('#open-cvd-risk-calculate') as HTMLButtonElement).disabled,
    ).toBe(true);

    component['setProceedDespiteExclusions'](true);
    fixture.detectChanges();
    expect(
      (root.querySelector('#open-cvd-risk-calculate') as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('should dismiss a chart exclusion and re-enable Calculate without proceed', () => {
    selectSamplePatient();
    const fixture = TestBed.createComponent(OpenCVDRiskCalculator);
    const component = fixture.componentInstance;
    fillCompleteForm(component);
    fixture.detectChanges();

    component['chartExclusions'].set([
      {
        id: 'known-cvd',
        message: 'Chart suggests known cardiovascular disease',
        source: 'chart',
      },
    ]);
    fixture.detectChanges();
    expect(component['canCalculate']()).toBe(false);

    component['dismissExclusion']('known-cvd');
    fixture.detectChanges();

    expect(component['hasActiveExclusions']()).toBe(false);
    expect(fixture.nativeElement.querySelector('#open-cvd-risk-prevent-applicability')).toBeNull();
    expect(component['canCalculate']()).toBe(true);
  });

  it('should merge clinician attestation into active exclusions', () => {
    selectSamplePatient();
    const fixture = TestBed.createComponent(OpenCVDRiskCalculator);
    const component = fixture.componentInstance;
    fillCompleteForm(component);
    fixture.detectChanges();

    expect(component['hasActiveExclusions']()).toBe(false);
    component['setLifeExpectancyLimited'](true);
    fixture.detectChanges();

    expect(component['activeExclusions']().map((e) => e.id)).toContain('life-expectancy-limited');
    expect(component['canCalculate']()).toBe(false);
    expect(
      fixture.nativeElement.querySelector('#open-cvd-risk-clinical-context-card'),
    ).toBeTruthy();
  });

  it('should map the current form to OpenCVDRisk library parameters', () => {
    selectSamplePatient();
    const fixture = TestBed.createComponent(OpenCVDRiskCalculator);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    fillCompleteForm(component);
    component['setLifeExpectancyLimited'](true);
    component['setPathogenicGeneticVariant'](false);
    fixture.detectChanges();

    const params = component['buildLibraryParameters']();
    expect(params['OverrideAgeYears']).toEqual({ integer: 55 });
    expect(params['OverrideIsFemale']).toBe(true);
    expect(params['OverrideTotalCholMgDl']).toEqual({ decimal: 200 });
    expect(params['OverrideHdlMgDl']).toEqual({ decimal: 50 });
    expect(params['OverrideSbpMmHg']).toEqual({ decimal: 120 });
    expect(params['OverrideEgfr']).toEqual({ decimal: 90 });
    expect(params['OverrideDiabetes']).toBe(false);
    expect(params['OverrideCurrentSmoker']).toBe(false);
    expect(params['OverrideAntihypertensive']).toBe(false);
    expect(params['OverrideStatin']).toBe(false);
    expect(params['LifeExpectancyLimited']).toBe(true);
    expect(params['PathogenicGeneticCvdVariant']).toBe(false);
    expect(params['OverrideBmiKgM2']).toEqual({ decimal: expect.any(Number) });
    expect((params['OverrideBmiKgM2'] as { decimal: number }).decimal).toBeCloseTo(24.2, 1);
  });

  it('should pass library parameters when calculating risk', () => {
    const evaluateLibrary = vi.fn(() =>
      of({
        TenYearTotalCvdPercent: 8.1,
        TenYearAscvdProbability: 0.05,
        TenYearHeartFailureProbability: 0.04,
        ThirtyYearTotalCvdPercent: 22.3,
      }),
    );
    TestBed.overrideProvider(CqlEvaluateService, {
      useValue: { evaluateLibrary },
    });

    selectSamplePatient();
    const fixture = TestBed.createComponent(OpenCVDRiskCalculator);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    fillCompleteForm(component);
    fixture.detectChanges();

    component['calculateRisk']();

    expect(evaluateLibrary).toHaveBeenCalledWith(
      'OpenCVDRisk',
      [
        'TenYearTotalCvdPercent',
        'TenYearAscvdProbability',
        'TenYearHeartFailureProbability',
        'ThirtyYearTotalCvdPercent',
      ],
      expect.objectContaining({
        OverrideAgeYears: { integer: 55 },
        OverrideIsFemale: true,
        OverrideTotalCholMgDl: { decimal: 200 },
      }),
    );
  });
});

function setNumberInput(root: HTMLElement, selector: string, value: number): void {
  const input = root.querySelector(selector) as HTMLInputElement;
  input.value = String(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
