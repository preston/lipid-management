// Author: Preston Lee

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Bundle, Library, Resource } from 'fhir/r4';

/** Same rules CQL Studio uses in validateFhirPackageJson. */
const FHIR_PACKAGE_NAME_PATTERN = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;
const FHIR_PACKAGE_VERSION_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const PACKAGE_DIR = join(process.cwd(), 'public/package');

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

interface PackageManifest {
  name?: string;
  version?: string;
  author?: string;
  description?: string;
  type?: string;
  dependencies?: Record<string, string>;
  directories?: { examples?: string };
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

describe('FHIR package layout for CQL Studio importer', () => {
  const manifest = readJson<PackageManifest>(join(PACKAGE_DIR, 'package.json'));
  const index = readJson<PackageIndex>(join(PACKAGE_DIR, '.index.json'));

  it('has a FHIR-compliant package.json', () => {
    expect(manifest.name).toMatch(FHIR_PACKAGE_NAME_PATTERN);
    expect(manifest.version).toMatch(FHIR_PACKAGE_VERSION_PATTERN);
    expect(manifest.author?.trim()).toBeTruthy();
    expect(manifest.description?.trim()).toBeTruthy();
    expect(manifest.type).toBe('Conformance');
    expect(manifest.directories?.examples).toBe('examples');
    const deps = Object.keys(manifest.dependencies ?? {});
    expect(deps.some((k) => /^hl7\.fhir\.r\d+\.core$/i.test(k))).toBe(true);
  });

  it('indexes every JSON resource as ResourceType-id.json', () => {
    expect(index['index-version']).toBe(2);
    const indexed = new Set(index.files.map((f) => f.filename));
    const rootJson = readdirSync(PACKAGE_DIR).filter(
      (name) => name.endsWith('.json') && name !== 'package.json' && name !== '.index.json',
    );
    for (const name of rootJson) {
      expect(indexed.has(name), `root .index.json missing ${name}`).toBe(true);
      const resource = readJson<Resource>(join(PACKAGE_DIR, name));
      expect(name).toBe(`${resource.resourceType}-${resource.id}.json`);
    }

    const exampleFiles = readdirSync(join(PACKAGE_DIR, 'examples')).filter((name) =>
      name.endsWith('.json'),
    );
    for (const name of exampleFiles) {
      expect(indexed.has(`examples/${name}`), `root .index.json missing examples/${name}`).toBe(
        true,
      );
      const bundle = readJson<Bundle>(join(PACKAGE_DIR, 'examples', name));
      expect(bundle.resourceType).toBe('Bundle');
      expect(name).toBe(`Bundle-${bundle.id}.json`);
    }

    for (const entry of index.files) {
      const resource = readJson<Resource>(join(PACKAGE_DIR, entry.filename));
      expect(entry.resourceType).toBe(resource.resourceType);
      expect(entry.id).toBe(resource.id);
    }
  });

  it('resolves every example Bundle reference without HAPI placeholders or match URLs', () => {
    const exampleDir = join(PACKAGE_DIR, 'examples');
    const exampleFiles = readdirSync(exampleDir).filter((name) => name.endsWith('.json'));
    expect(exampleFiles.length).toBeGreaterThan(0);

    for (const name of exampleFiles) {
      const bundle = readJson<Bundle>(join(exampleDir, name));
      const dangling = collectUnresolvableRefs(bundle);
      expect(dangling, `${name} has unresolved transaction references`).toEqual([]);
    }
  });

  it('ships Library JSON whose text/cql attachment matches authored .cql', () => {
    const cqlByContent = new Map(
      readdirSync(join(PACKAGE_DIR, 'cql'))
        .filter((name) => name.endsWith('.cql'))
        .map((name) => [readFileSync(join(PACKAGE_DIR, 'cql', name), 'utf8'), name]),
    );
    const libraryFiles = readdirSync(PACKAGE_DIR).filter(
      (name) => name.startsWith('Library-') && name.endsWith('.json'),
    );
    expect(libraryFiles.length).toBe(cqlByContent.size);
    for (const name of libraryFiles) {
      const library = readJson<Library>(join(PACKAGE_DIR, name));
      expect(library.resourceType).toBe('Library');
      expect(library.status).toBe('active');
      expect(library.type?.coding?.some((c) => c.code === 'logic-library')).toBe(true);
      const data = library.content?.find((c) => c.contentType === 'text/cql')?.data;
      expect(data).toBeTruthy();
      const cql = Buffer.from(data!, 'base64').toString('utf8');
      expect(cqlByContent.has(cql), `${name} CQL does not match public/package/cql`).toBe(true);
    }
  });
});

/**
 * HAPI-0541: urn:uuid references must match an entry.fullUrl.
 * HAPI-1091: Type?search=... conditional matches must already exist on the server.
 */
function collectUnresolvableRefs(bundle: Bundle): string[] {
  const knownFullUrls = new Set(
    (bundle.entry ?? []).map((e) => e.fullUrl).filter((u): u is string => Boolean(u)),
  );
  const knownTypeIds = new Set(
    (bundle.entry ?? [])
      .map((e) => e.resource)
      .filter((r): r is Resource => Boolean(r?.resourceType && r.id))
      .map((r) => `${r.resourceType}/${r.id}`),
  );
  const dangling: string[] = [];
  walk(bundle);
  return dangling;

  function walk(node: unknown): void {
    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item);
      }
      return;
    }
    if (node == null || typeof node !== 'object') {
      return;
    }
    const obj = node as Record<string, unknown>;
    const ref = obj['reference'];
    if (typeof ref === 'string' && isUnresolvableTransactionRef(ref, knownFullUrls, knownTypeIds)) {
      dangling.push(ref);
    }
    for (const child of Object.values(obj)) {
      walk(child);
    }
  }
}

function isUnresolvableTransactionRef(
  ref: string,
  knownFullUrls: Set<string>,
  knownTypeIds: Set<string>,
): boolean {
  if (ref.startsWith('urn:uuid:')) {
    return !knownFullUrls.has(ref);
  }
  if (ref.includes('?')) {
    return true;
  }
  const relative = /^([A-Za-z]+)\/([^/?#]+)$/.exec(ref);
  if (relative) {
    return !knownTypeIds.has(`${relative[1]}/${relative[2]}`) && !knownFullUrls.has(ref);
  }
  return false;
}
