// Author: Preston Lee

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { CalculatorPrefillService } from './calculator-prefill.service';
import { CqlEvaluateService } from './cql-evaluate.service';
import { PatientContextService } from './patient-context.service';

describe('CalculatorPrefillService mapChartExclusions', () => {
  let service: CalculatorPrefillService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        CalculatorPrefillService,
        CqlEvaluateService,
        PatientContextService,
      ],
    });
    service = TestBed.inject(CalculatorPrefillService);
  });

  it('should map chart PREVENT exclusion flags to exclusion list', () => {
    const exclusions = service.mapChartExclusions({
      PreventExclusionAgeOutOfRange: true,
      PreventExclusionKnownCvd: true,
      ActiveKnownCvdCondition: {
        resourceType: 'Condition',
        id: 'cvd-1',
        code: { coding: [{ display: 'Coronary artery disease' }] },
      },
      PreventExclusionLvefBelow40: true,
      LatestLvefPercent: 35,
      LatestLvefObservation: {
        resourceType: 'Observation',
        id: 'lvef-1',
        code: { coding: [{ code: '10230-1', display: 'Left ventricular Ejection fraction' }] },
        effectiveDateTime: '2025-01-01',
      },
      PreventExclusionHfref: true,
      ActiveHfrEfCondition: {
        resourceType: 'Condition',
        id: 'hfref-1',
        code: { coding: [{ display: 'Heart failure with reduced ejection fraction' }] },
      },
      PreventExclusionCacAtLeast300: false,
      PreventExclusionEskd: true,
      ActiveEskdCondition: {
        resourceType: 'Condition',
        id: 'eskd-1',
        code: { coding: [{ code: 'N18.6', display: 'End stage renal disease' }] },
      },
      PreventExclusionInheritedCvdCondition: false,
    });

    expect(exclusions.map((e) => e.id)).toEqual([
      'age-out-of-range',
      'known-cvd',
      'lvef-below-40',
      'hfref',
      'eskd',
    ]);
    expect(exclusions.every((e) => e.source === 'chart')).toBe(true);
    expect(exclusions.find((e) => e.id === 'known-cvd')?.provenance).toContain('Condition/cvd-1');
    expect(exclusions.find((e) => e.id === 'lvef-below-40')?.provenance).toContain('LVEF 35%');
    expect(exclusions.find((e) => e.id === 'hfref')?.message).toContain('reduced ejection');
  });

  it('should return empty list when no exclusions fire', () => {
    expect(service.mapChartExclusions({})).toEqual([]);
  });
});
