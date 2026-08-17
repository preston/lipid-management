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
import { NgTemplateOutlet } from '@angular/common';
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
  type GuidelineRecommendationResult,
  type RecommendationDisplayTier,
  type TriState,
} from './guideline.model';
import {
  buildGuidelineDiagramModel,
  filterDiagramModelToPath,
  orderedPathDescription,
  toMermaidDefinition,
  type GuidelineDiagramModel,
} from './guideline.diagrams';
import {
  boxMeta,
  formatBoxLabel,
  formatRelatedBoxLabels,
  pathBlockingQuestionIds,
  questionsForBox,
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
    label:
      'Persistently elevated fasting triglycerides ≥150 mg/dL after secondary causes? (Rec 16)',
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

interface ReferenceSidebarRow {
  id: string;
  title: string;
  body: string;
}

const REFERENCE_SIDEBARS: readonly ReferenceSidebarRow[] = [
  {
    id: 'guideline-sidebar-1',
    title: '1 — PREVENT calculator',
    body: 'Use PREVENT for 10-year total CVD risk in eligible adults. Do not insert Lp(a) into PREVENT. Calculator exclusions (<1 year life expectancy, etc.) differ from CPG population exclusions.',
  },
  {
    id: 'guideline-sidebar-2',
    title: '2 — Novel markers',
    body: 'CAC (Recs 3–4), Lp(a) once lifetime (Rec 5), and insufficient evidence for ABI, ApoB, PRS, TPA, hs-CRP (Rec 6). Imaging-only atherosclerosis does not independently define secondary prevention (see Sidebar 3).',
  },
  {
    id: 'guideline-sidebar-3',
    title: '3 — Clinical ASCVD',
    body: 'Clinical ASCVD for secondary prevention excludes asymptomatic imaging-only atherosclerosis. Use established clinical ASCVD diagnoses for Box 5.',
  },
  {
    id: 'guideline-sidebar-4',
    title: '4 — Very high risk',
    body: 'All three very-high-risk criteria require current lipid-lowering therapy. ASCVD with LDL-C ≥70 mg/dL without therapy is not automatically very high risk.',
  },
  {
    id: 'guideline-sidebar-5',
    title: '5 — Statin intensity',
    body: 'Moderate- and high-intensity statin definitions as in the CPG. Outputs are intensity guidance and option sets, not prescriptions.',
  },
  {
    id: 'guideline-sidebar-6',
    title: '6 — Non-statin therapies',
    body: 'Ezetimibe, PCSK9 monoclonal antibodies, and bempedoic acid appear in secondary and statin-intolerance option sets (Recs 13–14, 19). Unranked when the CPG presents alternatives.',
  },
  {
    id: 'guideline-sidebar-7',
    title: '7 — Statin intolerance',
    body: 'Rechallenge before switching (Rec 18). Unable-to-take-statin options (Rec 19). Intolerance and inability are clinician-confirmed.',
  },
  {
    id: 'guideline-sidebar-8',
    title: '8 — Elevated triglycerides',
    body: 'Secondary-prevention IPE when statin use and persistently elevated fasting triglycerides ≥150 mg/dL are established (Rec 16). Suggest against non-IPE omega-3 supplements (Rec 21). Triglycerides >500 mg/dL relate to genetic-dyslipidemia population exclusion.',
  },
  {
    id: 'guideline-appendix-i',
    title: 'Appendix I — Pharmacotherapy reference (non-ordering)',
    body: 'Agents surfaced by recommendations include statins (intensity per Sidebar 5), ezetimibe, PCSK9 monoclonal antibodies, bempedoic acid, fibrates (suggest against adding to statin — Rec 12), and icosapent ethyl. This panel is a reference aid only; it does not authorize or rank orders.',
  },
];

type DiagramViewMode = 'full' | 'path';

interface RecommendationFilterButton {
  id: RecommendationDisplayTier;
  label: string;
  inputId: string;
}

const RECOMMENDATION_FILTERS: readonly RecommendationFilterButton[] = [
  { id: 'applies-now', label: 'Applicable', inputId: 'guideline-rec-filter-applicable' },
  {
    id: 'discuss',
    label: 'Needs clinical input',
    inputId: 'guideline-rec-filter-needs-clinical-input',
  },
  { id: 'informational', label: 'Informational', inputId: 'guideline-rec-filter-informational' },
  { id: 'does-not-apply', label: 'Not applicable', inputId: 'guideline-rec-filter-not-applicable' },
];

const DEFAULT_RECOMMENDATION_FILTERS: Record<RecommendationDisplayTier, boolean> = {
  'applies-now': true,
  discuss: false,
  informational: false,
  'does-not-apply': false,
};

@Component({
  selector: 'app-guideline',
  imports: [RouterLink, NgTemplateOutlet],
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
  protected readonly diagramViewMode = signal<DiagramViewMode>('full');
  protected readonly recommendationFilters = signal<Record<RecommendationDisplayTier, boolean>>({
    ...DEFAULT_RECOMMENDATION_FILTERS,
  });
  protected readonly recommendationFilterButtons = RECOMMENDATION_FILTERS;

  protected readonly fullDiagramModel = computed<GuidelineDiagramModel | null>(() => {
    const view = this.evaluation();
    if (!view) {
      return null;
    }
    return buildGuidelineDiagramModel(view, this.answers());
  });

  protected readonly diagramModel = computed<GuidelineDiagramModel | null>(() => {
    const full = this.fullDiagramModel();
    const view = this.evaluation();
    if (!full || !view) {
      return null;
    }
    if (this.diagramViewMode() === 'full') {
      return full;
    }
    return filterDiagramModelToPath(full, new Set([...view.activeBoxes, ...view.unresolvedBoxes]));
  });

  protected readonly selectedDiagramDetail = computed(() => {
    const boxId = this.selectedDiagramBox();
    const view = this.evaluation();
    const model = this.fullDiagramModel();
    if (boxId == null || !view || !model) {
      return null;
    }
    const meta = boxMeta(boxId);
    const node = model.nodes.find((n) => n.id === boxId);
    const questionIds = questionsForBox(boxId);
    return {
      boxId,
      label: formatBoxLabel(boxId),
      title: meta.title,
      subtitle: node?.subtitle ?? null,
      questions: questionIds.map((id) => ({
        id,
        label: CLINICIAN_QUESTIONS.find((q) => q.id === id)?.label ?? id,
      })),
    };
  });

  protected readonly pathDescription = computed(() => {
    const view = this.evaluation();
    if (!view) {
      return '';
    }
    return orderedPathDescription(view.activeBoxes, view.unresolvedBoxes, view.algorithmPath);
  });

  protected readonly pathBlockingQuestions = computed(() => {
    const unresolved = this.evaluation()?.unresolvedBoxes ?? [];
    const ids = pathBlockingQuestionIds(unresolved);
    return CLINICIAN_QUESTIONS.filter((q) => ids.has(q.id));
  });

  protected readonly detailQuestions = computed(() => {
    const blocking = new Set(this.pathBlockingQuestions().map((q) => q.id));
    return CLINICIAN_QUESTIONS.filter((q) => !blocking.has(q.id));
  });

  protected readonly pathBlockingUnresolvedCount = computed(
    () => this.pathBlockingQuestions().filter((q) => this.answers()[q.id] === 'unknown').length,
  );

  protected readonly detailUnresolvedCount = computed(
    () => this.detailQuestions().filter((q) => this.answers()[q.id] === 'unknown').length,
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

  protected readonly visibleRecommendationGroups = computed(() => {
    const byTier = this.recommendationsByTier();
    const filters = this.recommendationFilters();
    const groups: {
      id: RecommendationDisplayTier;
      title: string;
      items: GuidelineRecommendationResult[];
    }[] = [
      { id: 'applies-now', title: 'Applies now', items: byTier.appliesNow },
      { id: 'discuss', title: 'Discuss with patient', items: byTier.discuss },
      {
        id: 'informational',
        title: 'Informational / evidence uncertain',
        items: byTier.informational,
      },
      { id: 'does-not-apply', title: 'Does not currently apply', items: byTier.doesNotApply },
    ];
    return groups.filter((group) => filters[group.id]);
  });

  protected readonly formatBoxLabel = formatBoxLabel;
  protected readonly formatRelatedBoxLabels = formatRelatedBoxLabels;
  protected readonly referenceSidebars = REFERENCE_SIDEBARS;

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
      const host = this.diagramHost();
      if (model && host) {
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

  setRecommendationFilter(id: RecommendationDisplayTier, enabled: boolean): void {
    this.recommendationFilters.update((filters) => ({ ...filters, [id]: enabled }));
  }

  protected onRecommendationFilterChange(id: RecommendationDisplayTier, event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.setRecommendationFilter(id, target.checked);
    }
  }

  setDiagramViewMode(mode: DiagramViewMode): void {
    this.diagramViewMode.set(mode);
    const selected = this.selectedDiagramBox();
    if (selected == null) {
      return;
    }
    const model = this.diagramModel();
    if (!model?.nodes.some((node) => node.id === selected)) {
      this.selectedDiagramBox.set(null);
      this.diagramController?.clearSelection();
    }
  }

  selectDiagramBox(boxId: number): void {
    this.selectedDiagramBox.set(boxId);
    this.diagramController?.select(boxId);
  }

  focusDiagramBox(boxId: number): void {
    this.selectedDiagramBox.set(boxId);
    const visible = this.diagramModel()?.nodes.some((node) => node.id === boxId) ?? false;
    if (!visible && this.diagramViewMode() === 'path') {
      this.diagramViewMode.set('full');
      this.pendingFocusBox = boxId;
      this.scrollToElement('#guideline-algorithm');
      return;
    }

    this.scrollToElement('#guideline-algorithm');

    if (!this.diagramController) {
      this.pendingFocusBox = boxId;
      return;
    }
    this.diagramController.select(boxId);
    this.diagramController.focus(boxId);
  }

  scrollToQuestion(questionId: keyof GuidelineClinicianAnswers): void {
    this.scrollToElement(`#guideline-question-${questionId}`);
  }

  recRowHighlighted(rec: GuidelineRecommendationResult): boolean {
    const boxId = this.selectedDiagramBox();
    return boxId != null && rec.relatedBoxIds.includes(boxId);
  }

  protected isAnswer(question: ClinicianQuestionDef, value: TriState): boolean {
    return this.answers()[question.id] === value;
  }

  protected setQuestionAnswer(question: ClinicianQuestionDef, value: TriState): void {
    this.setAnswer(question.id, value);
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

  private scrollToElement(selector: string): void {
    const el = this.host.nativeElement.querySelector(selector);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
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
          onSelect: (boxId) => this.selectDiagramBox(boxId),
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
