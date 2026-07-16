// Author: Preston Lee

export type OpenCVDRiskSex = 'female' | 'male';

export type OpenCVDRiskYesNo = 'yes' | 'no';

export interface OpenCVDRiskCalculatorForm {
  age: number | null;
  sex: OpenCVDRiskSex | '';
  heightCm: number | null;
  weightKg: number | null;
  totalCholesterolMgDl: number | null;
  hdlMgDl: number | null;
  systolicBpMmHg: number | null;
  egfrMlMin173m2: number | null;
  diabetes: OpenCVDRiskYesNo;
  currentSmoker: OpenCVDRiskYesNo;
  onAntihypertensive: OpenCVDRiskYesNo;
  onStatin: OpenCVDRiskYesNo;
  /** Optional PREVENT enhance predictors (null = absent). */
  uacrMgG: number | null;
  hba1cPercent: number | null;
  /** ZIP/ZCTA for SDI lookup (chart postalCode or user override). Empty string = absent. */
  zipCode: string;
  sdiDecile: number | null;
}
