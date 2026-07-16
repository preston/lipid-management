// Author: Preston Lee

import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormField, form, max, min, required } from '@angular/forms/signals';
import type { Patient } from 'fhir/r4';
import { computeBmiKgM2 } from './open-cvd-risk-egfr';
import type { OpenCVDRiskCalculatorForm, OpenCVDRiskSex } from './open-cvd-risk-calculator.model';
import { PatientContextService } from '../../services/patient-context.service';
import { FhirPatientService, type PatientSearchHit } from '../../services/fhir-patient.service';
import {
  CalculatorPrefillService,
  type FieldProvenance,
  type PreventExclusion,
  type PreventExclusionId,
} from '../../services/calculator-prefill.service';
import {
  CqlEvaluateService,
  type CqlLibraryParameterValue,
} from '../../services/cql-evaluate.service';
import { SmartLaunchService } from '../../services/smart-launch.service';
import {
  parseClientFhirJson,
  validateClientFhirPatientBundle,
} from '../../services/client-fhir-bundle';
import { isHttpOfflineOrServerError, ToastService } from '../../services/toast.service';
import { formatFhirDateTime } from '../../util/fhir-datetime';
import {
  isValidHba1c,
  isValidSdi,
  isValidUacr,
  formatPreventRiskAgeDisplay,
  selectPreventModel,
  type PreventModel,
  type PreventSex,
} from './prevent/prevent-math';
import { formatPrevent30yCvdPercentileDisplay } from './prevent/prevent-percentiles';
import { normalizeZip, postalCodeFromPatientAddress } from './sdi/sdi-lookup';

const PLACEHOLDER = '—';

type PatientSource = 'server' | 'file';

type FileStatus = { message: string };

type SdiLookupStatus = 'blank' | 'found' | 'missing' | 'manual' | 'loading';

const RISK_EXPRESSIONS = [
  'SelectedPreventModel',
  'TenYearTotalCvdPercent',
  'TenYearAscvdPercent',
  'TenYearHeartFailurePercent',
  'TenYearChdPercent',
  'TenYearStrokePercent',
  'ThirtyYearTotalCvdPercent',
  'ThirtyYearAscvdPercent',
  'ThirtyYearHeartFailurePercent',
  'ThirtyYearChdPercent',
  'ThirtyYearStrokePercent',
  'BaseTenYearTotalCvdPercent',
  'BaseThirtyYearTotalCvdPercent',
] as const;

const EMPTY_FORM: OpenCVDRiskCalculatorForm = {
  age: null,
  sex: '',
  heightCm: null,
  weightKg: null,
  totalCholesterolMgDl: null,
  hdlMgDl: null,
  systolicBpMmHg: null,
  egfrMlMin173m2: null,
  diabetes: 'no',
  currentSmoker: 'no',
  onAntihypertensive: 'no',
  onStatin: 'no',
  uacrMgG: null,
  hba1cPercent: null,
  zipCode: '',
  sdiDecile: null,
};

@Component({
  selector: 'app-open-cvd-risk-calculator',
  imports: [FormField],
  templateUrl: './open-cvd-risk-calculator.html',
  styleUrl: './open-cvd-risk-calculator.scss',
})
export class OpenCVDRiskCalculator implements OnInit {
  private readonly patientContext = inject(PatientContextService);
  private readonly fhirPatients = inject(FhirPatientService);
  private readonly prefillService = inject(CalculatorPrefillService);
  private readonly cqlEvaluate = inject(CqlEvaluateService);
  private readonly smartLaunch = inject(SmartLaunchService);
  private readonly toasts = inject(ToastService);

  protected readonly model = signal<OpenCVDRiskCalculatorForm>({ ...EMPTY_FORM });
  protected readonly provenances = signal<Partial<Record<string, FieldProvenance>>>({});
  /** Form values immediately after last successful prefill; used for override provenance. */
  private readonly prefillBaseline = signal<OpenCVDRiskCalculatorForm | null>(null);

  protected readonly chartExclusions = signal<PreventExclusion[]>([]);
  protected readonly dismissedExclusionIds = signal<Set<PreventExclusionId>>(new Set());
  protected readonly lifeExpectancyLimited = signal(false);
  protected readonly pathogenicGeneticVariant = signal(false);
  protected readonly proceedDespiteExclusions = signal(false);
  protected readonly calculatedWithExclusions = signal(false);

  protected readonly searchQuery = signal('');
  protected readonly searchHits = signal<PatientSearchHit[]>([]);
  protected readonly activeSearchHitIndex = signal(-1);
  protected readonly searchLoading = signal(false);
  protected readonly patientSource = signal<PatientSource>('server');
  protected readonly fileStatus = signal<FileStatus | null>(null);
  protected readonly prefillLoading = signal(false);
  protected readonly calculateLoading = signal(false);

  /** User typed ZIP this session (do not overwrite from chart until patient reset). */
  private readonly zipUserEdited = signal(false);
  /** User edited SDI decile directly; ZIP changes clear this flag. */
  private readonly sdiManual = signal(false);
  /** Ensures prefill auto-calc runs at most once per patient load (after ZIP→SDI if needed). */
  private autoCalculateAttemptedForPrefill = false;
  /** Ignores stale SDI2019 $evaluate responses when ZIP changes quickly. */
  private sdiLookupSeq = 0;
  protected readonly sdiLookupStatus = signal<SdiLookupStatus>('blank');

  protected readonly risk10yTotal = signal<string>(PLACEHOLDER);
  protected readonly risk10yAscvd = signal<string>(PLACEHOLDER);
  protected readonly risk10yHf = signal<string>(PLACEHOLDER);
  protected readonly risk10yChd = signal<string>(PLACEHOLDER);
  protected readonly risk10yStroke = signal<string>(PLACEHOLDER);
  protected readonly openCvdRiskAge = signal<string>(PLACEHOLDER);
  protected readonly risk30yTotal = signal<string>(PLACEHOLDER);
  protected readonly risk30yAscvd = signal<string>(PLACEHOLDER);
  protected readonly risk30yHf = signal<string>(PLACEHOLDER);
  protected readonly risk30yChd = signal<string>(PLACEHOLDER);
  protected readonly risk30yStroke = signal<string>(PLACEHOLDER);
  protected readonly risk30yCvdPercentile = signal<string>(PLACEHOLDER);
  protected readonly selectedRiskModel = signal<PreventModel | null>(null);

  protected readonly isSmart = this.patientContext.isSmart;
  protected readonly selectedPatient = this.patientContext.selectedPatient;
  protected readonly isBlankSession = this.patientContext.isBlankSession;
  protected readonly hasRealClientData = this.patientContext.hasRealClientData;

  protected readonly openCvdRiskForm = form(this.model, (fields) => {
    required(fields.age, { message: 'Age is required' });
    min(fields.age, 1, { message: 'Age must be at least 1' });
    max(fields.age, 120, { message: 'Age must be at most 120' });
    required(fields.sex, { message: 'Sex is required' });
    required(fields.heightCm, { message: 'Height is required' });
    min(fields.heightCm, 1, { message: 'Height must be greater than 0' });
    required(fields.weightKg, { message: 'Weight is required' });
    min(fields.weightKg, 1, { message: 'Weight must be greater than 0' });
    required(fields.totalCholesterolMgDl, { message: 'Total cholesterol is required' });
    min(fields.totalCholesterolMgDl, 0, { message: 'Total cholesterol must be 0 or greater' });
    required(fields.hdlMgDl, { message: 'HDL cholesterol is required' });
    min(fields.hdlMgDl, 0, { message: 'HDL cholesterol must be 0 or greater' });
    required(fields.systolicBpMmHg, { message: 'Systolic blood pressure is required' });
    min(fields.systolicBpMmHg, 90, { message: 'Systolic blood pressure must be at least 90 mmHg (PREVENT validated range)' });
    max(fields.systolicBpMmHg, 200, { message: 'Systolic blood pressure must be at most 200 mmHg (PREVENT validated range)' });
    required(fields.egfrMlMin173m2, { message: 'eGFR is required' });
    min(fields.egfrMlMin173m2, 15, { message: 'eGFR must be at least 15 (PREVENT validated range)' });
    max(fields.egfrMlMin173m2, 150, { message: 'eGFR must be at most 150 (PREVENT validated range)' });
    min(fields.uacrMgG, 0.1, { message: 'UACR must be at least 0.1' });
    max(fields.uacrMgG, 25000, { message: 'UACR must be at most 25000' });
    min(fields.hba1cPercent, 3, { message: 'HbA1c must be at least 3' });
    max(fields.hba1cPercent, 15, { message: 'HbA1c must be at most 15' });
    min(fields.sdiDecile, 1, { message: 'SDI decile must be at least 1' });
    max(fields.sdiDecile, 10, { message: 'SDI decile must be at most 10' });
  });

  protected readonly bmiKgM2 = computed(() => {
    const { heightCm, weightKg } = this.model();
    if (heightCm == null || weightKg == null || heightCm <= 0 || weightKg <= 0) {
      return null;
    }
    return computeBmiKgM2(heightCm, weightKg);
  });

  protected readonly bmiDisplay = computed(() => this.formatNumber(this.bmiKgM2(), 1));

  /** Required risk-scoring inputs have values (presence only; age band is a separate applicability check). */
  protected readonly inputsComplete = computed(() => {
    const m = this.model();
    return (
      m.age != null &&
      this.isSex(m.sex) &&
      m.totalCholesterolMgDl != null &&
      m.hdlMgDl != null &&
      m.systolicBpMmHg != null &&
      this.bmiKgM2() != null &&
      m.egfrMlMin173m2 != null
    );
  });

  protected readonly ageInGuidelineRange = computed(() => {
    const age = this.model().age;
    return age != null && age >= 30 && age <= 79;
  });

  protected readonly activeExclusions = computed((): PreventExclusion[] => {
    const dismissed = this.dismissedExclusionIds();
    const fromChart = this.chartExclusions().filter((e) => !dismissed.has(e.id));
    const clinician: PreventExclusion[] = [];
    if (
      this.model().age != null &&
      !this.ageInGuidelineRange() &&
      !dismissed.has('age-out-of-range') &&
      !fromChart.some((e) => e.id === 'age-out-of-range')
    ) {
      clinician.push({
        id: 'age-out-of-range',
        message: 'Age outside 30–79 years',
        source: 'clinician',
        provenance: 'Risk scoring equations require age 30–79.',
      });
    }
    if (this.lifeExpectancyLimited()) {
      clinician.push({
        id: 'life-expectancy-limited',
        message: 'Limited life expectancy (<1 year)',
        source: 'clinician',
      });
    }
    if (this.pathogenicGeneticVariant()) {
      clinician.push({
        id: 'pathogenic-genetic-variant',
        message: 'Known pathogenic genetic CVD variant',
        source: 'clinician',
      });
    }
    return [...fromChart, ...clinician];
  });

  protected readonly hasActiveExclusions = computed(() => this.activeExclusions().length > 0);

  protected readonly patientBanner = computed(() => {
    if (this.isBlankSession()) {
      return {
        blank: true as const,
        name: 'Manual entry',
      };
    }
    const patient = this.selectedPatient();
    if (!patient) {
      return null;
    }
    return {
      blank: false as const,
      name: this.patientContext.patientDisplayName(patient),
      gender: patient.gender ?? '—',
      birthDate: formatFhirDateTime(patient.birthDate) ?? '—',
      ageYears: this.ageFromBirthDate(patient.birthDate),
    };
  });

  protected readonly canCalculate = computed(() => {
    if (this.selectedPatient() == null || this.calculateLoading() || !this.inputsComplete()) {
      return false;
    }
    // Block when PREVENT-validated ranges fail (e.g. SBP < 90), matching AHA calculator gating.
    if (
      this.openCvdRiskForm.systolicBpMmHg().invalid() ||
      this.openCvdRiskForm.egfrMlMin173m2().invalid() ||
      this.openCvdRiskForm.age().invalid() ||
      this.openCvdRiskForm.totalCholesterolMgDl().invalid() ||
      this.openCvdRiskForm.hdlMgDl().invalid() ||
      this.openCvdRiskForm.heightCm().invalid() ||
      this.openCvdRiskForm.weightKg().invalid()
    ) {
      return false;
    }
    if (this.hasActiveExclusions() && !this.proceedDespiteExclusions()) {
      return false;
    }
    return true;
  });

  /** Client-side preview of which S12 model will be used (matches CQL selection). */
  protected readonly activeRiskModel = computed((): PreventModel => {
    const m = this.model();
    return selectPreventModel({
      age: m.age ?? 55,
      totalChol: m.totalCholesterolMgDl ?? 200,
      hdl: m.hdlMgDl ?? 50,
      sbp: m.systolicBpMmHg ?? 120,
      diabetes: m.diabetes === 'yes' ? 1 : 0,
      smoke: m.currentSmoker === 'yes' ? 1 : 0,
      bmi: this.bmiKgM2() ?? 25,
      egfr: m.egfrMlMin173m2 ?? 90,
      antihtn: m.onAntihypertensive === 'yes' ? 1 : 0,
      statin: m.onStatin === 'yes' ? 1 : 0,
      uacr: m.uacrMgG,
      hba1c: m.hba1cPercent,
      sdi: m.sdiDecile,
    });
  });

  protected readonly activeRiskModelLabel = computed(() => {
    switch (this.selectedRiskModel() ?? this.activeRiskModel()) {
      case 'uacr':
        return 'Base + UACR';
      case 'hba1c':
        return 'Base + HbA1c';
      case 'sdi':
        return 'Base + SDI';
      case 'full':
        return 'Full (UACR + HbA1c + SDI)';
      default:
        return 'Base';
    }
  });

  protected readonly sdiLookupStatusLabel = computed(() => {
    switch (this.sdiLookupStatus()) {
      case 'loading':
        return 'Looking up SDI via SDI2019…';
      case 'found':
        return 'SDI from ZIP (SDI2019 library)';
      case 'missing':
        return 'ZIP not in 2019 ZCTA table';
      case 'manual':
        return 'Manual SDI (ZIP lookup not applied until ZIP changes)';
      default:
        return 'Enter ZIP or SDI decile (optional)';
    }
  });

  async ngOnInit(): Promise<void> {
    const url = new URL(window.location.href);
    const mode = this.patientContext.detectLaunchFromUrl(url);
    if (mode === 'smart' && url.pathname.includes('launch') === false) {
      try {
        await this.smartLaunch.completeLaunch();
      } catch {
        // Standalone may still work if launch route handles authorize.
      }
    }
    if (mode === 'standalone' && (this.isBlankSession() || !this.selectedPatient())) {
      this.enterBlankCalculatorSession();
      return;
    }
    if (this.selectedPatient() && !this.isBlankSession()) {
      this.applyPatientDemographics(this.selectedPatient()!);
      this.runPrefill();
    }
  }

  protected onZipCodeInput(event?: Event): void {
    this.zipUserEdited.set(true);
    // Prefer the DOM value: (input) can run before [formField] flushes into the model.
    const raw =
      event?.target instanceof HTMLInputElement
        ? event.target.value
        : this.model().zipCode;
    if (this.model().zipCode !== raw) {
      this.model.update((m) => ({ ...m, zipCode: raw }));
    }
    const key = normalizeZip(raw);
    if (key == null) {
      // Cleared ZIP: drop auto-filled SDI; keep a manually entered decile.
      this.sdiLookupSeq += 1;
      if (!this.sdiManual()) {
        this.model.update((m) => ({ ...m, sdiDecile: null }));
        this.sdiLookupStatus.set('blank');
      } else {
        this.sdiLookupStatus.set('manual');
      }
      return;
    }
    this.sdiManual.set(false);
    this.applyZipToSdi();
  }

  protected onSdiDecileInput(): void {
    this.sdiManual.set(true);
    this.sdiLookupStatus.set('manual');
  }

  protected setPatientSource(source: PatientSource): void {
    if (this.patientSource() === source) {
      return;
    }
    this.patientSource.set(source);
    this.searchHits.set([]);
    this.activeSearchHitIndex.set(-1);
    this.searchQuery.set('');
    this.fileStatus.set(null);
  }

  protected onPatientSearchInput(value: string): void {
    this.searchQuery.set(value);
    this.activeSearchHitIndex.set(-1);
  }

  protected onPatientSearchKeydown(event: KeyboardEvent): void {
    const hits = this.searchHits();
    if (event.key === 'Escape') {
      this.searchHits.set([]);
      this.activeSearchHitIndex.set(-1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const activeHit = hits[this.activeSearchHitIndex()];
      if (activeHit) {
        this.selectPatient(activeHit);
      } else {
        this.searchPatients();
      }
      return;
    }
    if (hits.length === 0 || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) {
      return;
    }
    event.preventDefault();
    const current = this.activeSearchHitIndex();
    const next =
      event.key === 'ArrowDown'
        ? current >= hits.length - 1
          ? 0
          : current + 1
        : current <= 0
          ? hits.length - 1
          : current - 1;
    this.activeSearchHitIndex.set(next);
  }

  protected searchPatients(): void {
    this.searchLoading.set(true);
    this.activeSearchHitIndex.set(-1);
    this.fhirPatients.searchByName(this.searchQuery()).subscribe({
      next: (hits) => {
        this.searchHits.set(hits);
        this.activeSearchHitIndex.set(-1);
        this.searchLoading.set(false);
      },
      error: (err) => {
        this.searchHits.set([]);
        this.activeSearchHitIndex.set(-1);
        this.searchLoading.set(false);
        this.toastDomainError(err);
      },
    });
  }

  protected selectPatient(hit: PatientSearchHit): void {
    this.patientContext.setStandalonePatient(hit.patient);
    this.searchHits.set([]);
    this.activeSearchHitIndex.set(-1);
    this.searchQuery.set('');
    this.fileStatus.set(null);
    this.resetFormAndResults();
    this.applyPatientDemographics(hit.patient);
    this.runPrefill();
  }

  protected async onClientBundleFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.fileStatus.set({ message: `Reading ${file.name}…` });
    try {
      const text = await file.text();
      const parsed = parseClientFhirJson(text);
      if ('error' in parsed) {
        this.fileStatus.set(null);
        this.toasts.danger(parsed.error);
        input.value = '';
        return;
      }

      const result = validateClientFhirPatientBundle(parsed.value);
      if ('error' in result) {
        this.fileStatus.set(null);
        this.toasts.danger(result.error);
        input.value = '';
        return;
      }

      this.patientContext.setClientDataPatient(result.bundle, result.patient);
      this.fileStatus.set(null);
      this.resetFormAndResults();
      this.applyPatientDemographics(result.patient);
      this.runPrefill();
    } catch (err) {
      this.fileStatus.set(null);
      this.toasts.danger(err instanceof Error ? err.message : String(err));
      input.value = '';
    }
  }

  protected clearPatient(): void {
    this.fileStatus.set(null);
    this.searchHits.set([]);
    this.activeSearchHitIndex.set(-1);
    this.searchQuery.set('');
    this.enterBlankCalculatorSession();
  }

  protected provenanceFor(field: string): string | null {
    if (this.isLocallyOverridden(field)) {
      return 'Overridden.';
    }
    return this.provenances()[field]?.summary ?? null;
  }

  /** Omit required-only errors; missing fields are indicated by invalid styling. */
  protected visibleFieldErrors(
    errors: readonly { readonly kind: string; readonly message?: string }[],
  ): readonly { readonly kind: string; readonly message?: string }[] | null {
    const visible = errors.filter((error) => error.kind !== 'required');
    return visible.length > 0 ? visible : null;
  }

  protected formatDate(value: string | undefined | null): string | null {
    return formatFhirDateTime(value);
  }

  protected dismissExclusion(id: PreventExclusionId): void {
    const next = new Set(this.dismissedExclusionIds());
    next.add(id);
    this.dismissedExclusionIds.set(next);
    this.clearProceedIfNoExclusions();
  }

  protected setLifeExpectancyLimited(checked: boolean): void {
    this.lifeExpectancyLimited.set(checked);
    this.clearProceedIfNoExclusions();
  }

  protected setPathogenicGeneticVariant(checked: boolean): void {
    this.pathogenicGeneticVariant.set(checked);
    this.clearProceedIfNoExclusions();
  }

  protected setProceedDespiteExclusions(checked: boolean): void {
    this.proceedDespiteExclusions.set(checked);
  }

  protected readonly canResetToPrefill = computed(() => this.prefillBaseline() != null);

  /** Restore chart/demographics prefill values and clear local overrides. */
  protected resetToPrefill(): void {
    const baseline = this.prefillBaseline();
    if (baseline == null) {
      return;
    }
    this.openCvdRiskForm().reset({ ...baseline });
    this.zipUserEdited.set(false);
    this.sdiManual.set(false);
    this.lifeExpectancyLimited.set(false);
    this.pathogenicGeneticVariant.set(false);
    this.dismissedExclusionIds.set(new Set());
    this.proceedDespiteExclusions.set(false);
    this.clearCalculatedResults();
    this.autoCalculateAttemptedForPrefill = false;
    this.applyZipToSdi();
    this.tryAutoCalculateAfterPrefill();
  }

  private clearProceedIfNoExclusions(): void {
    if (!this.hasActiveExclusions()) {
      this.proceedDespiteExclusions.set(false);
    }
  }

  protected calculateRisk(): void {
    if (!this.canCalculate()) {
      return;
    }
    const hadExclusions = this.hasActiveExclusions();
    this.calculateLoading.set(true);
    this.cqlEvaluate
      .evaluateLibrary('OpenCVDRisk', [...RISK_EXPRESSIONS], this.buildLibraryParameters())
      .subscribe({
        next: (results) => {
          this.risk10yTotal.set(this.formatPercent(results['TenYearTotalCvdPercent']));
          this.risk10yAscvd.set(this.formatPercent(results['TenYearAscvdPercent']));
          this.risk10yHf.set(this.formatPercent(results['TenYearHeartFailurePercent']));
          this.risk10yChd.set(this.formatPercent(results['TenYearChdPercent']));
          this.risk10yStroke.set(this.formatPercent(results['TenYearStrokePercent']));
          this.openCvdRiskAge.set(
            this.formatRiskAgeDisplay(this.model().sex, results['BaseTenYearTotalCvdPercent']),
          );
          this.risk30yTotal.set(this.formatPercent(results['ThirtyYearTotalCvdPercent']));
          this.risk30yAscvd.set(this.formatPercent(results['ThirtyYearAscvdPercent']));
          this.risk30yHf.set(this.formatPercent(results['ThirtyYearHeartFailurePercent']));
          this.risk30yChd.set(this.formatPercent(results['ThirtyYearChdPercent']));
          this.risk30yStroke.set(this.formatPercent(results['ThirtyYearStrokePercent']));
          this.risk30yCvdPercentile.set(
            this.formatPercentileDisplay(
              this.model().age,
              this.model().sex,
              results['BaseThirtyYearTotalCvdPercent'],
            ),
          );
          const model = results['SelectedPreventModel'];
          this.selectedRiskModel.set(
            typeof model === 'string' &&
              (model === 'base' ||
                model === 'uacr' ||
                model === 'hba1c' ||
                model === 'sdi' ||
                model === 'full')
              ? model
              : this.activeRiskModel(),
          );
          this.calculatedWithExclusions.set(hadExclusions);
          this.calculateLoading.set(false);
        },
        error: (err) => {
          this.calculateLoading.set(false);
          this.toastDomainError(err);
        },
      });
  }

  /** Map the current form (and clinician exclusion flags) to OpenCVDRisk library parameters. */
  protected buildLibraryParameters(): Record<string, CqlLibraryParameterValue> {
    const m = this.model();
    const params: Record<string, CqlLibraryParameterValue> = {
      LifeExpectancyLimited: this.lifeExpectancyLimited(),
      PathogenicGeneticCvdVariant: this.pathogenicGeneticVariant(),
      OverrideDiabetes: m.diabetes === 'yes',
      OverrideCurrentSmoker: m.currentSmoker === 'yes',
      OverrideAntihypertensive: m.onAntihypertensive === 'yes',
      OverrideStatin: m.onStatin === 'yes',
    };

    if (m.age != null && Number.isFinite(m.age)) {
      params['OverrideAgeYears'] = { integer: Math.trunc(m.age) };
    }
    if (m.sex === 'female' || m.sex === 'male') {
      params['OverrideIsFemale'] = m.sex === 'female';
    }
    if (m.totalCholesterolMgDl != null && Number.isFinite(m.totalCholesterolMgDl)) {
      params['OverrideTotalCholMgDl'] = { decimal: m.totalCholesterolMgDl };
    }
    if (m.hdlMgDl != null && Number.isFinite(m.hdlMgDl)) {
      params['OverrideHdlMgDl'] = { decimal: m.hdlMgDl };
    }
    if (m.systolicBpMmHg != null && Number.isFinite(m.systolicBpMmHg)) {
      params['OverrideSbpMmHg'] = { decimal: m.systolicBpMmHg };
    }
    if (m.egfrMlMin173m2 != null && Number.isFinite(m.egfrMlMin173m2)) {
      params['OverrideEgfr'] = { decimal: m.egfrMlMin173m2 };
    }
    const bmi = this.bmiKgM2();
    if (bmi != null && Number.isFinite(bmi)) {
      params['OverrideBmiKgM2'] = { decimal: bmi };
    }
    // Only pass optionals that pass the same in-range checks as CQL HasValid* / model selection.
    if (isValidUacr(m.uacrMgG)) {
      params['OverrideUacrMgG'] = { decimal: m.uacrMgG as number };
    }
    if (isValidHba1c(m.hba1cPercent)) {
      params['OverrideHba1cPercent'] = { decimal: m.hba1cPercent as number };
    }
    if (isValidSdi(m.sdiDecile)) {
      params['OverrideSdiDecile'] = { integer: m.sdiDecile as number };
    }

    return params;
  }

  private enterBlankCalculatorSession(): void {
    this.patientContext.enterBlankSession();
    this.resetFormAndResults();
  }

  private runPrefill(): void {
    if (this.isBlankSession()) {
      return;
    }
    this.prefillLoading.set(true);
    this.autoCalculateAttemptedForPrefill = false;
    this.prefillService.prefillFromChart().subscribe({
      next: (result) => {
        this.model.update((m) => ({ ...m, ...result.form }));
        const map: Partial<Record<string, FieldProvenance>> = {};
        for (const p of result.provenances) {
          map[p.field] = p;
        }
        this.provenances.set(map);
        this.prefillBaseline.set({ ...this.model() });
        this.chartExclusions.set(result.exclusions);
        this.dismissedExclusionIds.set(new Set());
        this.proceedDespiteExclusions.set(false);
        this.prefillLoading.set(false);
        this.tryAutoCalculateAfterPrefill();
      },
      error: (err) => {
        this.prefillLoading.set(false);
        this.chartExclusions.set([]);
        this.prefillBaseline.set({ ...this.model() });
        this.toastDomainError(err, 'Prefill failed: ', 'warning');
        this.tryAutoCalculateAfterPrefill();
      },
    });
  }

  /** Run Calculate when the form is submittable (optionally waiting on ZIP→SDI). */
  private tryAutoCalculateAfterPrefill(): void {
    if (
      this.isBlankSession() ||
      this.autoCalculateAttemptedForPrefill ||
      this.prefillLoading() ||
      this.calculateLoading()
    ) {
      return;
    }
    // ZIP→SDI uses async SDI2019 $evaluate; wait so the first calc includes SDI when available.
    if (normalizeZip(this.model().zipCode) != null && this.sdiLookupStatus() === 'loading') {
      return;
    }
    if (!this.canCalculate()) {
      return;
    }
    this.autoCalculateAttemptedForPrefill = true;
    this.calculateRisk();
  }

  private applyPatientDemographics(patient: Patient): void {
    const age = this.ageFromBirthDate(patient.birthDate);
    let sex: OpenCVDRiskSex | '' = '';
    if (patient.gender === 'female') {
      sex = 'female';
    } else if (patient.gender === 'male') {
      sex = 'male';
    }
    const chartZip = postalCodeFromPatientAddress(patient.address);
    this.model.update((m) => ({
      ...m,
      age: age ?? m.age,
      sex: sex || m.sex,
      zipCode: this.zipUserEdited() ? m.zipCode : chartZip || m.zipCode,
    }));
    if (!this.zipUserEdited()) {
      this.sdiManual.set(false);
      this.applyZipToSdi();
    }
    const provenances = { ...this.provenances() };
    if (age != null) {
      const born = formatFhirDateTime(patient.birthDate);
      provenances['age'] = {
        field: 'age',
        summary: born ? `Born ${born}` : '',
      };
    }
    if (sex) {
      delete provenances['sex'];
    }
    if (chartZip && !this.zipUserEdited()) {
      provenances['zipCode'] = {
        field: 'zipCode',
        summary: `Chart address ZIP ${chartZip}`,
      };
    }
    this.provenances.set(provenances);
  }

  /** Keep Reset/provenance aligned when async ZIP→SDI fills after prefillBaseline was captured. */
  private syncPrefillBaselineFromModel(): void {
    if (this.prefillBaseline() == null || this.zipUserEdited() || this.sdiManual()) {
      return;
    }
    this.prefillBaseline.set({ ...this.model() });
  }

  /** Resolve ZIP → SDI decile via server-side SDI2019 CQL ($evaluate). */
  private applyZipToSdi(): void {
    if (this.sdiManual()) {
      this.sdiLookupStatus.set('manual');
      return;
    }
    const key = normalizeZip(this.model().zipCode);
    if (key == null) {
      this.sdiLookupSeq += 1;
      this.model.update((m) => ({ ...m, sdiDecile: null }));
      this.sdiLookupStatus.set('blank');
      return;
    }
    if (!this.selectedPatient()?.id) {
      this.sdiLookupSeq += 1;
      this.model.update((m) => ({ ...m, sdiDecile: null }));
      this.sdiLookupStatus.set('blank');
      return;
    }

    const seq = ++this.sdiLookupSeq;
    this.sdiLookupStatus.set('loading');
    this.cqlEvaluate
      .evaluateLibrary('SDI2019', ['SdiDecile'], { OverrideZipCode: key })
      .subscribe({
        next: (results) => {
          if (seq !== this.sdiLookupSeq || this.sdiManual()) {
            return;
          }
          const raw = results['SdiDecile'];
          const decile =
            typeof raw === 'number' && Number.isInteger(raw) && raw >= 1 && raw <= 10
              ? raw
              : null;
          if (decile == null) {
            this.model.update((m) => ({ ...m, sdiDecile: null }));
            this.sdiLookupStatus.set('missing');
          } else {
            this.model.update((m) => ({ ...m, sdiDecile: decile }));
            this.sdiLookupStatus.set('found');
          }
          this.syncPrefillBaselineFromModel();
          this.tryAutoCalculateAfterPrefill();
        },
        error: (err) => {
          if (seq !== this.sdiLookupSeq) {
            return;
          }
          this.model.update((m) => ({ ...m, sdiDecile: null }));
          this.sdiLookupStatus.set('blank');
          this.toastDomainError(err, 'SDI lookup failed: ', 'warning');
          this.tryAutoCalculateAfterPrefill();
        },
      });
  }

  private resetFormAndResults(): void {
    this.model.set({ ...EMPTY_FORM });
    this.provenances.set({});
    this.prefillBaseline.set(null);
    this.chartExclusions.set([]);
    this.dismissedExclusionIds.set(new Set());
    this.lifeExpectancyLimited.set(false);
    this.pathogenicGeneticVariant.set(false);
    this.proceedDespiteExclusions.set(false);
    this.zipUserEdited.set(false);
    this.sdiManual.set(false);
    this.autoCalculateAttemptedForPrefill = false;
    this.sdiLookupSeq += 1;
    this.sdiLookupStatus.set('blank');
    this.clearCalculatedResults();
  }

  private clearCalculatedResults(): void {
    this.calculatedWithExclusions.set(false);
    this.risk10yTotal.set(PLACEHOLDER);
    this.risk10yAscvd.set(PLACEHOLDER);
    this.risk10yHf.set(PLACEHOLDER);
    this.risk10yChd.set(PLACEHOLDER);
    this.risk10yStroke.set(PLACEHOLDER);
    this.openCvdRiskAge.set(PLACEHOLDER);
    this.risk30yTotal.set(PLACEHOLDER);
    this.risk30yAscvd.set(PLACEHOLDER);
    this.risk30yHf.set(PLACEHOLDER);
    this.risk30yChd.set(PLACEHOLDER);
    this.risk30yStroke.set(PLACEHOLDER);
    this.risk30yCvdPercentile.set(PLACEHOLDER);
    this.selectedRiskModel.set(null);
  }

  private isLocallyOverridden(field: string): boolean {
    const baseline = this.prefillBaseline();
    if (!baseline) {
      return false;
    }
    const current = this.model();
    if (field === 'bmi') {
      const currentBmi = this.bmiKgM2();
      const baselineBmi =
        baseline.heightCm != null &&
          baseline.weightKg != null &&
          baseline.heightCm > 0 &&
          baseline.weightKg > 0
          ? computeBmiKgM2(baseline.heightCm, baseline.weightKg)
          : null;
      if (currentBmi == null || baselineBmi == null) {
        return currentBmi !== baselineBmi;
      }
      return Math.abs(currentBmi - baselineBmi) > 0.05;
    }
    if (field === 'heightCm' || field === 'weightKg') {
      return current.heightCm !== baseline.heightCm || current.weightKg !== baseline.weightKg;
    }
    if (!(field in current)) {
      return false;
    }
    const key = field as keyof OpenCVDRiskCalculatorForm;
    return current[key] !== baseline[key];
  }

  private ageFromBirthDate(birthDate: string | undefined): number | null {
    if (!birthDate) {
      return null;
    }
    const born = new Date(birthDate);
    if (Number.isNaN(born.getTime())) {
      return null;
    }
    const today = new Date();
    let age = today.getFullYear() - born.getFullYear();
    const m = today.getMonth() - born.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < born.getDate())) {
      age -= 1;
    }
    return age;
  }

  private isSex(value: string): value is OpenCVDRiskSex {
    return value === 'female' || value === 'male';
  }

  private toastDomainError(
    err: unknown,
    prefix = '',
    variant: 'danger' | 'warning' = 'danger',
  ): void {
    if (isHttpOfflineOrServerError(err)) {
      return;
    }
    const detail = err instanceof Error ? err.message : String(err);
    this.toasts.show(`${prefix}${detail}`, variant);
  }

  private formatNumber(value: number | null, fractionDigits: number): string {
    if (value == null || !Number.isFinite(value)) {
      return PLACEHOLDER;
    }
    return value.toLocaleString(undefined, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
  }

  private formatPercent(value: unknown): string {
    const n = typeof value === 'number' ? value : null;
    if (n == null || !Number.isFinite(n)) {
      return PLACEHOLDER;
    }
    return this.formatNumber(n, 1);
  }

  private formatRiskAgeDisplay(sex: OpenCVDRiskSex | '', baseTenYearTotalCvdPercent: unknown): string {
    if (sex !== 'female' && sex !== 'male') {
      return PLACEHOLDER;
    }
    if (
      typeof baseTenYearTotalCvdPercent !== 'number' ||
      !Number.isFinite(baseTenYearTotalCvdPercent)
    ) {
      return PLACEHOLDER;
    }
    return (
      formatPreventRiskAgeDisplay(sex as PreventSex, baseTenYearTotalCvdPercent) ?? PLACEHOLDER
    );
  }

  private formatPercentileDisplay(
    ageYears: number | null,
    sex: OpenCVDRiskSex | '',
    baseThirtyYearTotalCvdPercent: unknown,
  ): string {
    if (sex !== 'female' && sex !== 'male') {
      return PLACEHOLDER;
    }
    if (ageYears == null || !Number.isFinite(ageYears)) {
      return PLACEHOLDER;
    }
    if (
      typeof baseThirtyYearTotalCvdPercent !== 'number' ||
      !Number.isFinite(baseThirtyYearTotalCvdPercent)
    ) {
      return PLACEHOLDER;
    }
    return (
      formatPrevent30yCvdPercentileDisplay(
        ageYears,
        sex as PreventSex,
        baseThirtyYearTotalCvdPercent,
      ) ?? PLACEHOLDER
    );
  }
}
