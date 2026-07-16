// Author: Preston Lee

import { TestBed } from '@angular/core/testing';
import { Architecture } from './architecture';

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

describe('Architecture', () => {
  beforeEach(async () => {
    renderMock.mockClear();
    await TestBed.configureTestingModule({
      imports: [Architecture],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(Architecture);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render title and project links', () => {
    const fixture = TestBed.createComponent(Architecture);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('#architecture-title')?.textContent).toContain('Architecture');

    const github = root.querySelector('#architecture-link-github') as HTMLAnchorElement;
    expect(github?.getAttribute('href')).toBe('https://github.com/preston/lipid-management');

    const docker = root.querySelector('#architecture-link-docker') as HTMLAnchorElement;
    expect(docker?.getAttribute('href')).toBe('https://hub.docker.com/r/p3000/lipid-management');
  });

  it('should render architecture landmarks and Mermaid hosts', async () => {
    const fixture = TestBed.createComponent(Architecture);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('#architecture-how-it-works')).toBeTruthy();
    expect(root.querySelector('#architecture-overview')).toBeTruthy();
    expect(root.querySelector('#architecture-standalone')).toBeTruthy();
    expect(root.querySelector('#architecture-smart')).toBeTruthy();
    expect(root.querySelector('#architecture-cql-packaging')).toBeTruthy();
    expect(root.querySelector('#architecture-cql-packaging-notes')?.textContent).toContain(
      'SDI-2019',
    );
    expect(root.querySelector('#architecture-opencvd-risk-body')?.textContent).toContain(
      'ZCTA',
    );

    expect(root.querySelector('#architecture-overview-diagram')).toBeTruthy();
    expect(root.querySelector('#architecture-standalone-diagram')).toBeTruthy();
    expect(root.querySelector('#architecture-smart-diagram')).toBeTruthy();
    expect(root.querySelector('#architecture-cql-packaging-diagram')).toBeTruthy();

    await vi.waitFor(() => {
      expect(root.getAttribute('data-architecture-diagrams-rendered')).toBe('true');
    });

    expect(renderMock).toHaveBeenCalledTimes(4);
    expect(root.querySelector('#architecture-overview-diagram svg')).toBeTruthy();
  });
});
