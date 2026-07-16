// Author: Preston Lee

export type TriState = 'yes' | 'no' | 'unknown';

export type AlgorithmStatus =
  | 'Complete'
  | 'NeedsClinicalInput'
  | 'OutsidePopulation'
  | 'NotAdult';

export type RecommendationStatus =
  | 'Applicable'
  | 'NotApplicable'
  | 'NeedsClinicalInput'
  | 'Informational'
  | 'InsufficientData';

export type RecommendationStrength =
  | 'Strong for'
  | 'Weak for'
  | 'Weak against'
  | 'Neither for nor against';

export type RecommendationDisplayTier =
  | 'applies-now'
  | 'discuss'
  | 'informational'
  | 'does-not-apply';

export interface GuidelineClinicianAnswers {
  lifeExpectancyLimitedUnder5Years: TriState;
  borderlineRiskPatientDesiresStatin: TriState;
  recentMiAcsOrCabgPciWithin6Weeks: TriState;
  veryHighRiskRecentAcsOrMiOnTherapy: TriState;
  veryHighRiskRecurrentEventsOnTherapy: TriState;
  onLipidLoweringTherapy: TriState;
  escalationNeeded: TriState;
  persistentlyElevatedFastingTriglycerides: TriState;
  statinIntoleranceAttested: TriState;
  unableToTakeStatin: TriState;
  cacWouldChangeManagement: TriState;
  clinicalRiskIntermediateOrHigh: TriState;
  clinicalRiskLow: TriState;
  astAltLessThan3xUlnConfirmed: TriState;
}

export const EMPTY_CLINICIAN_ANSWERS: GuidelineClinicianAnswers = {
  lifeExpectancyLimitedUnder5Years: 'unknown',
  borderlineRiskPatientDesiresStatin: 'unknown',
  recentMiAcsOrCabgPciWithin6Weeks: 'unknown',
  veryHighRiskRecentAcsOrMiOnTherapy: 'unknown',
  veryHighRiskRecurrentEventsOnTherapy: 'unknown',
  onLipidLoweringTherapy: 'unknown',
  escalationNeeded: 'unknown',
  persistentlyElevatedFastingTriglycerides: 'unknown',
  statinIntoleranceAttested: 'unknown',
  unableToTakeStatin: 'unknown',
  cacWouldChangeManagement: 'unknown',
  clinicalRiskIntermediateOrHigh: 'unknown',
  clinicalRiskLow: 'unknown',
  astAltLessThan3xUlnConfirmed: 'unknown',
};

export interface GuidelineRecommendationMeta {
  id: number;
  text: string;
  strength: RecommendationStrength;
  category: string;
  pdfPages: string;
  relatedBoxIds: number[];
  relatedSidebars: string[];
  displayNote: string;
}

export interface GuidelineRecommendationResult extends GuidelineRecommendationMeta {
  status: RecommendationStatus;
  tier: RecommendationDisplayTier;
}

export interface GuidelineEvaluationView {
  algorithmStatus: AlgorithmStatus;
  algorithmPath: string;
  pathwayTitle: string;
  pathwaySummary: string;
  guidelinePopulationStatus: string;
  effectiveAgeYears: number | null;
  tenYearTotalCvdPercent: number | null;
  latestLdlMgDl: number | null;
  effectiveDiabetes: boolean | null;
  hasEstablishedCvd: boolean;
  hasHivInfection: boolean;
  effectiveOnLipidLoweringTherapy: boolean | null;
  veryHighRiskCvd: boolean | null;
  box8UsedNullPreventRisk: boolean;
  shouldDiscussCardiacRehabReferral: boolean;
  showComprehensiveLifestyleReminder: boolean;
  showReemphasizeLifestyleReminder: boolean;
  showBox15ReassessReminder: boolean;
  showBox20MonitoringReminder: boolean;
  activeBoxes: number[];
  unresolvedBoxes: number[];
  recommendations: GuidelineRecommendationResult[];
  supportingFactors: { label: string; value: string }[];
}

export function triStateToBooleanOrOmit(
  value: TriState,
): boolean | undefined {
  if (value === 'yes') {
    return true;
  }
  if (value === 'no') {
    return false;
  }
  return undefined;
}

export function recommendationTier(status: RecommendationStatus): RecommendationDisplayTier {
  switch (status) {
    case 'Applicable':
      return 'applies-now';
    case 'NeedsClinicalInput':
      return 'discuss';
    case 'Informational':
    case 'InsufficientData':
      return 'informational';
    default:
      return 'does-not-apply';
  }
}

export function pathwayCopy(path: string): { title: string; summary: string } {
  switch (path) {
    case 'Box1_NotAdultOutsideAlgorithm':
      return {
        title: 'Outside adult algorithm (Box 1)',
        summary: 'This management algorithm applies to adult patients (age ≥18).',
      };
    case 'OutsideGuidelinePopulation':
      return {
        title: 'Outside guideline population',
        summary:
          'One or more CPG population exclusions apply (for example HFrEF with LVEF ≤35%, life expectancy <5 years, ESRD, or genetic dyslipidemia). Results remain decision support only.',
      };
    case 'Box4_DiscussUncertainBenefitLimitedLifeExpectancy':
      return {
        title: 'Discuss uncertain benefit (Box 4)',
        summary:
          'Life expectancy is limited (<5 years). Discuss uncertain benefit of lipid therapy. This is a CPG population exclusion; deterministic medication-path wording is suppressed.',
      };
    case 'Box9_PrimaryAtLeastModerateStatinConsiderLipidSpecialistIfLdlGe190':
      return {
        title: 'Primary prevention — at least moderate-intensity statin (Box 9)',
        summary:
          'Diabetes, LDL-C ≥190 mg/dL, or 10-year PREVENT total CVD risk ≥10% indicates at least a moderate-intensity statin (Rec 7). Consider lipid specialist referral if LDL-C ≥190.',
      };
    case 'Box11_PrimaryModerateStatinHiv':
      return {
        title: 'Primary prevention — moderate statin for HIV (Box 11)',
        summary:
          'Suggest a moderate-intensity statin with low antiretroviral interaction risk even when 10-year risk is low (Rec 10).',
      };
    case 'Box11_PrimaryModerateStatinBorderlineRiskPatientPreference':
      return {
        title: 'Primary prevention — moderate statin after shared decision (Box 11)',
        summary:
          'Estimated 10-year risk is 5% to <10% and the patient desires treatment. Suggest a moderate-intensity statin (Rec 8; Box 12 Yes).',
      };
    case 'Box13_14_NoMedicationRepeatRiskEvery5YearsUnlessNewRiskFactors':
      return {
        title: 'No medication; repeat risk assessment (Boxes 13–14)',
        summary:
          'No medication treatment now. Algorithm practice point: repeat risk assessment every 5 years unless new risk factors develop (Rec 1 tool; Rec 2 is neither for nor against a mandated frequency).',
      };
    case 'Box16_SecondaryStandardRiskThreeOptions':
      return {
        title: 'Secondary prevention — three unranked options (Box 16)',
        summary:
          'Suggest one of: high-intensity statin; moderate-intensity statin with ezetimibe; or moderate-intensity statin with a PCSK9 inhibitor (Rec 13). Shared decision-making required.',
      };
    case 'Box17_SecondaryVeryHighRiskInitialCombination':
      return {
        title: 'Very high-risk secondary prevention — initial combination (Box 17)',
        summary:
          'Suggest high-intensity or maximally tolerated statin with ezetimibe, or with a PCSK9 inhibitor (Rec 14). Escalation not selected.',
      };
    case 'Box19_SecondaryVeryHighRiskTripleTherapy':
      return {
        title: 'Very high-risk secondary prevention — triple therapy (Box 19)',
        summary:
          'Escalation needed: high-intensity or maximally tolerated statin with ezetimibe and a PCSK9 inhibitor (Rec 14).',
      };
    case 'NeedsClinicalInput_LifeExpectancy':
    case 'NeedsClinicalInput_VeryHighRisk':
    case 'NeedsClinicalInput_Escalation':
    case 'NeedsClinicalInput_BorderlineDesire':
    case 'NeedsClinicalInput':
      return {
        title: 'Clinical input needed',
        summary:
          'One or more algorithm decisions require clinician confirmation before a complete pathway recommendation can be shown.',
      };
    default:
      return {
        title: 'Guideline pathway',
        summary: path,
      };
  }
}
