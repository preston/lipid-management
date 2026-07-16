// Author: Preston Lee

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Guideline } from './guideline';
import { RiskCalculatorSessionService } from '../../services/risk-calculator-session.service';
import { GuidelineEvaluationService } from '../../services/guideline-evaluation.service';
import { PatientContextService } from '../../services/patient-context.service';
import { ToastService } from '../../services/toast.service';
import type { GuidelineEvaluationView } from './guideline.model';
import { EMPTY_CLINICIAN_ANSWERS } from './guideline.model';
import { GUIDELINE_RECOMMENDATIONS } from './guideline-recommendations';
import { buildGuidelineMermaidDefinition } from './guideline.diagrams';

const renderMock = vi.fn(async (id: string) => ({
  svg: `<svg data-testid="mermaid-${id}" aria-hidden="true"><g class="node" id="flowchart-B3-0"></g></svg>`,
  bindFunctions: undefined,
}));

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: (...args: unknown[]) => renderMock(...(args as [string])),
  },
}));

function evaluationFixture(overrides: Partial<GuidelineEvaluationView> = {}): GuidelineEvaluationView {
  return {
    algorithmStatus: 'NeedsClinicalInput',
    algorithmPath: 'NeedsClinicalInput_LifeExpectancy',
    pathwayTitle: 'Clinical input needed',
    pathwaySummary: 'Need Box 3',
    guidelinePopulationStatus: 'InPopulation',
    effectiveAgeYears: 62,
    tenYearTotalCvdPercent: 8,
    latestLdlMgDl: 110,
    effectiveDiabetes: false,
    hasEstablishedCvd: false,
    hasHivInfection: false,
    effectiveOnLipidLoweringTherapy: false,
    veryHighRiskCvd: false,
    box8UsedNullPreventRisk: false,
    shouldDiscussCardiacRehabReferral: false,
    showComprehensiveLifestyleReminder: true,
    showReemphasizeLifestyleReminder: false,
    showBox15ReassessReminder: false,
    showBox20MonitoringReminder: false,
    activeBoxes: [1, 2, 3],
    unresolvedBoxes: [3],
    recommendations: GUIDELINE_RECOMMENDATIONS.map((meta) => ({
      ...meta,
      status: meta.id === 18 || meta.id === 19 ? 'Informational' : 'NotApplicable',
      tier: meta.id === 18 || meta.id === 19 ? 'informational' : 'does-not-apply',
    })),
    supportingFactors: [{ label: 'PREVENT model', value: 'base' }],
    ...overrides,
  };
}

describe('Guideline', () => {
  let fixture: ComponentFixture<Guideline>;
  let evaluateSubject: Subject<GuidelineEvaluationView>;

  beforeEach(async () => {
    evaluateSubject = new Subject();
    await TestBed.configureTestingModule({
      imports: [Guideline],
      providers: [
        provideRouter([]),
        {
          provide: PatientContextService,
          useValue: {
            selectedPatient: () => ({ id: 'pt-1', name: [{ given: ['Ada'], family: 'Lovelace' }] }),
          },
        },
        {
          provide: RiskCalculatorSessionService,
          useValue: {
            session: () => null,
            hasValidSessionForCurrentPatient: () => false,
            clearIfPatientMismatch: vi.fn(),
          },
        },
        {
          provide: GuidelineEvaluationService,
          useValue: {
            evaluate: vi.fn(() => evaluateSubject.asObservable()),
          },
        },
        {
          provide: ToastService,
          useValue: { show: vi.fn() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Guideline);
    fixture.detectChanges();
  });

  it('shows calculator gate without a valid session', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('#guideline-gate')).toBeTruthy();
    expect(el.querySelector('#guideline-go-calculator')).toBeTruthy();
    expect(el.querySelector('#guideline-session-summary')).toBeNull();
  });
});

describe('Guideline with session', () => {
  let fixture: ComponentFixture<Guideline>;
  const evaluate = vi.fn();

  beforeEach(async () => {
    evaluate.mockReset();
    evaluate.mockReturnValue(of(evaluationFixture()));
    renderMock.mockClear();
    await TestBed.configureTestingModule({
      imports: [Guideline],
      providers: [
        provideRouter([]),
        {
          provide: PatientContextService,
          useValue: {
            selectedPatient: () => ({ id: 'pt-1', name: [{ given: ['Ada'], family: 'Lovelace' }] }),
          },
        },
        {
          provide: RiskCalculatorSessionService,
          useValue: {
            session: () => ({
              patientId: 'pt-1',
              calculatedAt: '2026-07-16T12:00:00.000Z',
              calculatedWithExclusions: true,
              selectedPreventModel: 'base',
              rawResults: {},
              libraryParameters: {},
              display: {
                risk10yTotal: '8.0%',
                risk10yAscvd: '—',
                risk10yHf: '—',
                risk10yChd: '—',
                risk10yStroke: '—',
                openCvdRiskAge: '—',
                risk30yTotal: '—',
                risk30yAscvd: '—',
                risk30yHf: '—',
                risk30yChd: '—',
                risk30yStroke: '—',
                risk30yCvdPercentile: '—',
              },
              preventLifeExpectancyLimited: true,
              effectiveDiabetes: false,
              effectiveLdlMgDl: 110,
              tenYearTotalCvdPercent: 8,
            }),
            hasValidSessionForCurrentPatient: () => true,
            clearIfPatientMismatch: vi.fn(),
          },
        },
        {
          provide: GuidelineEvaluationService,
          useValue: { evaluate },
        },
        {
          provide: ToastService,
          useValue: { show: vi.fn() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Guideline);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('prefills life expectancy Yes from calculator PREVENT flag and evaluates', () => {
    const component = fixture.componentInstance;
    expect(component['answers']().lifeExpectancyLimitedUnder5Years).toBe('yes');
    expect(evaluate).toHaveBeenCalled();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('#guideline-session-summary')).toBeTruthy();
    expect(el.querySelector('#guideline-exclusion-honesty')).toBeTruthy();
    expect(el.querySelector('#guideline-pathway')).toBeTruthy();
    expect(el.querySelectorAll('[id^="guideline-rec-"]').length).toBeGreaterThan(0);
  });

  it('exposes diagram toolbar and focuses a path box', async () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('#guideline-diagram-download-svg')).toBeTruthy();
    expect(el.querySelector('#guideline-diagram-download-png')).toBeTruthy();
    expect(el.querySelector('#guideline-diagram-legend')).toBeTruthy();

    fixture.componentInstance.focusDiagramBox(3);
    fixture.detectChanges();
    expect(fixture.componentInstance['selectedDiagramBox']()).toBe(3);
    expect(el.querySelector('#guideline-diagram-selection')).toBeTruthy();
    expect(el.querySelector('#guideline-path-box-3-link')).toBeTruthy();
    expect(el.querySelector('#guideline-question-diagram-lifeExpectancyLimitedUnder5Years')).toBeTruthy();
  });

  it('re-evaluates when a clinician answer changes', () => {
    evaluate.mockClear();
    evaluate.mockReturnValue(of(evaluationFixture({ algorithmPath: 'Box13_14_NoMedicationRepeatRiskEvery5YearsUnlessNewRiskFactors' })));
    fixture.componentInstance.setAnswer('lifeExpectancyLimitedUnder5Years', 'no');
    fixture.detectChanges();
    expect(evaluate).toHaveBeenCalled();
  });

  it('suppresses deterministic treatment wording outside population', () => {
    evaluate.mockReturnValue(
      of(
        evaluationFixture({
          algorithmStatus: 'OutsidePopulation',
          algorithmPath: 'OutsideGuidelinePopulation',
          guidelinePopulationStatus: 'OutsidePopulation',
          showComprehensiveLifestyleReminder: true,
        }),
      ),
    );
    fixture = TestBed.createComponent(Guideline);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('#guideline-outside-population')).toBeTruthy();
    expect(el.querySelector('#guideline-action-box2')).toBeNull();
  });
});

describe('guideline diagrams builder', () => {
  it('includes all boxes and class assignments', () => {
    const def = buildGuidelineMermaidDefinition(
      evaluationFixture({
        activeBoxes: [1, 2, 3, 5, 8, 9],
        unresolvedBoxes: [12],
        algorithmStatus: 'Complete',
        algorithmPath: 'Box9_PrimaryAtLeastModerateStatinConsiderLipidSpecialistIfLdlGe190',
      }),
      EMPTY_CLINICIAN_ANSWERS,
    );
    expect(def).toContain('B21');
    expect(def).toContain('class B9 active');
    expect(def).toContain('class B12 unresolved');
    expect(def).toContain('class B16 idle');
  });
});

describe('recommendation catalog', () => {
  it('covers recommendations 1–24 with neither never as strong/weak for', () => {
    expect(GUIDELINE_RECOMMENDATIONS).toHaveLength(24);
    for (const rec of GUIDELINE_RECOMMENDATIONS) {
      if (rec.strength === 'Neither for nor against') {
        expect(['Informational', 'insufficient']).toBeTruthy();
      }
    }
    expect(GUIDELINE_RECOMMENDATIONS.find((r) => r.id === 17)?.strength).toBe('Neither for nor against');
    expect(GUIDELINE_RECOMMENDATIONS.find((r) => r.id === 2)?.displayNote).toMatch(/Box 14/);
    expect(GUIDELINE_RECOMMENDATIONS.find((r) => r.id === 15)?.displayNote).toMatch(/Box 15/);
    expect(GUIDELINE_RECOMMENDATIONS.find((r) => r.id === 7)?.relatedBoxIds).toEqual([8, 9]);
  });
});
