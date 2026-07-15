// Author: Preston Lee

import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';
import type { Condition, MedicationRequest, Observation, Quantity } from 'fhir/r4';
import type {
  OpenCVDRiskCalculatorForm,
  OpenCVDRiskYesNo,
} from '../features/open-cvd-risk-calculator/open-cvd-risk-calculator.model';
import { CqlEvaluateService } from './cql-evaluate.service';

export interface FieldProvenance {
  field: keyof OpenCVDRiskCalculatorForm | 'bmi';
  summary: string;
  resourceType?: string;
  resourceId?: string;
  effective?: string;
  status?: string;
  codeDisplay?: string;
  derived?: boolean;
}

export type PreventExclusionSource = 'chart' | 'clinician';

export type PreventExclusionId =
  | 'age-out-of-range'
  | 'known-cvd'
  | 'lvef-below-40'
  | 'hfref'
  | 'cac-at-least-300'
  | 'eskd'
  | 'inherited-cvd'
  | 'life-expectancy-limited'
  | 'pathogenic-genetic-variant';

export interface PreventExclusion {
  id: PreventExclusionId;
  message: string;
  source: PreventExclusionSource;
  provenance?: string;
}

export interface PrefillResult {
  form: Partial<OpenCVDRiskCalculatorForm>;
  provenances: FieldProvenance[];
  exclusions: PreventExclusion[];
}

const OPEN_CVD_EXPRESSIONS = [
  'LatestTotalCholMgDl',
  'LatestTotalCholObservation',
  'LatestHdlMgDl',
  'LatestHdlObservation',
  'LatestSbpMmHg',
  'LatestSbpObservation',
  'EgfrFromCreatinine',
  'LatestCreatinineObservation',
  'HasDiabetesMellitusType2',
  'ActiveDiabetesMellitusType2Condition',
  'CurrentSmokingFromObservation',
  'LatestSmokingObservation',
  'ActiveStatinTherapy',
  'ActiveStatinMedicationRequest',
  'ActiveAntihypertensiveTherapy',
  'ActiveAntihypertensiveMedicationRequest',
  'PreventExclusionAgeOutOfRange',
  'PreventExclusionKnownCvd',
  'ActiveKnownCvdCondition',
  'PreventExclusionLvefBelow40',
  'LatestLvefObservation',
  'LatestLvefPercent',
  'PreventExclusionHfref',
  'ActiveHfrEfCondition',
  'PreventExclusionCacAtLeast300',
  'LatestCacObservation',
  'LatestCacScore',
  'PreventExclusionEskd',
  'ActiveEskdCondition',
  'PreventExclusionInheritedCvdCondition',
  'ActiveInheritedCvdCondition',
];

const BMI_EXPRESSIONS = [
  'HeightCm',
  'WeightKg',
  'BestBmiKgM2',
  'ComputedBMI',
  'MostRecentRecordedBodyHeight',
  'MostRecentRecordedBodyWeight',
  'MostRecentRecordedBMI',
];

@Injectable({
  providedIn: 'root',
})
export class CalculatorPrefillService {
  private readonly cql = inject(CqlEvaluateService);

  prefillFromChart(): Observable<PrefillResult> {
    return forkJoin({
      openCvd: this.cql.evaluateLibrary('OpenCVDRisk', OPEN_CVD_EXPRESSIONS),
      bmi: this.cql.evaluateLibrary('BMI', BMI_EXPRESSIONS),
    }).pipe(map(({ openCvd, bmi }) => this.mapResults(openCvd, bmi)));
  }

  /** Map chart-side PREVENT exclusion flags from an OpenCVDRisk $evaluate result. */
  mapChartExclusions(openCvd: Record<string, unknown>): PreventExclusion[] {
    const exclusions: PreventExclusion[] = [];

    if (openCvd['PreventExclusionAgeOutOfRange'] === true) {
      exclusions.push({
        id: 'age-out-of-range',
        message: 'Age outside 30–79 years',
        source: 'chart',
        provenance: 'Derived from recorded date of birth.',
      });
    }

    if (openCvd['PreventExclusionKnownCvd'] === true) {
      exclusions.push({
        id: 'known-cvd',
        message: 'Chart suggests known atherosclerotic cardiovascular disease',
        source: 'chart',
        provenance: this.conditionEvidenceSummary(openCvd['ActiveKnownCvdCondition']),
      });
    }

    if (openCvd['PreventExclusionLvefBelow40'] === true) {
      const pct = this.asNumber(openCvd['LatestLvefPercent']);
      exclusions.push({
        id: 'lvef-below-40',
        message: 'Left ventricular ejection fraction <40%',
        source: 'chart',
        provenance: [
          this.observationEvidenceSummary(openCvd['LatestLvefObservation']),
          pct != null ? `LVEF ${pct}%` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      });
    }

    if (openCvd['PreventExclusionHfref'] === true) {
      exclusions.push({
        id: 'hfref',
        message: 'Chart suggests heart failure with reduced ejection fraction',
        source: 'chart',
        provenance: this.conditionEvidenceSummary(openCvd['ActiveHfrEfCondition']),
      });
    }

    if (openCvd['PreventExclusionCacAtLeast300'] === true) {
      const score = this.asNumber(openCvd['LatestCacScore']);
      exclusions.push({
        id: 'cac-at-least-300',
        message: 'Coronary artery calcium score ≥300',
        source: 'chart',
        provenance: [
          this.observationEvidenceSummary(openCvd['LatestCacObservation']),
          score != null ? `CAC ${score}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      });
    }

    if (openCvd['PreventExclusionEskd'] === true) {
      exclusions.push({
        id: 'eskd',
        message: 'Chart suggests end-stage kidney disease',
        source: 'chart',
        provenance: this.conditionEvidenceSummary(openCvd['ActiveEskdCondition']),
      });
    }

    if (openCvd['PreventExclusionInheritedCvdCondition'] === true) {
      exclusions.push({
        id: 'inherited-cvd',
        message: 'Chart suggests inherited cardiovascular condition',
        source: 'chart',
        provenance: this.conditionEvidenceSummary(openCvd['ActiveInheritedCvdCondition']),
      });
    }

    return exclusions;
  }

  private mapResults(
    openCvd: Record<string, unknown>,
    bmi: Record<string, unknown>,
  ): PrefillResult {
    const form: Partial<OpenCVDRiskCalculatorForm> = {};
    const provenances: FieldProvenance[] = [];

    const totalChol = this.asNumber(openCvd['LatestTotalCholMgDl']);
    if (totalChol != null) {
      form.totalCholesterolMgDl = totalChol;
      provenances.push(
        this.observationProvenance('totalCholesterolMgDl', openCvd['LatestTotalCholObservation']),
      );
    }

    const hdl = this.asNumber(openCvd['LatestHdlMgDl']);
    if (hdl != null) {
      form.hdlMgDl = hdl;
      provenances.push(this.observationProvenance('hdlMgDl', openCvd['LatestHdlObservation']));
    }

    const sbp = this.asNumber(openCvd['LatestSbpMmHg']);
    if (sbp != null) {
      form.systolicBpMmHg = sbp;
      provenances.push(this.observationProvenance('systolicBpMmHg', openCvd['LatestSbpObservation']));
    }

    const egfr = this.asNumber(openCvd['EgfrFromCreatinine']);
    if (egfr != null) {
      form.egfrMlMin173m2 = egfr;
      const base = this.observationProvenance(
        'egfrMlMin173m2',
        openCvd['LatestCreatinineObservation'],
      );
      provenances.push({
        ...base,
        derived: true,
        summary: `${base.summary} eGFR derived via CKD-EPI 2021 from creatinine.`,
      });
    }

    const heightCm = this.asNumber(bmi['HeightCm']);
    if (heightCm != null) {
      form.heightCm = heightCm;
      provenances.push(
        this.observationProvenance('heightCm', bmi['MostRecentRecordedBodyHeight']),
      );
    }

    const weightKg = this.asNumber(bmi['WeightKg']);
    if (weightKg != null) {
      form.weightKg = weightKg;
      provenances.push(
        this.observationProvenance('weightKg', bmi['MostRecentRecordedBodyWeight']),
      );
    }

    if (bmi['ComputedBMI'] != null || bmi['BestBmiKgM2'] != null) {
      const computed = bmi['ComputedBMI'] != null;
      provenances.push({
        field: 'bmi',
        derived: true,
        summary: computed
          ? 'BMI computed from latest height and weight (BMI library). Override height/weight if inappropriate.'
          : this.observationProvenance('bmi', bmi['MostRecentRecordedBMI']).summary,
        ...this.resourceMeta(
          (bmi['MostRecentRecordedBodyHeight'] as Observation | undefined) ??
            (bmi['MostRecentRecordedBMI'] as Observation | undefined),
        ),
      });
    }

    if (openCvd['HasDiabetesMellitusType2'] === true) {
      form.diabetes = 'yes';
      provenances.push(
        this.conditionProvenance('diabetes', openCvd['ActiveDiabetesMellitusType2Condition']),
      );
    }

    if (openCvd['CurrentSmokingFromObservation'] === true) {
      form.currentSmoker = 'yes';
      provenances.push(
        this.observationProvenance('currentSmoker', openCvd['LatestSmokingObservation']),
      );
    } else if (openCvd['LatestSmokingObservation'] != null) {
      form.currentSmoker = 'no';
      provenances.push(
        this.observationProvenance('currentSmoker', openCvd['LatestSmokingObservation']),
      );
    }

    form.onStatin = this.yesNo(openCvd['ActiveStatinTherapy']);
    if (openCvd['ActiveStatinMedicationRequest'] != null) {
      provenances.push(
        this.medicationProvenance('onStatin', openCvd['ActiveStatinMedicationRequest']),
      );
    }

    form.onAntihypertensive = this.yesNo(openCvd['ActiveAntihypertensiveTherapy']);
    if (openCvd['ActiveAntihypertensiveMedicationRequest'] != null) {
      provenances.push(
        this.medicationProvenance(
          'onAntihypertensive',
          openCvd['ActiveAntihypertensiveMedicationRequest'],
        ),
      );
    }

    return {
      form,
      provenances: provenances.filter((p) => !!p.summary),
      exclusions: this.mapChartExclusions(openCvd),
    };
  }

  private yesNo(value: unknown): OpenCVDRiskYesNo {
    return value === true ? 'yes' : 'no';
  }

  private asNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (value && typeof value === 'object' && 'value' in value) {
      const q = value as Quantity;
      if (typeof q.value === 'number' && Number.isFinite(q.value)) {
        return q.value;
      }
    }
    return null;
  }

  private resourceMeta(resource: { resourceType?: string; id?: string } | null | undefined) {
    if (!resource) {
      return {};
    }
    return {
      resourceType: resource.resourceType,
      resourceId: resource.id,
    };
  }

  private observationProvenance(
    field: FieldProvenance['field'],
    raw: unknown,
  ): FieldProvenance {
    const obs = raw as Observation | null;
    if (!obs || obs.resourceType !== 'Observation') {
      return { field, summary: 'Chart value from clinical data (source details unavailable).' };
    }
    const coding = obs.code?.coding?.[0];
    const codeDisplay = coding?.display || obs.code?.text;
    const effective =
      typeof obs.effectiveDateTime === 'string'
        ? obs.effectiveDateTime
        : obs.effectivePeriod?.start;
    const status = obs.status;
    const bits = [
      'From chart observation',
      codeDisplay ?? null,
      effective ? `dated ${effective}` : null,
      status && status !== 'final' ? `status ${status}` : null,
      'Consider override if outdated, wrong specimen, or not reflective of usual values.',
    ].filter(Boolean);
    return {
      field,
      summary: bits.join(' · '),
      resourceType: 'Observation',
      resourceId: obs.id,
      effective,
      status,
      codeDisplay: codeDisplay ?? undefined,
    };
  }

  private conditionProvenance(field: FieldProvenance['field'], raw: unknown): FieldProvenance {
    const condition = raw as Condition | null;
    if (!condition || condition.resourceType !== 'Condition') {
      return { field, summary: 'Active diabetes diagnosis found in chart.' };
    }
    const coding = condition.code?.coding?.[0];
    const codeDisplay = coding?.display || condition.code?.text;
    const clinicalStatus = condition.clinicalStatus?.coding?.[0]?.code;
    const bits = [
      'From chart condition',
      codeDisplay ?? null,
      clinicalStatus ? `status ${clinicalStatus}` : null,
      'Override if the diagnosis is inactive, historical, or not applicable.',
    ].filter(Boolean);
    return {
      field,
      summary: bits.join(' · '),
      resourceType: 'Condition',
      resourceId: condition.id,
      status: clinicalStatus,
      codeDisplay: codeDisplay ?? undefined,
    };
  }

  private medicationProvenance(field: FieldProvenance['field'], raw: unknown): FieldProvenance {
    const med = raw as MedicationRequest | null;
    if (!med || med.resourceType !== 'MedicationRequest') {
      return { field, summary: 'Active therapy found in chart medications.' };
    }
    const concept =
      med.medicationCodeableConcept ??
      (typeof med.medicationReference === 'object' ? undefined : undefined);
    const coding = concept?.coding?.[0];
    const codeDisplay = coding?.display || concept?.text;
    const bits = [
      'From chart medication',
      codeDisplay ?? null,
      med.status && med.status !== 'active' ? `status ${med.status}` : null,
      med.authoredOn ? `authored ${med.authoredOn}` : null,
      'Override if the order is not currently taken or not a true statin/antihypertensive.',
    ].filter(Boolean);
    return {
      field,
      summary: bits.join(' · '),
      resourceType: 'MedicationRequest',
      resourceId: med.id,
      status: med.status,
      effective: med.authoredOn,
      codeDisplay: codeDisplay ?? undefined,
    };
  }

  private conditionEvidenceSummary(raw: unknown): string | undefined {
    const condition = raw as Condition | null;
    if (!condition || condition.resourceType !== 'Condition') {
      return undefined;
    }
    const coding = condition.code?.coding?.[0];
    const codeDisplay = coding?.display || condition.code?.text;
    return codeDisplay ? `Chart condition: ${codeDisplay}` : 'Matched chart condition.';
  }

  private observationEvidenceSummary(raw: unknown): string | undefined {
    const obs = raw as Observation | null;
    if (!obs || obs.resourceType !== 'Observation') {
      return undefined;
    }
    const coding = obs.code?.coding?.[0];
    const codeDisplay = coding?.display || obs.code?.text;
    const effective =
      typeof obs.effectiveDateTime === 'string'
        ? obs.effectiveDateTime
        : obs.effectivePeriod?.start;
    return [
      codeDisplay ? `Chart observation: ${codeDisplay}` : 'Matched chart observation',
      effective ? `dated ${effective}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }
}
