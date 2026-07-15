// Author: Preston Lee

import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { loaderGuard } from './loader.guard';
import { SettingsService } from '../../services/settings.service';
import { Settings } from '../../models/settings.model';

describe('loaderGuard', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '', children: [] }])],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('allows activation when developer mode is on', () => {
    const settings = TestBed.inject(SettingsService);
    settings.settings.set(Object.assign(new Settings(), { developer: true }));
    const result = TestBed.runInInjectionContext(() => loaderGuard({} as never, {} as never));
    expect(result).toBe(true);
  });

  it('redirects home when developer mode is off', () => {
    const settings = TestBed.inject(SettingsService);
    settings.settings.set(Object.assign(new Settings(), { developer: false }));
    const result = TestBed.runInInjectionContext(() => loaderGuard({} as never, {} as never));
    const tree = TestBed.inject(Router).createUrlTree(['/']);
    expect(result).toEqual(tree);
  });
});
