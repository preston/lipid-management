// Author: Preston Lee

import {
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription, switchMap, of, catchError } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { PatientContextService } from '../../services/patient-context.service';
import { RiskCalculatorSessionService } from '../../services/risk-calculator-session.service';
import { GuidelineEvaluationService } from '../../services/guideline-evaluation.service';
import { ToastService } from '../../services/toast.service';
import {
  EMPTY_CLINICIAN_ANSWERS,
  type GuidelineClinicianAnswers,
  type GuidelineEvaluationView,
  type TriState,
} from './guideline.model';
import {
  buildGuidelineDiagramModel,
  orderedPathDescription,
  toMermaidDefinition,
  type GuidelineDiagramModel,
} from './guideline.diagrams';
import {
  boxMeta,
  diagramBoxForQuestion,
  formatBoxLabel,
  formatRelatedBoxLabels,
} from './guideline-boxes';
import {
  attachDiagramInteractivity,
  findDiagramSvg,
  type DiagramInteractivityController,
} from './guideline-diagram-dom';
import { exportDiagramPng, exportDiagramSvg } from './guideline-diagram-export';

interface ClinicianQuestionDef {
  id: keyof GuidelineClinicianAnswers;
  label: string;
  help: string;
}

const CLINICIAN_QUESTIONS: ClinicianQuestionDef[] = [
  {
    id: 'lifeExpectancyLimitedUnder5Years',
    label: 'Is life expectancy limited to less than 5 years? (Box 3)',
    help: 'CPG population / Box 3 uses <5 years. This is not the PREVENT <1 year exclusion flag.',
  },
  {
    id: 'recentMiAcsOrCabgPciWithin6Weeks',
    label: 'Recent MI, ACS, CABG, or PCI within 6 weeks? (Box 6)',
    help: 'Narrow concurrent cardiac-rehab cue. Recommendation 24 uses a broader “recent CHD” population.',
  },
  {
    id: 'onLipidLoweringTherapy',
    label: 'Currently on lipid-lowering therapy? (Sidebar 4)',
    help: 'Required for every very-high-risk arm.',
  },
  {
    id: 'veryHighRiskRecentAcsOrMiOnTherapy',
    label: 'Recent ACS or MI while on lipid-lowering therapy? (Sidebar 4)',
    help: 'Very-high-risk criterion; requires therapy.',
  },
  {
    id: 'veryHighRiskRecurrentEventsOnTherapy',
    label: 'Recurrent ASCVD events while on lipid-lowering therapy? (Sidebar 4)',
    help: 'Very-high-risk criterion; requires therapy.',
  },
  {
    id: 'escalationNeeded',
    label: 'Is escalation to triple therapy needed? (Box 18)',
    help: 'Clinician judgment; the algorithm does not define a deterministic LDL threshold.',
  },
  {
    id: 'borderlineRiskPatientDesiresStatin',
    label: 'Does the patient desire statin treatment? (Box 12)',
    help: 'Required for Box 11 borderline path. Recommendation 8 remains visible in the 5%–<10% band regardless.',
  },
  {
    id: 'clinicalRiskIntermediateOrHigh',
    label: 'Is clinical ASCVD risk intermediate to high? (Rec 3)',
    help: 'The CPG does not define PREVENT cutoffs for “intermediate/high.”',
  },
  {
    id: 'cacWouldChangeManagement',
    label: 'Would CAC testing change management? (Rec 3)',
    help: 'Required for the weak-for CAC suggestion.',
  },
  {
    id: 'clinicalRiskLow',
    label: 'Is clinical ASCVD risk low? (Rec 4)',
    help: 'Required for the weak-against CAC suggestion.',
  },
  {
    id: 'astAltLessThan3xUlnConfirmed',
    label: 'Baseline AST and ALT <3× ULN confirmed? (Rec 11)',
    help: 'Confirm when reference-range evidence is missing.',
  },
  {
    id: 'persistentlyElevatedFastingTriglycerides',
    label: 'Persistently elevated fasting triglycerides ≥150 mg/dL after secondary causes? (Rec 16)',
    help: 'Persistence is clinician-confirmed when chart data are ambiguous.',
  },
  {
    id: 'statinIntoleranceAttested',
    label: 'Statin intolerance attested? (Rec 18)',
    help: 'Optional clinician confirmation. Yes surfaces the rechallenge suggestion; do not infer from missing chart data.',
  },
  {
    id: 'unableToTakeStatin',
    label: 'Unable to take a statin? (Rec 19)',
    help: 'Optional clinician confirmation. Yes surfaces unranked non-statin options.',
  },
];

@Component({
  selector: 'app-guideline',
  imports: [RouterLink],
  templateUrl: './guideline.html',
  styleUrl: './guideline.scss',
})
export class Guideline implements OnDestroy {
  private readonly patientContext = inject(PatientContextService);
  private readonly riskSession = inject(RiskCalculatorSessionService);
  private readonly guidelineEval = inject(GuidelineEvaluationService);
  private readonly toasts = inject(ToastService);
  private readonly host = inject(ElementRef<HTMLElement>);

  private readonly diagramHost = viewChild<ElementRef<HTMLElement>>('algorithmDiagram');

  private evalSub: Subscription | null = null;
  private renderGeneration = 0;
  private diagramController: DiagramInteractivityController | null = null;
  private pendingFocusBox: number | null = null;

  protected readonly selectedPatient = this.patientContext.selectedPatient;
  protected readonly session = this.riskSession.session;
  protected readonly hasValidSession = this.riskSession.hasValidSessionForCurrentPatient;

  protected readonly answers = signal<GuidelineClinicianAnswers>({ ...EMPTY_CLINICIAN_ANSWERS });
  protected readonly evaluation = signal<GuidelineEvaluationView | null>(null);
  protected readonly loading = signal(false);
  protected readonly evaluateError = signal<string | null>(null);
  protected readonly diagramError = signal<string | null>(null);
  protected readonly selectedDiagramBox = signal<number | null>(null);
  protected readonly diagramReady = signal(false);

  protected readonly diagramModel = computed<GuidelineDiagramModel | null>(() => {
    const view = this.evaluation();
    if (!view) {
      return null;
    }
    return buildGuidelineDiagramModel(view, this.answers());
  });

  protected readonly selectedDiagramDetail = computed(() => {
    const boxId = this.selectedDiagramBox();
    const model = this.diagramModel();
    if (boxId == null || !model) {
      return null;
    }
    const meta = boxMeta(boxId);
    const node = model.nodes.find((n) => n.id === boxId);
    return {
      boxId,
      label: formatBoxLabel(boxId),
      title: meta.title,
      subtitle: node?.subtitle ?? null,
      questionId: meta.questionId ?? null,
    };
  });

  protected readonly pathDescription = computed(() => {
    const view = this.evaluation();
    if (!view) {
      return '';
    }
    return orderedPathDescription(view.activeBoxes, view.unresolvedBoxes, view.algorithmPath);
  });

  protected readonly visibleQuestions = computed(() => CLINICIAN_QUESTIONS);

  protected readonly unresolvedQuestionCount = computed(
    () => CLINICIAN_QUESTIONS.filter((q) => this.answers()[q.id] === 'unknown').length,
  );

  protected readonly recommendationsByTier = computed(() => {
    const recs = this.evaluation()?.recommendations ?? [];
    return {
      appliesNow: recs.filter((r) => r.tier === 'applies-now'),
      discuss: recs.filter((r) => r.tier === 'discuss'),
      informational: recs.filter((r) => r.tier === 'informational'),
      doesNotApply: recs.filter((r) => r.tier === 'does-not-apply'),
    };
  });

  protected readonly suppressDeterministicTreatmentWording = computed(
    () => this.evaluation()?.algorithmStatus === 'OutsidePopulation',
  );

  protected readonly formatBoxLabel = formatBoxLabel;
  protected readonly formatRelatedBoxLabels = formatRelatedBoxLabels;
  protected readonly diagramBoxForQuestion = diagramBoxForQuestion;

  constructor() {
    this.riskSession.clearIfPatientMismatch();
    this.seedLifeExpectancyFromCalculator();

    const trigger$ = toObservable(
      computed(() => ({
        valid: this.hasValidSession(),
        session: this.session(),
        answers: this.answers(),
      })),
    );

    this.evalSub = trigger$
      .pipe(
        switchMap(({ valid, session, answers }) => {
          if (!valid || !session) {
            this.evaluation.set(null);
            this.loading.set(false);
            this.evaluateError.set(null);
            return of(null);
          }
          this.loading.set(true);
          this.evaluateError.set(null);
          return this.guidelineEval.evaluate(session, answers).pipe(
            catchError((err: unknown) => {
              const message = err instanceof Error ? err.message : String(err);
              this.evaluateError.set(message);
              this.toasts.show(`Guideline evaluation failed: ${message}`, 'danger');
              this.loading.set(false);
              return of(null);
            }),
          );
        }),
      )
      .subscribe((view) => {
        if (view) {
          this.evaluation.set(view);
          this.loading.set(false);
        }
      });

    effect(() => {
      const model = this.diagramModel();
      if (model) {
        void this.renderDiagram(model);
      }
    });
  }

  ngOnDestroy(): void {
    this.evalSub?.unsubscribe();
    this.diagramController?.destroy();
    this.diagramController = null;
  }

  setAnswer(id: keyof GuidelineClinicianAnswers, value: TriState): void {
    this.answers.update((a) => ({ ...a, [id]: value }));
  }

  focusDiagramBox(boxId: number): void {
    this.selectedDiagramBox.set(boxId);
    const section = this.host.nativeElement.querySelector('#guideline-algorithm');
    if (section && typeof section.scrollIntoView === 'function') {
      section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    if (!this.diagramController) {
      this.pendingFocusBox = boxId;
      return;
    }
    this.diagramController.select(boxId);
    this.diagramController.focus(boxId);
  }

  scrollToQuestion(questionId: keyof GuidelineClinicianAnswers): void {
    const el = this.host.nativeElement.querySelector(`#guideline-question-${questionId}`);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  downloadDiagramSvg(): void {
    const svg = this.currentDiagramSvg();
    if (!svg) {
      this.toasts.show('Diagram is not ready to download.', 'warning');
      return;
    }
    exportDiagramSvg(svg, this.diagramFilename('svg'));
  }

  async downloadDiagramPng(): Promise<void> {
    const svg = this.currentDiagramSvg();
    if (!svg) {
      this.toasts.show('Diagram is not ready to download.', 'warning');
      return;
    }
    try {
      await exportDiagramPng(svg, this.diagramFilename('png'));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.toasts.show(`PNG export failed: ${message}. Try SVG instead.`, 'warning');
    }
  }

  protected patientDisplayName(): string {
    const patient = this.selectedPatient();
    const name = patient?.name?.[0];
    if (!name) {
      return patient?.id ?? 'Unknown patient';
    }
    const given = (name.given ?? []).join(' ');
    return [given, name.family].filter(Boolean).join(' ') || patient.id || 'Unknown patient';
  }

  private seedLifeExpectancyFromCalculator(): void {
    const session = this.session();
    if (!session) {
      return;
    }
    // Calculator Yes (<1y PREVENT) can prefill CPG <5y Yes; calculator No leaves unresolved.
    if (session.preventLifeExpectancyLimited) {
      this.answers.update((a) => ({
        ...a,
        lifeExpectancyLimitedUnder5Years: 'yes',
      }));
    }
  }

  private currentDiagramSvg(): SVGSVGElement | null {
    const host = this.diagramHost()?.nativeElement;
    return host ? findDiagramSvg(host) : null;
  }

  private diagramFilename(ext: 'svg' | 'png'): string {
    const patientId = this.selectedPatient()?.id ?? 'patient';
    return `appendix-g-algorithm-${patientId}.${ext}`;
  }

  private async renderDiagram(model: GuidelineDiagramModel): Promise<void> {
    const generation = ++this.renderGeneration;
    const hostRef = this.diagramHost();
    const el = hostRef?.nativeElement;
    if (!el) {
      return;
    }
    this.diagramError.set(null);
    this.diagramReady.set(false);
    this.diagramController?.destroy();
    this.diagramController = null;
    el.classList.remove('text-danger');
    el.replaceChildren();
    try {
      const { default: mermaid } = await import('mermaid');
      if (generation !== this.renderGeneration) {
        return;
      }
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'default',
      });
      const definition = toMermaidDefinition(model);
      const { svg } = await mermaid.render(`guideline-algorithm-${generation}`, definition);
      if (generation !== this.renderGeneration) {
        return;
      }
      el.innerHTML = svg;
      const svgEl = findDiagramSvg(el);
      if (svgEl) {
        const tooltips = new Map(model.nodes.map((n) => [n.id, n.tooltip]));
        this.diagramController = attachDiagramInteractivity(svgEl, {
          onSelect: (boxId) => this.focusDiagramBox(boxId),
          tooltipForBox: (boxId) => tooltips.get(boxId) ?? formatBoxLabel(boxId),
        });
        const selected = this.selectedDiagramBox();
        if (selected != null) {
          this.diagramController.select(selected);
        }
        const pending = this.pendingFocusBox;
        if (pending != null) {
          this.pendingFocusBox = null;
          this.diagramController.select(pending);
          this.diagramController.focus(pending);
          this.selectedDiagramBox.set(pending);
        }
      }
      this.diagramReady.set(true);
      this.host.nativeElement.setAttribute('data-guideline-diagram-rendered', 'true');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.diagramError.set(message);
      this.diagramReady.set(false);
      el.textContent = `Diagram could not be rendered: ${message}`;
      el.classList.add('text-danger');
    }
  }
}
