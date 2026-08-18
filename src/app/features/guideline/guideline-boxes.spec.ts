// Author: Preston Lee

import { EMPTY_CLINICIAN_ANSWERS, type GuidelineClinicianAnswers } from './guideline.model';
import {
  APPENDIX_G_BOXES,
  boxMeta,
  diagramBoxForQuestion,
  formatBoxLabel,
  formatRelatedBoxLabels,
  pathBlockingQuestionIds,
  questionAffectsDiagram,
  questionsForBox,
} from './guideline-boxes';

describe('guideline-boxes catalog', () => {
  it('covers boxes 1–21 with unique ids', () => {
    expect(APPENDIX_G_BOXES).toHaveLength(21);
    expect(APPENDIX_G_BOXES.map((b) => b.id)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
    ]);
  });

  it('maps clinician questions to decision boxes', () => {
    expect(diagramBoxForQuestion('lifeExpectancyLimitedUnder5Years')).toBe(3);
    expect(diagramBoxForQuestion('establishedCvd')).toBe(5);
    expect(diagramBoxForQuestion('veryHighRiskCvd')).toBe(7);
    expect(diagramBoxForQuestion('primaryPreventionStatinIndication')).toBe(8);
    expect(diagramBoxForQuestion('hivInfection')).toBe(10);
    expect(diagramBoxForQuestion('borderlineRiskBand')).toBe(12);
    expect(diagramBoxForQuestion('borderlineRiskPatientDesiresStatin')).toBe(12);
    expect(diagramBoxForQuestion('escalationNeeded')).toBe(18);
    expect(diagramBoxForQuestion('onLipidLoweringTherapy')).toBe(7);
    expect(diagramBoxForQuestion('veryHighRiskRecentAcsOrMiOnTherapy')).toBe(7);
    expect(diagramBoxForQuestion('veryHighRiskRecurrentEventsOnTherapy')).toBe(7);
    expect(diagramBoxForQuestion('clinicalRiskLow')).toBeNull();
    expect(questionAffectsDiagram('lifeExpectancyLimitedUnder5Years')).toBe(true);
    expect(questionAffectsDiagram('establishedCvd')).toBe(true);
    expect(questionAffectsDiagram('hivInfection')).toBe(true);
    expect(questionAffectsDiagram('primaryPreventionStatinIndication')).toBe(true);
    expect(questionAffectsDiagram('borderlineRiskBand')).toBe(true);
    expect(questionAffectsDiagram('veryHighRiskCvd')).toBe(true);
    expect(questionAffectsDiagram('onLipidLoweringTherapy')).toBe(true);
    expect(questionAffectsDiagram('borderlineRiskPatientDesiresStatin')).toBe(true);
    expect(questionAffectsDiagram('escalationNeeded')).toBe(true);
    expect(questionAffectsDiagram('recentMiAcsOrCabgPciWithin6Weeks')).toBe(false);
    expect(questionAffectsDiagram('clinicalRiskLow')).toBe(false);
    expect(questionAffectsDiagram('persistentlyElevatedFastingTriglycerides')).toBe(false);
    expect(questionAffectsDiagram('statinIntoleranceAttested')).toBe(false);
  });

  it('partitions every clinician question between diagram and recommendation columns', () => {
    const diagramIds: (keyof GuidelineClinicianAnswers)[] = [
      'lifeExpectancyLimitedUnder5Years',
      'establishedCvd',
      'veryHighRiskCvd',
      'onLipidLoweringTherapy',
      'veryHighRiskRecentAcsOrMiOnTherapy',
      'veryHighRiskRecurrentEventsOnTherapy',
      'hivInfection',
      'primaryPreventionStatinIndication',
      'borderlineRiskBand',
      'borderlineRiskPatientDesiresStatin',
      'escalationNeeded',
    ];
    const recommendationIds: (keyof GuidelineClinicianAnswers)[] = [
      'recentMiAcsOrCabgPciWithin6Weeks',
      'clinicalRiskIntermediateOrHigh',
      'cacWouldChangeManagement',
      'clinicalRiskLow',
      'elevatedAstOrAltLessThan3xUln',
      'persistentlyElevatedFastingTriglycerides',
      'statinIntoleranceAttested',
      'unableToTakeStatin',
    ];
    const allIds = Object.keys(EMPTY_CLINICIAN_ANSWERS) as (keyof GuidelineClinicianAnswers)[];
    expect(diagramIds.length + recommendationIds.length).toBe(allIds.length);
    for (const id of diagramIds) {
      expect(questionAffectsDiagram(id), id).toBe(true);
    }
    for (const id of recommendationIds) {
      expect(questionAffectsDiagram(id), id).toBe(false);
    }
    expect(allIds.filter((id) => questionAffectsDiagram(id)).sort()).toEqual(diagramIds.sort());
    expect(allIds.filter((id) => !questionAffectsDiagram(id)).sort()).toEqual(
      recommendationIds.sort(),
    );
  });

  it('formats box labels', () => {
    expect(formatBoxLabel(8)).toBe('Box 8');
    expect(formatRelatedBoxLabels([8, 9])).toBe('Box 8, Box 9');
    expect(boxMeta(1).kind).toBe('start');
    expect(boxMeta(1).title).toBe('Adult patient');
    expect(boxMeta(3).title).toMatch(/life expectancy limited/i);
    expect(boxMeta(5).kind).toBe('decision');
    expect(boxMeta(5).title).toMatch(/Existing CVD/);
    expect(boxMeta(9).kind).toBe('action');
  });

  it('maps path-blocking questions for unresolved boxes including Box 7', () => {
    expect(questionsForBox(7)).toEqual([
      'veryHighRiskCvd',
      'onLipidLoweringTherapy',
      'veryHighRiskRecentAcsOrMiOnTherapy',
      'veryHighRiskRecurrentEventsOnTherapy',
    ]);
    expect([...pathBlockingQuestionIds([7])]).toEqual([
      'veryHighRiskCvd',
      'onLipidLoweringTherapy',
      'veryHighRiskRecentAcsOrMiOnTherapy',
      'veryHighRiskRecurrentEventsOnTherapy',
    ]);
    expect(pathBlockingQuestionIds([])).toEqual(new Set());
    expect(questionsForBox(5)).toEqual(['establishedCvd']);
    expect(questionsForBox(6)).toEqual(['recentMiAcsOrCabgPciWithin6Weeks']);
    expect(questionsForBox(8)).toEqual(['primaryPreventionStatinIndication']);
    expect(questionsForBox(10)).toEqual(['hivInfection']);
    expect(questionsForBox(12)).toEqual(['borderlineRiskBand', 'borderlineRiskPatientDesiresStatin']);
  });

  it('maps an override question onto every Appendix G decision diamond', () => {
    for (const box of APPENDIX_G_BOXES.filter((b) => b.kind === 'decision')) {
      expect(questionsForBox(box.id).length, `Box ${box.id}`).toBeGreaterThan(0);
    }
  });
});
