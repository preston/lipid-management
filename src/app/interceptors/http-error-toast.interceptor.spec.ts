// Author: Preston Lee

import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { httpErrorToastInterceptor } from './http-error-toast.interceptor';
import { ToastService } from '../services/toast.service';

describe('httpErrorToastInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let toasts: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([httpErrorToastInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    toasts = TestBed.inject(ToastService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('toasts on status 0 and rethrows', () => {
    let caught: unknown;
    http.get('/api').subscribe({
      error: (err) => {
        caught = err;
      },
    });
    httpMock.expectOne('/api').error(new ProgressEvent('error'));
    expect(caught).toBeTruthy();
    expect(toasts.toasts()).toHaveLength(1);
    expect(toasts.toasts()[0].dedupeKey).toBe('http-offline');
  });

  it('toasts on 5xx and rethrows', () => {
    let caught: unknown;
    http.get('/api').subscribe({
      error: (err) => {
        caught = err;
      },
    });
    httpMock.expectOne('/api').flush('fail', { status: 500, statusText: 'Server Error' });
    expect(caught).toBeTruthy();
    expect(toasts.toasts()).toHaveLength(1);
    expect(toasts.toasts()[0].dedupeKey).toBe('http-5xx');
  });

  it('does not toast on 404', () => {
    let caught: unknown;
    http.get('/api').subscribe({
      error: (err) => {
        caught = err;
      },
    });
    httpMock.expectOne('/api').flush('missing', { status: 404, statusText: 'Not Found' });
    expect(caught).toBeTruthy();
    expect(toasts.toasts()).toHaveLength(0);
  });

  it('dedupes offline toasts across concurrent failures', () => {
    http.get('/a').subscribe({ error: () => undefined });
    http.get('/b').subscribe({ error: () => undefined });
    httpMock.expectOne('/a').error(new ProgressEvent('error'));
    httpMock.expectOne('/b').error(new ProgressEvent('error'));
    expect(toasts.toasts()).toHaveLength(1);
  });
});
