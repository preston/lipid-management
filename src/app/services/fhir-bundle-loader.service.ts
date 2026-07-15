// Author: Preston Lee

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Bundle, OperationOutcome, Patient, ValueSet } from 'fhir/r4';
import { firstValueFrom } from 'rxjs';
import { SettingsService } from './settings.service';
import {
  EXAMPLE_DATA_CATALOG,
  ExampleDataCatalogEntry,
  VALUE_SET_CATALOG,
  ValueSetCatalogEntry,
} from '../features/loader/loader.catalog';

export type RowLoadStatus =
  | 'idle'
  | 'loading_asset'
  | 'uploading'
  | 'ok'
  | 'error'
  | 'present'
  | 'missing'
  | 'match'
  | 'version_mismatch';

export interface BundleLoadRowResult {
  id: string;
  label: string;
  status: RowLoadStatus;
  message?: string;
  appVersion?: string | null;
  serverVersion?: string | null;
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
        const appVersion = this.normalizeVersion(this.valueSetVersionFromBundle(bundle));
        row.appVersion = appVersion;
        if (appVersion == null) {
          row.status = 'error';
          row.message = 'App ValueSet asset has no version';
          results.push({ ...row });
          options?.onProgress?.(row);
          if (!continueOnError) {
            break;
          }
          continue;
        }
        row.status = 'uploading';
        options?.onProgress?.(row);
        await this.postBundle(bundle);
        const server = await this.getValueSet(entry.id);
        const serverVersion = this.normalizeVersion(server?.version ?? null);
        row.serverVersion = serverVersion;
        if (!server) {
          row.status = 'missing';
          row.message = 'Upload completed but ValueSet not found on server';
        } else if (serverVersion !== appVersion) {
          row.status = 'version_mismatch';
          row.message = `Server version must be ${appVersion}`;
        } else {
          row.status = 'match';
          row.message = 'Loaded';
        }
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
        const appBundle = await firstValueFrom(this.http.get<Bundle>(entry.assetPath));
        const appVersion = this.normalizeVersion(this.valueSetVersionFromBundle(appBundle));
        if (appVersion == null) {
          results.push({
            id: entry.id,
            label: entry.label,
            status: 'error',
            appVersion: null,
            message: 'App ValueSet asset has no version',
          });
          continue;
        }

        const server = await this.getValueSet(entry.id);
        if (!server) {
          results.push({
            id: entry.id,
            label: entry.label,
            status: 'missing',
            appVersion,
            serverVersion: null,
            message: 'Not found on server',
          });
          continue;
        }

        const serverVersion = this.normalizeVersion(server.version ?? null);
        if (serverVersion !== appVersion) {
          results.push({
            id: entry.id,
            label: entry.label,
            status: 'version_mismatch',
            appVersion,
            serverVersion,
            message: `Server version must be ${appVersion}`,
          });
        } else {
          results.push({
            id: entry.id,
            label: entry.label,
            status: 'match',
            appVersion,
            serverVersion,
          });
        }
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
        const response = await this.postBundle(this.preserveResourceIds(bundle));
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

  private valueSetVersionFromBundle(bundle: Bundle): string | null {
    const resource = bundle.entry?.[0]?.resource;
    if (!resource || resource.resourceType !== 'ValueSet') {
      return null;
    }
    return (resource as ValueSet).version ?? null;
  }

  private normalizeVersion(version: string | null | undefined): string | null {
    if (version == null) {
      return null;
    }
    const trimmed = version.trim();
    return trimmed === '' ? null : trimmed;
  }

  private async getValueSet(id: string): Promise<ValueSet | null> {
    try {
      return await firstValueFrom(
        this.http.get<ValueSet>(`${this.baseUrl()}/ValueSet/${encodeURIComponent(id)}`),
      );
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 404) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Synthea transaction bundles use POST, so HAPI assigns new ids. Rewrite to PUT by
   * resource id so catalog Patient/{resourceId} checks and app patient selection work.
   */
  private preserveResourceIds(bundle: Bundle): Bundle {
    const entries = bundle.entry?.map((entry) => {
      const resource = entry.resource;
      if (!resource || resource.resourceType === 'Bundle') {
        return entry;
      }
      const id = 'id' in resource ? resource.id : undefined;
      if (!id) {
        return entry;
      }
      return {
        ...entry,
        request: {
          method: 'PUT' as const,
          url: `${resource.resourceType}/${id}`,
        },
      };
    });
    return { ...bundle, entry: entries };
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
