// Author: Preston Lee

import { TestBed } from '@angular/core/testing';
import type { Bundle, Patient } from 'fhir/r4';
import {
  BLANK_SESSION_PATIENT_ID,
  PatientContextService,
} from './patient-context.service';
import { SettingsService } from './settings.service';

describe('PatientContextService', () => {
  let service: PatientContextService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PatientContextService, SettingsService],
    });
    service = TestBed.inject(PatientContextService);
    service.resetForTests();
  });

  it('enterBlankSession installs synthetic patient and client bundle', () => {
    service.enterBlankSession();

    expect(service.isBlankSession()).toBe(true);
    expect(service.selectedPatient()?.id).toBe(BLANK_SESSION_PATIENT_ID);
    expect(service.hasClientData()).toBe(true);
    expect(service.hasRealClientData()).toBe(false);
    expect(service.clientDataBundle()?.entry?.[0]?.resource?.resourceType).toBe('Patient');
  });

  it('setStandalonePatient clears blank session', () => {
    service.enterBlankSession();
    const patient: Patient = {
      resourceType: 'Patient',
      id: 'real-1',
      name: [{ family: 'Doe', given: ['Jane'] }],
    };
    service.setStandalonePatient(patient);

    expect(service.isBlankSession()).toBe(false);
    expect(service.selectedPatient()?.id).toBe('real-1');
    expect(service.hasClientData()).toBe(false);
    expect(service.hasRealClientData()).toBe(false);
  });

  it('setClientDataPatient clears blank session and marks real client data', () => {
    service.enterBlankSession();
    const patient: Patient = {
      resourceType: 'Patient',
      id: 'bundle-1',
      name: [{ family: 'Bundle', given: ['Pat'] }],
    };
    const bundle: Bundle = {
      resourceType: 'Bundle',
      type: 'collection',
      entry: [{ fullUrl: 'Patient/bundle-1', resource: patient }],
    };
    service.setClientDataPatient(bundle, patient);

    expect(service.isBlankSession()).toBe(false);
    expect(service.hasClientData()).toBe(true);
    expect(service.hasRealClientData()).toBe(true);
    expect(service.selectedPatient()?.id).toBe('bundle-1');
  });

  it('setSmartSession clears blank session', () => {
    service.enterBlankSession();
    const patient: Patient = {
      resourceType: 'Patient',
      id: 'smart-1',
    };
    service.setSmartSession(patient, 'https://example.org/fhir');

    expect(service.isBlankSession()).toBe(false);
    expect(service.isSmart()).toBe(true);
    expect(service.hasClientData()).toBe(false);
  });

  it('enterBlankSession is a no-op in SMART mode', () => {
    const patient: Patient = { resourceType: 'Patient', id: 'smart-1' };
    service.setSmartSession(patient, 'https://example.org/fhir');
    service.enterBlankSession();

    expect(service.isBlankSession()).toBe(false);
    expect(service.selectedPatient()?.id).toBe('smart-1');
  });

  it('clearPatient clears blank session state', () => {
    service.enterBlankSession();
    service.clearPatient();

    expect(service.isBlankSession()).toBe(false);
    expect(service.selectedPatient()).toBeNull();
    expect(service.hasClientData()).toBe(false);
  });
});
