// Author: Preston Lee

import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { VALUE_SET_CATALOG, CQL_LIBRARY_CATALOG } from '../loader/loader.catalog';
import { APPENDIX_G_BOXES } from './guideline-boxes';
import { GUIDELINE_RECOMMENDATIONS } from './guideline-recommendations';

const ROOT = join(process.cwd());
const VALID_BOX_IDS = new Set(APPENDIX_G_BOXES.map((b) => b.id));

describe('Guideline terminology and catalog integrity', () => {
  it('registers LipidManagement and keeps recommendation catalog complete', () => {
    expect(CQL_LIBRARY_CATALOG.some((e) => e.id === 'LipidManagement')).toBe(true);
    expect(GUIDELINE_RECOMMENDATIONS.map((r) => r.id)).toEqual(
      Array.from({ length: 24 }, (_, i) => i + 1),
    );
    for (const rec of GUIDELINE_RECOMMENDATIONS) {
      if (rec.strength === 'Neither for nor against') {
        expect(['2', '6', '9', '17', '20']).toContain(String(rec.id));
      }
      for (const boxId of rec.relatedBoxIds) {
        expect(VALID_BOX_IDS.has(boxId), `Rec ${rec.id} box ${boxId}`).toBe(true);
      }
    }
  });

  it('has on-disk ValueSet bundles for every catalog entry', () => {
    for (const entry of VALUE_SET_CATALOG) {
      const path = join(ROOT, 'public', entry.assetPath.replace(/^\//, ''));
      expect(existsSync(path), entry.id).toBe(true);
      const json = JSON.parse(readFileSync(path, 'utf8')) as {
        resourceType?: string;
        entry?: { resource?: { resourceType?: string; url?: string } }[];
      };
      expect(json.resourceType).toBe('Bundle');
      const vs = json.entry?.find((e) => e.resource?.resourceType === 'ValueSet')?.resource;
      expect(vs?.url, entry.id).toBeTruthy();
    }
  });

  it('LipidManagement.cql references committed ValueSet URLs', () => {
    const cql = readFileSync(join(ROOT, 'public/cql/LipidManagement.cql'), 'utf8');
    const urls = [...cql.matchAll(/valueset\s+"[^"]+"\s*:\s*'([^']+)'/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(10);
    for (const url of urls) {
      const match = VALUE_SET_CATALOG.find((e) => {
        const path = join(ROOT, 'public', e.assetPath.replace(/^\//, ''));
        const json = JSON.parse(readFileSync(path, 'utf8')) as {
          entry?: { resource?: { resourceType?: string; url?: string } }[];
        };
        return json.entry?.some(
          (x) => x.resource?.resourceType === 'ValueSet' && x.resource.url === url,
        );
      });
      expect(match, url).toBeTruthy();
    }
  });
});
