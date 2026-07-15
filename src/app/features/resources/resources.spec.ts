// Author: Preston Lee

import { TestBed } from '@angular/core/testing';
import { Resources } from './resources';

describe('Resources', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Resources],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(Resources);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render title and CQL download links', () => {
    const fixture = TestBed.createComponent(Resources);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('#resources-title')?.textContent).toContain('Resources');

    const openCvd = root.querySelector('#resources-download-opencvd-risk') as HTMLAnchorElement;
    expect(openCvd?.getAttribute('href')).toBe('/cql/OpenCVDRisk.cql');

    const lipid = root.querySelector('#resources-download-lipid-management') as HTMLAnchorElement;
    expect(lipid?.getAttribute('href')).toBe('/cql/LipidManagement.cql');

    const bmi = root.querySelector('#resources-download-bmi') as HTMLAnchorElement;
    expect(bmi?.getAttribute('href')).toBe('/cql/BMI.cql');
  });
});
