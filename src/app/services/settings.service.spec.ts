// Author: Preston Lee

import { TestBed } from '@angular/core/testing';
import { SettingsService } from './settings.service';
import { Settings } from '../models/settings.model';

const memory = new Map<string, string>();

function installMemoryStorage(): void {
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
    clear: () => memory.clear(),
    get length() {
      return memory.size;
    },
    key: (index: number) => [...memory.keys()][index] ?? null,
  };
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: storage,
  });
}

describe('SettingsService', () => {
  beforeEach(() => {
    memory.clear();
    installMemoryStorage();
    (window as unknown as Record<string, string>)['LIPID_MANAGEMENT_FHIR_BASE_URL'] =
      'http://env.example/fhir';
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    memory.clear();
  });

  it('uses env FHIR base URL when settings override is empty', () => {
    const service = TestBed.inject(SettingsService);
    expect(service.getEffectiveFhirBaseUrl()).toBe('http://env.example/fhir');
  });

  it('prefers non-empty localStorage override for FHIR base URL', () => {
    const service = TestBed.inject(SettingsService);
    const next = Object.assign(new Settings(), service.settings(), {
      fhirBaseUrl: 'http://override.example/fhir',
    });
    service.settings.set(next);
    service.saveSettings();
    expect(service.getEffectiveFhirBaseUrl()).toBe('http://override.example/fhir');
  });

  it('falls back to hardcoded default when env FHIR URL is empty', () => {
    (window as unknown as Record<string, string>)['LIPID_MANAGEMENT_FHIR_BASE_URL'] = '';
    memory.clear();
    const service = TestBed.inject(SettingsService);
    service.forceResetToDefaults();
    expect(service.getDefaultFhirBaseUrl()).toBe('http://localhost:8080/fhir');
  });

  it('defaults experimental and developer to false', () => {
    const service = TestBed.inject(SettingsService);
    expect(service.settings().experimental).toBe(false);
    expect(service.settings().developer).toBe(false);
  });

  it('backfills missing experimental and developer flags on reload', () => {
    memory.set(
      SettingsService.SETTINGS_KEY,
      JSON.stringify({ theme_preferred: 'light', fhirBaseUrl: 'http://x/fhir' }),
    );
    const service = TestBed.inject(SettingsService);
    service.reload();
    expect(service.settings().experimental).toBe(false);
    expect(service.settings().developer).toBe(false);
  });
});
