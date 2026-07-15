// Author: Preston Lee

import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SmartLaunchService } from '../../services/smart-launch.service';
import { PatientContextService } from '../../services/patient-context.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-smart-launch',
  templateUrl: './smart-launch.html',
})
export class SmartLaunch implements OnInit {
  private readonly smartLaunch = inject(SmartLaunchService);
  private readonly patientContext = inject(PatientContextService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  protected readonly status = signal('Starting SMART launch…');

  async ngOnInit(): Promise<void> {
    try {
      const url = new URL(window.location.href);
      this.patientContext.detectLaunchFromUrl(url);
      const authorizing = await this.smartLaunch.authorizeIfNeeded(url);
      if (authorizing) {
        this.status.set('Redirecting to EHR authorization…');
        return;
      }
      this.status.set('Completing SMART authorization…');
      await this.smartLaunch.completeLaunch();
      await this.router.navigateByUrl('/');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.status.set('SMART launch failed.');
      this.toasts.danger(message);
    }
  }
}
