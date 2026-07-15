// Author: Preston Lee

import { TestBed } from '@angular/core/testing';
import { About } from './about';

const renderMock = vi.fn(async (id: string) => ({
  svg: `<svg data-testid="mermaid-${id}" aria-hidden="true"></svg>`,
  bindFunctions: undefined,
}));

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: (...args: unknown[]) => renderMock(...(args as [string])),
  },
}));

describe('About', () => {
  beforeEach(async () => {
    renderMock.mockClear();
    await TestBed.configureTestingModule({
      imports: [About],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(About);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render title and project links', () => {
    const fixture = TestBed.createComponent(About);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('#about-title')?.textContent).toContain('About');

    const github = root.querySelector('#about-link-github') as HTMLAnchorElement;
    expect(github?.getAttribute('href')).toBe('https://github.com/preston/lipid-management');

    const docker = root.querySelector('#about-link-docker') as HTMLAnchorElement;
    expect(docker?.getAttribute('href')).toBe('https://hub.docker.com/r/p3000/lipid-management');
  });

  it('should render architecture landmarks and Mermaid hosts', async () => {
    const fixture = TestBed.createComponent(About);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('#about-architecture')).toBeTruthy();
    expect(root.querySelector('#about-arch-overview')).toBeTruthy();
    expect(root.querySelector('#about-arch-standalone')).toBeTruthy();
    expect(root.querySelector('#about-arch-smart')).toBeTruthy();
    expect(root.querySelector('#about-arch-cql-packaging')).toBeTruthy();

    expect(root.querySelector('#about-arch-overview-diagram')).toBeTruthy();
    expect(root.querySelector('#about-arch-standalone-diagram')).toBeTruthy();
    expect(root.querySelector('#about-arch-smart-diagram')).toBeTruthy();
    expect(root.querySelector('#about-arch-cql-packaging-diagram')).toBeTruthy();

    await vi.waitFor(() => {
      expect(root.getAttribute('data-about-diagrams-rendered')).toBe('true');
    });

    expect(renderMock).toHaveBeenCalledTimes(4);
    expect(root.querySelector('#about-arch-overview-diagram svg')).toBeTruthy();
  });
});
