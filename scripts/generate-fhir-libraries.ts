// Author: Preston Lee

/**
 * Write public/package/Library-*.json from public/package/cql/*.cql for the FHIR NPM package.
 *
 * Usage: npm run generate:fhir-libraries
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Library } from 'fhir/r4';

const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../public/package');
const CQL_DIR = join(PACKAGE_DIR, 'cql');
const INDEX_PATH = join(PACKAGE_DIR, '.index.json');
const LIBRARY_CANONICAL_BASE = 'https://asu.edu/fhir/Library';

interface PackageIndex {
  'index-version': number;
  files: Array<{
    filename: string;
    resourceType?: string;
    id?: string;
    url?: string;
    version?: string;
    type?: string;
  }>;
}

function stripCqlComments(cqlContent: string): string {
  const withoutBlockComments = cqlContent.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlockComments.replace(/^\s*\/\/[^\n\r]*/gm, '');
}

function parseCqlLibraryHeader(cqlContent: string, fileName: string): { name: string; version: string } {
  const stripped = stripCqlComments(cqlContent);
  const match = stripped.match(
    /library\s+(?:"([^"]+)"|'([^']+)'|([A-Za-z_][\w.]*))\s+version\s+['"]([^'"]+)['"]/i,
  );
  const name = match?.[1] || match?.[2] || match?.[3] || fileName.replace(/\.cql$/i, '');
  const version = match?.[4] ?? '0.0.0';
  return { name, version };
}

function libraryDescription(cqlContent: string, libraryName: string): string {
  const match = cqlContent.match(/\/\*([\s\S]*?)\*\//);
  if (!match) {
    return `CQL Library: ${libraryName}`;
  }
  return match[1].trim().replace(/\s+/g, ' ').slice(0, 500);
}

function buildLibraryFromCql(cqlContent: string, fileName: string): Library {
  const { name, version } = parseCqlLibraryHeader(cqlContent, fileName);
  const id = name.replace(/[^A-Za-z0-9.-]/g, '-');
  return {
    resourceType: 'Library',
    id,
    url: `${LIBRARY_CANONICAL_BASE}/${encodeURIComponent(name)}`,
    name,
    title: name,
    status: 'active',
    version,
    description: libraryDescription(cqlContent, name),
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
        data: Buffer.from(cqlContent, 'utf8').toString('base64'),
      },
    ],
  };
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function writeFhirLibraries(): string[] {
  const written: string[] = [];
  const index = JSON.parse(readFileSync(INDEX_PATH, 'utf8')) as PackageIndex;

  for (const fileName of readdirSync(CQL_DIR).filter((n) => n.endsWith('.cql')).sort()) {
    const cql = readFileSync(join(CQL_DIR, fileName), 'utf8');
    const library = buildLibraryFromCql(cql, fileName);
    const filename = `Library-${library.id}.json`;
    writeJson(join(PACKAGE_DIR, filename), library);
    written.push(filename);

    const existing = index.files.find((f) => f.filename === filename);
    const entry = {
      filename,
      resourceType: 'Library' as const,
      id: library.id,
      url: library.url,
      version: library.version,
    };
    if (existing) {
      Object.assign(existing, entry);
    } else {
      index.files.push(entry);
    }
  }

  index.files.sort((a, b) => a.filename.localeCompare(b.filename));
  writeJson(INDEX_PATH, index);
  return written;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  const files = writeFhirLibraries();
  console.log(`Wrote ${files.join(', ')}`);
}
