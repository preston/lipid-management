// Author: Preston Lee

import { TestBed } from '@angular/core/testing';
import type { Patient } from 'fhir/r4';
import { RiskCalculatorSessionService, type RiskCalculatorSession } from './risk-calculator-session.service';
import { PatientContextService } from './patient-context.service';

function sampleSession(patientId = 'p1'): RiskCalculatorSession {
  return {
    patientId,
    calculatedAt: '2026-07-16T12:00:00.000Z',
    calculatedWithExclusions: false,
    selectedPreventModel: 'base',
    rawResults: { TenYearTotalCvdPercent: 8.5 },
    libraryParameters: { OverrideDiabetes: false },
    display: {
      risk10yTotal: '8.5',
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
    effectiveLdlMgDl: 120,
    tenYearTotalCvdPercent: 8.5,
  };
}

describe('RiskCalculatorSessionService', () => {
  let service: RiskCalculatorSessionService;
  let patientContext: PatientContextService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RiskCalculatorSessionService);
    patientContext = TestBed.inject(PatientContextService);
  });

  it('starts without results', () => {
    expect(service.hasResults()).toBe(false);
    expect(service.session()).toBeNull();
  });

  it('stores and clears a calculator session', () => {
    service.setFromCalculator(sampleSession());
    expect(service.hasResults()).toBe(true);
    expect(service.session()?.tenYearTotalCvdPercent).toBe(8.5);

    service.clear();
    expect(service.hasResults()).toBe(false);
  });

  it('validates session against the selected patient', () => {
    patientContext.setStandalonePatient({
      resourceType: 'Patient',
      id: 'p1',
    } as Patient);
    service.setFromCalculator(sampleSession('p1'));
    expect(service.hasValidSessionForCurrentPatient()).toBe(true);

    patientContext.setStandalonePatient({
      resourceType: 'Patient',
      id: 'p2',
    } as Patient);
    expect(service.hasValidSessionForCurrentPatient()).toBe(false);

    service.clearIfPatientMismatch();
    expect(service.hasResults()).toBe(false);
  });
});
