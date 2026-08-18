// Author: Preston Lee

import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { pathwayCopy, recommendationTier, EMPTY_CLINICIAN_ANSWERS } from './guideline.model';
import { GUIDELINE_RECOMMENDATIONS } from './guideline-recommendations';
import { GuidelineEvaluationService } from '../../services/guideline-evaluation.service';
import { CqlEvaluateService } from '../../services/cql-evaluate.service';
import type { RiskCalculatorSession } from '../../services/risk-calculator-session.service';

/**
 * Decision-table coverage for Appendix G / Rec strengths that must not regress.
 * CQL remains the runtime source of truth; these tests lock TS mapping + clinical contracts.
 */
describe('Guideline clinical contracts', () => {
  it('maps neither-for-nor-against recommendations only to informational tier', () => {
    for (const rec of GUIDELINE_RECOMMENDATIONS) {
      if (rec.strength === 'Neither for nor against') {
        expect(recommendationTier('Informational')).toBe('informational');
        expect(rec.strength).not.toMatch(/Strong for|Weak for/);
      }
    }
  });

  it('preserves Box 14 / Rec 2, Box 15 / Rec 15, Box 20 / Rec 17, Box 6 / Rec 24 distinctions', () => {
    expect(GUIDELINE_RECOMMENDATIONS.find((r) => r.id === 2)?.displayNote).toMatch(/Box 14/);
    expect(GUIDELINE_RECOMMENDATIONS.find((r) => r.id === 15)?.displayNote).toMatch(/Box 15/);
    expect(GUIDELINE_RECOMMENDATIONS.find((r) => r.id === 17)?.relatedBoxIds).toContain(20);
    expect(GUIDELINE_RECOMMENDATIONS.find((r) => r.id === 24)?.displayNote).toMatch(/Box 6/);
    expect(GUIDELINE_RECOMMENDATIONS.find((r) => r.id === 22)?.strength).toBe('Weak for');
    expect(GUIDELINE_RECOMMENDATIONS.find((r) => r.id === 23)?.strength).toBe('Weak for');
    expect(GUIDELINE_RECOMMENDATIONS.find((r) => r.id === 23)?.text).not.toMatch(/150 minutes/);
  });

  it('documents primary algorithm path titles for every complete branch', () => {
    const paths = [
      'Box1_NotAdultOutsideAlgorithm',
      'OutsideGuidelinePopulation',
      'Box4_DiscussUncertainBenefitLimitedLifeExpectancy',
      'Box9_PrimaryAtLeastModerateStatinConsiderLipidSpecialistIfLdlGe190',
      'Box11_PrimaryModerateStatinHiv',
      'Box11_PrimaryModerateStatinBorderlineRiskPatientPreference',
      'Box13_14_NoMedicationRepeatRiskEvery5YearsUnlessNewRiskFactors',
      'Box16_SecondaryStandardRiskThreeOptions',
      'Box17_SecondaryVeryHighRiskInitialCombination',
      'Box19_SecondaryVeryHighRiskTripleTherapy',
      'NeedsClinicalInput_LifeExpectancy',
      'NeedsClinicalInput_VeryHighRisk',
      'NeedsClinicalInput_Escalation',
      'NeedsClinicalInput_BorderlineDesire',
    ];
    for (const path of paths) {
      const copy = pathwayCopy(path);
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.summary.length).toBeGreaterThan(0);
    }
  });

  it('replay overrides prefer session risk, LDL, and diabetes', () => {
    TestBed.configureTestingModule({
      providers: [
        GuidelineEvaluationService,
        { provide: CqlEvaluateService, useValue: { evaluateLibrary: () => ({}) } },
      ],
    });
    const service = TestBed.inject(GuidelineEvaluationService);
    const session: RiskCalculatorSession = {
      patientId: 'p1',
      calculatedAt: '2026-07-16T00:00:00.000Z',
      calculatedWithExclusions: false,
      selectedPreventModel: 'base',
      rawResults: {},
      libraryParameters: { OverrideAgeYears: { integer: 60 } },
      display: {
        risk10yTotal: '11%',
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
      effectiveDiabetes: true,
      effectiveLdlMgDl: 195,
      tenYearTotalCvdPercent: 11.2,
    };
    const params = service.buildLibraryParameters(session, EMPTY_CLINICIAN_ANSWERS);
    expect(params['OverrideTenYearTotalCvdPercent']).toEqual({ decimal: 11.2 });
    expect(params['OverrideLdlMgDl']).toEqual({ decimal: 195 });
    expect(params['OverrideHasDiabetes']).toBe(true);
    expect(params['OverrideAgeYears']).toEqual({ integer: 60 });
    expect(params['LifeExpectancyLimitedUnder5Years']).toBeUndefined();
    expect(params['EstablishedCvd']).toBeUndefined();
    expect(params['PrimaryPreventionStatinIndication']).toBeUndefined();
    expect(params['BorderlineRiskBand']).toBeUndefined();
    expect(params['VeryHighRisk']).toBeUndefined();
  });

  it('marks unresolved Mermaid boxes for each NeedsClinicalInput path', () => {
    TestBed.configureTestingModule({
      providers: [
        GuidelineEvaluationService,
        { provide: CqlEvaluateService, useValue: { evaluateLibrary: () => ({}) } },
      ],
    });
    const service = TestBed.inject(GuidelineEvaluationService);
    expect(service.unresolvedBoxesForPath('NeedsClinicalInput_LifeExpectancy')).toEqual([3]);
    expect(service.unresolvedBoxesForPath('NeedsClinicalInput_VeryHighRisk')).toEqual([7]);
    expect(service.unresolvedBoxesForPath('NeedsClinicalInput_Escalation')).toEqual([18]);
    expect(service.unresolvedBoxesForPath('NeedsClinicalInput_BorderlineDesire')).toEqual([12]);
    expect(service.unresolvedBoxesForPath('Box16_SecondaryStandardRiskThreeOptions')).toEqual([]);
  });
});
