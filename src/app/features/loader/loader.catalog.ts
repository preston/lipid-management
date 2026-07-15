// Author: Preston Lee

export interface CqlLibraryCatalogEntry {
  id: string;
  assetPath: string;
  label: string;
}

export type ValueSetOrigin = 'vsac' | 'asu';

export interface ValueSetCatalogEntry {
  id: string;
  assetPath: string;
  label: string;
  origin: ValueSetOrigin;
}

export type ExampleDataKind = 'hospital' | 'practitioner' | 'patient';

export interface ExampleDataCatalogEntry {
  id: string;
  assetPath: string;
  label: string;
  kind: ExampleDataKind;
  /** Patient id used for Check, when kind is patient. */
  resourceId?: string;
  sizeHint: string;
}

/** Dependency order: BMI → OpenCVDRisk → LipidManagement. */
export const CQL_LIBRARY_CATALOG: readonly CqlLibraryCatalogEntry[] = [
  { id: 'BMI', assetPath: '/cql/BMI.cql', label: 'BMI' },
  { id: 'OpenCVDRisk', assetPath: '/cql/OpenCVDRisk.cql', label: 'OpenCVDRisk' },
  { id: 'LipidManagement', assetPath: '/cql/LipidManagement.cql', label: 'LipidManagement' },
];

/** Order roughly follows library dependency (BMI → OpenCVDRisk / LipidManagement). */
export const VALUE_SET_CATALOG: readonly ValueSetCatalogEntry[] = [
  { id: 'body-height', assetPath: '/value-sets/body-height.json', label: 'Body Height', origin: 'asu' },
  { id: 'body-weight', assetPath: '/value-sets/body-weight.json', label: 'Body Weight', origin: 'asu' },
  { id: 'body-mass-index', assetPath: '/value-sets/body-mass-index.json', label: 'Body Mass Index', origin: 'asu' },
  { id: 'total-cholesterol', assetPath: '/value-sets/total-cholesterol.json', label: 'Total Cholesterol', origin: 'asu' },
  { id: 'hdl-cholesterol', assetPath: '/value-sets/hdl-cholesterol.json', label: 'HDL Cholesterol', origin: 'asu' },
  { id: 'ldl-cholesterol', assetPath: '/value-sets/ldl-cholesterol.json', label: 'LDL Cholesterol', origin: 'asu' },
  { id: 'systolic-blood-pressure', assetPath: '/value-sets/systolic-blood-pressure.json', label: 'Systolic Blood Pressure', origin: 'asu' },
  { id: 'creatinine', assetPath: '/value-sets/creatinine.json', label: 'Creatinine', origin: 'asu' },
  { id: 'tobacco-smoking-status', assetPath: '/value-sets/tobacco-smoking-status.json', label: 'Tobacco Smoking Status', origin: 'asu' },
  { id: 'current-smoker-answers', assetPath: '/value-sets/current-smoker-answers.json', label: 'Current Smoker Answers', origin: 'asu' },
  { id: 'statin-therapy', assetPath: '/value-sets/statin-therapy.json', label: 'Statin Therapy', origin: 'asu' },
  { id: 'antihypertensive-therapy', assetPath: '/value-sets/antihypertensive-therapy.json', label: 'Antihypertensive Therapy', origin: 'asu' },
  {
    id: 'atherosclerotic-cardiovascular-disease',
    assetPath: '/value-sets/atherosclerotic-cardiovascular-disease.json',
    label: 'AHA Atherosclerotic Cardiovascular Disease',
    origin: 'vsac',
  },
  { id: 'diabetes-mellitus-type-2', assetPath: '/value-sets/diabetes-mellitus-type-2.json', label: 'Diabetes Mellitus Type 2', origin: 'asu' },
  {
    id: 'end-stage-kidney-disease',
    assetPath: '/value-sets/end-stage-kidney-disease.json',
    label: 'End Stage Renal Disease',
    origin: 'vsac',
  },
  {
    id: 'left-ventricular-ejection-fraction',
    assetPath: '/value-sets/left-ventricular-ejection-fraction.json',
    label: 'Left Ventricular Ejection Fraction',
    origin: 'asu',
  },
  {
    id: 'heart-failure-with-reduced-ejection-fraction',
    assetPath: '/value-sets/heart-failure-with-reduced-ejection-fraction.json',
    label: 'HFrEF',
    origin: 'asu',
  },
  {
    id: 'coronary-artery-calcium-score',
    assetPath: '/value-sets/coronary-artery-calcium-score.json',
    label: 'Coronary Artery Calcium Score',
    origin: 'asu',
  },
  {
    id: 'inherited-cardiovascular-condition',
    assetPath: '/value-sets/inherited-cardiovascular-condition.json',
    label: 'Inherited Cardiovascular Condition',
    origin: 'asu',
  },
];

/** Recommended order: hospital → practitioner → patients. */
export const EXAMPLE_DATA_CATALOG: readonly ExampleDataCatalogEntry[] = [
  {
    id: 'hospital',
    assetPath: '/data/synthetic/hospitalInformation1744683719203.json',
    label: 'Hospital / organization context',
    kind: 'hospital',
    sizeHint: '~2.3 MB',
  },
  {
    id: 'practitioner',
    assetPath: '/data/synthetic/practitionerInformation1744683719203.json',
    label: 'Practitioners',
    kind: 'practitioner',
    sizeHint: '~2.4 MB',
  },
  {
    id: 'dakota',
    assetPath: '/data/synthetic/Dakota806_Hegmann834_1c2eb354-d800-404a-d393-0c802c4e581f.json',
    label: 'Patient Dakota Hegmann',
    kind: 'patient',
    resourceId: '1c2eb354-d800-404a-d393-0c802c4e581f',
    sizeHint: '~6.9 MB',
  },
  {
    id: 'dori',
    assetPath: '/data/synthetic/Dori98_Bailey598_b93b0a92-648f-55aa-8841-ce863b9c21a5.json',
    label: 'Patient Dori Bailey',
    kind: 'patient',
    resourceId: 'b93b0a92-648f-55aa-8841-ce863b9c21a5',
    sizeHint: '~2.5 MB',
  },
];
