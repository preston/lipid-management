// Author: Preston Lee

import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  CqlEvaluateService,
  type CqlLibraryParameterValue,
} from './cql-evaluate.service';
import type { RiskCalculatorSession } from './risk-calculator-session.service';
import { GUIDELINE_RECOMMENDATIONS } from '../features/guideline/guideline-recommendations';
import {
  type AlgorithmStatus,
  type GuidelineClinicianAnswers,
  type GuidelineEvaluationView,
  type RecommendationStatus,
  pathwayCopy,
  recommendationTier,
  triStateToBooleanOrOmit,
} from '../features/guideline/guideline.model';

export const LIPID_MANAGEMENT_EXPRESSIONS = [
  'AlgorithmStatus',
  'AlgorithmPath',
  'GuidelinePopulationStatus',
  'EffectiveAgeYears',
  'OpenCVDRiskTenYearTotalCvdPercent',
  'LatestLdlMgDl',
  'EffectiveDiabetes',
  'HasEstablishedCvd',
  'HasHivInfection',
  'EffectiveOnLipidLoweringTherapy',
  'VeryHighRiskCvd',
  'Box8UsedNullPreventRisk',
  'ShouldDiscussCardiacRehabReferral',
  'ShowComprehensiveLifestyleReminder',
  'ShowReemphasizeLifestyleReminder',
  'ShowBox15ReassessReminder',
  'ShowBox20MonitoringReminder',
  'SelectedPreventModel',
  'ExclusionHfrefLvefLe35',
  'ExclusionHfrefCondition',
  'ExclusionEskd',
  'ExclusionInheritedDyslipidemia',
  'ExclusionTriglyceridesGt500',
  'ExclusionLifeExpectancyUnder5Years',
  'ActiveBox1',
  'ActiveBox2',
  'ActiveBox3',
  'ActiveBox4',
  'ActiveBox5',
  'ActiveBox6',
  'ActiveBox7',
  'ActiveBox8',
  'ActiveBox9',
  'ActiveBox10',
  'ActiveBox11',
  'ActiveBox12',
  'ActiveBox13',
  'ActiveBox14',
  'ActiveBox15',
  'ActiveBox16',
  'ActiveBox17',
  'ActiveBox18',
  'ActiveBox19',
  'ActiveBox20',
  'ActiveBox21',
  'Rec01Status',
  'Rec02Status',
  'Rec03Status',
  'Rec04Status',
  'Rec05Status',
  'Rec06Status',
  'Rec07Status',
  'Rec08Status',
  'Rec09Status',
  'Rec10Status',
  'Rec11Status',
  'Rec12Status',
  'Rec13Status',
  'Rec14Status',
  'Rec15Status',
  'Rec16Status',
  'Rec17Status',
  'Rec18Status',
  'Rec19Status',
  'Rec20Status',
  'Rec21Status',
  'Rec22Status',
  'Rec23Status',
  'Rec24Status',
] as const;

const ALGORITHM_STATUSES = new Set<AlgorithmStatus>([
  'Complete',
  'NeedsClinicalInput',
  'OutsidePopulation',
  'NotAdult',
]);

const REC_STATUSES = new Set<RecommendationStatus>([
  'Applicable',
  'NotApplicable',
  'NeedsClinicalInput',
  'Informational',
  'InsufficientData',
]);

@Injectable({
  providedIn: 'root',
})
export class GuidelineEvaluationService {
  private readonly cql = inject(CqlEvaluateService);

  evaluate(
    session: RiskCalculatorSession,
    answers: GuidelineClinicianAnswers,
  ): Observable<GuidelineEvaluationView> {
    const libraryParameters = this.buildLibraryParameters(session, answers);
    return this.cql
      .evaluateLibrary('LipidManagement', [...LIPID_MANAGEMENT_EXPRESSIONS], libraryParameters)
      .pipe(map((raw) => this.mapResults(raw, session)));
  }

  buildLibraryParameters(
    session: RiskCalculatorSession,
    answers: GuidelineClinicianAnswers,
  ): Record<string, CqlLibraryParameterValue> {
    const params: Record<string, CqlLibraryParameterValue> = {
      ...session.libraryParameters,
    };

    if (session.tenYearTotalCvdPercent != null) {
      params['OverrideTenYearTotalCvdPercent'] = { decimal: session.tenYearTotalCvdPercent };
    }
    if (session.effectiveLdlMgDl != null) {
      params['OverrideLdlMgDl'] = { decimal: session.effectiveLdlMgDl };
    }
    if (session.effectiveDiabetes != null) {
      params['OverrideHasDiabetes'] = session.effectiveDiabetes;
      params['OverrideDiabetes'] = session.effectiveDiabetes;
    }
    const ageParam = session.libraryParameters['OverrideAgeYears'];
    if (ageParam != null) {
      params['OverrideAgeYears'] = ageParam;
    }

    this.applyTriState(params, 'LifeExpectancyLimitedUnder5Years', answers.lifeExpectancyLimitedUnder5Years);
    this.applyTriState(params, 'BorderlineRiskPatientDesiresStatin', answers.borderlineRiskPatientDesiresStatin);
    this.applyTriState(params, 'RecentMiAcsOrCabgPciWithin6Weeks', answers.recentMiAcsOrCabgPciWithin6Weeks);
    this.applyTriState(params, 'VeryHighRiskRecentAcsOrMiOnTherapy', answers.veryHighRiskRecentAcsOrMiOnTherapy);
    this.applyTriState(
      params,
      'VeryHighRiskRecurrentEventsOnTherapy',
      answers.veryHighRiskRecurrentEventsOnTherapy,
    );
    this.applyTriState(params, 'OnLipidLoweringTherapy', answers.onLipidLoweringTherapy);
    this.applyTriState(params, 'EscalationNeeded', answers.escalationNeeded);
    this.applyTriState(
      params,
      'PersistentlyElevatedFastingTriglycerides',
      answers.persistentlyElevatedFastingTriglycerides,
    );
    this.applyTriState(params, 'StatinIntoleranceAttested', answers.statinIntoleranceAttested);
    this.applyTriState(params, 'UnableToTakeStatin', answers.unableToTakeStatin);
    this.applyTriState(params, 'CacWouldChangeManagement', answers.cacWouldChangeManagement);
    this.applyTriState(params, 'ClinicalRiskIntermediateOrHigh', answers.clinicalRiskIntermediateOrHigh);
    this.applyTriState(params, 'ClinicalRiskLow', answers.clinicalRiskLow);
    this.applyTriState(params, 'AstAltLessThan3xUlnConfirmed', answers.astAltLessThan3xUlnConfirmed);

    return params;
  }

  mapResults(
    raw: Record<string, unknown>,
    session: RiskCalculatorSession,
  ): GuidelineEvaluationView {
    const algorithmStatus = this.requireAlgorithmStatus(raw['AlgorithmStatus']);
    const algorithmPath = this.requireString(raw, 'AlgorithmPath');
    const copy = pathwayCopy(algorithmPath);

    const activeBoxes: number[] = [];
    for (let i = 1; i <= 21; i++) {
      if (raw[`ActiveBox${i}`] === true) {
        activeBoxes.push(i);
      }
    }

    const unresolvedBoxes = this.unresolvedBoxesForPath(algorithmPath);

    const recommendations = GUIDELINE_RECOMMENDATIONS.map((meta) => {
      const key = `Rec${String(meta.id).padStart(2, '0')}Status`;
      const status = this.requireRecStatus(raw[key], key);
      return {
        ...meta,
        status,
        tier: recommendationTier(status),
      };
    });

    const tenYear =
      this.asFiniteNumber(raw['OpenCVDRiskTenYearTotalCvdPercent']) ??
      session.tenYearTotalCvdPercent;
    const ldl = this.asFiniteNumber(raw['LatestLdlMgDl']) ?? session.effectiveLdlMgDl;
    const diabetes =
      typeof raw['EffectiveDiabetes'] === 'boolean'
        ? raw['EffectiveDiabetes']
        : session.effectiveDiabetes;

    return {
      algorithmStatus,
      algorithmPath,
      pathwayTitle: copy.title,
      pathwaySummary: copy.summary,
      guidelinePopulationStatus: this.requireString(raw, 'GuidelinePopulationStatus'),
      effectiveAgeYears: this.asFiniteNumber(raw['EffectiveAgeYears']),
      tenYearTotalCvdPercent: tenYear,
      latestLdlMgDl: ldl,
      effectiveDiabetes: diabetes,
      hasEstablishedCvd: raw['HasEstablishedCvd'] === true,
      hasHivInfection: raw['HasHivInfection'] === true,
      effectiveOnLipidLoweringTherapy:
        typeof raw['EffectiveOnLipidLoweringTherapy'] === 'boolean'
          ? raw['EffectiveOnLipidLoweringTherapy']
          : null,
      veryHighRiskCvd:
        typeof raw['VeryHighRiskCvd'] === 'boolean' ? raw['VeryHighRiskCvd'] : null,
      box8UsedNullPreventRisk: raw['Box8UsedNullPreventRisk'] === true,
      shouldDiscussCardiacRehabReferral: raw['ShouldDiscussCardiacRehabReferral'] === true,
      showComprehensiveLifestyleReminder: raw['ShowComprehensiveLifestyleReminder'] === true,
      showReemphasizeLifestyleReminder: raw['ShowReemphasizeLifestyleReminder'] === true,
      showBox15ReassessReminder: raw['ShowBox15ReassessReminder'] === true,
      showBox20MonitoringReminder: raw['ShowBox20MonitoringReminder'] === true,
      activeBoxes,
      unresolvedBoxes,
      recommendations,
      supportingFactors: [
        {
          label: 'PREVENT model',
          value: String(raw['SelectedPreventModel'] ?? session.selectedPreventModel ?? '—'),
        },
        {
          label: '10-year total CVD risk',
          value: tenYear != null ? `${tenYear.toFixed(1)}%` : '—',
        },
        {
          label: 'LDL-C',
          value: ldl != null ? `${ldl.toFixed(0)} mg/dL` : '—',
        },
        {
          label: 'Diabetes (effective)',
          value: diabetes == null ? 'Unknown' : diabetes ? 'Yes' : 'No',
        },
        {
          label: 'Established ASCVD (Sidebar 3)',
          value: raw['HasEstablishedCvd'] === true ? 'Yes' : 'No',
        },
        {
          label: 'HIV',
          value: raw['HasHivInfection'] === true ? 'Yes' : 'No',
        },
        {
          label: 'Box 8 used null PREVENT risk',
          value: raw['Box8UsedNullPreventRisk'] === true ? 'Yes' : 'No',
        },
        {
          label: 'Exclusion: HFrEF LVEF ≤35%',
          value: raw['ExclusionHfrefLvefLe35'] === true ? 'Yes' : 'No',
        },
        {
          label: 'Exclusion: HFrEF condition',
          value: raw['ExclusionHfrefCondition'] === true ? 'Yes' : 'No',
        },
        {
          label: 'Exclusion: ESRD',
          value: raw['ExclusionEskd'] === true ? 'Yes' : 'No',
        },
        {
          label: 'Exclusion: inherited / genetic dyslipidemia',
          value: raw['ExclusionInheritedDyslipidemia'] === true ? 'Yes' : 'No',
        },
        {
          label: 'Exclusion: triglycerides >500 mg/dL',
          value: raw['ExclusionTriglyceridesGt500'] === true ? 'Yes' : 'No',
        },
        {
          label: 'Exclusion: life expectancy <5 years',
          value: raw['ExclusionLifeExpectancyUnder5Years'] === true ? 'Yes' : 'No',
        },
        {
          label: 'Calculator session time',
          value: session.calculatedAt,
        },
      ],
    };
  }

  unresolvedBoxesForPath(path: string): number[] {
    switch (path) {
      case 'NeedsClinicalInput_LifeExpectancy':
        return [3];
      case 'NeedsClinicalInput_VeryHighRisk':
        return [7];
      case 'NeedsClinicalInput_Escalation':
        return [18];
      case 'NeedsClinicalInput_BorderlineDesire':
        return [12];
      default:
        return [];
    }
  }

  private applyTriState(
    params: Record<string, CqlLibraryParameterValue>,
    name: string,
    value: GuidelineClinicianAnswers[keyof GuidelineClinicianAnswers],
  ): void {
    const bool = triStateToBooleanOrOmit(value);
    if (bool !== undefined) {
      params[name] = bool;
    }
  }

  private requireAlgorithmStatus(value: unknown): AlgorithmStatus {
    if (typeof value === 'string' && ALGORITHM_STATUSES.has(value as AlgorithmStatus)) {
      return value as AlgorithmStatus;
    }
    throw new Error(`Malformed LipidManagement AlgorithmStatus: ${String(value)}`);
  }

  private requireRecStatus(value: unknown, key: string): RecommendationStatus {
    if (typeof value === 'string' && REC_STATUSES.has(value as RecommendationStatus)) {
      return value as RecommendationStatus;
    }
    throw new Error(`Malformed LipidManagement ${key}: ${String(value)}`);
  }

  private requireString(raw: Record<string, unknown>, key: string): string {
    const value = raw[key];
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`Malformed or missing LipidManagement ${key}`);
    }
    return value;
  }

  private asFiniteNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    return null;
  }
}
