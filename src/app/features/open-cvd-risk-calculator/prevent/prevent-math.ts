// Author: Preston Lee

/** Excel-faithful PREVENT simplified logistic terms (S12), mg/dL cholesterol via ×0.02586. */

export type PreventModel = 'base' | 'uacr' | 'hba1c' | 'sdi' | 'full';
export type PreventSex = 'female' | 'male';
export type PreventOutcome = 'totalCvd' | 'ascvd' | 'hf' | 'chd' | 'stroke';

export interface PreventInputs {
  age: number;
  totalChol: number;
  hdl: number;
  sbp: number;
  diabetes: number; // 0|1
  smoke: number;
  bmi: number;
  egfr: number;
  antihtn: number;
  statin: number;
  uacr?: number | null;
  hba1c?: number | null;
  sdi?: number | null;
}

export function isValidUacr(v: number | null | undefined): boolean {
  return v != null && Number.isFinite(v) && v >= 0.1 && v <= 25000;
}

export function isValidHba1c(v: number | null | undefined): boolean {
  return v != null && Number.isFinite(v) && v >= 3 && v <= 15;
}

export function isValidSdi(v: number | null | undefined): boolean {
  return v != null && Number.isFinite(v) && v >= 1 && v <= 10 && Number.isInteger(v);
}

export function selectPreventModel(input: PreventInputs): PreventModel {
  const u = isValidUacr(input.uacr);
  const h = isValidHba1c(input.hba1c);
  const s = isValidSdi(input.sdi);
  const n = (u ? 1 : 0) + (h ? 1 : 0) + (s ? 1 : 0);
  if (n >= 2) {
    return 'full';
  }
  if (u) {
    return 'uacr';
  }
  if (h) {
    return 'hba1c';
  }
  if (s) {
    return 'sdi';
  }
  return 'base';
}

export function prepTerms(
  horizon: 10 | 30,
  model: PreventModel,
  input: PreventInputs,
): number[] {
  const age10 = (input.age - 55) / 10;
  const nonhdl = (input.totalChol - input.hdl) * 0.02586 - 3.5;
  const hdlsc = (input.hdl * 0.02586 - 1.3) / 0.3;
  const sbpLt = (Math.min(input.sbp, 110) - 110) / 20;
  const sbpGte = (Math.max(input.sbp, 110) - 130) / 20;
  const bmiLt = (Math.min(input.bmi, 30) - 25) / 5;
  const bmiGte = (Math.max(input.bmi, 30) - 30) / 5;
  const egfrLt = (Math.min(input.egfr, 60) - 60) / -15;
  const egfrGte = (Math.max(input.egfr, 60) - 90) / -15;
  const dm = input.diabetes;
  const smoke = input.smoke;
  const bp = input.antihtn;
  const statin = input.statin;

  const core: number[] =
    horizon === 30
      ? [
          age10,
          age10 * age10,
          nonhdl,
          hdlsc,
          sbpLt,
          sbpGte,
          dm,
          smoke,
          bmiLt,
          bmiGte,
          egfrLt,
          egfrGte,
          bp,
          statin,
          bp * sbpGte,
          statin * nonhdl,
          age10 * nonhdl,
          age10 * hdlsc,
          age10 * sbpGte,
          age10 * dm,
          age10 * smoke,
          age10 * bmiGte,
          age10 * egfrLt,
        ]
      : [
          age10,
          nonhdl,
          hdlsc,
          sbpLt,
          sbpGte,
          dm,
          smoke,
          bmiLt,
          bmiGte,
          egfrLt,
          egfrGte,
          bp,
          statin,
          bp * sbpGte,
          statin * nonhdl,
          age10 * nonhdl,
          age10 * hdlsc,
          age10 * sbpGte,
          age10 * dm,
          age10 * smoke,
          age10 * bmiGte,
          age10 * egfrLt,
        ];

  const uacrOk = isValidUacr(input.uacr);
  const hba1cOk = isValidHba1c(input.hba1c);
  const sdiOk = isValidSdi(input.sdi);
  const uacr = uacrOk ? (input.uacr as number) : null;
  const hba1c = hba1cOk ? (input.hba1c as number) : null;
  const sdi = sdiOk ? (input.sdi as number) : null;

  let extras: number[] = [];
  if (model === 'uacr') {
    extras = [Math.log(uacr!), 0];
  } else if (model === 'hba1c') {
    extras = [(hba1c! - 5.3) * dm, (hba1c! - 5.3) * (1 - dm), 0];
  } else if (model === 'sdi') {
    extras = [sdi! >= 4 && sdi! <= 6 ? 1 : 0, sdi! >= 7 ? 1 : 0, 0];
  } else if (model === 'full') {
    const sdi46 = sdiOk && sdi! >= 4 && sdi! <= 6 ? 1 : 0;
    const sdi710 = sdiOk && sdi! >= 7 ? 1 : 0;
    const missSdi = sdiOk ? 0 : 1;
    const lnUacr = uacrOk ? Math.log(uacr!) : 0;
    const missUacr = uacrOk ? 0 : 1;
    const hbaDm = hba1cOk ? (hba1c! - 5.3) * dm : 0;
    const hbaNo = hba1cOk ? (hba1c! - 5.3) * (1 - dm) : 0;
    const missHba = hba1cOk ? 0 : 1;
    extras = [sdi46, sdi710, missSdi, lnUacr, missUacr, hbaDm, hbaNo, missHba];
  }

  return [...core, ...extras, 1];
}

export function sigmoid(logOdds: number): number {
  return Math.exp(logOdds) / (1 + Math.exp(logOdds));
}

export function riskFromBetas(betas: readonly number[], terms: readonly number[]): number {
  let lp = 0;
  for (let i = 0; i < betas.length; i++) {
    lp += betas[i]! * terms[i]!;
  }
  return sigmoid(lp);
}
