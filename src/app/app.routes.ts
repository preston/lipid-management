// Author: Preston Lee

import { Routes } from '@angular/router';
import { loaderGuard } from './features/loader/loader.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/open-cvd-risk-calculator/open-cvd-risk-calculator').then(
        (m) => m.OpenCVDRiskCalculator,
      ),
  },
  {
    path: 'interpretation',
    loadComponent: () =>
      import('./features/interpretation/interpretation').then((m) => m.Interpretation),
  },
  {
    path: 'architecture',
    loadComponent: () =>
      import('./features/architecture/architecture').then((m) => m.Architecture),
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings').then((m) => m.Settings),
  },
  {
    path: 'loader',
    canActivate: [loaderGuard],
    loadComponent: () => import('./features/loader/loader').then((m) => m.Loader),
  },
  {
    path: 'launch',
    loadComponent: () =>
      import('./features/smart-launch/smart-launch').then((m) => m.SmartLaunch),
  },
  { path: '**', redirectTo: '' },
];
