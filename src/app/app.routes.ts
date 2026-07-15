// Author: Preston Lee

import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/open-cvd-risk-calculator/open-cvd-risk-calculator').then(
        (m) => m.OpenCVDRiskCalculator,
      ),
  },
  { path: '**', redirectTo: '' },
];
