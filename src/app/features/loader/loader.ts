// Author: Preston Lee

import { Component, computed, inject, OnInit, signal } from '@angular/core';
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

interface CqlRow {
  catalogId: string;
  label: string;
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

@Component({
  selector: 'app-loader',
  imports: [FormsModule, RouterLink],
  templateUrl: './loader.html',
  styleUrl: './loader.scss',
})
export class Loader implements OnInit {
  protected readonly settingsService = inject(SettingsService);
  private readonly libraries = inject(FhirLibraryService);
  private readonly bundles = inject(FhirBundleLoaderService);

  protected readonly fhirBaseUrl = computed(() => this.settingsService.getEffectiveFhirBaseUrl());

  protected readonly fhirHelpersStatus = signal<'unknown' | 'present' | 'missing' | 'error'>(
    'unknown',
  );
  protected readonly busy = signal(false);
  protected readonly continueOnError = signal(false);

  protected readonly cqlRows = signal<CqlRow[]>(
    CQL_LIBRARY_CATALOG.map((e) => ({
      catalogId: e.id,
      label: e.label,
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

  protected readonly cqlSummary = computed(() => {
    const rows = this.cqlRows();
    const known = rows.filter((r) => r.status !== 'idle').length;
    if (known === 0) {
      return `${rows.length} libraries`;
    }
    const match = rows.filter((r) => r.status === 'match').length;
    return `${match}/${rows.length} match`;
  });

  protected readonly valueSetSummary = computed(() => {
    const rows = this.valueSetRows();
    const present = rows.filter((r) => r.status === 'present' || r.status === 'ok').length;
    const known = rows.filter((r) => r.status !== 'idle').length;
    if (known === 0) {
      return `${rows.length} packs`;
    }
    return `${present}/${rows.length} present`;
  });

  protected readonly examplePatientSummary = computed(() => {
    const patients = this.exampleRows().filter((r) => r.id === 'dakota' || r.id === 'dori');
    const present = patients.filter((r) => r.status === 'present' || r.status === 'ok').length;
    return `${present}/${patients.length} patients`;
  });

  ngOnInit(): void {
    void this.refreshFhirHelpers();
  }

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

  async refreshFhirHelpers(): Promise<void> {
    const status = await this.libraries.checkFhirHelpers();
    this.fhirHelpersStatus.set(status);
  }

  async checkAll(): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      await this.refreshFhirHelpers();
      await this.runCqlAudit();
      await this.runValueSetCheck();
      await this.runExampleCheck();
    } finally {
      this.busy.set(false);
    }
  }

  async loadCql(): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      const results = await this.libraries.loadCatalogLibraries();
      this.applyCqlResults(results);
    } finally {
      this.busy.set(false);
    }
  }

  async checkCql(): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      await this.runCqlAudit();
    } finally {
      this.busy.set(false);
    }
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
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      await this.bundles.loadValueSets(VALUE_SET_CATALOG, {
        continueOnError: this.continueOnError(),
        onProgress: (row) => this.patchValueSetRow(row),
      });
    } finally {
      this.busy.set(false);
    }
  }

  async checkValueSets(): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      await this.runValueSetCheck();
    } finally {
      this.busy.set(false);
    }
  }

  async loadExampleData(): Promise<void> {
    if (this.busy()) {
      return;
    }
    const selectedIds = new Set(
      this.exampleRows().filter((r) => r.selected).map((r) => r.id),
    );
    const selected = EXAMPLE_DATA_CATALOG.filter((e) => selectedIds.has(e.id));
    if (selected.length === 0) {
      return;
    }
    this.busy.set(true);
    try {
      await this.bundles.loadExampleData(selected, {
        continueOnError: this.continueOnError(),
        onProgress: (row) => this.patchExampleRow(row),
      });
    } finally {
      this.busy.set(false);
    }
  }

  async checkExampleData(): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      await this.runExampleCheck();
    } finally {
      this.busy.set(false);
    }
  }

  toggleExampleSelected(id: string, selected: boolean): void {
    this.exampleRows.update((rows) =>
      rows.map((r) => (r.id === id ? { ...r, selected } : r)),
    );
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
        return { ...next, expanded: row.expanded };
      }),
    );
  }

  private patchValueSetRow(row: BundleLoadRowResult): void {
    this.valueSetRows.update((rows) =>
      rows.map((r) =>
        r.id === row.id ? { ...r, status: row.status, message: row.message } : r,
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
