// Author: Preston Lee

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SettingsService } from '../../services/settings.service';

export const loaderGuard: CanActivateFn = () => {
  const enabled = inject(SettingsService).settings().developer;
  if (enabled) {
    return true;
  }
  return inject(Router).createUrlTree(['/']);
};
