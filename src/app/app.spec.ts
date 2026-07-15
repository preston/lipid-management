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

  it('should render nav links for calculator, resources, about, and settings', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('#app-nav-calculator')?.textContent).toContain(
      'OpenCVDRisk Calculator',
    );
    expect(compiled.querySelector('#app-nav-resources')?.textContent).toContain('Resources');
    expect(compiled.querySelector('#app-nav-about')?.textContent).toContain('About');
    expect(compiled.querySelector('#app-nav-settings')?.textContent).toContain('Settings');
  });
});
