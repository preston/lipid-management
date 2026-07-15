// Author: Preston Lee

import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Location } from '@angular/common';
import { SettingsService } from '../../services/settings.service';
import { ToastService } from '../../services/toast.service';
import { ThemeType } from '../../models/settings.model';

@Component({
  selector: 'app-settings',
  imports: [FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings implements OnInit {
  protected readonly settingsService = inject(SettingsService);
  private readonly location = inject(Location);
  private readonly toasts = inject(ToastService);

  protected readonly themeTypes = signal(ThemeType);

  ngOnInit(): void {
    this.settingsService.reload();
  }

  themePreferenceChanged(_value: ThemeType): void {
    this.settingsService.setEffectiveTheme();
  }

  save(): void {
    this.settingsService.saveSettings();
    this.settingsService.setEffectiveTheme();
    this.toasts.success('Settings saved to this browser.');
    this.location.back();
  }

  restoreDefaults(): void {
    this.settingsService.forceResetToDefaults();
    this.toasts.success('Settings reset to defaults.');
  }
}
