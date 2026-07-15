// Author: Preston Lee

import { Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription, timer } from 'rxjs';

export type ToastVariant = 'success' | 'danger' | 'warning' | 'info';

export interface ToastOptions {
  delay?: number;
  autohide?: boolean;
  dedupeKey?: string;
}

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  dedupeKey?: string;
}

const DEFAULT_DELAY_MS: Record<ToastVariant, number> = {
  success: 5000,
  info: 5000,
  warning: 8000,
  danger: 10000,
};

export function isHttpOfflineOrServerError(err: unknown): boolean {
  if (!(err instanceof HttpErrorResponse)) {
    return false;
  }
  return err.status === 0 || err.status >= 500;
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  private nextId = 1;
  private readonly autohideSubs = new Map<string, Subscription>();

  show(message: string, variant: ToastVariant, options: ToastOptions = {}): string | null {
    const dedupeKey = options.dedupeKey;
    if (dedupeKey && this._toasts().some((t) => t.dedupeKey === dedupeKey)) {
      return null;
    }

    const id = `toast-${this.nextId++}`;
    const toast: Toast = { id, message, variant, dedupeKey };
    this._toasts.update((list) => [...list, toast]);

    const autohide = options.autohide ?? true;
    if (autohide) {
      const delay = options.delay ?? DEFAULT_DELAY_MS[variant];
      const sub = timer(delay).subscribe(() => this.dismiss(id));
      this.autohideSubs.set(id, sub);
    }

    return id;
  }

  success(message: string, options?: ToastOptions): string | null {
    return this.show(message, 'success', options);
  }

  danger(message: string, options?: ToastOptions): string | null {
    return this.show(message, 'danger', options);
  }

  warning(message: string, options?: ToastOptions): string | null {
    return this.show(message, 'warning', options);
  }

  info(message: string, options?: ToastOptions): string | null {
    return this.show(message, 'info', options);
  }

  dismiss(id: string): void {
    const sub = this.autohideSubs.get(id);
    if (sub) {
      sub.unsubscribe();
      this.autohideSubs.delete(id);
    }
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
