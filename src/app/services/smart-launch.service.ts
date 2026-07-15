// Author: Preston Lee

import { Injectable, inject } from '@angular/core';
import type { Patient } from 'fhir/r4';
import FHIR from 'fhirclient';
import { SettingsService } from './settings.service';
import { PatientContextService } from './patient-context.service';

@Injectable({
  providedIn: 'root',
})
export class SmartLaunchService {
  private readonly settings = inject(SettingsService);
  private readonly patientContext = inject(PatientContextService);

  async authorizeIfNeeded(url: URL = new URL(window.location.href)): Promise<boolean> {
    const iss = url.searchParams.get('iss');
    const launch = url.searchParams.get('launch');
    if (!iss || !launch) {
      return false;
    }

    const clientId = this.settings.getEffectiveSmartClientId();
    const redirectUri =
      this.settings.getEffectiveSmartRedirectUri() || `${window.location.origin}/launch`;

    if (!clientId) {
      throw new Error('SMART client ID is not configured. Set it in Settings.');
    }

    await FHIR.oauth2.authorize({
      client_id: clientId,
      scope: 'launch openid fhirUser patient/*.read',
      redirect_uri: redirectUri,
      iss,
      launch,
    });
    return true;
  }

  async completeLaunch(): Promise<Patient> {
    const client = await FHIR.oauth2.ready();
    const patientId = client.patient.id;
    if (!patientId) {
      throw new Error('SMART launch did not include a patient context.');
    }
    const patient = (await client.patient.read()) as Patient;
    const fhirBase =
      (client.state as { serverUrl?: string }).serverUrl ||
      this.settings.getEffectiveFhirBaseUrl();
    this.patientContext.setSmartSession(patient, fhirBase);
    return patient;
  }
}
