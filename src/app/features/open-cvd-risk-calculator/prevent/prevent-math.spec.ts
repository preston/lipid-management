// Author: Preston Lee

import { describe, expect, it } from 'vitest';
import { PREVENT_S12_GOLDENS } from './s12-goldens';
import {
  prepTerms,
  preventRiskAge,
  formatPreventRiskAgeDisplay,
  riskFromBetas,
  selectPreventModel,
  type PreventInputs,
  type PreventModel,
  type PreventOutcome,
} from './prevent-math';

const OUTCOMES: PreventOutcome[] = ['totalCvd', 'ascvd', 'hf', 'chd', 'stroke'];

function sheetToInputs(sheetKey: string): { inputs: PreventInputs; model: PreventModel; horizon: 10 | 30 } {
  const sheet = PREVENT_S12_GOLDENS.sheets[sheetKey as keyof typeof PREVENT_S12_GOLDENS.sheets];
  const inp = sheet.inputs;
  const inputs: PreventInputs = {
    age: inp.age,
    totalChol: inp.totalChol,
    hdl: inp.hdl,
    sbp: inp.sbp,
    diabetes: inp.diabetes,
    smoke: inp.smoke,
    bmi: inp.bmi,
    egfr: inp.egfr,
    antihtn: inp.antihtn,
    statin: inp.statin,
    uacr: 'uacr' in inp ? inp.uacr : null,
    hba1c: 'hba1c' in inp ? inp.hba1c : null,
    sdi: 'sdi' in inp ? inp.sdi : null,
  };
  return {
    inputs,
    model: sheet.model as PreventModel,
    horizon: sheet.horizon as 10 | 30,
  };
}

describe('PREVENT S12 Excel goldens', () => {
  it('selects models like preventr / AHA optional rules', () => {
    const base = sheetToInputs('base_10').inputs;
    expect(selectPreventModel(base)).toBe('base');
    expect(selectPreventModel({ ...base, uacr: 40 })).toBe('uacr');
    expect(selectPreventModel({ ...base, hba1c: 7.5 })).toBe('hba1c');
    expect(selectPreventModel({ ...base, sdi: 8 })).toBe('sdi');
    expect(selectPreventModel({ ...base, uacr: 40, hba1c: 7.5 })).toBe('full');
    expect(selectPreventModel({ ...base, uacr: 40, sdi: 8 })).toBe('full');
    expect(selectPreventModel({ ...base, hba1c: 7.5, sdi: 8 })).toBe('full');
    expect(selectPreventModel({ ...base, uacr: 40, hba1c: 7.5, sdi: 8 })).toBe('full');
  });

  for (const sheetKey of Object.keys(PREVENT_S12_GOLDENS.sheets)) {
    it(`matches Excel worked example for ${sheetKey}`, () => {
      const sheet = PREVENT_S12_GOLDENS.sheets[sheetKey as keyof typeof PREVENT_S12_GOLDENS.sheets];
      const { inputs, model, horizon } = sheetToInputs(sheetKey);
      expect(selectPreventModel(inputs)).toBe(model);
      const terms = prepTerms(horizon, model, inputs);
      expect(terms.length).toBe(sheet.termKeys.length);

      for (const outcome of OUTCOMES) {
        for (const sex of ['female', 'male'] as const) {
          const betas = sheet.betas[`${outcome}_${sex}` as keyof typeof sheet.betas] as unknown as number[];
          const expected = sheet.risks[`${outcome}_${sex}` as keyof typeof sheet.risks] as unknown as number;
          const risk = riskFromBetas(betas, terms);
          expect(Math.abs(risk - expected)).toBeLessThan(1e-12);
        }
      }
    });
  }

  it('full model with missing SDI uses missing indicator (deterministic)', () => {
    const { inputs } = sheetToInputs('full_10');
    const partial = { ...inputs, sdi: null as number | null };
    expect(selectPreventModel(partial)).toBe('full');
    const terms = prepTerms(10, 'full', partial);
    // term order extras: sdi46, sdi710, missSdi, lnUacr, missUacr, hbaDm, hbaNo, missHba, constant
    const coreLen = 22; // 10y without constant
    expect(terms[coreLen + 2]).toBe(1); // missSdi
    expect(terms[coreLen]).toBe(0); // sdi46
    expect(terms[coreLen + 1]).toBe(0); // sdi710
  });

  it('covers spline edges: smoker+statin, SBP<110, eGFR<60', () => {
    const { inputs } = sheetToInputs('base_10');
    const edge = {
      ...inputs,
      smoke: 1,
      statin: 1,
      sbp: 100,
      egfr: 45,
    };
    const terms = prepTerms(10, 'base', edge);
    // indices: sbp_lt=3, sbp_gte=4, smoke=6, egfr_lt=9, statin=12, treated_nonhdl=14
    expect(terms[3]).toBeLessThan(0); // sbp_lt
    expect(terms[4]).toBe((110 - 130) / 20); // sbp_gte clipped at 110
    expect(terms[6]).toBe(1);
    expect(terms[9]).toBeGreaterThan(0); // egfr_lt
    expect(terms[12]).toBe(1);
    expect(terms[14]).not.toBe(0); // statin * nonhdl
  });

  it('rejects non-integer SDI and out-of-range optionals for model selection', () => {
    const { inputs } = sheetToInputs('base_10');
    expect(selectPreventModel({ ...inputs, sdi: 8.5 })).toBe('base');
    expect(selectPreventModel({ ...inputs, uacr: 0.01 })).toBe('base');
    expect(selectPreventModel({ ...inputs, hba1c: 16 })).toBe('base');
    expect(selectPreventModel({ ...inputs, uacr: 40, hba1c: 7.5, sdi: null })).toBe('full');
  });
});

describe('preventRiskAge (PREVENT-Risk Age / OpenCVDRisk Age)', () => {
  it('uses percent-scale p-hat (near-optimal 0.9% ≈ chronological mid-40s for females)', () => {
    expect(preventRiskAge('female', 0.9)).toBe(44);
    expect(preventRiskAge('male', 0.9)).toBe(40);
  });

  it('matches published ~5% → ~63 female example', () => {
    expect(preventRiskAge('female', 5)).toBe(63);
    expect(preventRiskAge('male', 5)).toBe(60);
  });

  it('clamps below 30 and above 79', () => {
    expect(preventRiskAge('female', 0.01)).toBe(30);
    expect(preventRiskAge('male', 0.01)).toBe(30);
    expect(preventRiskAge('female', 50)).toBe(79);
    expect(preventRiskAge('male', 50)).toBe(79);
  });

  it('displays extremes as <30 and >79', () => {
    expect(formatPreventRiskAgeDisplay('female', 0.01)).toBe('<30');
    expect(formatPreventRiskAgeDisplay('male', 0.01)).toBe('<30');
    expect(formatPreventRiskAgeDisplay('female', 25)).toBe('>79');
    expect(formatPreventRiskAgeDisplay('male', 25)).toBe('>79');
    expect(formatPreventRiskAgeDisplay('female', 5)).toBe('63');
  });

  it('returns null for non-positive or non-finite risk', () => {
    expect(preventRiskAge('female', 0)).toBeNull();
    expect(preventRiskAge('female', -1)).toBeNull();
    expect(preventRiskAge('female', Number.NaN)).toBeNull();
    expect(formatPreventRiskAgeDisplay('female', 0)).toBeNull();
  });
});
