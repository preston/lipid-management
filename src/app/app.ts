// Author: Preston Lee

import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ToastHost } from './components/toast-host/toast-host';
import { SettingsService } from './services/settings.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastHost],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  host: {
    class: 'd-block bg-body text-body min-vh-100',
  },
})
export class App {
  protected readonly settingsService = inject(SettingsService);
}
