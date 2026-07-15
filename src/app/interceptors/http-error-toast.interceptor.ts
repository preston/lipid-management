// Author: Preston Lee

import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast.service';

export const httpErrorToastInterceptor: HttpInterceptorFn = (req, next) => {
  const toasts = inject(ToastService);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        if (err.status === 0) {
          toasts.danger('Unable to reach the server. Check your connection or server URL.', {
            dedupeKey: 'http-offline',
          });
        } else if (err.status >= 500) {
          toasts.danger('The server returned an error. Try again later.', {
            dedupeKey: 'http-5xx',
          });
        }
      }
      return throwError(() => err);
    }),
  );
};
