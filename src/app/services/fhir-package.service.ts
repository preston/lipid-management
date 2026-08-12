// Author: Preston Lee

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Bundle, Resource, ValueSet } from 'fhir/r4';
import { firstValueFrom } from 'rxjs';
import {
  CQL_LIBRARY_CATALOG,
  EXAMPLE_DATA_CATALOG,
  VALUE_SET_CATALOG,
} from '../features/loader/loader.catalog';
import { FhirLibraryService } from './fhir-library.service';
import {
  PACKAGE_LIBRARY_CANONICAL_BASE,
  TarEntry,
  buildIndexJson,
  buildPackageJson,
  buildTarGz,
  encodeUtf8Json,
  packageArchiveFileName,
  parseCqlRelatedArtifacts,
  resourceFileName,
  triggerBlobDownload,
} from './fhir-package.lib';

@Injectable({
  providedIn: 'root',
})
export class FhirPackageService {
  private readonly http = inject(HttpClient);
  private readonly libraries = inject(FhirLibraryService);

  async downloadPackage(): Promise<void> {
    const { archive, filename } = await this.buildPackageArchive();
    const blob = new Blob([new Uint8Array(archive)], { type: 'application/gzip' });
    triggerBlobDownload(blob, filename);
  }

  async buildPackageArchive(): Promise<{ archive: Uint8Array; filename: string }> {
    const lipMgmtEntry = CQL_LIBRARY_CATALOG.find((e) => e.id === 'LipidManagement');
    if (!lipMgmtEntry) {
      throw new Error('LipidManagement library not found in catalog');
    }

    const lipMgmtCql = await this.libraries.fetchAppCql(lipMgmtEntry.assetPath);
    const version = this.libraries.parseAppVersion(lipMgmtCql);
    if (!version) {
      throw new Error('LipidManagement CQL has no version');
    }

    const cqlCache = new Map<string, string>([['LipidManagement', lipMgmtCql]]);

    const packageResources: { filename: string; resource: Resource }[] = [];
    const tarEntries: TarEntry[] = [];

    for (const entry of CQL_LIBRARY_CATALOG) {
      let cql = cqlCache.get(entry.id);
      if (!cql) {
        cql = await this.libraries.fetchAppCql(entry.assetPath);
        cqlCache.set(entry.id, cql);
      }
      const relatedArtifacts = parseCqlRelatedArtifacts(cql, PACKAGE_LIBRARY_CANONICAL_BASE);
      const library = this.libraries.buildLibraryFromCql(cql, `${entry.id}.cql`, {
        canonicalBaseUrl: PACKAGE_LIBRARY_CANONICAL_BASE,
        relatedArtifacts,
      });
      const filename = resourceFileName('Library', library.id!);
      packageResources.push({ filename, resource: library });
      tarEntries.push({
        path: `package/${filename}`,
        bytes: encodeUtf8Json(library),
      });
    }

    for (const entry of VALUE_SET_CATALOG) {
      const bundle = await firstValueFrom(this.http.get<Bundle>(entry.assetPath));
      const valueSet = this.extractValueSet(bundle, entry.id);
      const filename = resourceFileName('ValueSet', valueSet.id!);
      packageResources.push({ filename, resource: valueSet });
      tarEntries.push({
        path: `package/${filename}`,
        bytes: encodeUtf8Json(valueSet),
      });
    }

    const packageIndex = buildIndexJson(packageResources);
    tarEntries.push({
      path: 'package/.index.json',
      bytes: encodeUtf8Json(packageIndex),
    });

    const manifest = buildPackageJson(version);
    tarEntries.push({
      path: 'package/package.json',
      bytes: encodeUtf8Json(manifest),
    });

    const exampleResources: { filename: string; resource: Resource }[] = [];
    const patientEntries = EXAMPLE_DATA_CATALOG.filter((e) => e.kind === 'patient');
    for (const entry of patientEntries) {
      if (!entry.resourceId) {
        throw new Error(`Patient example ${entry.id} has no resourceId`);
      }
      // Preserve original asset bytes (avoid pretty-print bloat on ~50MB fixtures).
      const raw = await firstValueFrom(
        this.http.get(entry.assetPath, { responseType: 'text' }),
      );
      const bundle = JSON.parse(raw) as Bundle;
      if (bundle.resourceType !== 'Bundle') {
        throw new Error(`Patient example ${entry.id} is not a Bundle`);
      }
      const filename = resourceFileName('Bundle', entry.resourceId);
      exampleResources.push({ filename, resource: bundle });
      tarEntries.push({
        path: `package/examples/${filename}`,
        bytes: new TextEncoder().encode(raw),
      });
    }

    const examplesIndex = buildIndexJson(exampleResources);
    tarEntries.push({
      path: 'package/examples/.index.json',
      bytes: encodeUtf8Json(examplesIndex),
    });

    tarEntries.sort((a, b) => a.path.localeCompare(b.path));

    const archive = buildTarGz(tarEntries);
    return { archive, filename: packageArchiveFileName(version) };
  }

  private extractValueSet(bundle: Bundle, catalogId: string): ValueSet {
    const resource = bundle.entry?.[0]?.resource;
    if (!resource || resource.resourceType !== 'ValueSet') {
      throw new Error(`ValueSet asset ${catalogId} has no ValueSet resource`);
    }
    if (!resource.id) {
      throw new Error(`ValueSet asset ${catalogId} has no id`);
    }
    return resource as ValueSet;
  }
}
