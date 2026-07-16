// Author: Preston Lee

import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { CqlEvaluateService } from './cql-evaluate.service';
import {
  GuidelineEvaluationService,
  LIPID_MANAGEMENT_EXPRESSIONS,
} from './guideline-evaluation.service';
import type { RiskCalculatorSession } from './risk-calculator-session.service';
import { EMPTY_CLINICIAN_ANSWERS } from '../features/guideline/guideline.model';

function sessionFixture(): RiskCalculatorSession {
  return {
    patientId: 'pt-1',
    calculatedAt: '2026-07-16T12:00:00.000Z',
    calculatedWithExclusions: false,
    selectedPreventModel: 'base',
    rawResults: { TenYearTotalCvdPercent: 12.5 },
    libraryParameters: {
      OverrideAgeYears: { integer: 55 },
      OverrideDiabetes: false,
    },
    display: {
      risk10yTotal: '12.5%',
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
    effectiveLdlMgDl: 100,
    tenYearTotalCvdPercent: 12.5,
  };
}

function rawCompletePath(): Record<string, unknown> {
  const raw: Record<string, unknown> = {
    AlgorithmStatus: 'Complete',
    AlgorithmPath: 'Box9_PrimaryAtLeastModerateStatinConsiderLipidSpecialistIfLdlGe190',
    GuidelinePopulationStatus: 'InPopulation',
    EffectiveAgeYears: 62,
    OpenCVDRiskTenYearTotalCvdPercent: 12.5,
    LatestLdlMgDl: 100,
    EffectiveDiabetes: false,
    HasEstablishedCvd: false,
    HasHivInfection: false,
    EffectiveOnLipidLoweringTherapy: true,
    VeryHighRiskCvd: false,
    Box8UsedNullPreventRisk: false,
    ShouldDiscussCardiacRehabReferral: false,
    ShowComprehensiveLifestyleReminder: true,
    ShowReemphasizeLifestyleReminder: true,
    ShowBox15ReassessReminder: true,
    ShowBox20MonitoringReminder: false,
    SelectedPreventModel: 'base',
  };
  for (let i = 1; i <= 21; i++) {
    raw[`ActiveBox${i}`] = [1, 2, 3, 5, 8, 9, 15, 21].includes(i);
  }
  for (let i = 1; i <= 24; i++) {
    const key = `Rec${String(i).padStart(2, '0')}Status`;
    if (i === 1 || i === 7 || i === 22 || i === 23) {
      raw[key] = 'Applicable';
    } else if (i === 2 || i === 6 || i === 9 || i === 17 || i === 20) {
      raw[key] = 'Informational';
    } else {
      raw[key] = 'NotApplicable';
    }
  }
  return raw;
}

describe('GuidelineEvaluationService', () => {
  it('builds session overrides and only yes/no clinician params', () => {
    const evaluateLibrary = vi.fn(() => of(rawCompletePath()));
    TestBed.configureTestingModule({
      providers: [
        GuidelineEvaluationService,
        { provide: CqlEvaluateService, useValue: { evaluateLibrary } },
      ],
    });
    const service = TestBed.inject(GuidelineEvaluationService);
    const params = service.buildLibraryParameters(sessionFixture(), {
      ...EMPTY_CLINICIAN_ANSWERS,
      lifeExpectancyLimitedUnder5Years: 'no',
      borderlineRiskPatientDesiresStatin: 'unknown',
    });
    expect(params['OverrideTenYearTotalCvdPercent']).toEqual({ decimal: 12.5 });
    expect(params['OverrideLdlMgDl']).toEqual({ decimal: 100 });
    expect(params['OverrideHasDiabetes']).toBe(false);
    expect(params['LifeExpectancyLimitedUnder5Years']).toBe(false);
    expect(params['BorderlineRiskPatientDesiresStatin']).toBeUndefined();
  });

  it('maps flat CQL results into recommendation catalog metadata', () => {
    const evaluateLibrary = vi.fn(() => of(rawCompletePath()));
    TestBed.configureTestingModule({
      providers: [
        GuidelineEvaluationService,
        { provide: CqlEvaluateService, useValue: { evaluateLibrary } },
      ],
    });
    const service = TestBed.inject(GuidelineEvaluationService);
    let view: ReturnType<GuidelineEvaluationService['mapResults']> | undefined;
    service.evaluate(sessionFixture(), EMPTY_CLINICIAN_ANSWERS).subscribe((v) => {
      view = v;
    });
    expect(evaluateLibrary).toHaveBeenCalledWith(
      'LipidManagement',
      [...LIPID_MANAGEMENT_EXPRESSIONS],
      expect.any(Object),
    );
    expect(view?.algorithmStatus).toBe('Complete');
    expect(view?.effectiveAgeYears).toBe(62);
    expect(view?.recommendations).toHaveLength(24);
    expect(view?.recommendations.find((r) => r.id === 7)?.strength).toBe('Strong for');
    expect(view?.recommendations.find((r) => r.id === 7)?.tier).toBe('applies-now');
    expect(view?.recommendations.find((r) => r.id === 2)?.tier).toBe('informational');
    expect(view?.activeBoxes).toContain(9);
    expect(view?.effectiveOnLipidLoweringTherapy).toBe(true);
    expect(view?.veryHighRiskCvd).toBe(false);
  });

  it('throws when AlgorithmStatus is malformed', () => {
    TestBed.configureTestingModule({
      providers: [
        GuidelineEvaluationService,
        { provide: CqlEvaluateService, useValue: { evaluateLibrary: vi.fn() } },
      ],
    });
    const service = TestBed.inject(GuidelineEvaluationService);
    expect(() =>
      service.mapResults({ ...rawCompletePath(), AlgorithmStatus: 'Nope' }, sessionFixture()),
    ).toThrow(/AlgorithmStatus/);
  });
});
