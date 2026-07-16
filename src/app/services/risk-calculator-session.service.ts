// Author: Preston Lee

import { Injectable, computed, inject, signal } from '@angular/core';
import type { CqlLibraryParameterValue } from './cql-evaluate.service';
import { PatientContextService } from './patient-context.service';
import type { PreventModel } from '../features/open-cvd-risk-calculator/prevent/prevent-math';

export interface RiskCalculatorSessionDisplay {
  risk10yTotal: string;
  risk10yAscvd: string;
  risk10yHf: string;
  risk10yChd: string;
  risk10yStroke: string;
  openCvdRiskAge: string;
  risk30yTotal: string;
  risk30yAscvd: string;
  risk30yHf: string;
  risk30yChd: string;
  risk30yStroke: string;
  risk30yCvdPercentile: string;
}

export interface RiskCalculatorSession {
  patientId: string;
  calculatedAt: string;
  calculatedWithExclusions: boolean;
  selectedPreventModel: PreventModel | null;
  rawResults: Record<string, unknown>;
  libraryParameters: Record<string, CqlLibraryParameterValue>;
  display: RiskCalculatorSessionDisplay;
  /** Calculator clinician flag for PREVENT exclusion (<1 year). Not the CPG <5 year Box 3 answer. */
  preventLifeExpectancyLimited: boolean;
  effectiveDiabetes: boolean | null;
  effectiveLdlMgDl: number | null;
  tenYearTotalCvdPercent: number | null;
}

@Injectable({
  providedIn: 'root',
})
export class RiskCalculatorSessionService {
  private readonly patientContext = inject(PatientContextService);
  private readonly sessionState = signal<RiskCalculatorSession | null>(null);

  readonly session = this.sessionState.asReadonly();

  readonly hasResults = computed(() => this.sessionState() != null);

  /** True when a session exists for the currently selected patient. */
  readonly hasValidSessionForCurrentPatient = computed(() => {
    const session = this.sessionState();
    const patientId = this.patientContext.selectedPatient()?.id;
    return session != null && patientId != null && session.patientId === patientId;
  });

  setFromCalculator(session: RiskCalculatorSession): void {
    this.sessionState.set(session);
  }

  clear(): void {
    this.sessionState.set(null);
  }

  /** Clears when the selected patient no longer matches the stored session. */
  clearIfPatientMismatch(): void {
    const session = this.sessionState();
    if (!session) {
      return;
    }
    const patientId = this.patientContext.selectedPatient()?.id;
    if (patientId == null || session.patientId !== patientId) {
      this.clear();
    }
  }
}
