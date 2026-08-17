// Author: Preston Lee

import { describe, expect, it } from 'vitest';
import {
  APPENDIX_G_BOXES,
  boxMeta,
  diagramBoxForQuestion,
  formatBoxLabel,
  formatRelatedBoxLabels,
  pathBlockingQuestionIds,
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
    expect(diagramBoxForQuestion('borderlineRiskPatientDesiresStatin')).toBe(12);
    expect(diagramBoxForQuestion('escalationNeeded')).toBe(18);
    expect(diagramBoxForQuestion('onLipidLoweringTherapy')).toBe(7);
    expect(diagramBoxForQuestion('veryHighRiskRecentAcsOrMiOnTherapy')).toBe(7);
    expect(diagramBoxForQuestion('veryHighRiskRecurrentEventsOnTherapy')).toBe(7);
    expect(diagramBoxForQuestion('clinicalRiskLow')).toBeNull();
  });

  it('formats box labels', () => {
    expect(formatBoxLabel(8)).toBe('Box 8');
    expect(formatRelatedBoxLabels([8, 9])).toBe('Box 8, Box 9');
    expect(boxMeta(1).kind).toBe('start');
    expect(boxMeta(1).title).toBe('Adult patient');
    expect(boxMeta(5).kind).toBe('decision');
    expect(boxMeta(9).kind).toBe('action');
  });

  it('maps path-blocking questions for unresolved boxes including Box 7', () => {
    expect(questionsForBox(7)).toEqual([
      'onLipidLoweringTherapy',
      'veryHighRiskRecentAcsOrMiOnTherapy',
      'veryHighRiskRecurrentEventsOnTherapy',
    ]);
    expect([...pathBlockingQuestionIds([7])]).toEqual([
      'onLipidLoweringTherapy',
      'veryHighRiskRecentAcsOrMiOnTherapy',
      'veryHighRiskRecurrentEventsOnTherapy',
    ]);
    expect(pathBlockingQuestionIds([])).toEqual(new Set());
    expect(questionsForBox(6)).toEqual(['recentMiAcsOrCabgPciWithin6Weeks']);
  });
});
