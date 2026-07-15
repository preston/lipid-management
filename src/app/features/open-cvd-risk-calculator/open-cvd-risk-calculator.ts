// Author: Preston Lee

import { Component, computed, signal } from '@angular/core';
import { FormField, form, max, min, required } from '@angular/forms/signals';
import { computeBmiKgM2, computeEgfr2021Creatinine } from './open-cvd-risk-egfr';
import type { OpenCVDRiskCalculatorForm, OpenCVDRiskSex } from './open-cvd-risk-calculator.model';

const PLACEHOLDER = '—';

const EMPTY_FORM: OpenCVDRiskCalculatorForm = {
  age: null,
  sex: '',
  heightCm: null,
  weightKg: null,
  totalCholesterolMgDl: null,
  hdlMgDl: null,
  systolicBpMmHg: null,
  serumCreatinineMgDl: null,
  diabetes: 'no',
  currentSmoker: 'no',
  onAntihypertensive: 'no',
  onStatin: 'no',
};

@Component({
  selector: 'app-open-cvd-risk-calculator',
  imports: [FormField],
  templateUrl: './open-cvd-risk-calculator.html',
  styleUrl: './open-cvd-risk-calculator.scss',
})
export class OpenCVDRiskCalculator {
  protected readonly model = signal<OpenCVDRiskCalculatorForm>({ ...EMPTY_FORM });

  protected readonly openCvdRiskForm = form(this.model, (fields) => {
    required(fields.age);
    min(fields.age, 30);
    max(fields.age, 79);
    required(fields.sex);
    required(fields.heightCm);
    min(fields.heightCm, 1);
    required(fields.weightKg);
    min(fields.weightKg, 1);
    required(fields.totalCholesterolMgDl);
    min(fields.totalCholesterolMgDl, 0);
    required(fields.hdlMgDl);
    min(fields.hdlMgDl, 0);
    required(fields.systolicBpMmHg);
    min(fields.systolicBpMmHg, 0);
    required(fields.serumCreatinineMgDl);
    min(fields.serumCreatinineMgDl, 0);
  });

  protected readonly bmiKgM2 = computed(() => {
    const { heightCm, weightKg } = this.model();
    if (heightCm == null || weightKg == null || heightCm <= 0 || weightKg <= 0) {
      return null;
    }
    return computeBmiKgM2(heightCm, weightKg);
  });

  protected readonly egfrMlMin = computed(() => {
    const { serumCreatinineMgDl: scr, age: ageYears, sex } = this.model();
    if (scr == null || ageYears == null || !this.isSex(sex) || scr <= 0) {
      return null;
    }
    return computeEgfr2021Creatinine(scr, ageYears, sex);
  });

  protected readonly bmiDisplay = computed(() => this.formatNumber(this.bmiKgM2(), 1));
  protected readonly egfrDisplay = computed(() => this.formatNumber(this.egfrMlMin(), 0));

  protected readonly inputsComplete = computed(() => {
    const m = this.model();
    return (
      m.age != null &&
      m.age >= 30 &&
      m.age <= 79 &&
      this.isSex(m.sex) &&
      m.totalCholesterolMgDl != null &&
      m.hdlMgDl != null &&
      m.systolicBpMmHg != null &&
      this.bmiKgM2() != null &&
      this.egfrMlMin() != null
    );
  });

  protected readonly riskPlaceholder = PLACEHOLDER;

  private isSex(value: string): value is OpenCVDRiskSex {
    return value === 'female' || value === 'male';
  }

  private formatNumber(value: number | null, fractionDigits: number): string {
    if (value == null || !Number.isFinite(value)) {
      return PLACEHOLDER;
    }
    return value.toLocaleString(undefined, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
  }
}
