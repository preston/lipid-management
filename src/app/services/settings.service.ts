// Author: Preston Lee

import { Injectable, signal } from '@angular/core';
import { Settings, ThemeType } from '../models/settings.model';

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  public static readonly SETTINGS_KEY = 'lipid_management_settings';
  public static readonly FORCE_RESET_KEY = 'lipid_management_settings_force_reset';

  private static readonly FHIR_BASE_DEFAULT = 'http://localhost:8080/fhir';

  public settings = signal<Settings>(new Settings());
  public force_reset = signal(false);
  public theme_effective = signal<ThemeType>(ThemeType.LIGHT);

  constructor() {
    this.reload();
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (this.settings().theme_preferred === ThemeType.AUTOMATIC) {
          this.setEffectiveTheme();
          this.saveSettings();
        }
      });
    }
  }

  private storageGet(key: string): string | null {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  private storageSet(key: string, value: string): void {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Ignore unavailable storage (e.g. unit tests).
    }
  }

  private storageRemove(key: string): void {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // Ignore unavailable storage.
    }
  }

  setEffectiveTheme(): void {
    let resolved: ThemeType.LIGHT | ThemeType.DARK;
    if (this.settings().theme_preferred === ThemeType.AUTOMATIC) {
      const dark =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      resolved = dark ? ThemeType.DARK : ThemeType.LIGHT;
    } else if (this.settings().theme_preferred === ThemeType.DARK) {
      resolved = ThemeType.DARK;
    } else {
      resolved = ThemeType.LIGHT;
    }
    this.theme_effective.set(resolved);
    this.applyDocumentTheme(resolved);
  }

  /** Apply Bootstrap color mode on <html> so body and all descendants use theme tokens. */
  private applyDocumentTheme(theme: ThemeType.LIGHT | ThemeType.DARK): void {
    if (typeof document === 'undefined') {
      return;
    }
    document.documentElement.setAttribute('data-bs-theme', theme);
  }

  reload(): void {
    this.force_reset.set(this.storageGet(SettingsService.FORCE_RESET_KEY) === 'true');
    if (this.force_reset()) {
      this.forceResetToDefaults();
      return;
    }

    const raw = this.storageGet(SettingsService.SETTINGS_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<Settings>;
        const merged = Object.assign(new Settings(), parsed);
        let shouldSave = false;
        if (parsed.theme_preferred == null) {
          merged.theme_preferred = Settings.DEFAULT_THEME;
          shouldSave = true;
        }
        if (parsed.experimental == null) {
          merged.experimental = false;
          shouldSave = true;
        }
        for (const key of [
          'fhirBaseUrl',
          'smartClientId',
          'smartRedirectUri',
        ] as const) {
          if (parsed[key] == null) {
            merged[key] = '';
            shouldSave = true;
          }
        }
        this.settings.set(merged);
        if (shouldSave) {
          this.saveSettings();
        }
      } catch {
        this.settings.set(new Settings());
        this.saveSettings();
      }
    } else {
      this.settings.set(new Settings());
      this.saveSettings();
    }
    this.setEffectiveTheme();
  }

  forceResetToDefaults(): void {
    this.storageRemove(SettingsService.SETTINGS_KEY);
    this.storageRemove(SettingsService.FORCE_RESET_KEY);
    this.settings.set(new Settings());
    this.force_reset.set(false);
    this.saveSettings();
    this.setEffectiveTheme();
  }

  saveSettings(): void {
    this.storageSet(SettingsService.SETTINGS_KEY, JSON.stringify(this.settings()));
  }

  private envString(key: string): string {
    const value = (window as unknown as Record<string, unknown>)[key];
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : '';
  }

  getDefaultFhirBaseUrl(): string {
    return this.envString('LIPID_MANAGEMENT_FHIR_BASE_URL') || SettingsService.FHIR_BASE_DEFAULT;
  }

  getDefaultSmartClientId(): string {
    return this.envString('LIPID_MANAGEMENT_SMART_CLIENT_ID');
  }

  getDefaultSmartRedirectUri(): string {
    return this.envString('LIPID_MANAGEMENT_SMART_REDIRECT_URI');
  }

  getEffectiveFhirBaseUrl(): string {
    const settingValue = this.settings().fhirBaseUrl;
    return settingValue && settingValue.trim() !== '' ? settingValue.trim() : this.getDefaultFhirBaseUrl();
  }

  getEffectiveSmartClientId(): string {
    const settingValue = this.settings().smartClientId;
    return settingValue && settingValue.trim() !== ''
      ? settingValue.trim()
      : this.getDefaultSmartClientId();
  }

  getEffectiveSmartRedirectUri(): string {
    const settingValue = this.settings().smartRedirectUri;
    return settingValue && settingValue.trim() !== ''
      ? settingValue.trim()
      : this.getDefaultSmartRedirectUri();
  }
}
