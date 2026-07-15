// Author: Preston Lee

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { Bundle, Patient } from 'fhir/r4';
import { SettingsService } from './settings.service';
import { PatientContextService } from './patient-context.service';

export interface PatientSearchHit {
  id: string;
  displayName: string;
  gender?: string;
  birthDate?: string;
  patient: Patient;
}

@Injectable({
  providedIn: 'root',
})
export class FhirPatientService {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(SettingsService);
  private readonly patientContext = inject(PatientContextService);

  private baseUrl(): string {
    return (
      this.patientContext.activeFhirBaseUrl() ||
      this.settings.getEffectiveFhirBaseUrl().replace(/\/+$/, '')
    );
  }

  searchByName(name: string, count = 20): Observable<PatientSearchHit[]> {
    const trimmed = name.trim();
    let params = new HttpParams().set('_count', String(count));
    if (trimmed) {
      params = params.set('name', trimmed);
    }
    return this.http.get<Bundle>(`${this.baseUrl()}/Patient`, { params }).pipe(
      map((bundle) =>
        (bundle.entry ?? [])
          .map((e) => e.resource)
          .filter((r): r is Patient => r?.resourceType === 'Patient')
          .map((patient) => ({
            id: patient.id ?? '',
            displayName: this.patientContext.patientDisplayName(patient),
            gender: patient.gender,
            birthDate: patient.birthDate,
            patient,
          })),
      ),
    );
  }

  read(id: string): Observable<Patient> {
    return this.http.get<Patient>(`${this.baseUrl()}/Patient/${encodeURIComponent(id)}`);
  }
}
