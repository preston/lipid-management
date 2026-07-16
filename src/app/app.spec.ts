// Author: Preston Lee

import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render navbar title', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('#app-navbar-title')?.textContent).toContain('Lipid Management');
  });

  it('should render nav links for calculator, documentation, and settings', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('#app-nav-calculator')?.textContent).toContain(
      'OpenCVDRisk Calculator',
    );
    expect(compiled.querySelector('#app-nav-documentation')?.textContent).toContain('Documentation');
    expect(compiled.querySelector('#app-nav-architecture')?.textContent).toContain('Architecture');
    expect(compiled.querySelector('#app-nav-interpretation')?.textContent).toContain(
      'Interpretation',
    );
    expect(compiled.querySelector('#app-nav-settings')?.textContent).toContain('Settings');
  });
});
