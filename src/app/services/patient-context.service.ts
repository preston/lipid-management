// Author: Preston Lee

import { Injectable, computed, inject, signal } from '@angular/core';
import type { Bundle, Patient } from 'fhir/r4';
import type { AppMode } from '../models/app-mode';
import { SettingsService } from './settings.service';

/** Stable synthetic patient id for blank (no chart) calculator sessions. */
export const BLANK_SESSION_PATIENT_ID = 'opencvd-blank';

@Injectable({
  providedIn: 'root',
})
export class PatientContextService {
  private readonly settingsService = inject(SettingsService);

  private readonly modeState = signal<AppMode>('standalone');
  private readonly patientState = signal<Patient | null>(null);
  private readonly clientDataBundleState = signal<Bundle | null>(null);
  private readonly blankSessionState = signal(false);
  private readonly smartSessionActive = signal(false);
  private readonly fhirBaseOverride = signal<string | null>(null);

  readonly mode = this.modeState.asReadonly();
  readonly selectedPatient = this.patientState.asReadonly();
  readonly clientDataBundle = this.clientDataBundleState.asReadonly();
  readonly isBlankSession = this.blankSessionState.asReadonly();
  readonly isSmart = computed(() => this.modeState() === 'smart');
  readonly hasPatient = computed(() => this.patientState() != null);
  readonly hasClientData = computed(() => this.clientDataBundleState() != null);
  /** True when a user-uploaded Bundle is loaded (not the blank-session stub). */
  readonly hasRealClientData = computed(
    () => this.clientDataBundleState() != null && !this.blankSessionState(),
  );

  readonly activeFhirBaseUrl = computed(() => {
    const override = this.fhirBaseOverride();
    if (override && override.trim() !== '') {
      return override.replace(/\/+$/, '');
    }
    return this.settingsService.getEffectiveFhirBaseUrl().replace(/\/+$/, '');
  });

  detectLaunchFromUrl(url: URL = new URL(window.location.href)): AppMode {
    const iss = url.searchParams.get('iss');
    const launch = url.searchParams.get('launch');
    if (iss && launch) {
      this.modeState.set('smart');
      return 'smart';
    }
    if (this.smartSessionActive()) {
      this.modeState.set('smart');
      return 'smart';
    }
    this.modeState.set('standalone');
    return 'standalone';
  }

  setSmartSession(patient: Patient, fhirBaseUrl: string): void {
    this.smartSessionActive.set(true);
    this.modeState.set('smart');
    this.fhirBaseOverride.set(fhirBaseUrl.replace(/\/+$/, ''));
    this.blankSessionState.set(false);
    this.clientDataBundleState.set(null);
    this.patientState.set(patient);
  }

  setStandalonePatient(patient: Patient | null): void {
    if (this.modeState() === 'smart') {
      return;
    }
    this.blankSessionState.set(false);
    this.clientDataBundleState.set(null);
    this.patientState.set(patient);
  }

  setClientDataPatient(bundle: Bundle, patient: Patient): void {
    if (this.modeState() === 'smart') {
      return;
    }
    this.blankSessionState.set(false);
    this.clientDataBundleState.set(bundle);
    this.patientState.set(patient);
  }

  /**
   * Standalone blank calculator session: synthetic Patient in a minimal client Bundle
   * so $evaluate can use subject + useServerData:false without chart data.
   */
  enterBlankSession(): void {
    if (this.modeState() === 'smart') {
      return;
    }
    const patient: Patient = {
      resourceType: 'Patient',
      id: BLANK_SESSION_PATIENT_ID,
      name: [{ text: 'Manual entry' }],
    };
    const bundle: Bundle = {
      resourceType: 'Bundle',
      type: 'collection',
      entry: [
        {
          fullUrl: `Patient/${BLANK_SESSION_PATIENT_ID}`,
          resource: patient,
        },
      ],
    };
    this.blankSessionState.set(true);
    this.clientDataBundleState.set(bundle);
    this.patientState.set(patient);
  }

  clearPatient(): void {
    if (this.modeState() === 'smart') {
      return;
    }
    this.blankSessionState.set(false);
    this.clientDataBundleState.set(null);
    this.patientState.set(null);
  }

  resetForTests(): void {
    this.smartSessionActive.set(false);
    this.fhirBaseOverride.set(null);
    this.modeState.set('standalone');
    this.blankSessionState.set(false);
    this.clientDataBundleState.set(null);
    this.patientState.set(null);
  }

  patientDisplayName(patient: Patient | null = this.patientState()): string {
    if (!patient?.name?.length) {
      return 'Unknown patient';
    }
    const name = patient.name[0];
    const given = (name.given ?? []).join(' ');
    const family = name.family ?? '';
    const text = name.text?.trim();
    if (text) {
      return text;
    }
    return `${given} ${family}`.trim() || 'Unknown patient';
  }
}
