// Author: Preston Lee

import { TestBed } from '@angular/core/testing';
import { OpenCVDRiskCalculator } from './open-cvd-risk-calculator';

describe('OpenCVDRiskCalculator', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OpenCVDRiskCalculator],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(OpenCVDRiskCalculator);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render required field controls', () => {
    const fixture = TestBed.createComponent(OpenCVDRiskCalculator);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('#open-cvd-risk-age')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-sex-female')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-sex-male')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-height-cm')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-weight-kg')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-total-cholesterol')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-hdl-cholesterol')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-systolic-bp')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-serum-creatinine')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-calculate')).toBeTruthy();
    expect(root.querySelector('#open-cvd-risk-results')).toBeTruthy();
  });

  it('should not render optional add-on fields', () => {
    const fixture = TestBed.createComponent(OpenCVDRiskCalculator);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).not.toMatch(/HbA1c/i);
    expect(text).not.toMatch(/UACR/i);
    expect(text).not.toMatch(/albumin/i);
    expect(text).not.toMatch(/social deprivation/i);
    expect(text).not.toMatch(/zip code/i);
  });

  it('should compute BMI and eGFR from inputs', () => {
    const fixture = TestBed.createComponent(OpenCVDRiskCalculator);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component['model'].update((current) => ({
      ...current,
      heightCm: 170,
      weightKg: 70,
      age: 55,
      sex: 'female',
      serumCreatinineMgDl: 1.0,
    }));
    fixture.detectChanges();

    expect(component['bmiKgM2']()).toBeCloseTo(24.2, 1);
    expect(component['egfrMlMin']()).not.toBeNull();
    expect(component['egfrDisplay']()).not.toBe('—');
  });

  it('should sync Signal Forms field bindings from the DOM', async () => {
    const fixture = TestBed.createComponent(OpenCVDRiskCalculator);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const component = fixture.componentInstance;

    setNumberInput(root, '#open-cvd-risk-age', 55);
    setNumberInput(root, '#open-cvd-risk-height-cm', 170);
    setNumberInput(root, '#open-cvd-risk-weight-kg', 70);
    setNumberInput(root, '#open-cvd-risk-serum-creatinine', 1);
    (root.querySelector('#open-cvd-risk-sex-female') as HTMLInputElement).click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component['model']().age).toBe(55);
    expect(component['model']().heightCm).toBe(170);
    expect(component['model']().weightKg).toBe(70);
    expect(component['model']().serumCreatinineMgDl).toBe(1);
    expect(component['model']().sex).toBe('female');
    expect(component['bmiKgM2']()).toBeCloseTo(24.2, 1);
    expect(component['egfrMlMin']()).not.toBeNull();
  });

  it('should mark inputs complete when required fields are present', () => {
    const fixture = TestBed.createComponent(OpenCVDRiskCalculator);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component['inputsComplete']()).toBe(false);

    component['model'].set({
      age: 55,
      sex: 'female',
      heightCm: 170,
      weightKg: 70,
      totalCholesterolMgDl: 200,
      hdlMgDl: 50,
      systolicBpMmHg: 120,
      serumCreatinineMgDl: 1.0,
      diabetes: 'no',
      currentSmoker: 'no',
      onAntihypertensive: 'no',
      onStatin: 'no',
    });
    fixture.detectChanges();

    expect(component['inputsComplete']()).toBe(true);
    expect(
      fixture.nativeElement.querySelector('#open-cvd-risk-results-message')?.textContent,
    ).toContain('Required inputs are complete');
  });
});

function setNumberInput(root: HTMLElement, selector: string, value: number): void {
  const input = root.querySelector(selector) as HTMLInputElement;
  input.value = String(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
