// Author: Preston Lee

import type { GuidelineClinicianAnswers } from './guideline.model';

export interface AppendixGBoxMeta {
  id: number;
  title: string;
  kind: 'start' | 'decision' | 'action';
  /** Primary clinician question linked to this decision (when applicable). */
  questionId?: keyof GuidelineClinicianAnswers;
}

/** VA/DoD Lipids CPG 2025 Appendix G (pp. 125–127), Boxes 1–21. */
export const APPENDIX_G_BOXES: readonly AppendixGBoxMeta[] = [
  { id: 1, title: 'Adult patient', kind: 'start' },
  {
    id: 2,
    title: 'Comprehensive lifestyle medicine (Sidebars 1–2; Recs 22–23)',
    kind: 'action',
  },
  {
    id: 3,
    title: 'Is life expectancy limited (<5 years)?',
    kind: 'decision',
    questionId: 'lifeExpectancyLimitedUnder5Years',
  },
  { id: 4, title: 'Discuss uncertain benefit', kind: 'action' },
  {
    id: 5,
    title: 'Existing CVD? (Sidebar 3)',
    kind: 'decision',
    questionId: 'establishedCvd',
  },
  {
    id: 6,
    title: 'Refer for cardiac rehab if MI, ACS, or CABG/PCI in past 6 weeks (Rec 24)',
    kind: 'action',
    questionId: 'recentMiAcsOrCabgPciWithin6Weeks',
  },
  { id: 7, title: 'Very high-risk CVD (Sidebar 4)?', kind: 'decision', questionId: 'veryHighRiskCvd' },
  {
    id: 8,
    title: 'DM, LDL-C ≥190, or 10-year estimated risk ≥10%?',
    kind: 'decision',
    questionId: 'primaryPreventionStatinIndication',
  },
  {
    id: 9,
    title: 'At least a moderate dose statin (Sidebar 5, Rec 7). Consider lipid specialist if LDL-C ≥190',
    kind: 'action',
  },
  { id: 10, title: 'HIV positive?', kind: 'decision', questionId: 'hivInfection' },
  {
    id: 11,
    title: 'Moderate dose statin (Sidebar 5; Recs 8 and 10)',
    kind: 'action',
  },
  {
    id: 12,
    title: 'Estimated risk 5% to <10% AND patient desires treatment?',
    kind: 'decision',
    questionId: 'borderlineRiskPatientDesiresStatin',
  },
  { id: 13, title: 'No medication treatment', kind: 'action' },
  {
    id: 14,
    title: 'Repeat risk assessment every 5 years unless new risk factors (Rec 1)',
    kind: 'action',
  },
  {
    id: 15,
    title: 'Reassess therapy and consider modification if new risk factors or enhancers develop',
    kind: 'action',
  },
  {
    id: 16,
    title: '3 options (Rec 13): high-intensity statin; moderate-intensity statin + ezetimibe; moderate-intensity statin + PCSK9 inhibitor',
    kind: 'action',
  },
  {
    id: 17,
    title: 'Start either (Rec 14): high-intensity or max-tolerated statin + ezetimibe, or + PCSK9 inhibitor',
    kind: 'action',
  },
  {
    id: 18,
    title: 'Escalation needed?',
    kind: 'decision',
    questionId: 'escalationNeeded',
  },
  {
    id: 19,
    title: 'High-intensity or max-tolerated statin + ezetimibe + PCSK9 inhibitor (Rec 14)',
    kind: 'action',
  },
  {
    id: 20,
    title: 'Monitoring (Rec 17): fixed-dose — lipids for adherence/effect; treat-to-target — LDL-C <70 mg/dL',
    kind: 'action',
  },
  {
    id: 21,
    title: 'Re-emphasize lifestyle — diet, exercise, smoking, sleep, connections, stress, weight (Sidebars 1–2; Recs 22–23)',
    kind: 'action',
  },
];

const BY_ID = new Map(APPENDIX_G_BOXES.map((b) => [b.id, b]));

/** Path-blocking clinician questions keyed by unresolved Appendix G box. */
export const PATH_BLOCKING_QUESTIONS_BY_BOX: ReadonlyMap<
  number,
  readonly (keyof GuidelineClinicianAnswers)[]
> = new Map([
  [3, ['lifeExpectancyLimitedUnder5Years']],
  [
    7,
    [
      'veryHighRiskCvd',
      'onLipidLoweringTherapy',
      'veryHighRiskRecentAcsOrMiOnTherapy',
      'veryHighRiskRecurrentEventsOnTherapy',
    ],
  ],
  [12, ['borderlineRiskBand', 'borderlineRiskPatientDesiresStatin']],
  [18, ['escalationNeeded']],
]);

const QUESTION_TO_BOX = new Map<keyof GuidelineClinicianAnswers, number>();
for (const box of APPENDIX_G_BOXES) {
  if (box.questionId) {
    QUESTION_TO_BOX.set(box.questionId, box.id);
  }
}
for (const [boxId, questionIds] of PATH_BLOCKING_QUESTIONS_BY_BOX) {
  for (const questionId of questionIds) {
    QUESTION_TO_BOX.set(questionId, boxId);
  }
}

export function boxMeta(id: number): AppendixGBoxMeta {
  const meta = BY_ID.get(id);
  if (!meta) {
    throw new Error(`Unknown Appendix G box id: ${id}`);
  }
  return meta;
}

export function formatBoxLabel(id: number): string {
  return `Box ${id}`;
}

export function diagramBoxForQuestion(questionId: keyof GuidelineClinicianAnswers): number | null {
  return QUESTION_TO_BOX.get(questionId) ?? null;
}

/** True when the answer can change Appendix G node state, path, or decision subtitles. */
export function questionAffectsDiagram(questionId: keyof GuidelineClinicianAnswers): boolean {
  const boxId = diagramBoxForQuestion(questionId);
  if (boxId == null) {
    return false;
  }
  return boxMeta(boxId).kind === 'decision';
}

export function questionsForBox(boxId: number): readonly (keyof GuidelineClinicianAnswers)[] {
  const mapped = PATH_BLOCKING_QUESTIONS_BY_BOX.get(boxId);
  if (mapped) {
    return mapped;
  }
  const questionId = BY_ID.get(boxId)?.questionId;
  return questionId ? [questionId] : [];
}

export function pathBlockingQuestionIds(
  unresolvedBoxes: readonly number[],
): Set<keyof GuidelineClinicianAnswers> {
  const ids = new Set<keyof GuidelineClinicianAnswers>();
  for (const boxId of unresolvedBoxes) {
    for (const questionId of PATH_BLOCKING_QUESTIONS_BY_BOX.get(boxId) ?? []) {
      ids.add(questionId);
    }
  }
  return ids;
}

export function formatRelatedBoxLabels(ids: readonly number[]): string {
  return ids.map(formatBoxLabel).join(', ');
}
