// Author: Preston Lee

import { describe, expect, it } from 'vitest';
import { GUIDELINE_CLINICIAN_QUESTIONS } from './guideline';
import { EMPTY_CLINICIAN_ANSWERS, type GuidelineClinicianAnswers } from './guideline.model';

const EXPECTED_LABEL_SUFFIX: Record<keyof GuidelineClinicianAnswers, string> = {
  lifeExpectancyLimitedUnder5Years: '(Box 3)',
  establishedCvd: '(Box 5, Sidebar 3)',
  veryHighRiskCvd: '(Box 7, Sidebar 4)',
  recentMiAcsOrCabgPciWithin6Weeks: '(Box 6, Rec 24)',
  onLipidLoweringTherapy: '(Box 7, Sidebar 4)',
  veryHighRiskRecentAcsOrMiOnTherapy: '(Box 7, Sidebar 4)',
  veryHighRiskRecurrentEventsOnTherapy: '(Box 7, Sidebar 4)',
  hivInfection: '(Box 10)',
  primaryPreventionStatinIndication: '(Box 8)',
  borderlineRiskBand: '(Box 12)',
  escalationNeeded: '(Box 18)',
  borderlineRiskPatientDesiresStatin: '(Box 12 → Box 11)',
  clinicalRiskIntermediateOrHigh: '(Rec 3, Sidebar 7)',
  cacWouldChangeManagement: '(Rec 3, Sidebar 7)',
  clinicalRiskLow: '(Rec 4, Sidebar 7)',
  elevatedAstOrAltLessThan3xUln: '(Rec 11)',
  persistentlyElevatedFastingTriglycerides: '(Rec 16, Sidebar 8)',
  statinIntoleranceAttested: '(Rec 18, Sidebar 6)',
  unableToTakeStatin: '(Rec 19, Sidebar 6)',
};

describe('guideline clinician question catalog', () => {
  it('covers every answer key with a Box, Rec, or Sidebar context suffix', () => {
    const catalogIds = GUIDELINE_CLINICIAN_QUESTIONS.map((q) => q.id);
    expect(catalogIds.sort()).toEqual(
      (Object.keys(EMPTY_CLINICIAN_ANSWERS) as (keyof GuidelineClinicianAnswers)[]).sort(),
    );
    for (const question of GUIDELINE_CLINICIAN_QUESTIONS) {
      const suffix = EXPECTED_LABEL_SUFFIX[question.id];
      expect(question.label.endsWith(suffix), question.id).toBe(true);
    }
  });
});
