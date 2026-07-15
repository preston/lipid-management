// Author: Preston Lee

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Bundle, OperationOutcome, Patient } from 'fhir/r4';
import { firstValueFrom } from 'rxjs';
import { SettingsService } from './settings.service';
import {
  EXAMPLE_DATA_CATALOG,
  ExampleDataCatalogEntry,
  VALUE_SET_CATALOG,
  ValueSetCatalogEntry,
} from '../features/loader/loader.catalog';

export type RowLoadStatus = 'idle' | 'loading_asset' | 'uploading' | 'ok' | 'error' | 'present' | 'missing';

export interface BundleLoadRowResult {
  id: string;
  label: string;
  status: RowLoadStatus;
  message?: string;
}

@Injectable({
  providedIn: 'root',
})
export class FhirBundleLoaderService {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(SettingsService);

  private baseUrl(): string {
    return this.settings.getEffectiveFhirBaseUrl().replace(/\/$/, '');
  }

  async postBundle(bundle: Bundle): Promise<Bundle> {
    return firstValueFrom(
      this.http.post<Bundle>(this.baseUrl(), bundle, {
        headers: { 'Content-Type': 'application/fhir+json' },
      }),
    );
  }

  async loadValueSets(
    entries: readonly ValueSetCatalogEntry[] = VALUE_SET_CATALOG,
    options?: { continueOnError?: boolean; onProgress?: (row: BundleLoadRowResult) => void },
  ): Promise<BundleLoadRowResult[]> {
    const results: BundleLoadRowResult[] = [];
    const continueOnError = options?.continueOnError ?? false;

    for (const entry of entries) {
      const row: BundleLoadRowResult = {
        id: entry.id,
        label: entry.label,
        status: 'loading_asset',
      };
      options?.onProgress?.(row);
      try {
        const bundle = await firstValueFrom(this.http.get<Bundle>(entry.assetPath));
        row.status = 'uploading';
        options?.onProgress?.(row);
        await this.postBundle(bundle);
        row.status = 'ok';
        row.message = 'Loaded';
      } catch (err) {
        row.status = 'error';
        row.message = this.errorMessage(err);
        results.push({ ...row });
        options?.onProgress?.(row);
        if (!continueOnError) {
          break;
        }
        continue;
      }
      results.push({ ...row });
      options?.onProgress?.(row);
    }
    return results;
  }

  async checkValueSets(
    entries: readonly ValueSetCatalogEntry[] = VALUE_SET_CATALOG,
  ): Promise<BundleLoadRowResult[]> {
    const results: BundleLoadRowResult[] = [];
    for (const entry of entries) {
      try {
        await firstValueFrom(this.http.get(`${this.baseUrl()}/ValueSet/${entry.id}`));
        results.push({ id: entry.id, label: entry.label, status: 'present' });
      } catch (err) {
        if (err instanceof HttpErrorResponse && err.status === 404) {
          results.push({ id: entry.id, label: entry.label, status: 'missing' });
        } else {
          results.push({
            id: entry.id,
            label: entry.label,
            status: 'error',
            message: this.errorMessage(err),
          });
        }
      }
    }
    return results;
  }

  async loadExampleData(
    entries: readonly ExampleDataCatalogEntry[],
    options?: { continueOnError?: boolean; onProgress?: (row: BundleLoadRowResult) => void },
  ): Promise<BundleLoadRowResult[]> {
    const ordered = this.orderExampleEntries(entries);
    const results: BundleLoadRowResult[] = [];
    const continueOnError = options?.continueOnError ?? false;

    for (const entry of ordered) {
      const row: BundleLoadRowResult = {
        id: entry.id,
        label: entry.label,
        status: 'loading_asset',
      };
      options?.onProgress?.(row);
      try {
        const bundle = await firstValueFrom(this.http.get<Bundle>(entry.assetPath));
        row.status = 'uploading';
        options?.onProgress?.(row);
        const response = await this.postBundle(bundle);
        row.status = 'ok';
        row.message = this.summarizeBundleResponse(response);
      } catch (err) {
        row.status = 'error';
        row.message = this.errorMessage(err);
        results.push({ ...row });
        options?.onProgress?.(row);
        if (!continueOnError) {
          break;
        }
        continue;
      }
      results.push({ ...row });
      options?.onProgress?.(row);
    }
    return results;
  }

  async checkExampleData(
    entries: readonly ExampleDataCatalogEntry[] = EXAMPLE_DATA_CATALOG,
  ): Promise<BundleLoadRowResult[]> {
    const results: BundleLoadRowResult[] = [];
    for (const entry of entries) {
      try {
        const present = await this.isExampleEntryPresent(entry);
        results.push({
          id: entry.id,
          label: entry.label,
          status: present ? 'present' : 'missing',
          message: present
            ? entry.kind === 'patient'
              ? `Patient/${entry.resourceId}`
              : 'Heuristic presence check'
            : undefined,
        });
      } catch (err) {
        results.push({
          id: entry.id,
          label: entry.label,
          status: 'error',
          message: this.errorMessage(err),
        });
      }
    }
    return results;
  }

  orderExampleEntries(
    entries: readonly ExampleDataCatalogEntry[],
  ): ExampleDataCatalogEntry[] {
    const order = new Map(EXAMPLE_DATA_CATALOG.map((e, i) => [e.id, i]));
    return [...entries].sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
  }

  private async isExampleEntryPresent(entry: ExampleDataCatalogEntry): Promise<boolean> {
    if (entry.kind === 'patient' && entry.resourceId) {
      try {
        await firstValueFrom(
          this.http.get<Patient>(`${this.baseUrl()}/Patient/${entry.resourceId}`),
        );
        return true;
      } catch (err) {
        if (err instanceof HttpErrorResponse && err.status === 404) {
          return false;
        }
        throw err;
      }
    }

    if (entry.kind === 'hospital') {
      const bundle = await firstValueFrom(
        this.http.get<Bundle>(`${this.baseUrl()}/Organization`, { params: { _count: '1' } }),
      );
      return (bundle.entry?.length ?? 0) > 0;
    }

    if (entry.kind === 'practitioner') {
      const bundle = await firstValueFrom(
        this.http.get<Bundle>(`${this.baseUrl()}/Practitioner`, { params: { _count: '1' } }),
      );
      return (bundle.entry?.length ?? 0) > 0;
    }

    return false;
  }

  private summarizeBundleResponse(response: Bundle): string {
    const entries = response.entry?.length ?? 0;
    if (response.type === 'transaction-response' || response.type === 'batch-response') {
      return `Server accepted bundle (${entries} response entries)`;
    }
    return 'Uploaded';
  }

  private errorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const outcome = err.error as OperationOutcome | undefined;
      const diagnostics = outcome?.issue?.[0]?.diagnostics;
      const code = outcome?.issue?.[0]?.code;
      if (diagnostics) {
        return diagnostics;
      }
      if (code) {
        return `${code} (HTTP ${err.status})`;
      }
      return err.message || `HTTP ${err.status}`;
    }
    if (err instanceof Error) {
      return err.message;
    }
    return String(err);
  }
}
