// Author: Preston Lee

import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Interpretation } from './interpretation';

describe('Interpretation', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Interpretation],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(Interpretation);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render title and clinical guidance sections', () => {
    const fixture = TestBed.createComponent(Interpretation);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('#interpretation-title')?.textContent).toContain('Interpretation');
    expect(root.querySelector('#interpretation-intended-use')).toBeTruthy();
    expect(root.querySelector('#interpretation-population')).toBeTruthy();
    expect(root.querySelector('#interpretation-limitations')).toBeTruthy();
    expect(root.querySelector('#interpretation-reading-results')).toBeTruthy();

    const link = root.querySelector('#interpretation-calculator-link') as HTMLAnchorElement;
    expect(link?.getAttribute('routerLink') ?? link?.getAttribute('href')).toBeTruthy();
  });
});
