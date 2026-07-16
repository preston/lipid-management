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
  { id: 2, title: 'Comprehensive lifestyle medicine', kind: 'action' },
  {
    id: 3,
    title: 'Life expectancy <5 years?',
    kind: 'decision',
    questionId: 'lifeExpectancyLimitedUnder5Years',
  },
  { id: 4, title: 'Discuss uncertain benefit', kind: 'action' },
  { id: 5, title: 'Clinical ASCVD?', kind: 'decision' },
  {
    id: 6,
    title: 'Cardiac rehab if MI/ACS/CABG/PCI ≤6 weeks',
    kind: 'action',
    questionId: 'recentMiAcsOrCabgPciWithin6Weeks',
  },
  { id: 7, title: 'Very high risk (Sidebar 4 + on LLT)?', kind: 'decision' },
  { id: 8, title: 'DM, LDL ≥190, or 10y risk ≥10%?', kind: 'decision' },
  {
    id: 9,
    title: '≥ Moderate-intensity statin (consider lipid specialist if LDL ≥190)',
    kind: 'action',
  },
  { id: 10, title: 'HIV?', kind: 'decision' },
  { id: 11, title: 'Moderate-intensity statin', kind: 'action' },
  {
    id: 12,
    title: '5%–<10% and patient desires statin?',
    kind: 'decision',
    questionId: 'borderlineRiskPatientDesiresStatin',
  },
  { id: 13, title: 'No medication treatment', kind: 'action' },
  { id: 14, title: 'Repeat risk ~ every 5 years unless new risk factors', kind: 'action' },
  { id: 15, title: 'Reassess if new risk factors / enhancers', kind: 'action' },
  { id: 16, title: 'Three unranked secondary options', kind: 'action' },
  { id: 17, title: 'VHR dual therapy options', kind: 'action' },
  {
    id: 18,
    title: 'Escalation needed?',
    kind: 'decision',
    questionId: 'escalationNeeded',
  },
  { id: 19, title: 'Triple therapy', kind: 'action' },
  {
    id: 20,
    title: 'Fixed-dose and treat-to-target (neither preferred)',
    kind: 'action',
  },
  { id: 21, title: 'Re-emphasize lifestyle', kind: 'action' },
];

const BY_ID = new Map(APPENDIX_G_BOXES.map((b) => [b.id, b]));

const QUESTION_TO_BOX = new Map<keyof GuidelineClinicianAnswers, number>();
for (const box of APPENDIX_G_BOXES) {
  if (box.questionId) {
    QUESTION_TO_BOX.set(box.questionId, box.id);
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

export function diagramBoxForQuestion(
  questionId: keyof GuidelineClinicianAnswers,
): number | null {
  return QUESTION_TO_BOX.get(questionId) ?? null;
}

export function formatRelatedBoxLabels(ids: readonly number[]): string {
  return ids.map(formatBoxLabel).join(', ');
}
