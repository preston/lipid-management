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
import { EMPTY_CLINICIAN_ANSWERS, EMPTY_CHART_EVIDENCE } from './guideline.model';
import { questionAffectsDiagram } from './guideline-boxes';
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

function evaluationFixture(
  overrides: Partial<GuidelineEvaluationView> = {},
): GuidelineEvaluationView {
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
    primaryPreventionStatinIndicationBox8: false,
    primaryPreventionBorderlineRiskBand: true,
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
    chartEvidence: EMPTY_CHART_EVIDENCE,
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
    expect(component['answers']().establishedCvd).toBe('no');
    expect(component['answers']().hivInfection).toBe('no');
    expect(component['answers']().primaryPreventionStatinIndication).toBe('no');
    expect(component['answers']().borderlineRiskBand).toBe('yes');
    expect(evaluate).toHaveBeenCalled();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('#guideline-session-summary')).toBeTruthy();
    expect(el.querySelector('#guideline-patient-name')?.textContent).toContain('Ada Lovelace');
    expect(
      el
        .querySelector('#guideline-title')
        ?.closest('header')
        ?.querySelector('#guideline-session-summary'),
    ).toBeTruthy();
    expect(el.querySelector('#guideline-exclusion-honesty')).toBeTruthy();
    expect(el.querySelector('#guideline-pathway')).toBeNull();
    expect(el.querySelector('#guideline-intro')).toBeNull();
    expect(el.querySelector('#guideline-applicability')).toBeNull();
    expect(el.querySelector('#guideline-questions-heading')?.textContent?.trim()).toBe(
      'Visualization Questions',
    );
    expect(el.querySelector('#guideline-detail-questions-heading')?.textContent?.trim()).toBe(
      'Recommendation questions',
    );
    expect(el.querySelector('#guideline-questions-confirm-heading')).toBeNull();
    expect(el.querySelector('#guideline-path-questions')).toBeNull();
    expect(el.querySelector('#guideline-questions-additional-heading')).toBeNull();
    expect(
      el.querySelector('#guideline-questions-list #guideline-question-lifeExpectancyLimitedUnder5Years'),
    ).toBeTruthy();
    expect(
      el.querySelector('#guideline-questions-list #guideline-question-establishedCvd'),
    ).toBeTruthy();
    expect(
      el.querySelector('#guideline-questions-list #guideline-question-veryHighRiskCvd'),
    ).toBeTruthy();
    expect(
      el.querySelector(
        '#guideline-questions-list #guideline-question-primaryPreventionStatinIndication',
      ),
    ).toBeTruthy();
    expect(
      el.querySelector('#guideline-questions-list #guideline-question-borderlineRiskBand'),
    ).toBeTruthy();
    expect(
      el.querySelector('#guideline-questions-list #guideline-question-hivInfection'),
    ).toBeTruthy();
    expect(
      el.querySelector('#guideline-questions-list #guideline-question-onLipidLoweringTherapy'),
    ).toBeTruthy();
    expect(
      el.querySelector('#guideline-questions-list #guideline-question-clinicalRiskLow'),
    ).toBeNull();
    expect(
      el.querySelector('#guideline-detail-questions-list #guideline-question-clinicalRiskLow'),
    ).toBeTruthy();
    expect(
      el.querySelector(
        '#guideline-detail-questions-list #guideline-question-recentMiAcsOrCabgPciWithin6Weeks',
      ),
    ).toBeTruthy();
    const catalogCount = Object.keys(EMPTY_CLINICIAN_ANSWERS).length;
    expect(
      el.querySelectorAll('#guideline-questions-list .guideline-question').length +
        el.querySelectorAll('#guideline-detail-questions-list .guideline-question').length,
    ).toBe(catalogCount);
    expect(el.querySelector('#guideline-summary-recs')).toBeNull();
    expect(el.querySelector('#guideline-algorithm')).toBeTruthy();
    expect(el.querySelector('#guideline-evidence')).toBeTruthy();
    expect(el.querySelector('#guideline-sidebars-table')).toBeTruthy();
    expect(el.querySelector('#guideline-references-row #guideline-evidence')).toBeTruthy();
    expect(el.querySelector('#guideline-references-row #guideline-sidebars')).toBeTruthy();
    expect(el.querySelector('#guideline-sidebars-accordion')).toBeNull();
    expect(el.querySelector('#guideline-sidebar-1')).toBeTruthy();
    expect(el.querySelector('#guideline-sidebar-1')?.textContent).toMatch(/Lifestyle Medicine/i);
    expect(el.querySelector('#guideline-sidebar-6')?.textContent).toMatch(/Statin Intolerance/i);
    expect(el.querySelector('#guideline-appendix-i')).toBeTruthy();
    expect(el.querySelectorAll('[id^="guideline-rec-"]').length).toBeGreaterThan(0);

    const workspace = el.querySelector('#guideline-workspace');
    const questions = el.querySelector('#guideline-questions');
    const algorithm = el.querySelector('#guideline-algorithm');
    const recs = el.querySelector('#guideline-recommendations');
    const recRow = el.querySelector('#guideline-recommendations-row');
    const detailQuestions = el.querySelector('#guideline-detail-questions');
    expect(workspace && questions && algorithm && recs && recRow && detailQuestions).toBeTruthy();
    expect(el.querySelector('#guideline-questions-col.col-lg-4')).toBeTruthy();
    expect(el.querySelector('#guideline-algorithm-col.col-lg-8')).toBeTruthy();
    expect(el.querySelector('#guideline-detail-questions-col.col-lg-4')).toBeTruthy();
    expect(el.querySelector('#guideline-recommendations-col.col-lg-8')).toBeTruthy();
    expect(workspace!.contains(questions!)).toBe(true);
    expect(workspace!.contains(algorithm!)).toBe(true);
    expect(recRow!.contains(detailQuestions!)).toBe(true);
    expect(recRow!.contains(recs!)).toBe(true);
    expect(
      questions!.compareDocumentPosition(algorithm!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      detailQuestions!.compareDocumentPosition(recs!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      workspace!.compareDocumentPosition(recRow!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('shows a brief chart or session blurb on questions pre-set from data', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('#guideline-question-evidence-lifeExpectancyLimitedUnder5Years')?.textContent).toMatch(
      /PREVENT <1 y \(2026-07-16\)/,
    );
    expect(el.querySelector('#guideline-question-evidence-establishedCvd')?.textContent?.trim()).toBe(
      'No ASCVD or CABG/PCI on file',
    );
    expect(el.querySelector('#guideline-question-evidence-hivInfection')?.textContent?.trim()).toBe(
      'No active HIV on file',
    );
    expect(
      el.querySelector('#guideline-question-evidence-primaryPreventionStatinIndication')?.textContent,
    ).toMatch(/no DM · LDL-C 110 mg\/dL · 10y 8\.0% \(2026-07-16\)/);
    expect(el.querySelector('#guideline-question-evidence-borderlineRiskBand')?.textContent?.trim()).toBe(
      '10y 8.0% (2026-07-16)',
    );
    expect(el.querySelector('#guideline-question-evidence-escalationNeeded')).toBeNull();
    expect(el.querySelector('#guideline-question-evidence-borderlineRiskPatientDesiresStatin')).toBeNull();
  });

  it('places decision-tree questions in Visualization Questions and all others in Recommendation questions', () => {
    const el: HTMLElement = fixture.nativeElement;
    const allIds = Object.keys(EMPTY_CLINICIAN_ANSWERS) as (keyof typeof EMPTY_CLINICIAN_ANSWERS)[];
    for (const id of allIds) {
      const inDiagram = el.querySelector(`#guideline-questions-list #guideline-question-${id}`);
      const inRec = el.querySelector(`#guideline-detail-questions-list #guideline-question-${id}`);
      if (questionAffectsDiagram(id)) {
        expect(inDiagram, `${id} should be in Visualization Questions`).toBeTruthy();
        expect(inRec, `${id} should not be in Recommendation questions`).toBeNull();
      } else {
        expect(inDiagram, `${id} should not be in Visualization Questions`).toBeNull();
        expect(inRec, `${id} should be in Recommendation questions`).toBeTruthy();
      }
    }
    expect(el.querySelectorAll('#guideline-questions-list .guideline-question').length).toBe(
      allIds.filter((id) => questionAffectsDiagram(id)).length,
    );
    expect(el.querySelectorAll('#guideline-detail-questions-list .guideline-question').length).toBe(
      allIds.filter((id) => !questionAffectsDiagram(id)).length,
    );
  });

  it('shows CQL-dated chart findings on pre-set answers', async () => {
    evaluate.mockReturnValue(
      of(
        evaluationFixture({
          hasEstablishedCvd: true,
          hasHivInfection: true,
          effectiveOnLipidLoweringTherapy: true,
          chartEvidence: {
            ...EMPTY_CHART_EVIDENCE,
            establishedCvd: 'ASCVD (2023-04-12)',
            hivInfection: 'Active HIV (2021-08-01)',
            latestLdlDate: '2024-01-03',
            lipidLoweringTherapy: 'Statin Rx (2025-11-02)',
          },
        }),
      ),
    );
    fixture = TestBed.createComponent(Guideline);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('#guideline-question-evidence-establishedCvd')?.textContent?.trim()).toBe(
      'ASCVD (2023-04-12)',
    );
    expect(el.querySelector('#guideline-question-evidence-hivInfection')?.textContent?.trim()).toBe(
      'Active HIV (2021-08-01)',
    );
    expect(el.querySelector('#guideline-question-evidence-onLipidLoweringTherapy')?.textContent?.trim()).toBe(
      'Statin Rx (2025-11-02)',
    );
    expect(
      el.querySelector('#guideline-question-evidence-primaryPreventionStatinIndication')?.textContent,
    ).toMatch(/LDL-C 110 mg\/dL \(2024-01-03\)/);
    expect(fixture.componentInstance['answers']().onLipidLoweringTherapy).toBe('yes');
    expect(fixture.componentInstance['answers']().establishedCvd).toBe('yes');
  });

  it('exposes diagram toolbar and focuses a path box', async () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('#guideline-diagram-view-full')).toBeTruthy();
    expect(el.querySelector('#guideline-diagram-view-path')).toBeTruthy();
    expect(el.querySelector('#guideline-diagram-download-svg')).toBeTruthy();
    expect(el.querySelector('#guideline-diagram-legend')).toBeTruthy();

    fixture.componentInstance.focusDiagramBox(3);
    fixture.detectChanges();
    expect(fixture.componentInstance['selectedDiagramBox']()).toBe(3);
    expect(el.querySelector('#guideline-diagram-selection')).toBeTruthy();
    expect(
      el.querySelector('#guideline-diagram-selection-question-lifeExpectancyLimitedUnder5Years'),
    ).toBeTruthy();
    expect(
      el.querySelector('#guideline-question-diagram-lifeExpectancyLimitedUnder5Years'),
    ).toBeNull();
    expect(
      el.querySelector(
        '#guideline-questions-list #guideline-question-lifeExpectancyLimitedUnder5Years',
      ),
    ).toBeTruthy();
  });

  it('re-evaluates when a clinician answer changes', () => {
    evaluate.mockClear();
    evaluate.mockReturnValue(
      of(
        evaluationFixture({
          algorithmPath: 'Box13_14_NoMedicationRepeatRiskEvery5YearsUnlessNewRiskFactors',
        }),
      ),
    );
    fixture.componentInstance.setAnswer('lifeExpectancyLimitedUnder5Years', 'no');
    fixture.detectChanges();
    expect(evaluate).toHaveBeenCalled();
  });

  it('lets the clinician override chart-determined Box 5 Existing CVD', () => {
    evaluate.mockClear();
    evaluate.mockReturnValue(of(evaluationFixture({ hasEstablishedCvd: true })));
    fixture.componentInstance.setAnswer('establishedCvd', 'yes');
    fixture.detectChanges();
    expect(evaluate).toHaveBeenCalled();
    const passed = evaluate.mock.calls.at(-1)?.[1] as { establishedCvd: string };
    expect(passed.establishedCvd).toBe('yes');
    const el: HTMLElement = fixture.nativeElement;
    expect(
      el.querySelector('#guideline-answer-establishedCvd-yes') as HTMLInputElement,
    ).toBeTruthy();
  });

  it('lets the clinician override Box 8 DM/LDL/risk composite', () => {
    evaluate.mockClear();
    evaluate.mockReturnValue(
      of(evaluationFixture({ primaryPreventionStatinIndicationBox8: true })),
    );
    fixture.componentInstance.setAnswer('primaryPreventionStatinIndication', 'yes');
    fixture.detectChanges();
    expect(evaluate).toHaveBeenCalled();
    const passed = evaluate.mock.calls.at(-1)?.[1] as {
      primaryPreventionStatinIndication: string;
    };
    expect(passed.primaryPreventionStatinIndication).toBe('yes');
  });

  it('keeps the algorithm visible outside the CPG population', () => {
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
    expect(el.querySelector('#guideline-pathway')).toBeNull();
    expect(el.querySelector('#guideline-outside-population')).toBeNull();
    expect(el.querySelector('#guideline-algorithm')).toBeTruthy();
  });

  it('shows every clinician question before CQL evaluation returns', async () => {
    const pending = new Subject<GuidelineEvaluationView>();
    evaluate.mockReturnValue(pending.asObservable());
    fixture = TestBed.createComponent(Guideline);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('#guideline-questions-pending')).toBeNull();
    expect(
      el.querySelectorAll('#guideline-questions-list .guideline-question').length +
        el.querySelectorAll('#guideline-detail-questions-list .guideline-question').length,
    ).toBe(Object.keys(EMPTY_CLINICIAN_ANSWERS).length);
    expect(el.querySelector('#guideline-detail-questions')).toBeTruthy();
    expect(el.querySelector('#guideline-recommendations')).toBeNull();
    pending.complete();
  });

  it('keeps Box 7 Sidebar 4 questions in Visualization Questions', async () => {
    evaluate.mockReturnValue(
      of(
        evaluationFixture({
          algorithmStatus: 'NeedsClinicalInput',
          algorithmPath: 'NeedsClinicalInput_VeryHighRisk',
          unresolvedBoxes: [7],
          activeBoxes: [1, 2, 3, 5, 6, 7],
        }),
      ),
    );
    fixture = TestBed.createComponent(Guideline);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('#guideline-algorithm')).toBeTruthy();
    expect(el.querySelector('#guideline-algorithm-diagram')).toBeTruthy();
    expect(
      el.querySelector('#guideline-questions-list #guideline-question-onLipidLoweringTherapy'),
    ).toBeTruthy();
    expect(
      el.querySelector(
        '#guideline-questions-list #guideline-question-veryHighRiskRecentAcsOrMiOnTherapy',
      ),
    ).toBeTruthy();
    expect(
      el.querySelector('#guideline-detail-questions-list #guideline-question-onLipidLoweringTherapy'),
    ).toBeNull();
    expect(el.querySelector('#guideline-path-questions')).toBeNull();
    expect(
      el.querySelectorAll('#guideline-questions-list .guideline-question').length +
        el.querySelectorAll('#guideline-detail-questions-list .guideline-question').length,
    ).toBe(Object.keys(EMPTY_CLINICIAN_ANSWERS).length);
  });

  it('lists applies-now recs in Recommendations 1–24 and highlights mapped table rows', async () => {
    evaluate.mockReturnValue(
      of(
        evaluationFixture({
          unresolvedBoxes: [],
          recommendations: GUIDELINE_RECOMMENDATIONS.map((meta) => ({
            ...meta,
            status: meta.id === 7 ? ('Applicable' as const) : ('NotApplicable' as const),
            tier: meta.id === 7 ? ('applies-now' as const) : ('does-not-apply' as const),
          })),
        }),
      ),
    );
    fixture = TestBed.createComponent(Guideline);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('#guideline-summary-recs')).toBeNull();
    expect(el.querySelector('#guideline-rec-filters')).toBeTruthy();
    expect(el.querySelector('#guideline-rec-group-applies-now')).toBeTruthy();
    expect(el.querySelector('#guideline-rec-7')).toBeTruthy();
    expect(el.querySelector('#guideline-rec-group-does-not-apply')).toBeNull();
    expect(el.querySelector('#guideline-questions')).toBeTruthy();
    expect(el.querySelector('#guideline-questions-confirm-heading')).toBeNull();
    expect(el.querySelector('#guideline-path-questions')).toBeNull();
    expect(el.querySelector('#guideline-questions-additional-heading')).toBeNull();
    expect(
      el.querySelector('#guideline-questions-list #guideline-question-lifeExpectancyLimitedUnder5Years'),
    ).toBeTruthy();
    expect(
      el.querySelector('#guideline-questions-list #guideline-question-escalationNeeded'),
    ).toBeTruthy();
    expect(
      el.querySelector('#guideline-detail-questions-list #guideline-question-escalationNeeded'),
    ).toBeNull();
    expect(
      el.querySelector('#guideline-detail-questions-list #guideline-question-statinIntoleranceAttested'),
    ).toBeTruthy();
    expect(
      el.querySelectorAll('#guideline-questions-list .guideline-question').length +
        el.querySelectorAll('#guideline-detail-questions-list .guideline-question').length,
    ).toBe(Object.keys(EMPTY_CLINICIAN_ANSWERS).length);

    fixture.componentInstance.focusDiagramBox(9);
    fixture.detectChanges();
    expect(el.querySelector('#guideline-rec-7')?.classList.contains('table-active')).toBe(true);
  });

  it('shows only applicable recommendation rows until other status filters are enabled', async () => {
    evaluate.mockReturnValue(
      of(
        evaluationFixture({
          unresolvedBoxes: [],
          recommendations: GUIDELINE_RECOMMENDATIONS.map((meta) => ({
            ...meta,
            status:
              meta.id === 7
                ? ('Applicable' as const)
                : meta.id === 8
                  ? ('NeedsClinicalInput' as const)
                  : meta.id === 18
                    ? ('Informational' as const)
                    : ('NotApplicable' as const),
            tier:
              meta.id === 7
                ? ('applies-now' as const)
                : meta.id === 8
                  ? ('discuss' as const)
                  : meta.id === 18
                    ? ('informational' as const)
                    : ('does-not-apply' as const),
          })),
        }),
      ),
    );
    fixture = TestBed.createComponent(Guideline);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const applicable = el.querySelector('#guideline-rec-filter-applicable') as HTMLInputElement;
    const needsInput = el.querySelector(
      '#guideline-rec-filter-needs-clinical-input',
    ) as HTMLInputElement;
    const informational = el.querySelector(
      '#guideline-rec-filter-informational',
    ) as HTMLInputElement;
    const notApplicable = el.querySelector(
      '#guideline-rec-filter-not-applicable',
    ) as HTMLInputElement;

    expect(applicable?.checked).toBe(true);
    expect(needsInput?.checked).toBe(false);
    expect(informational?.checked).toBe(false);
    expect(notApplicable?.checked).toBe(false);
    expect(el.querySelector('#guideline-rec-7')).toBeTruthy();
    expect(el.querySelector('#guideline-rec-8')).toBeNull();
    expect(el.querySelector('#guideline-rec-18')).toBeNull();
    expect(el.querySelector('#guideline-rec-group-does-not-apply')).toBeNull();

    fixture.componentInstance.setRecommendationFilter('discuss', true);
    fixture.componentInstance.setRecommendationFilter('informational', true);
    fixture.componentInstance.setRecommendationFilter('does-not-apply', true);
    fixture.detectChanges();
    expect(el.querySelector('#guideline-rec-8')).toBeTruthy();
    expect(el.querySelector('#guideline-rec-18')).toBeTruthy();
    expect(el.querySelector('#guideline-rec-group-does-not-apply')).toBeTruthy();

    fixture.componentInstance.setRecommendationFilter('applies-now', false);
    fixture.detectChanges();
    expect(el.querySelector('#guideline-rec-7')).toBeNull();
  });

  it('switches to patient-path view and clears an off-path selection', async () => {
    const el: HTMLElement = fixture.nativeElement;
    fixture.componentInstance.focusDiagramBox(16);
    fixture.detectChanges();
    expect(fixture.componentInstance['selectedDiagramBox']()).toBe(16);

    fixture.componentInstance.setDiagramViewMode('path');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance['diagramViewMode']()).toBe('path');
    expect(fixture.componentInstance['selectedDiagramBox']()).toBeNull();
    expect(el.querySelector('#guideline-diagram-view-path')).toBeTruthy();
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
    expect(def).toContain('linkStyle');
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
    expect(GUIDELINE_RECOMMENDATIONS.find((r) => r.id === 17)?.strength).toBe(
      'Neither for nor against',
    );
    expect(GUIDELINE_RECOMMENDATIONS.find((r) => r.id === 2)?.displayNote).toMatch(/Box 14/);
    expect(GUIDELINE_RECOMMENDATIONS.find((r) => r.id === 15)?.displayNote).toMatch(/Box 15/);
    expect(GUIDELINE_RECOMMENDATIONS.find((r) => r.id === 7)?.relatedBoxIds).toEqual([8, 9]);
    expect(
      GUIDELINE_RECOMMENDATIONS.filter((r) => r.strength === 'Strong for').map((r) => r.id),
    ).toEqual([7, 24]);
  });
});
