// Author: Preston Lee

import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { isHttpOfflineOrServerError, ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('enqueues a toast', () => {
    const id = service.success('Saved');
    expect(id).toBeTruthy();
    expect(service.toasts()).toHaveLength(1);
    expect(service.toasts()[0].message).toBe('Saved');
    expect(service.toasts()[0].variant).toBe('success');
  });

  it('dismisses a toast', () => {
    const id = service.danger('Boom')!;
    service.dismiss(id);
    expect(service.toasts()).toHaveLength(0);
  });

  it('suppresses duplicates while a matching dedupeKey is open', () => {
    expect(service.danger('Offline', { dedupeKey: 'http-offline' })).toBeTruthy();
    expect(service.danger('Offline again', { dedupeKey: 'http-offline' })).toBeNull();
    expect(service.toasts()).toHaveLength(1);
  });

  it('autohides after the delay', () => {
    service.info('Temp', { delay: 1000 });
    expect(service.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(service.toasts()).toHaveLength(0);
  });

  it('does not autohide when disabled', () => {
    service.warning('Sticky', { autohide: false });
    vi.advanceTimersByTime(60_000);
    expect(service.toasts()).toHaveLength(1);
  });
});

describe('isHttpOfflineOrServerError', () => {
  it('detects status 0 and 5xx', () => {
    expect(isHttpOfflineOrServerError(new HttpErrorResponse({ status: 0 }))).toBe(true);
    expect(isHttpOfflineOrServerError(new HttpErrorResponse({ status: 503 }))).toBe(true);
    expect(isHttpOfflineOrServerError(new HttpErrorResponse({ status: 404 }))).toBe(false);
    expect(isHttpOfflineOrServerError(new Error('nope'))).toBe(false);
  });
});
