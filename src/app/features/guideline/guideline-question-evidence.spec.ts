// Author: Preston Lee

import { describe, expect, it } from 'vitest';
import { formatQuestionEvidence } from './guideline-question-evidence';
import { EMPTY_CHART_EVIDENCE, type GuidelineEvaluationView } from './guideline.model';
import { GUIDELINE_RECOMMENDATIONS } from './guideline-recommendations';
import type { RiskCalculatorSession } from '../../services/risk-calculator-session.service';

function session(overrides: Partial<RiskCalculatorSession> = {}): RiskCalculatorSession {
  return {
    patientId: 'pt-1',
    calculatedAt: '2026-07-16T12:00:00.000Z',
    calculatedWithExclusions: false,
    selectedPreventModel: 'base',
    rawResults: {},
    libraryParameters: {},
    display: {
      risk10yTotal: '8.0%',
      risk10yAscvd: '—',
      risk10yHf: '—',
      risk10yChd: '—',
      risk10yStroke: '—',
      openCvdRiskAge: '—',
      risk30yTotal: '—',
      risk30yAscvd: '—',
      risk30yHf: '—',
      risk30yChd: '—',
      risk30yStroke: '—',
      risk30yCvdPercentile: '—',
    },
    preventLifeExpectancyLimited: false,
    effectiveDiabetes: false,
    effectiveLdlMgDl: 110,
    tenYearTotalCvdPercent: 8,
    ...overrides,
  };
}

function view(overrides: Partial<GuidelineEvaluationView> = {}): GuidelineEvaluationView {
  return {
    algorithmStatus: 'Complete',
    algorithmPath: 'Box13_14_NoMedicationRepeatRiskEvery5YearsUnlessNewRiskFactors',
    pathwayTitle: 'Primary',
    pathwaySummary: 'summary',
    guidelinePopulationStatus: 'InPopulation',
    effectiveAgeYears: 62,
    tenYearTotalCvdPercent: 8,
    latestLdlMgDl: 110,
    effectiveDiabetes: false,
    hasEstablishedCvd: false,
    hasHivInfection: false,
    primaryPreventionStatinIndicationBox8: false,
    primaryPreventionBorderlineRiskBand: true,
    effectiveOnLipidLoweringTherapy: false,
    veryHighRiskCvd: false,
    box8UsedNullPreventRisk: false,
    shouldDiscussCardiacRehabReferral: false,
    showComprehensiveLifestyleReminder: true,
    showReemphasizeLifestyleReminder: false,
    showBox15ReassessReminder: false,
    showBox20MonitoringReminder: false,
    activeBoxes: [1, 2, 3, 5, 8, 12, 13],
    unresolvedBoxes: [],
    recommendations: GUIDELINE_RECOMMENDATIONS.map((meta) => ({
      ...meta,
      status: 'NotApplicable',
      tier: 'does-not-apply',
    })),
    supportingFactors: [],
    chartEvidence: EMPTY_CHART_EVIDENCE,
    ...overrides,
  };
}

describe('formatQuestionEvidence', () => {
  it('uses PREVENT calculator date for Box 3 when life expectancy is prefilled', () => {
    expect(
      formatQuestionEvidence(
        'lifeExpectancyLimitedUnder5Years',
        view(),
        session({ preventLifeExpectancyLimited: true }),
      ),
    ).toBe('PREVENT <1 y (2026-07-16)');
    expect(formatQuestionEvidence('lifeExpectancyLimitedUnder5Years', view(), session())).toBeNull();
  });

  it('uses CQL chart findings and dates when present', () => {
    const charted = view({
      hasEstablishedCvd: true,
      hasHivInfection: true,
      effectiveDiabetes: true,
      veryHighRiskCvd: true,
      latestLdlMgDl: 92,
      chartEvidence: {
        ...EMPTY_CHART_EVIDENCE,
        establishedCvd: 'ASCVD (2023-04-12)',
        hivInfection: 'Active HIV (2021-08-01)',
        latestLdlDate: '2024-01-03',
        diabetes: 'DM (2019-02-11)',
        lipidLoweringTherapy: 'Statin Rx (2025-11-02)',
        chartIndexEvent: 'MI/ACS/CABG/PCI (2025-06-15)',
        triglycerides: 'TG 180 mg/dL (2024-09-20)',
        astAlt: 'AST 42 (2024-09-20)',
      },
    });
    expect(formatQuestionEvidence('establishedCvd', charted, session())).toBe(
      'ASCVD (2023-04-12)',
    );
    expect(formatQuestionEvidence('hivInfection', charted, session())).toBe(
      'Active HIV (2021-08-01)',
    );
    expect(formatQuestionEvidence('primaryPreventionStatinIndication', charted, session())).toBe(
      'DM (2019-02-11) · LDL-C 92 mg/dL (2024-01-03) · 10y 8.0% (2026-07-16)',
    );
    expect(formatQuestionEvidence('onLipidLoweringTherapy', charted, session())).toBe(
      'Statin Rx (2025-11-02)',
    );
    expect(formatQuestionEvidence('veryHighRiskCvd', charted, session())).toBe(
      'Statin Rx (2025-11-02) · LDL-C 92 mg/dL (2024-01-03) · MI/ACS/CABG/PCI (2025-06-15)',
    );
    expect(formatQuestionEvidence('persistentlyElevatedFastingTriglycerides', charted, session())).toBe(
      'TG 180 mg/dL (2024-09-20)',
    );
  });

  it('omits blurbs for judgment-only questions and unseeded very-high-risk', () => {
    expect(formatQuestionEvidence('escalationNeeded', view(), session())).toBeNull();
    expect(formatQuestionEvidence('borderlineRiskPatientDesiresStatin', view(), session())).toBeNull();
    expect(formatQuestionEvidence('veryHighRiskCvd', view(), session())).toBeNull();
    expect(formatQuestionEvidence('onLipidLoweringTherapy', view(), session())).toBeNull();
  });
});
