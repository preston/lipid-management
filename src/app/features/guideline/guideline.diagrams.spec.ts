// Author: Preston Lee

import { describe, expect, it } from 'vitest';
import {
  buildGuidelineDiagramModel,
  filterDiagramModelToPath,
  toMermaidDefinition,
} from './guideline.diagrams';
import { EMPTY_CLINICIAN_ANSWERS, type GuidelineEvaluationView } from './guideline.model';
import { GUIDELINE_RECOMMENDATIONS } from './guideline-recommendations';

function baseView(overrides: Partial<GuidelineEvaluationView> = {}): GuidelineEvaluationView {
  return {
    algorithmStatus: 'Complete',
    algorithmPath: 'Box9_PrimaryAtLeastModerateStatinConsiderLipidSpecialistIfLdlGe190',
    pathwayTitle: 'Primary',
    pathwaySummary: 'summary',
    guidelinePopulationStatus: 'InScope',
    effectiveAgeYears: 62,
    tenYearTotalCvdPercent: 12,
    latestLdlMgDl: 200,
    effectiveDiabetes: true,
    hasEstablishedCvd: false,
    hasHivInfection: false,
    effectiveOnLipidLoweringTherapy: false,
    veryHighRiskCvd: false,
    box8UsedNullPreventRisk: false,
    shouldDiscussCardiacRehabReferral: false,
    showComprehensiveLifestyleReminder: true,
    showReemphasizeLifestyleReminder: true,
    showBox15ReassessReminder: true,
    showBox20MonitoringReminder: false,
    activeBoxes: [1, 2, 3, 5, 8, 9, 15, 21],
    unresolvedBoxes: [],
    recommendations: GUIDELINE_RECOMMENDATIONS.map((meta) => ({
      ...meta,
      status: 'NotApplicable' as const,
      tier: 'does-not-apply' as const,
    })),
    supportingFactors: [],
    ...overrides,
  };
}

describe('guideline diagram model', () => {
  it('annotates Box 8 from evaluation fields and marks taken Yes edge', () => {
    const model = buildGuidelineDiagramModel(baseView(), EMPTY_CLINICIAN_ANSWERS);
    const box8 = model.nodes.find((n) => n.id === 8);
    expect(box8?.state).toBe('active');
    expect(box8?.subtitle).toContain('DM');
    expect(box8?.subtitle).toContain('200 mg/dL');
    expect(box8?.subtitle).toContain('12.0%');

    const yesEdge = model.edges.find((e) => e.from === 8 && e.to === 9);
    expect(yesEdge?.emphasisLabel).toMatch(/Yes/);
    expect(yesEdge?.emphasisLabel).toMatch(/DM|LDL/);
    expect(yesEdge?.taken).toBe(true);

    const noEdge = model.edges.find((e) => e.from === 8 && e.to === 10);
    expect(noEdge?.emphasisLabel).toBeNull();
    expect(noEdge?.taken).toBe(false);
  });

  it('shows unresolved Box 12 desire without taken Yes/No emphasis', () => {
    const model = buildGuidelineDiagramModel(
      baseView({
        algorithmStatus: 'NeedsClinicalInput',
        algorithmPath: 'NeedsClinicalInput_BorderlineDesire',
        tenYearTotalCvdPercent: 7,
        latestLdlMgDl: 110,
        effectiveDiabetes: false,
        activeBoxes: [1, 2, 3, 5, 8, 10, 12],
        unresolvedBoxes: [12],
      }),
      { ...EMPTY_CLINICIAN_ANSWERS, lifeExpectancyLimitedUnder5Years: 'no' },
    );
    const box12 = model.nodes.find((n) => n.id === 12);
    expect(box12?.state).toBe('unresolved');
    expect(box12?.subtitle).toMatch(/desire Unknown/i);

    const yesEdge = model.edges.find((e) => e.from === 12 && e.to === 11);
    const noEdge = model.edges.find((e) => e.from === 12 && e.to === 13);
    expect(yesEdge?.emphasisLabel).toBeNull();
    expect(noEdge?.emphasisLabel).toBeNull();
  });

  it('shows outside population with limited active boxes', () => {
    const model = buildGuidelineDiagramModel(
      baseView({
        algorithmStatus: 'OutsidePopulation',
        algorithmPath: 'OutsideGuidelinePopulation',
        guidelinePopulationStatus: 'OutsidePopulation',
        activeBoxes: [1, 2],
        unresolvedBoxes: [],
        showComprehensiveLifestyleReminder: true,
        showReemphasizeLifestyleReminder: false,
      }),
      EMPTY_CLINICIAN_ANSWERS,
    );
    expect(model.nodes.find((n) => n.id === 1)?.state).toBe('active');
    expect(model.nodes.find((n) => n.id === 3)?.state).toBe('idle');
    expect(model.nodes.find((n) => n.id === 9)?.state).toBe('idle');
  });

  it('marks secondary standard-risk path via active box membership', () => {
    const model = buildGuidelineDiagramModel(
      baseView({
        algorithmPath: 'Box16_SecondaryStandardRiskThreeOptions',
        hasEstablishedCvd: true,
        activeBoxes: [1, 2, 3, 5, 6, 7, 16, 20, 21],
        unresolvedBoxes: [],
        showBox20MonitoringReminder: true,
      }),
      {
        ...EMPTY_CLINICIAN_ANSWERS,
        lifeExpectancyLimitedUnder5Years: 'no',
        onLipidLoweringTherapy: 'yes',
        veryHighRiskRecentAcsOrMiOnTherapy: 'no',
        veryHighRiskRecurrentEventsOnTherapy: 'no',
      },
    );
    expect(model.nodes.find((n) => n.id === 16)?.state).toBe('active');
    expect(model.nodes.find((n) => n.id === 17)?.state).toBe('idle');
    const box7No = model.edges.find((e) => e.from === 7 && e.to === 16);
    expect(box7No?.emphasisLabel).toBe('No');
  });

  it('annotates Box 7 from CQL effective therapy and VHR outputs', () => {
    const model = buildGuidelineDiagramModel(
      baseView({
        hasEstablishedCvd: true,
        effectiveOnLipidLoweringTherapy: true,
        veryHighRiskCvd: true,
        latestLdlMgDl: 84,
        activeBoxes: [1, 2, 3, 5, 6, 7, 17, 18, 20, 21],
      }),
      {
        ...EMPTY_CLINICIAN_ANSWERS,
        lifeExpectancyLimitedUnder5Years: 'no',
        veryHighRiskRecentAcsOrMiOnTherapy: 'yes',
      },
    );
    expect(model.nodes.find((n) => n.id === 7)?.subtitle).toBe(
      'VHR Yes; LLT Yes; recent ACS/MI; LDL 84',
    );
  });

  it('emphasizes Box 10 No on borderline desire Yes despite Box 11 also being active', () => {
    const model = buildGuidelineDiagramModel(
      baseView({
        algorithmPath: 'Box11_PrimaryModerateStatinBorderlineRiskPatientPreference',
        tenYearTotalCvdPercent: 7,
        latestLdlMgDl: 110,
        effectiveDiabetes: false,
        activeBoxes: [1, 2, 3, 5, 8, 10, 12, 11, 15, 21],
        unresolvedBoxes: [],
      }),
      {
        ...EMPTY_CLINICIAN_ANSWERS,
        lifeExpectancyLimitedUnder5Years: 'no',
        borderlineRiskPatientDesiresStatin: 'yes',
      },
    );
    expect(model.edges.find((e) => e.from === 10 && e.to === 12)?.emphasisLabel).toBe('No');
    expect(model.edges.find((e) => e.from === 10 && e.to === 11)?.emphasisLabel).toBeNull();
    expect(model.edges.find((e) => e.from === 12 && e.to === 11)?.emphasisLabel).toBe('Yes');
  });

  it('emphasizes Box 18 Yes on triple therapy despite Box 20 also being active', () => {
    const model = buildGuidelineDiagramModel(
      baseView({
        algorithmPath: 'Box19_SecondaryVeryHighRiskTripleTherapy',
        hasEstablishedCvd: true,
        veryHighRiskCvd: true,
        effectiveOnLipidLoweringTherapy: true,
        activeBoxes: [1, 2, 3, 5, 6, 7, 17, 18, 19, 20, 21],
        unresolvedBoxes: [],
        showBox20MonitoringReminder: true,
      }),
      {
        ...EMPTY_CLINICIAN_ANSWERS,
        lifeExpectancyLimitedUnder5Years: 'no',
        escalationNeeded: 'yes',
      },
    );
    expect(model.edges.find((e) => e.from === 18 && e.to === 19)?.emphasisLabel).toBe('Yes');
    expect(model.edges.find((e) => e.from === 18 && e.to === 20)?.emphasisLabel).toBeNull();
  });

  it('serializes all boxes and class assignments to Mermaid', () => {
    const model = buildGuidelineDiagramModel(
      baseView({
        activeBoxes: [1, 2, 3, 5, 8, 9],
        unresolvedBoxes: [12],
      }),
      EMPTY_CLINICIAN_ANSWERS,
    );
    const def = toMermaidDefinition(model);
    expect(def).toContain('B1(["Box 1\\nAdult patient\\nAge 62; adult"])');
    expect(def).toContain('B3{{"Box 3\\nLife expectancy <5 years?');
    expect(def).not.toContain('Outside adult algorithm');
    expect(def).toContain('B21');
    expect(def).toContain('class B9 active');
    expect(def).toContain('class B12 unresolved');
    expect(def).toContain('class B16 idle');
    expect(def).toContain('linkStyle');
  });

  it('filters to the patient path and styles unlabeled taken edges', () => {
    const model = buildGuidelineDiagramModel(baseView(), EMPTY_CLINICIAN_ANSWERS);
    const first = model.edges.find((e) => e.from === 1 && e.to === 2);
    expect(first?.taken).toBe(true);
    expect(first?.emphasisLabel).toBeNull();

    const path = filterDiagramModelToPath(model, new Set([1, 2, 3, 5, 8, 9, 15, 21]));
    expect(path.nodes.map((n) => n.id)).toEqual([1, 2, 3, 5, 8, 9, 15, 21]);
    expect(path.edges.every((e) => [1, 2, 3, 5, 8, 9, 15, 21].includes(e.from))).toBe(true);
    expect(path.nodes.some((n) => n.id === 16)).toBe(false);

    const fullDef = toMermaidDefinition(model);
    expect(fullDef).toContain('stroke:#2196f3');
    expect(fullDef).toContain('stroke:#adb5bd');

    const def = toMermaidDefinition(path);
    expect(def).toContain('B9');
    expect(def).not.toContain('B16');
    expect(def).toContain('stroke:#2196f3');
    expect(def).not.toContain('stroke:#adb5bd');
  });
});
