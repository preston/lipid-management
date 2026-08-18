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
  questionAffectsDiagram,
  questionsForBox,
} from './guideline-boxes';
import {
  attachDiagramInteractivity,
  findDiagramSvg,
  type DiagramInteractivityController,
} from './guideline-diagram-dom';
import { exportDiagramSvg } from './guideline-diagram-export';
import { formatQuestionEvidence } from './guideline-question-evidence';

interface ClinicianQuestionDef {
  id: keyof GuidelineClinicianAnswers;
  label: string;
  help: string;
}

export const GUIDELINE_CLINICIAN_QUESTIONS: readonly ClinicianQuestionDef[] = [
  {
    id: 'lifeExpectancyLimitedUnder5Years',
    label: 'Is life expectancy limited to less than 5 years? (Box 3)',
    help: 'CPG population / Box 3 uses <5 years. This is not the PREVENT <1 year exclusion flag.',
  },
  {
    id: 'establishedCvd',
    label: 'Existing CVD? (Box 5, Sidebar 3)',
    help: 'Unknown uses Sidebar 3 chart findings (clinical ASCVD or completed CABG/PCI). Yes/No overrides the chart. Imaging-only atherosclerosis does not count.',
  },
  {
    id: 'veryHighRiskCvd',
    label: 'Very high-risk CVD? (Box 7, Sidebar 4)',
    help: 'Unknown uses Sidebar 4 criteria (therapy plus recent ACS/MI, recurrent events, or ASCVD with LDL-C ≥70). Yes/No overrides that Box 7 branch.',
  },
  {
    id: 'recentMiAcsOrCabgPciWithin6Weeks',
    label: 'Recent MI, ACS, CABG, or PCI within 6 weeks? (Box 6, Rec 24)',
    help: 'Box 6 concurrent cardiac-rehab cue (MI/ACS/CABG/PCI in 6 weeks). Rec 24 is broader (recent CHD including CAD diagnosis) and is not ruled out by a Box 6 No.',
  },
  {
    id: 'onLipidLoweringTherapy',
    label: 'Currently on lipid-lowering therapy? (Box 7, Sidebar 4)',
    help: 'Required for every very-high-risk arm at Box 7.',
  },
  {
    id: 'veryHighRiskRecentAcsOrMiOnTherapy',
    label: 'MI or ACS in the past 12 months while on lipid-lowering therapy? (Box 7, Sidebar 4)',
    help: 'Very-high-risk criterion 1 at Box 7; requires current lipid-lowering therapy.',
  },
  {
    id: 'veryHighRiskRecurrentEventsOnTherapy',
    label:
      'Recurrent ACS, MI, or atherosclerotic CVA while on lipid-lowering therapy? (Box 7, Sidebar 4)',
    help: 'Very-high-risk criterion 2 at Box 7; requires current lipid-lowering therapy.',
  },
  {
    id: 'hivInfection',
    label: 'HIV positive? (Box 10)',
    help: 'Unknown uses active HIV chart conditions. Yes/No overrides the chart for the Box 10 branch.',
  },
  {
    id: 'primaryPreventionStatinIndication',
    label: 'Diabetes, LDL-C ≥190, or 10-year estimated risk ≥10%? (Box 8)',
    help: 'Unknown uses calculator/chart diabetes, LDL-C, and PREVENT 10-year total CVD. Yes/No overrides that Box 8 composite.',
  },
  {
    id: 'borderlineRiskBand',
    label: 'Estimated 10-year risk 5% to <10%? (Box 12)',
    help: 'Unknown uses the accepted PREVENT 10-year total CVD session value. Yes/No overrides the Box 12 risk-band half of the diamond.',
  },
  {
    id: 'escalationNeeded',
    label: 'Is escalation to triple therapy needed? (Box 18)',
    help: 'Clinician judgment; the algorithm does not define a deterministic LDL threshold.',
  },
  {
    id: 'borderlineRiskPatientDesiresStatin',
    label: 'Does the patient desire statin treatment? (Box 12 → Box 11)',
    help: 'Box 12 desire Yes routes to Box 11. Rec 8 remains visible in the 5%–<10% band regardless.',
  },
  {
    id: 'clinicalRiskIntermediateOrHigh',
    label: 'Is clinical ASCVD risk intermediate to high? (Rec 3, Sidebar 7)',
    help: 'The CPG does not define PREVENT cutoffs for “intermediate/high.” Read the Rec 3 narrative.',
  },
  {
    id: 'cacWouldChangeManagement',
    label: 'Would CAC testing change management? (Rec 3, Sidebar 7)',
    help: 'Required for the weak-for CAC suggestion (Table 4: when deemed to affect clinical decision-making).',
  },
  {
    id: 'clinicalRiskLow',
    label: 'Is clinical ASCVD risk low? (Rec 4, Sidebar 7)',
    help: 'Required for the weak-against routine CAC suggestion.',
  },
  {
    id: 'elevatedAstOrAltLessThan3xUln',
    label: 'Elevated baseline AST or ALT that is still <3× ULN? (Rec 11)',
    help: 'Rec 11 applies when there is a statin indication and mildly elevated transaminases (1–3× ULN). Normal LFTs are outside this recommendation’s population.',
  },
  {
    id: 'persistentlyElevatedFastingTriglycerides',
    label:
      'Persistently elevated fasting triglycerides ≥150 mg/dL? (Rec 16, Sidebar 8)',
    help: 'Table 4 Rec 16 is secondary prevention on a statin. Sidebar 8 also addresses secondary causes and elevation despite maximally tolerated statin.',
  },
  {
    id: 'statinIntoleranceAttested',
    label: 'Statin intolerance attested? (Rec 18, Sidebar 6)',
    help: 'Optional. Yes surfaces Sidebar 6 washout then rechallenge (same or different statin or lower dose), then intermittent/nondaily dosing if that fails.',
  },
  {
    id: 'unableToTakeStatin',
    label: 'Unable to take a statin? (Rec 19, Sidebar 6)',
    help: 'Optional. Yes surfaces Sidebar 6 unranked non-statins: bempedoic acid, ezetimibe, fibrates, or PCSK9 monoclonal antibodies. Rec 12 still suggests against adding fibrates to a statin.',
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
    title: '1 — Comprehensive Lifestyle Medicine',
    body: 'Increase physical activity (aerobic and resistance) that maximizes what the patient is willing and able to achieve. Goals: 150 minutes moderate-intensity OR 75 minutes vigorous-intensity OR an equivalent combination per week. Choose a healthy dietary pattern (e.g., Mediterranean diet). Sleep 7–8 hours/night. Socialize: forge and embrace social connections. Quit tobacco and nicotine. Minimize alcohol. Manage stress. Address overweight and obesity (see VA/DoD Obesity and Overweight CPG).',
  },
  {
    id: 'guideline-sidebar-2',
    title: '2 — Mediterranean and Other Cardioprotective Diets',
    body: 'Emphasize: fruits and vegetables; whole grains; seafood (primarily fatty fish); skinless poultry; tree nuts, seeds, peanuts, nut butters; beans and legumes; non-tropical vegetable oils (olive, canola, avocado, etc.); low-fat daily products (milk, cheese) — CPG Sidebar 2 wording; Appendix J says dairy. Limit: added sugar; sugar-sweetened beverages; sodium; highly processed foods; refined carbohydrates; saturated fats; tropical vegetable oils (coconut, palm, etc.); high-fat and processed meats; alcoholic beverages.',
  },
  {
    id: 'guideline-sidebar-3',
    title: '3 — ASCVD (Secondary Prevention)',
    body: 'MI or ACS; CABG/PCI; stable CAD; CVA/TIA due to atherosclerosis; PAD. Does not include asymptomatic atherosclerosis on imaging (e.g., CCTA, CAC, catheterization). Use this list for Box 5 Existing CVD.',
  },
  {
    id: 'guideline-sidebar-4',
    title: '4 — Very High-Risk CVD Patients',
    body: 'Any one, all on lipid-lowering therapy: MI or ACS in the past 12 months; or recurrent ACS, MI, or atherosclerotic CVA; or ASCVD and LDL-C ≥70 mg/dL. ASCVD with LDL-C ≥70 mg/dL without therapy is not automatically very high risk.',
  },
  {
    id: 'guideline-sidebar-5',
    title: '5 — Statin Intensity',
    body: 'High-intensity in this CPG is only rosuvastatin 20–40 mg and atorvastatin 40–80 mg. Moderate: rosuvastatin 5–10 mg; atorvastatin 10–20 mg; fluvastatin 80 mg XL or 40 mg BID; lovastatin 40–80 mg; pitavastatin 1–4 mg; pravastatin 40–80 mg; simvastatin 20–40 mg. Intensified patient care (calls, education, regimen simplification) may improve adherence.',
  },
  {
    id: 'guideline-sidebar-6',
    title: '6 — For Statin Intolerance',
    body: '1. Washout period (e.g., 1 month) followed by the same or a different statin; continue other lipid-lowering therapy. 2. Lower dose or nondaily dosing (e.g., every other day or 2–3 days per week) of statin (Rec 18). 3. Consider initiating bempedoic acid, ezetimibe, fibrates, or PCSK9 mAb inhibitors in patients unable to take a statin (Rec 19).',
  },
  {
    id: 'guideline-sidebar-7',
    title: '7 — Novel Risk Markers',
    body: 'Suggest checking Lp(a) to identify intrinsic enhanced risk (Rec 5). Not recommended to routinely measure CAC in patients with low risk (Rec 4). Suggest CAC in patients with intermediate to high risk who question the need for therapy (Rec 3). Routine measurement of hs-CRP, ApoB, PRS, TPA, or ABI is not useful to refine risk (Rec 6).',
  },
  {
    id: 'guideline-sidebar-8',
    title: '8 — Elevated Triglycerides for Secondary CVD Prevention',
    body: 'Consider secondary causes of elevated triglycerides (co-occurring conditions, alcohol, and medications such as hormones, immune-related agents, beta blockers, thiazide/loop diuretics, bile acid sequestrants, atypical antipsychotics, isotretinoin). If triglycerides are persistently elevated (≥150 mg/dL) despite maximally tolerated statin, consider icosapent ethyl 2 g BID (Rec 16). Modify diet.',
  },
  {
    id: 'guideline-appendix-i',
    title: 'Appendix I — Pharmacotherapy reference (non-ordering)',
    body: 'Agents referenced by recommendations include statins (intensity per Sidebar 5), ezetimibe, PCSK9 monoclonal antibodies, bempedoic acid, fibrates (suggest against adding to a statin — Rec 12; option if unable to take a statin — Rec 19), and icosapent ethyl. Inclisiran is Appendix I only (outcomes pending; do not combine with PCSK9 mAb). This panel is a reference aid only; it does not authorize or rank orders.',
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
  private chartAnswersSeeded = false;

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
        label: GUIDELINE_CLINICIAN_QUESTIONS.find((q) => q.id === id)?.label ?? id,
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

  protected readonly diagramQuestions = GUIDELINE_CLINICIAN_QUESTIONS.filter((q) =>
    questionAffectsDiagram(q.id),
  );

  protected readonly recommendationQuestions = GUIDELINE_CLINICIAN_QUESTIONS.filter(
    (q) => !questionAffectsDiagram(q.id),
  );

  protected readonly unresolvedDiagramQuestionCount = computed(
    () => this.diagramQuestions.filter((q) => this.answers()[q.id] === 'unknown').length,
  );

  protected readonly unresolvedRecommendationQuestionCount = computed(
    () => this.recommendationQuestions.filter((q) => this.answers()[q.id] === 'unknown').length,
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
          this.seedChartDeterminedAnswers(view);
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

  protected questionEvidence(question: ClinicianQuestionDef): string | null {
    return formatQuestionEvidence(question.id, this.evaluation(), this.session());
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
    exportDiagramSvg(svg, this.diagramFilename());
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

  private seedChartDeterminedAnswers(view: GuidelineEvaluationView): void {
    if (this.chartAnswersSeeded) {
      return;
    }
    this.chartAnswersSeeded = true;
    this.answers.update((a) => {
      const next = { ...a };
      if (a.establishedCvd === 'unknown') {
        next.establishedCvd = view.hasEstablishedCvd ? 'yes' : 'no';
      }
      if (a.hivInfection === 'unknown') {
        next.hivInfection = view.hasHivInfection ? 'yes' : 'no';
      }
      if (a.primaryPreventionStatinIndication === 'unknown') {
        next.primaryPreventionStatinIndication = view.primaryPreventionStatinIndicationBox8
          ? 'yes'
          : 'no';
      }
      if (a.borderlineRiskBand === 'unknown') {
        next.borderlineRiskBand = view.primaryPreventionBorderlineRiskBand ? 'yes' : 'no';
      }
      if (a.veryHighRiskCvd === 'unknown' && view.veryHighRiskCvd === true) {
        next.veryHighRiskCvd = 'yes';
      }
      if (
        a.onLipidLoweringTherapy === 'unknown' &&
        (view.effectiveOnLipidLoweringTherapy === true || view.chartEvidence.lipidLoweringTherapy)
      ) {
        next.onLipidLoweringTherapy = 'yes';
      }
      return next;
    });
  }

  private currentDiagramSvg(): SVGSVGElement | null {
    const host = this.diagramHost()?.nativeElement;
    return host ? findDiagramSvg(host) : null;
  }

  private diagramFilename(): string {
    const patientId = this.selectedPatient()?.id ?? 'patient';
    return `appendix-g-algorithm-${patientId}.svg`;
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
        htmlLabels: false,
        markdownAutoWrap: false,
        flowchart: { htmlLabels: false },
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
