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

/** Dependency order: BMI → SDI2019 → OpenCVDRisk → LipidManagement. */
export const CQL_LIBRARY_CATALOG: readonly CqlLibraryCatalogEntry[] = [
  { id: 'BMI', assetPath: '/cql/BMI.cql', label: 'BMI' },
  { id: 'SDI2019', assetPath: '/cql/SDI-2019.cql', label: 'SDI-2019' },
  { id: 'OpenCVDRisk', assetPath: '/cql/OpenCVDRisk.cql', label: 'OpenCVDRisk' },
  { id: 'LipidManagement', assetPath: '/cql/LipidManagement.cql', label: 'LipidManagement' },
];

/** Order roughly follows library dependency (BMI → SDI2019 → OpenCVDRisk / LipidManagement). */
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
    id: 'marco',
    assetPath: '/data/synthetic/Marco578_Balistreri607_c6263db8-ac6d-4f67-89cd-520c9bcd32bd.json',
    label: 'Patient Marco Balistreri (baseline lipids + anti-HTN)',
    kind: 'patient',
    resourceId: 'c6263db8-ac6d-4f67-89cd-520c9bcd32bd',
    sizeHint: '~5.0 MB',
  },
  {
    id: 'aja',
    assetPath: '/data/synthetic/Aja848_Janeen273_Cormier289_c8a81d80-45e4-cc3c-534a-b5c384f7357d.json',
    label: 'Patient Aja Cormier (female T2DM)',
    kind: 'patient',
    resourceId: 'c8a81d80-45e4-cc3c-534a-b5c384f7357d',
    sizeHint: '~6.4 MB',
  },
  {
    id: 'ahmad',
    assetPath: '/data/synthetic/Ahmad985_Schulist381_ae2fc04e-7c66-5451-f7a8-dfc489ee265c.json',
    label: 'Patient Ahmad Schulist (T2DM + smoker + anti-HTN)',
    kind: 'patient',
    resourceId: 'ae2fc04e-7c66-5451-f7a8-dfc489ee265c',
    sizeHint: '~6.4 MB',
  },
  {
    id: 'jeromy',
    assetPath: '/data/synthetic/Jeromy156_Boyer713_0ac99efa-66a6-ab32-581f-651621eb2194.json',
    label: 'Patient Jeromy Boyer (HIV)',
    kind: 'patient',
    resourceId: '0ac99efa-66a6-ab32-581f-651621eb2194',
    sizeHint: '~6.5 MB',
  },
  {
    id: 'german',
    assetPath: '/data/synthetic/German382_Zemlak964_00c57650-013d-27a1-513f-b865c14a29ca.json',
    label: 'Patient German Zemlak (ASCVD + statin)',
    kind: 'patient',
    resourceId: '00c57650-013d-27a1-513f-b865c14a29ca',
    sizeHint: '~7.2 MB',
  },
  {
    id: 'katharine',
    assetPath: '/data/synthetic/Katharine125_Doris153_Hudson301_52227b7c-b95b-3291-55c5-dd159f545fbb.json',
    label: 'Patient Katharine Hudson (female ASCVD + LVEF)',
    kind: 'patient',
    resourceId: '52227b7c-b95b-3291-55c5-dd159f545fbb',
    sizeHint: '~8.5 MB',
  },
  {
    id: 'rhett',
    assetPath: '/data/synthetic/Rhett759_Kulas532_459ce83f-8a46-af89-447d-549e5e846740.json',
    label: 'Patient Rhett Kulas (ASCVD + LVEF <40)',
    kind: 'patient',
    resourceId: '459ce83f-8a46-af89-447d-549e5e846740',
    sizeHint: '~8.8 MB',
  },
  {
    id: 'tracie',
    assetPath: '/data/synthetic/Tracie996_Weber641_16ac2432-87ea-4992-8fe9-3143ee9f5ed8.json',
    label: 'Patient Tracie Weber (ASCVD + T2DM + statin + LVEF)',
    kind: 'patient',
    resourceId: '16ac2432-87ea-4992-8fe9-3143ee9f5ed8',
    sizeHint: '~9.3 MB',
  },
];
