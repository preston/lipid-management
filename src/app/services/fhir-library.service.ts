// Author: Preston Lee

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Library } from 'fhir/r4';
import { firstValueFrom } from 'rxjs';
import { SettingsService } from './settings.service';
import { decodeUtf8Base64, encodeUtf8Base64 } from './utf8-encoding.lib';
import { CQL_LIBRARY_CATALOG, CqlLibraryCatalogEntry } from '../features/loader/loader.catalog';

export type LibraryContentStatus =
  | 'missing'
  | 'match'
  | 'differs'
  | 'version_mismatch'
  | 'no_text_cql'
  | 'error';

export interface LibraryAuditResult {
  catalogId: string;
  label: string;
  appVersion: string | null;
  serverVersion: string | null;
  status: LibraryContentStatus;
  message?: string;
  appCql?: string;
  serverCql?: string;
}

@Injectable({
  providedIn: 'root',
})
export class FhirLibraryService {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(SettingsService);

  private baseUrl(): string {
    return this.settings.getEffectiveFhirBaseUrl().replace(/\/$/, '');
  }

  async fetchAppCql(assetPath: string): Promise<string> {
    return firstValueFrom(this.http.get(assetPath, { responseType: 'text' }));
  }

  async getLibrary(id: string): Promise<Library | null> {
    try {
      return await firstValueFrom(this.http.get<Library>(`${this.baseUrl()}/Library/${id}`));
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 404) {
        return null;
      }
      throw err;
    }
  }

  async putLibrary(library: Library): Promise<Library> {
    const id = library.id;
    if (!id) {
      throw new Error('Library.id is required for PUT');
    }
    return firstValueFrom(
      this.http.put<Library>(`${this.baseUrl()}/Library/${id}`, library, {
        headers: { 'Content-Type': 'application/fhir+json' },
      }),
    );
  }

  buildLibraryFromCql(cqlContent: string, fileName: string): Library {
    const contentWithoutComments = this.stripCqlComments(cqlContent);
    const libraryNameMatch = contentWithoutComments.match(/library\s+(\w+)/i);
    const libraryName = libraryNameMatch ? libraryNameMatch[1] : fileName.replace(/\.cql$/i, '');

    const cqlVersionMatch = contentWithoutComments.match(/version\s+['"]([^'"]+)['"]/i);
    const cqlVersion = cqlVersionMatch ? cqlVersionMatch[1] : '0.0.0';

    const descriptionMatch = cqlContent.match(/\/\*\*([\s\S]*?)\*\//);
    const description = descriptionMatch
      ? descriptionMatch[1].trim().replace(/\s+/g, ' ').slice(0, 500)
      : `CQL Library: ${libraryName}`;

    const canonicalUrl = `${this.baseUrl()}/Library/${libraryName}`;

    return {
      resourceType: 'Library',
      id: libraryName,
      version: cqlVersion,
      name: libraryName,
      title: libraryName,
      status: 'active',
      description,
      url: canonicalUrl,
      type: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/library-type',
            code: 'logic-library',
          },
        ],
      },
      content: [
        {
          contentType: 'text/cql',
          data: encodeUtf8Base64(cqlContent),
        },
      ],
    };
  }

  parseAppVersion(cqlContent: string): string | null {
    const contentWithoutComments = this.stripCqlComments(cqlContent);
    const match = contentWithoutComments.match(/version\s+['"]([^'"]+)['"]/i);
    return match ? match[1] : null;
  }

  extractTextCql(library: Library): string | null {
    const attachment = library.content?.find((c) => c.contentType === 'text/cql' && c.data);
    if (!attachment?.data) {
      return null;
    }
    try {
      return decodeUtf8Base64(attachment.data);
    } catch {
      return null;
    }
  }

  normalizeCql(text: string): string {
    return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  }

  async loadCatalogLibraries(
    entries: readonly CqlLibraryCatalogEntry[] = CQL_LIBRARY_CATALOG,
  ): Promise<LibraryAuditResult[]> {
    const results: LibraryAuditResult[] = [];
    for (const entry of entries) {
      try {
        const cql = await this.fetchAppCql(entry.assetPath);
        const library = this.buildLibraryFromCql(cql, `${entry.id}.cql`);
        await this.putLibrary(library);
        results.push({
          catalogId: entry.id,
          label: entry.label,
          appVersion: this.parseAppVersion(cql),
          serverVersion: library.version ?? null,
          status: 'match',
          message: 'Loaded',
          appCql: cql,
        });
      } catch (err) {
        results.push({
          catalogId: entry.id,
          label: entry.label,
          appVersion: null,
          serverVersion: null,
          status: 'error',
          message: this.errorMessage(err),
        });
      }
    }
    return results;
  }

  async auditCatalogLibraries(
    entries: readonly CqlLibraryCatalogEntry[] = CQL_LIBRARY_CATALOG,
  ): Promise<LibraryAuditResult[]> {
    const results: LibraryAuditResult[] = [];
    for (const entry of entries) {
      try {
        const appCql = await this.fetchAppCql(entry.assetPath);
        const appVersion = this.parseAppVersion(appCql);
        const server = await this.getLibrary(entry.id);
        if (!server) {
          results.push({
            catalogId: entry.id,
            label: entry.label,
            appVersion,
            serverVersion: null,
            status: 'missing',
            message: 'Not found on server',
            appCql,
          });
          continue;
        }
        const serverCql = this.extractTextCql(server);
        const serverVersion = server.version ?? null;
        if (serverCql == null) {
          results.push({
            catalogId: entry.id,
            label: entry.label,
            appVersion,
            serverVersion,
            status: 'no_text_cql',
            message: 'No text/cql on server',
            appCql,
          });
          continue;
        }
        const contentMatch = this.normalizeCql(appCql) === this.normalizeCql(serverCql);
        const versionMatch = appVersion === serverVersion;
        let status: LibraryContentStatus = 'match';
        let message: string | undefined;
        if (!contentMatch && !versionMatch) {
          status = 'differs';
          message = `Content differs; server version must be ${appVersion ?? '(unknown)'}`;
        } else if (!contentMatch) {
          status = 'differs';
          message = 'Content differs';
        } else if (!versionMatch) {
          status = 'version_mismatch';
          message = `Server version must be ${appVersion ?? '(unknown)'}`;
        }
        results.push({
          catalogId: entry.id,
          label: entry.label,
          appVersion,
          serverVersion,
          status,
          message,
          appCql,
          serverCql,
        });
      } catch (err) {
        results.push({
          catalogId: entry.id,
          label: entry.label,
          appVersion: null,
          serverVersion: null,
          status: 'error',
          message: this.errorMessage(err),
        });
      }
    }
    return results;
  }

  private stripCqlComments(cqlContent: string): string {
    const withoutBlockComments = cqlContent.replace(/\/\*[\s\S]*?\*\//g, '');
    return withoutBlockComments.replace(/\/\/[^\n\r]*(?=[\n\r]|$)/g, '');
  }

  private errorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const issue = (err.error as { issue?: { diagnostics?: string }[] })?.issue?.[0]?.diagnostics;
      return issue || err.message || `HTTP ${err.status}`;
    }
    if (err instanceof Error) {
      return err.message;
    }
    return String(err);
  }
}
