// Author: Preston Lee

import { APPENDIX_G_BOXES, boxMeta, formatBoxLabel } from './guideline-boxes';
import type {
  GuidelineClinicianAnswers,
  GuidelineEvaluationView,
  TriState,
} from './guideline.model';

export type DiagramNodeState = 'active' | 'unresolved' | 'idle';

export interface GuidelineDiagramNode {
  id: number;
  state: DiagramNodeState;
  subtitle: string | null;
  tooltip: string;
}

export interface GuidelineDiagramEdge {
  from: number;
  to: number;
  baseLabel: string;
  emphasisLabel: string | null;
  taken: boolean;
}

export interface GuidelineDiagramModel {
  nodes: GuidelineDiagramNode[];
  edges: GuidelineDiagramEdge[];
}

interface StaticEdge {
  from: number;
  to: number;
  baseLabel: string;
}

/** Topology matches Appendix G (Mermaid visualization only; CQL is source of truth). */
const STATIC_EDGES: readonly StaticEdge[] = [
  { from: 1, to: 2, baseLabel: '' },
  { from: 2, to: 3, baseLabel: '' },
  { from: 3, to: 4, baseLabel: 'Yes' },
  { from: 3, to: 5, baseLabel: 'No' },
  { from: 5, to: 6, baseLabel: 'Yes' },
  { from: 6, to: 7, baseLabel: '' },
  { from: 7, to: 17, baseLabel: 'Yes' },
  { from: 7, to: 16, baseLabel: 'No' },
  { from: 17, to: 18, baseLabel: '' },
  { from: 18, to: 19, baseLabel: 'Yes' },
  { from: 18, to: 20, baseLabel: 'No' },
  { from: 19, to: 20, baseLabel: '' },
  { from: 16, to: 20, baseLabel: '' },
  { from: 20, to: 21, baseLabel: '' },
  { from: 5, to: 8, baseLabel: 'No' },
  { from: 8, to: 9, baseLabel: 'Yes' },
  { from: 9, to: 15, baseLabel: '' },
  { from: 15, to: 21, baseLabel: '' },
  { from: 8, to: 10, baseLabel: 'No' },
  { from: 10, to: 11, baseLabel: 'Yes' },
  { from: 11, to: 15, baseLabel: '' },
  { from: 10, to: 12, baseLabel: 'No' },
  { from: 12, to: 11, baseLabel: 'Yes' },
  { from: 12, to: 13, baseLabel: 'No' },
  { from: 13, to: 14, baseLabel: '' },
  { from: 14, to: 21, baseLabel: '' },
];

function fmtTriState(value: TriState): string {
  if (value === 'yes') {
    return 'Yes';
  }
  if (value === 'no') {
    return 'No';
  }
  return 'Unknown';
}

function fmtMgDl(value: number | null): string {
  return value != null ? `${Math.round(value)} mg/dL` : 'LDL —';
}

function fmtPct(value: number | null): string {
  return value != null ? `${value.toFixed(1)}%` : '10y —';
}

function fmtBool(value: boolean): string {
  return value ? 'Yes' : 'No';
}

function box8Factors(view: GuidelineEvaluationView): string[] {
  const parts: string[] = [];
  if (view.effectiveDiabetes === true) {
    parts.push('DM');
  } else if (view.effectiveDiabetes === false) {
    parts.push('no DM');
  } else {
    parts.push('DM ?');
  }
  parts.push(fmtMgDl(view.latestLdlMgDl));
  parts.push(fmtPct(view.tenYearTotalCvdPercent));
  if (view.box8UsedNullPreventRisk) {
    parts.push('risk n/a');
  }
  return parts;
}

function box7Subtitle(view: GuidelineEvaluationView, answers: GuidelineClinicianAnswers): string {
  const effectiveLlt =
    view.effectiveOnLipidLoweringTherapy == null
      ? 'Unknown'
      : fmtBool(view.effectiveOnLipidLoweringTherapy);
  const vhr = view.veryHighRiskCvd == null ? 'Unknown' : fmtBool(view.veryHighRiskCvd);
  const parts = [`VHR ${vhr}`, `LLT ${effectiveLlt}`];
  if (answers.veryHighRiskRecentAcsOrMiOnTherapy === 'yes') {
    parts.push('recent ACS/MI');
  }
  if (answers.veryHighRiskRecurrentEventsOnTherapy === 'yes') {
    parts.push('recurrent events');
  }
  if (view.latestLdlMgDl != null) {
    parts.push(`LDL ${Math.round(view.latestLdlMgDl)}`);
  }
  if (view.veryHighRiskCvd == null) {
    parts.push(
      `ACS/MI ${fmtTriState(answers.veryHighRiskRecentAcsOrMiOnTherapy)}`,
      `recurrent ${fmtTriState(answers.veryHighRiskRecurrentEventsOnTherapy)}`,
    );
  }
  return parts.join('; ');
}

function nodeSubtitle(
  id: number,
  state: DiagramNodeState,
  view: GuidelineEvaluationView,
  answers: GuidelineClinicianAnswers,
): string | null {
  if (state === 'idle') {
    return null;
  }
  const meta = boxMeta(id);
  if (meta.kind === 'action') {
    return null;
  }
  switch (id) {
    case 1: {
      const age =
        view.effectiveAgeYears != null
          ? `Age ${Math.round(view.effectiveAgeYears)}`
          : 'Age unknown';
      return `${age}; ${view.algorithmStatus === 'NotAdult' ? 'not adult' : 'adult'}`;
    }
    case 3:
      return fmtTriState(answers.lifeExpectancyLimitedUnder5Years);
    case 5:
      return fmtBool(view.hasEstablishedCvd);
    case 7:
      return box7Subtitle(view, answers);
    case 8:
      return box8Factors(view).join('; ');
    case 10:
      return fmtBool(view.hasHivInfection);
    case 12: {
      const risk = fmtPct(view.tenYearTotalCvdPercent);
      const desire = fmtTriState(answers.borderlineRiskPatientDesiresStatin);
      return `${risk}; desire ${desire}`;
    }
    case 18:
      return fmtTriState(answers.escalationNeeded);
    default:
      return null;
  }
}

function nodeTooltip(id: number, state: DiagramNodeState, subtitle: string | null): string {
  const meta = boxMeta(id);
  const parts = [`${formatBoxLabel(id)}: ${meta.title}`, `Status: ${state}`];
  if (subtitle) {
    parts.push(subtitle);
  }
  return parts.join(' — ');
}

function edgeKey(from: number, to: number, baseLabel: string): string {
  return `${from}|${baseLabel}|${to}`;
}

/**
 * Taken labeled branches from AlgorithmPath only (display projection).
 * Avoids ActiveBox membership, which fails when paths converge (e.g. Box 10→12→11).
 */
function takenEdgesForAlgorithmPath(algorithmPath: string): ReadonlySet<string> {
  const keys = (edges: Array<[number, string, number]>): Set<string> =>
    new Set(edges.map(([from, label, to]) => edgeKey(from, to, label)));

  switch (algorithmPath) {
    case 'Box4_DiscussUncertainBenefitLimitedLifeExpectancy':
      return keys([
        [1, '', 2],
        [2, '', 3],
        [3, 'Yes', 4],
      ]);
    case 'NeedsClinicalInput_LifeExpectancy':
      return keys([
        [1, '', 2],
        [2, '', 3],
      ]);
    case 'NeedsClinicalInput_VeryHighRisk':
      return keys([
        [1, '', 2],
        [2, '', 3],
        [3, 'No', 5],
        [5, 'Yes', 6],
        [6, '', 7],
      ]);
    case 'NeedsClinicalInput_Escalation':
      return keys([
        [1, '', 2],
        [2, '', 3],
        [3, 'No', 5],
        [5, 'Yes', 6],
        [6, '', 7],
        [7, 'Yes', 17],
        [17, '', 18],
      ]);
    case 'Box19_SecondaryVeryHighRiskTripleTherapy':
      return keys([
        [1, '', 2],
        [2, '', 3],
        [3, 'No', 5],
        [5, 'Yes', 6],
        [6, '', 7],
        [7, 'Yes', 17],
        [17, '', 18],
        [18, 'Yes', 19],
        [19, '', 20],
        [20, '', 21],
      ]);
    case 'Box17_SecondaryVeryHighRiskInitialCombination':
      return keys([
        [1, '', 2],
        [2, '', 3],
        [3, 'No', 5],
        [5, 'Yes', 6],
        [6, '', 7],
        [7, 'Yes', 17],
        [17, '', 18],
        [18, 'No', 20],
        [20, '', 21],
      ]);
    case 'Box16_SecondaryStandardRiskThreeOptions':
      return keys([
        [1, '', 2],
        [2, '', 3],
        [3, 'No', 5],
        [5, 'Yes', 6],
        [6, '', 7],
        [7, 'No', 16],
        [16, '', 20],
        [20, '', 21],
      ]);
    case 'Box9_PrimaryAtLeastModerateStatinConsiderLipidSpecialistIfLdlGe190':
      return keys([
        [1, '', 2],
        [2, '', 3],
        [3, 'No', 5],
        [5, 'No', 8],
        [8, 'Yes', 9],
        [9, '', 15],
        [15, '', 21],
      ]);
    case 'Box11_PrimaryModerateStatinHiv':
      return keys([
        [1, '', 2],
        [2, '', 3],
        [3, 'No', 5],
        [5, 'No', 8],
        [8, 'No', 10],
        [10, 'Yes', 11],
        [11, '', 15],
        [15, '', 21],
      ]);
    case 'NeedsClinicalInput_BorderlineDesire':
      return keys([
        [1, '', 2],
        [2, '', 3],
        [3, 'No', 5],
        [5, 'No', 8],
        [8, 'No', 10],
        [10, 'No', 12],
      ]);
    case 'Box11_PrimaryModerateStatinBorderlineRiskPatientPreference':
      return keys([
        [1, '', 2],
        [2, '', 3],
        [3, 'No', 5],
        [5, 'No', 8],
        [8, 'No', 10],
        [10, 'No', 12],
        [12, 'Yes', 11],
        [11, '', 15],
        [15, '', 21],
      ]);
    case 'Box13_14_NoMedicationRepeatRiskEvery5YearsUnlessNewRiskFactors':
      return keys([
        [1, '', 2],
        [2, '', 3],
        [3, 'No', 5],
        [5, 'No', 8],
        [8, 'No', 10],
        [10, 'No', 12],
        [12, 'No', 13],
        [13, '', 14],
        [14, '', 21],
      ]);
    case 'Box1_NotAdultOutsideAlgorithm':
    case 'OutsideGuidelinePopulation':
    case 'NeedsClinicalInput':
    default:
      return keys([[1, '', 2]]);
  }
}

function edgeIsTaken(edge: StaticEdge, taken: ReadonlySet<string>): boolean {
  return taken.has(edgeKey(edge.from, edge.to, edge.baseLabel));
}

function edgeEmphasisLabel(
  edge: StaticEdge,
  taken: boolean,
  view: GuidelineEvaluationView,
): string | null {
  if (!taken || !edge.baseLabel) {
    return null;
  }
  if (edge.from === 8 && edge.baseLabel === 'Yes') {
    const hits: string[] = [];
    if (view.effectiveDiabetes === true) {
      hits.push('DM');
    }
    if (view.latestLdlMgDl != null && view.latestLdlMgDl >= 190) {
      hits.push('LDL≥190');
    }
    if (view.tenYearTotalCvdPercent != null && view.tenYearTotalCvdPercent >= 10) {
      hits.push('risk≥10%');
    }
    if (hits.length) {
      return `Yes · ${hits.join(', ')}`;
    }
  }
  return edge.baseLabel;
}

export function buildGuidelineDiagramModel(
  view: GuidelineEvaluationView,
  answers: GuidelineClinicianAnswers,
): GuidelineDiagramModel {
  const active = new Set(view.activeBoxes);
  const unresolved = new Set(view.unresolvedBoxes);

  const nodes: GuidelineDiagramNode[] = APPENDIX_G_BOXES.map((meta) => {
    let state: DiagramNodeState = 'idle';
    if (unresolved.has(meta.id)) {
      state = 'unresolved';
    } else if (active.has(meta.id)) {
      state = 'active';
    }
    const subtitle = nodeSubtitle(meta.id, state, view, answers);
    return {
      id: meta.id,
      state,
      subtitle,
      tooltip: nodeTooltip(meta.id, state, subtitle),
    };
  });

  const taken = takenEdgesForAlgorithmPath(view.algorithmPath);
  const edges: GuidelineDiagramEdge[] = STATIC_EDGES.map((edge) => {
    const isTaken = edgeIsTaken(edge, taken);
    return {
      from: edge.from,
      to: edge.to,
      baseLabel: edge.baseLabel,
      emphasisLabel: edgeEmphasisLabel(edge, isTaken, view),
      taken: isTaken,
    };
  });

  return { nodes, edges };
}

function escapeMermaidLabel(text: string): string {
  return text.replace(/"/g, "'").replace(/\n/g, '\\n');
}

/** Mermaid markdown strings support **bold** and real newlines, not `\n` or horizontal rules. */
function mermaidNodeLabel(node: GuidelineDiagramNode): string {
  const meta = boxMeta(node.id);
  const heading = [`Box ${node.id}`, meta.title];
  if (!node.subtitle) {
    return escapeMermaidLabel(heading.join('\\n'));
  }
  const blurb = node.subtitle.replace(/[*_`]/g, '');
  const markdown = [...heading, '', `**${blurb}**`].join('\n').replace(/"/g, "'");
  return `\`${markdown}\``;
}

function mermaidNodeLine(node: GuidelineDiagramNode): string {
  const label = mermaidNodeLabel(node);
  const meta = boxMeta(node.id);
  if (meta.kind === 'start') {
    return `B${node.id}(["${label}"])`;
  }
  if (meta.kind === 'decision') {
    return `B${node.id}{{"${label}"}}`;
  }
  return `B${node.id}["${label}"]`;
}

function mermaidEdgeLine(edge: GuidelineDiagramEdge): string {
  const from = `B${edge.from}`;
  const to = `B${edge.to}`;
  const label = edge.emphasisLabel ?? edge.baseLabel;
  if (!label) {
    return `${from} --> ${to}`;
  }
  return `${from} -->|${escapeMermaidLabel(label)}| ${to}`;
}

const LINK_TAKEN_STYLE = 'stroke:#2196f3,stroke-width:2px';
const LINK_IDLE_STYLE = 'stroke:#adb5bd,stroke-width:1px';

function mermaidLinkStyleLines(edges: readonly GuidelineDiagramEdge[]): string[] {
  const takenIdx: number[] = [];
  const idleIdx: number[] = [];
  edges.forEach((edge, index) => {
    if (edge.taken) {
      takenIdx.push(index);
    } else {
      idleIdx.push(index);
    }
  });
  const lines: string[] = [];
  if (takenIdx.length) {
    lines.push(`linkStyle ${takenIdx.join(',')} ${LINK_TAKEN_STYLE}`);
  }
  if (idleIdx.length) {
    lines.push(`linkStyle ${idleIdx.join(',')} ${LINK_IDLE_STYLE}`);
  }
  return lines;
}

/** Serialize a diagram model to a Mermaid flowchart definition. */
export function toMermaidDefinition(model: GuidelineDiagramModel): string {
  const classLines = model.nodes.map((n) => `class B${n.id} ${n.state}`);
  const nodeLines = model.nodes.map(mermaidNodeLine);
  const edgeLines = model.edges.map(mermaidEdgeLine);
  const linkStyleLines = mermaidLinkStyleLines(model.edges);

  return `
flowchart TD
  ${nodeLines.join('\n  ')}

  ${edgeLines.join('\n  ')}

  ${classLines.join('\n  ')}
  ${linkStyleLines.join('\n  ')}
`.trim();
}

/** Keep only boxes on the active / unresolved path and edges between them. */
export function filterDiagramModelToPath(
  model: GuidelineDiagramModel,
  boxIds: ReadonlySet<number>,
): GuidelineDiagramModel {
  const nodes = model.nodes.filter((node) => boxIds.has(node.id));
  if (nodes.length === 0) {
    return model;
  }
  const kept = new Set(nodes.map((node) => node.id));
  return {
    nodes,
    edges: model.edges.filter((edge) => kept.has(edge.from) && kept.has(edge.to)),
  };
}

/** Convenience: build model then serialize (for callers that only need the string). */
export function buildGuidelineMermaidDefinition(
  view: GuidelineEvaluationView,
  answers: GuidelineClinicianAnswers,
): string {
  return toMermaidDefinition(buildGuidelineDiagramModel(view, answers));
}

export function orderedPathDescription(
  activeBoxes: number[],
  unresolvedBoxes: number[],
  algorithmPath: string,
): string {
  const parts = activeBoxes.map((n) => formatBoxLabel(n));
  if (unresolvedBoxes.length) {
    parts.push(`unresolved decision at ${unresolvedBoxes.map(formatBoxLabel).join(', ')}`);
  }
  parts.push(`path ${algorithmPath}`);
  return parts.join('; ');
}
