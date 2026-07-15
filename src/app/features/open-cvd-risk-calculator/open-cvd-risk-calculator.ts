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

const PLACEHOLDER = '—';

type PatientSource = 'server' | 'file';

type FileStatus = { message: string };

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
  protected readonly searchLoading = signal(false);
  protected readonly patientSource = signal<PatientSource>('server');
  protected readonly fileStatus = signal<FileStatus | null>(null);
  protected readonly prefillLoading = signal(false);
  protected readonly calculateLoading = signal(false);

  protected readonly risk10yTotal = signal<string>(PLACEHOLDER);
  protected readonly risk10yAscvd = signal<string>(PLACEHOLDER);
  protected readonly risk10yHf = signal<string>(PLACEHOLDER);
  protected readonly risk30yTotal = signal<string>(PLACEHOLDER);

  protected readonly isSmart = this.patientContext.isSmart;
  protected readonly selectedPatient = this.patientContext.selectedPatient;
  protected readonly hasClientData = this.patientContext.hasClientData;

  protected readonly openCvdRiskForm = form(this.model, (fields) => {
    required(fields.age);
    min(fields.age, 1);
    max(fields.age, 120);
    required(fields.sex);
    required(fields.heightCm);
    min(fields.heightCm, 1);
    required(fields.weightKg);
    min(fields.weightKg, 1);
    required(fields.totalCholesterolMgDl);
    min(fields.totalCholesterolMgDl, 0);
    required(fields.hdlMgDl);
    min(fields.hdlMgDl, 0);
    required(fields.systolicBpMmHg);
    min(fields.systolicBpMmHg, 0);
    required(fields.egfrMlMin173m2);
    min(fields.egfrMlMin173m2, 0);
  });

  protected readonly bmiKgM2 = computed(() => {
    const { heightCm, weightKg } = this.model();
    if (heightCm == null || weightKg == null || heightCm <= 0 || weightKg <= 0) {
      return null;
    }
    return computeBmiKgM2(heightCm, weightKg);
  });

  protected readonly bmiDisplay = computed(() => this.formatNumber(this.bmiKgM2(), 1));

  /** Required PREVENT inputs have values (presence only; age band is a separate applicability check). */
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

  protected readonly ageInPreventRange = computed(() => {
    const age = this.model().age;
    return age != null && age >= 30 && age <= 79;
  });

  protected readonly activeExclusions = computed((): PreventExclusion[] => {
    const dismissed = this.dismissedExclusionIds();
    const fromChart = this.chartExclusions().filter((e) => !dismissed.has(e.id));
    const clinician: PreventExclusion[] = [];
    if (
      this.model().age != null &&
      !this.ageInPreventRange() &&
      !dismissed.has('age-out-of-range') &&
      !fromChart.some((e) => e.id === 'age-out-of-range')
    ) {
      clinician.push({
        id: 'age-out-of-range',
        message: 'Age outside 30–79 years',
        source: 'clinician',
        provenance: 'PREVENT equations require age 30–79.',
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
    const patient = this.selectedPatient();
    if (!patient) {
      return null;
    }
    return {
      name: this.patientContext.patientDisplayName(patient),
      gender: patient.gender ?? '—',
      birthDate: patient.birthDate ?? '—',
      ageYears: this.ageFromBirthDate(patient.birthDate),
    };
  });

  protected readonly canCalculate = computed(() => {
    if (this.selectedPatient() == null || this.calculateLoading() || !this.inputsComplete()) {
      return false;
    }
    if (this.hasActiveExclusions() && !this.proceedDespiteExclusions()) {
      return false;
    }
    return true;
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
    if (this.selectedPatient()) {
      this.applyPatientDemographics(this.selectedPatient()!);
      this.runPrefill();
    }
  }

  protected setPatientSource(source: PatientSource): void {
    if (this.patientSource() === source) {
      return;
    }
    this.patientSource.set(source);
    this.searchHits.set([]);
    this.searchQuery.set('');
    this.fileStatus.set(null);
  }

  protected searchPatients(): void {
    this.searchLoading.set(true);
    this.fhirPatients.searchByName(this.searchQuery()).subscribe({
      next: (hits) => {
        this.searchHits.set(hits);
        this.searchLoading.set(false);
      },
      error: (err) => {
        this.searchLoading.set(false);
        this.toastDomainError(err);
      },
    });
  }

  protected selectPatient(hit: PatientSearchHit): void {
    this.patientContext.setStandalonePatient(hit.patient);
    this.searchHits.set([]);
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
    this.patientContext.clearPatient();
    this.fileStatus.set(null);
    this.resetFormAndResults();
  }

  protected provenanceFor(field: string): string | null {
    if (this.isLocallyOverridden(field)) {
      return 'Overridden locally; Calculate sends this value as a CQL library parameter.';
    }
    return this.provenances()[field]?.summary ?? null;
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
      .evaluateLibrary(
        'OpenCVDRisk',
        [
          'TenYearTotalCvdPercent',
          'TenYearAscvdProbability',
          'TenYearHeartFailureProbability',
          'ThirtyYearTotalCvdPercent',
        ],
        this.buildLibraryParameters(),
      )
      .subscribe({
        next: (results) => {
          this.risk10yTotal.set(this.formatPercent(results['TenYearTotalCvdPercent']));
          this.risk10yAscvd.set(
            this.formatProbabilityAsPercent(results['TenYearAscvdProbability']),
          );
          this.risk10yHf.set(
            this.formatProbabilityAsPercent(results['TenYearHeartFailureProbability']),
          );
          this.risk30yTotal.set(this.formatPercent(results['ThirtyYearTotalCvdPercent']));
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

    return params;
  }

  private runPrefill(): void {
    this.prefillLoading.set(true);
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
      },
      error: (err) => {
        this.prefillLoading.set(false);
        this.chartExclusions.set([]);
        this.toastDomainError(err, 'Prefill failed: ', 'warning');
      },
    });
  }

  private applyPatientDemographics(patient: Patient): void {
    const age = this.ageFromBirthDate(patient.birthDate);
    let sex: OpenCVDRiskSex | '' = '';
    if (patient.gender === 'female') {
      sex = 'female';
    } else if (patient.gender === 'male') {
      sex = 'male';
    }
    this.model.update((m) => ({
      ...m,
      age: age ?? m.age,
      sex: sex || m.sex,
    }));
    const provenances = { ...this.provenances() };
    if (age != null) {
      provenances['age'] = {
        field: 'age',
        summary: `Derived from date of birth${patient.birthDate ? ` (${patient.birthDate})` : ''}. Override if age for scoring should differ.`,
      };
    }
    if (sex) {
      provenances['sex'] = {
        field: 'sex',
        summary: `From recorded gender (${patient.gender}). Override if administrative sex is not appropriate for PREVENT.`,
      };
    }
    this.provenances.set(provenances);
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
    this.calculatedWithExclusions.set(false);
    this.risk10yTotal.set(PLACEHOLDER);
    this.risk10yAscvd.set(PLACEHOLDER);
    this.risk10yHf.set(PLACEHOLDER);
    this.risk30yTotal.set(PLACEHOLDER);
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

  private formatProbabilityAsPercent(value: unknown): string {
    const n = typeof value === 'number' ? value : null;
    if (n == null || !Number.isFinite(n)) {
      return PLACEHOLDER;
    }
    return this.formatNumber(n * 100, 1);
  }
}
