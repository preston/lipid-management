// Author: Preston Lee

import { gzipSync } from 'fflate';
import { RelatedArtifact, Resource } from 'fhir/r4';

export const PACKAGE_NAME = 'com.prestonlee.fhir.lipid-management';
export const PACKAGE_AUTHOR = 'Preston Lee';
export const PACKAGE_LICENSE = 'Apache-2.0';
export const PACKAGE_FHIR_VERSION = '4.0.1';
export const PACKAGE_LIBRARY_CANONICAL_BASE = 'https://asu.edu/fhir/Library';
export const FHIR_HELPERS_CANONICAL = 'http://hl7.org/fhir/uv/cql/Library/FHIRHelpers';
export const FHIR_MODEL_INFO_CANONICAL = 'http://hl7.org/fhir/uv/cql/Library/FHIR-ModelInfo';

const INDEX_STRING_FIELDS = [
  'resourceType',
  'id',
  'url',
  'version',
  'kind',
  'type',
  'supplements',
  'content',
] as const;

export interface FhirPackageManifest {
  name: string;
  version: string;
  type: string;
  date: string;
  license: string;
  title: string;
  description: string;
  dependencies: Record<string, string>;
  author: string;
  fhirVersions: string[];
}

export interface FhirPackageIndexEntry {
  filename: string;
  resourceType?: string;
  id?: string;
  url?: string;
  version?: string;
  kind?: string;
  type?: string;
  supplements?: string;
  content?: string;
}

export interface FhirPackageIndex {
  'index-version': 2;
  files: FhirPackageIndexEntry[];
}

export interface TarEntry {
  path: string;
  bytes: Uint8Array;
}

export function stripCqlComments(cqlContent: string): string {
  const withoutBlockComments = cqlContent.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlockComments.replace(/^\s*\/\/[^\n\r]*/gm, '');
}

export function parseCqlRelatedArtifacts(
  cqlContent: string,
  libraryCanonicalBase: string = PACKAGE_LIBRARY_CANONICAL_BASE,
): RelatedArtifact[] {
  const stripped = stripCqlComments(cqlContent);
  const resources = new Set<string>();

  const usingMatch = stripped.match(/using\s+FHIR\s+version\s+['"]([^'"]+)['"]/i);
  if (usingMatch) {
    resources.add(`${FHIR_MODEL_INFO_CANONICAL}|${usingMatch[1]}`);
  }

  const includePattern = /include\s+(\w+)\s+version\s+['"]([^'"]+)['"]/gi;
  let includeMatch: RegExpExecArray | null;
  while ((includeMatch = includePattern.exec(stripped)) !== null) {
    const name = includeMatch[1];
    const version = includeMatch[2];
    if (name === 'FHIRHelpers') {
      resources.add(`${FHIR_HELPERS_CANONICAL}|${version}`);
    } else {
      resources.add(`${libraryCanonicalBase}/${name}|${version}`);
    }
  }

  const valuesetPattern = /valueset\s+"[^"]+"\s*:\s*'([^']+)'/gi;
  let valuesetMatch: RegExpExecArray | null;
  while ((valuesetMatch = valuesetPattern.exec(stripped)) !== null) {
    resources.add(valuesetMatch[1]);
  }

  const codesystemPattern = /codesystem\s+"[^"]+"\s*:\s*'([^']+)'/gi;
  let codesystemMatch: RegExpExecArray | null;
  while ((codesystemMatch = codesystemPattern.exec(stripped)) !== null) {
    resources.add(codesystemMatch[1]);
  }

  return [...resources].sort().map((resource) => ({
    type: 'depends-on' as const,
    resource,
  }));
}

export function formatPackageDate(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getUTCFullYear()}` +
    `${pad(date.getUTCMonth() + 1)}` +
    `${pad(date.getUTCDate())}` +
    `${pad(date.getUTCHours())}` +
    `${pad(date.getUTCMinutes())}` +
    `${pad(date.getUTCSeconds())}`
  );
}

export function buildPackageJson(version: string, date: Date = new Date()): FhirPackageManifest {
  return {
    name: PACKAGE_NAME,
    version,
    type: 'Conformance',
    date: formatPackageDate(date),
    license: PACKAGE_LICENSE,
    title: 'Lipid Management CDS',
    description:
      'VA/DoD Lipids CPG 2025 clinical decision support: CQL libraries, terminology ValueSets, and Synthea patient examples for FHIR R4.',
    dependencies: {
      'hl7.fhir.r4.core': PACKAGE_FHIR_VERSION,
      'hl7.fhir.uv.cql': '2.0.0',
    },
    author: PACKAGE_AUTHOR,
    fhirVersions: [PACKAGE_FHIR_VERSION],
  };
}

export function buildIndexEntry(
  filename: string,
  resource: Resource,
): FhirPackageIndexEntry {
  const entry: FhirPackageIndexEntry = { filename };
  const record = resource as unknown as Record<string, unknown>;
  for (const field of INDEX_STRING_FIELDS) {
    const value = record[field];
    if (typeof value === 'string') {
      entry[field] = value;
    }
  }
  return entry;
}

export function buildIndexJson(
  files: { filename: string; resource: Resource }[],
): FhirPackageIndex {
  const entries = files
    .map(({ filename, resource }) => buildIndexEntry(filename, resource))
    .sort((a, b) => a.filename.localeCompare(b.filename));
  return {
    'index-version': 2,
    files: entries,
  };
}

export function resourceFileName(resourceType: string, id: string): string {
  return `${resourceType}-${id}.json`;
}

export function encodeUtf8Json(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
}

function writeOctal(view: DataView, offset: number, value: number, length: number): void {
  const text = value.toString(8).padStart(length - 1, '0') + '\0';
  for (let i = 0; i < length; i++) {
    view.setUint8(offset + i, i < text.length ? text.charCodeAt(i) : 0);
  }
}

function writeString(view: DataView, offset: number, value: string, length: number): void {
  const bytes = new TextEncoder().encode(value);
  const limit = Math.min(bytes.length, length);
  for (let i = 0; i < limit; i++) {
    view.setUint8(offset + i, bytes[i]!);
  }
}

function computeChecksum(header: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < header.length; i++) {
    sum += header[i]!;
  }
  return sum;
}

function createTarHeader(path: string, size: number): Uint8Array {
  const header = new Uint8Array(512);
  const view = new DataView(header.buffer);
  writeString(view, 0, path, 100);
  writeOctal(view, 100, 0o644, 8);
  writeOctal(view, 108, 0, 8);
  writeOctal(view, 116, 0, 8);
  writeOctal(view, 124, size, 12);
  writeOctal(view, 136, Math.floor(Date.now() / 1000), 12);
  writeString(view, 156, '0', 1); // regular file
  writeString(view, 257, 'ustar', 6);
  writeString(view, 263, '00', 2);
  writeString(view, 265, 'user', 32);
  writeString(view, 297, 'user', 32);
  for (let i = 148; i < 156; i++) {
    header[i] = 0x20;
  }
  const checksum = computeChecksum(header);
  const chk = checksum.toString(8).padStart(6, '0');
  for (let i = 0; i < 6; i++) {
    header[148 + i] = chk.charCodeAt(i)!;
  }
  header[154] = 0;
  header[155] = 0x20;
  return header;
}

export function buildTar(entries: TarEntry[]): Uint8Array {
  const blocks: Uint8Array[] = [];
  for (const entry of entries) {
    blocks.push(createTarHeader(entry.path, entry.bytes.length));
    blocks.push(entry.bytes);
    const remainder = entry.bytes.length % 512;
    if (remainder !== 0) {
      blocks.push(new Uint8Array(512 - remainder));
    }
  }
  blocks.push(new Uint8Array(512));
  blocks.push(new Uint8Array(512));

  const totalLength = blocks.reduce((sum, block) => sum + block.length, 0);
  const archive = new Uint8Array(totalLength);
  let offset = 0;
  for (const block of blocks) {
    archive.set(block, offset);
    offset += block.length;
  }
  return archive;
}

export function buildTarGz(entries: TarEntry[]): Uint8Array {
  return gzipSync(buildTar(entries));
}

export function packageArchiveFileName(version: string): string {
  return `${PACKAGE_NAME}-${version}.tgz`;
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  requestAnimationFrame(() => URL.revokeObjectURL(url));
}
