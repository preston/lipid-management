// Author: Preston Lee

import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  CQL_LIBRARY_CATALOG,
  EXAMPLE_DATA_CATALOG,
  VALUE_SET_CATALOG,
  type ValueSetOrigin,
} from './loader.catalog';
import {
  FhirLibraryService,
  LibraryAuditResult,
  LibraryContentStatus,
} from '../../services/fhir-library.service';
import {
  BundleLoadRowResult,
  FhirBundleLoaderService,
  RowLoadStatus,
} from '../../services/fhir-bundle-loader.service';
import { SettingsService } from '../../services/settings.service';
import { FhirPackageService } from '../../services/fhir-package.service';
import { isHttpOfflineOrServerError, ToastService } from '../../services/toast.service';

interface CqlRow {
  catalogId: string;
  label: string;
  description: string;
  assetPath: string;
  downloadName: string;
  appVersion: string | null;
  serverVersion: string | null;
  status: LibraryContentStatus | 'idle';
  message?: string;
  appCql?: string;
  serverCql?: string;
  expanded: boolean;
}

interface ValueSetRow {
  id: string;
  label: string;
  origin: ValueSetOrigin;
  appVersion: string | null;
  serverVersion: string | null;
  status: RowLoadStatus;
  message?: string;
}

interface ExampleRow {
  id: string;
  label: string;
  sizeHint: string;
  selected: boolean;
  status: RowLoadStatus;
  message?: string;
}

type SummaryCounts = { ok: number; errors: number; other: number };

@Component({
  selector: 'app-loader',
  imports: [FormsModule, RouterLink],
  templateUrl: './loader.html',
  styleUrl: './loader.scss',
})
export class Loader {
  protected readonly settingsService = inject(SettingsService);
  private readonly libraries = inject(FhirLibraryService);
  private readonly bundles = inject(FhirBundleLoaderService);
  private readonly fhirPackage = inject(FhirPackageService);
  private readonly toasts = inject(ToastService);

  protected readonly fhirBaseUrl = computed(() => this.settingsService.getEffectiveFhirBaseUrl());

  protected readonly busy = signal(false);
  protected readonly continueOnError = signal(false);

  protected readonly cqlRows = signal<CqlRow[]>(
    CQL_LIBRARY_CATALOG.map((e) => ({
      catalogId: e.id,
      label: e.label,
      description: e.description,
      assetPath: e.assetPath,
      downloadName: e.assetPath.split('/').pop() ?? `${e.id}.cql`,
      appVersion: null,
      serverVersion: null,
      status: 'idle',
      expanded: false,
    })),
  );

  protected readonly valueSetRows = signal<ValueSetRow[]>(
    VALUE_SET_CATALOG.map((e) => ({
      id: e.id,
      label: e.label,
      origin: e.origin,
      appVersion: null,
      serverVersion: null,
      status: 'idle' as RowLoadStatus,
    })),
  );

  protected readonly exampleRows = signal<ExampleRow[]>(
    EXAMPLE_DATA_CATALOG.map((e) => ({
      id: e.id,
      label: e.label,
      sizeHint: e.sizeHint,
      selected: true,
      status: 'idle' as RowLoadStatus,
    })),
  );

  protected readonly valueSetSummary = computed(() => {
    const rows = this.valueSetRows();
    const known = rows.filter((r) => r.status !== 'idle').length;
    if (known === 0) {
      return `${rows.length} packs`;
    }
    const match = rows.filter((r) => r.status === 'match').length;
    return `${match}/${rows.length} match`;
  });

  protected statusBadgeClass(status: string): string {
    switch (status) {
      case 'match':
      case 'present':
      case 'ok':
        return 'text-bg-success';
      case 'missing':
      case 'idle':
      case 'unknown':
        return 'text-bg-secondary';
      case 'differs':
      case 'version_mismatch':
      case 'no_text_cql':
        return 'text-bg-warning';
      case 'error':
        return 'text-bg-danger';
      case 'loading_asset':
      case 'uploading':
        return 'text-bg-info';
      default:
        return 'text-bg-secondary';
    }
  }

  protected statusLabel(status: string): string {
    switch (status) {
      case 'version_mismatch':
        return 'Version mismatch';
      case 'no_text_cql':
        return 'No text/cql';
      case 'loading_asset':
        return 'Loading asset';
      case 'uploading':
        return 'Uploading';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  }

  async downloadFhirPackage(): Promise<void> {
    await this.runBusyOp('FHIR package download', async () => {
      this.toasts.info('Building FHIR package…');
      await this.fhirPackage.downloadPackage();
      this.toasts.success('FHIR package downloaded');
    });
  }

  async loadAll(): Promise<void> {
    await this.runBusyOp('Load', async () => {
      const cqlResults = await this.libraries.loadCatalogLibraries();
      this.applyCqlResults(cqlResults);
      await this.bundles.loadValueSets(VALUE_SET_CATALOG, {
        continueOnError: this.continueOnError(),
        onProgress: (row) => this.patchValueSetRow(row),
      });
      const selectedIds = new Set(
        this.exampleRows().filter((r) => r.selected).map((r) => r.id),
      );
      const selected = EXAMPLE_DATA_CATALOG.filter((e) => selectedIds.has(e.id));
      if (selected.length > 0) {
        await this.bundles.loadExampleData(selected, {
          continueOnError: this.continueOnError(),
          onProgress: (row) => this.patchExampleRow(row),
        });
      }
      this.toastSummary('Load finished', this.allRowStatuses());
    });
  }

  async checkAll(): Promise<void> {
    await this.runBusyOp('Check', async () => {
      await this.runCqlAudit();
      await this.runValueSetCheck();
      await this.runExampleCheck();
      this.toastSummary('Check finished', this.allRowStatuses());
    });
  }

  async loadCql(): Promise<void> {
    await this.runBusyOp('CQL load', async () => {
      const results = await this.libraries.loadCatalogLibraries();
      this.applyCqlResults(results);
      this.toastSummary('CQL load finished', this.cqlRows().map((r) => r.status));
    });
  }

  async checkCql(): Promise<void> {
    await this.runBusyOp('CQL check', async () => {
      await this.runCqlAudit();
      this.toastSummary('CQL check finished', this.cqlRows().map((r) => r.status));
    });
  }

  async auditCql(): Promise<void> {
    await this.checkCql();
  }

  toggleCqlExpand(catalogId: string): void {
    this.cqlRows.update((rows) =>
      rows.map((r) =>
        r.catalogId === catalogId ? { ...r, expanded: !r.expanded } : r,
      ),
    );
  }

  async loadValueSets(): Promise<void> {
    await this.runBusyOp('ValueSet load', async () => {
      await this.bundles.loadValueSets(VALUE_SET_CATALOG, {
        continueOnError: this.continueOnError(),
        onProgress: (row) => this.patchValueSetRow(row),
      });
      this.toastSummary(
        'ValueSet load finished',
        this.valueSetRows().map((r) => r.status),
      );
    });
  }

  async checkValueSets(): Promise<void> {
    await this.runBusyOp('ValueSet check', async () => {
      await this.runValueSetCheck();
      this.toastSummary(
        'ValueSet check finished',
        this.valueSetRows().map((r) => r.status),
      );
    });
  }

  async loadExampleData(): Promise<void> {
    const selectedIds = new Set(
      this.exampleRows().filter((r) => r.selected).map((r) => r.id),
    );
    const selected = EXAMPLE_DATA_CATALOG.filter((e) => selectedIds.has(e.id));
    if (selected.length === 0) {
      return;
    }
    await this.runBusyOp('Example load', async () => {
      await this.bundles.loadExampleData(selected, {
        continueOnError: this.continueOnError(),
        onProgress: (row) => this.patchExampleRow(row),
      });
      this.toastSummary(
        'Example load finished',
        this.exampleRows()
          .filter((r) => selectedIds.has(r.id))
          .map((r) => r.status),
      );
    });
  }

  async checkExampleData(): Promise<void> {
    await this.runBusyOp('Example check', async () => {
      await this.runExampleCheck();
      this.toastSummary(
        'Example check finished',
        this.exampleRows().map((r) => r.status),
      );
    });
  }

  toggleExampleSelected(id: string, selected: boolean): void {
    this.exampleRows.update((rows) =>
      rows.map((r) => (r.id === id ? { ...r, selected } : r)),
    );
  }

  private async runBusyOp(label: string, op: () => Promise<void>): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      await op();
    } catch (err) {
      if (!isHttpOfflineOrServerError(err)) {
        const detail = err instanceof Error ? err.message : String(err);
        this.toasts.danger(`${label} failed: ${detail}`);
      }
    } finally {
      this.busy.set(false);
    }
  }

  private allRowStatuses(): string[] {
    return [
      ...this.cqlRows().map((r) => r.status),
      ...this.valueSetRows().map((r) => r.status),
      ...this.exampleRows().map((r) => r.status),
    ];
  }

  private countStatuses(statuses: string[]): SummaryCounts {
    let ok = 0;
    let errors = 0;
    let other = 0;
    for (const status of statuses) {
      if (status === 'idle' || status === 'loading_asset' || status === 'uploading') {
        continue;
      }
      if (status === 'error') {
        errors += 1;
      } else if (status === 'match' || status === 'present' || status === 'ok') {
        ok += 1;
      } else {
        other += 1;
      }
    }
    return { ok, errors, other };
  }

  private toastSummary(prefix: string, statuses: string[]): void {
    const { ok, errors, other } = this.countStatuses(statuses);
    const parts = [`${ok} ok`];
    if (errors > 0) {
      parts.push(`${errors} error${errors === 1 ? '' : 's'}`);
    }
    if (other > 0) {
      parts.push(`${other} other`);
    }
    const message = `${prefix}: ${parts.join(', ')}`;
    if (errors > 0) {
      this.toasts.warning(message);
    } else {
      this.toasts.success(message);
    }
  }

  private async runCqlAudit(): Promise<void> {
    const results = await this.libraries.auditCatalogLibraries();
    this.applyCqlResults(results);
  }

  private async runValueSetCheck(): Promise<void> {
    const results = await this.bundles.checkValueSets();
    for (const row of results) {
      this.patchValueSetRow(row);
    }
  }

  private async runExampleCheck(): Promise<void> {
    const selectedIds = new Set(
      this.exampleRows().filter((r) => r.selected).map((r) => r.id),
    );
    const selected = EXAMPLE_DATA_CATALOG.filter((e) => selectedIds.has(e.id));
    const results = await this.bundles.checkExampleData(
      selected.length > 0 ? selected : EXAMPLE_DATA_CATALOG,
    );
    for (const row of results) {
      this.patchExampleRow(row);
    }
  }

  private applyCqlResults(results: LibraryAuditResult[]): void {
    const byId = new Map(results.map((r) => [r.catalogId, r]));
    this.cqlRows.update((rows) =>
      rows.map((row) => {
        const next = byId.get(row.catalogId);
        if (!next) {
          return row;
        }
        return {
          ...row,
          label: next.label,
          appVersion: next.appVersion,
          serverVersion: next.serverVersion,
          status: next.status,
          message: next.message,
          appCql: next.appCql,
          serverCql: next.serverCql,
          expanded: row.expanded,
        };
      }),
    );
  }

  private patchValueSetRow(row: BundleLoadRowResult): void {
    this.valueSetRows.update((rows) =>
      rows.map((r) =>
        r.id === row.id
          ? {
              ...r,
              status: row.status,
              message: row.message,
              appVersion: row.appVersion !== undefined ? row.appVersion ?? null : r.appVersion,
              serverVersion:
                row.serverVersion !== undefined ? row.serverVersion ?? null : r.serverVersion,
            }
          : r,
      ),
    );
  }

  private patchExampleRow(row: BundleLoadRowResult): void {
    this.exampleRows.update((rows) =>
      rows.map((r) =>
        r.id === row.id ? { ...r, status: row.status, message: row.message } : r,
      ),
    );
  }
}
