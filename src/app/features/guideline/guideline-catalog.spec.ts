// Author: Preston Lee

import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { APPENDIX_G_BOXES } from './guideline-boxes';
import { GUIDELINE_RECOMMENDATIONS } from './guideline-recommendations';

const ROOT = join(process.cwd());
const PACKAGE_DIR = join(ROOT, 'public/package');
const VALUE_SET_FILES = readdirSync(PACKAGE_DIR).filter(
  (name) => name.startsWith('ValueSet-') && name.endsWith('.json'),
);
const VALID_BOX_IDS = new Set(APPENDIX_G_BOXES.map((b) => b.id));

describe('Guideline terminology and catalog integrity', () => {
  it('ships LipidManagement.cql and keeps recommendation catalog complete', () => {
    expect(existsSync(join(PACKAGE_DIR, 'cql/LipidManagement.cql'))).toBe(true);
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
    expect(
      GUIDELINE_RECOMMENDATIONS.filter((r) => r.strength === 'Strong for').map((r) => r.id),
    ).toEqual([7, 24]);
    expect(GUIDELINE_RECOMMENDATIONS.find((r) => r.id === 22)?.strength).toBe('Weak for');
    expect(GUIDELINE_RECOMMENDATIONS.find((r) => r.id === 23)?.strength).toBe('Weak for');
    expect(GUIDELINE_RECOMMENDATIONS.find((r) => r.id === 8)?.relatedBoxIds).toEqual([12, 11]);
    expect(GUIDELINE_RECOMMENDATIONS.find((r) => r.id === 19)?.text).toMatch(/fibrates/);
    expect(GUIDELINE_RECOMMENDATIONS.find((r) => r.id === 20)?.text).toMatch(
      /fiber, garlic, ginger, green tea, and red yeast rice/,
    );
    expect(GUIDELINE_RECOMMENDATIONS.find((r) => r.id === 14)?.text).toMatch(
      /ezetimibe and PCSK9 inhibitor/,
    );
    expect(GUIDELINE_RECOMMENDATIONS.find((r) => r.id === 14)?.displayNote).toMatch(/peer/);
    expect(GUIDELINE_RECOMMENDATIONS.find((r) => r.id === 24)?.text).toMatch(
      /diagnosis of coronary artery disease/,
    );
    expect(GUIDELINE_RECOMMENDATIONS.find((r) => r.id === 24)?.text).not.toMatch(
      /acute coronary syndrome/i,
    );
    expect(GUIDELINE_RECOMMENDATIONS.find((r) => r.id === 5)?.text).not.toMatch(/lifetime/);
    expect(GUIDELINE_RECOMMENDATIONS.find((r) => r.id === 16)?.text).not.toMatch(/secondary causes/);
  });

  it('has on-disk ValueSet resources', () => {
    expect(VALUE_SET_FILES.length).toBeGreaterThan(10);
    for (const file of VALUE_SET_FILES) {
      const json = JSON.parse(readFileSync(join(PACKAGE_DIR, file), 'utf8')) as {
        resourceType?: string;
        url?: string;
      };
      expect(json.resourceType, file).toBe('ValueSet');
      expect(json.url, file).toBeTruthy();
    }
  });

  it('LipidManagement.cql pins a version and Rec 11/21/24 population rules', () => {
    const cql = readFileSync(join(ROOT, 'public/package/cql/LipidManagement.cql'), 'utf8');
    expect(cql).toMatch(/library LipidManagement version /);
    expect(cql).toContain('parameter ElevatedAstOrAltLessThan3xUln Boolean');
    expect(cql).toContain('parameter EstablishedCvd Boolean');
    expect(cql).toContain('parameter HivInfection Boolean');
    expect(cql).toContain('parameter PrimaryPreventionStatinIndication Boolean');
    expect(cql).toContain('parameter BorderlineRiskBand Boolean');
    expect(cql).toContain('parameter VeryHighRisk Boolean');
    expect(cql).toContain('Coalesce(EstablishedCvd, ChartHasEstablishedCvd)');
    expect(cql).toContain('Coalesce(HivInfection, ChartHasHivInfection)');
    expect(cql).toContain(
      'Coalesce(PrimaryPreventionStatinIndication, ComputedPrimaryPreventionStatinIndicationBox8)',
    );
    expect(cql).toContain('Coalesce(BorderlineRiskBand, ComputedPrimaryPreventionBorderlineRiskBand)');
    expect(cql).toContain('Coalesce(VeryHighRisk, ComputedVeryHighRiskCvd)');
    expect(cql).toContain('define ActiveBox12: ActiveBox10 and not HasHivInfection');
    expect(cql).toMatch(/Rec21Status:\s*\n\s*case when IsAdult then 'Applicable'/);
    expect(cql).not.toMatch(/when ChartSuggestsRecentIndexEvent then 'Applicable'/);
    expect(cql).toContain("VS.code ~ 'entered-in-error'");
    expect(cql).toMatch(/VS.code ~ 'refuted'/);
    expect(cql).toContain('HasStatinIndicationForRec11');
    expect(cql).toContain('BorderlineRiskPatientDesiresStatin is false');
    expect(cql).toMatch(
      /define Rec24Status:[\s\S]*?else 'Informational'\s*\n\s*end/,
    );
    expect(cql).toContain('ToString(date from FHIRHelpers.ToDateTime(value))');
    expect(cql).not.toMatch(/Replace\(/);
    expect(cql).not.toContain('define LatestCabgPciPerformedAt:');
    expect(cql).not.toMatch(/sort by recordedDate/);
    expect(cql).not.toMatch(/sort by performedAt/);
    expect(cql).toContain('define EstablishedCvdEvidence:');
    expect(cql).toContain('define HivInfectionEvidence:');
    expect(cql).toContain('define LatestLdlObservationDate:');
  });

  it('LipidManagement.cql references committed ValueSet URLs', () => {
    const cql = readFileSync(join(ROOT, 'public/package/cql/LipidManagement.cql'), 'utf8');
    const urls = [...cql.matchAll(/valueset\s+"[^"]+"\s*:\s*'([^']+)'/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(10);
    const committedUrls = new Set(
      VALUE_SET_FILES.map((file) => {
        const json = JSON.parse(readFileSync(join(PACKAGE_DIR, file), 'utf8')) as {
          resourceType?: string;
          url?: string;
        };
        return json.resourceType === 'ValueSet' ? json.url : undefined;
      }).filter((url): url is string => Boolean(url)),
    );
    for (const url of urls) {
      expect(committedUrls.has(url), url).toBe(true);
    }
  });
});
